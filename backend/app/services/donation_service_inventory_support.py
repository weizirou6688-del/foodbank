from __future__ import annotations

from datetime import date, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db_utils import fetch_one_or_none, fetch_rows, fetch_scalars
from app.core.goods_donation_format import parse_goods_pickup_date
from app.models.donation_goods import DonationGoods
from app.models.donation_goods_item import DonationGoodsItem
from app.models.inventory_item import InventoryItem
from app.models.inventory_lot import InventoryLot
from app.models.restock_request import RestockRequest
from app.routers._shared import require_by_id
from app.schemas.donation_goods import (
    DonationGoodsItemCreatePayload,
    SupermarketDonationItemPayload,
)


DEFAULT_INVENTORY_CATEGORY = "Canned Goods"
DEFAULT_INVENTORY_UNIT = "units"


async def resolve_or_create_inventory_item(
    item_name: str,
    food_bank_id: int | None,
    db: AsyncSession,
) -> InventoryItem:
    if food_bank_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Received goods donations must target a specific food bank",
        )

    normalized_name = item_name.strip()
    for query in (
        select(InventoryItem).where(func.lower(InventoryItem.name) == normalized_name.lower()),
        select(InventoryItem)
        .where(func.lower(InventoryItem.name).like(f"{normalized_name.lower()}%"))
        .order_by(InventoryItem.id),
    ):
        inventory_item = await fetch_one_or_none(
            db,
            query.where(InventoryItem.food_bank_id == food_bank_id),
        )
        if inventory_item is not None and inventory_item.food_bank_id == food_bank_id:
            return inventory_item

    item = InventoryItem(
        name=normalized_name,
        category=DEFAULT_INVENTORY_CATEGORY,
        unit=DEFAULT_INVENTORY_UNIT,
        threshold=10,
        food_bank_id=food_bank_id,
    )
    db.add(item)
    await db.flush()
    return item


async def sync_goods_donation_inventory(
    donation: DonationGoods,
    db: AsyncSession,
    items: list[DonationGoodsItem | DonationGoodsItemCreatePayload] | None = None,
) -> None:
    if donation.food_bank_id is None:
        return

    received_date = parse_goods_pickup_date(donation.pickup_date) or date.today()
    donation_items = items if items is not None else list(donation.items)
    resolved_items = [
        (
            item,
            await resolve_or_create_inventory_item(
                item.item_name,
                donation.food_bank_id,
                db,
            ),
        )
        for item in donation_items
    ]
    db.add_all(
        [
            inventory_lot(
                inventory_item_id=inventory_item.id,
                quantity=item.quantity,
                received_date=received_date,
                expiry_date=item.expiry_date or (received_date + timedelta(days=365)),
                batch_reference=f"donation-{donation.id}",
            )
            for item, inventory_item in resolved_items
        ],
    )

    await db.flush()


def goods_donation_item(
    donation: DonationGoods,
    *,
    item_name: str,
    quantity: int,
    expiry_date: date | None,
) -> DonationGoodsItem:
    return DonationGoodsItem(
        donation_id=donation.id,
        donation=donation,
        item_name=item_name,
        quantity=quantity,
        expiry_date=expiry_date,
    )


def inventory_lot(
    *,
    inventory_item_id: int,
    quantity: int,
    received_date: date,
    expiry_date: date,
    batch_reference: str,
) -> InventoryLot:
    return InventoryLot(
        inventory_item_id=inventory_item_id,
        quantity=quantity,
        received_date=received_date,
        expiry_date=expiry_date,
        batch_reference=batch_reference,
    )


async def resolve_supermarket_inventory_item(
    item_in: SupermarketDonationItemPayload,
    db: AsyncSession,
) -> InventoryItem:
    if item_in.inventory_item_id is not None:
        inventory_item = await require_by_id(
            db,
            InventoryItem,
            item_in.inventory_item_id,
            detail=f"Inventory item #{item_in.inventory_item_id} not found",
        )
        if inventory_item.food_bank_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inventory item must belong to a specific food bank",
            )
        return inventory_item

    normalized_name = (item_in.item_name or "").strip()
    inventory_item = await fetch_one_or_none(
        db,
        select(InventoryItem)
        .where(
            func.lower(InventoryItem.name) == normalized_name.lower(),
            InventoryItem.food_bank_id.is_not(None),
        )
        .order_by(InventoryItem.id),
    )
    if inventory_item is None or inventory_item.food_bank_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Inventory item '{normalized_name}' does not exist. "
                "Choose a low-stock item or enter an exact inventory name."
            ),
        )
    return inventory_item


async def sync_supermarket_restock_requests(
    inventory_item_ids: set[int],
    db: AsyncSession,
) -> None:
    if not inventory_item_ids:
        return

    stock_rows = await fetch_rows(
        db,
        select(
            InventoryLot.inventory_item_id,
            func.coalesce(func.sum(InventoryLot.quantity), 0).label("total_stock"),
        )
        .where(
            InventoryLot.inventory_item_id.in_(inventory_item_ids),
            InventoryLot.deleted_at.is_(None),
            InventoryLot.expiry_date >= date.today(),
        )
        .group_by(InventoryLot.inventory_item_id),
    )
    stock_by_item_id = {row[0]: int(row[1] or 0) for row in stock_rows}

    open_requests = await fetch_scalars(
        db,
        select(RestockRequest).where(
            RestockRequest.inventory_item_id.in_(inventory_item_ids),
            RestockRequest.status == "open",
        ),
    )

    for request in open_requests:
        latest_stock = stock_by_item_id.get(request.inventory_item_id, 0)
        request.current_stock = latest_stock
        if latest_stock >= request.threshold:
            request.status = "fulfilled"

    await db.flush()


async def append_goods_donation_items(
    donation: DonationGoods,
    items: list[DonationGoodsItemCreatePayload],
    db: AsyncSession,
) -> list[DonationGoodsItem]:
    created_items = [
        goods_donation_item(
            donation,
            item_name=item.item_name,
            quantity=item.quantity,
            expiry_date=item.expiry_date,
        )
        for item in items
    ]
    db.add_all(created_items)
    await db.flush()
    return created_items


async def replace_goods_donation_items(
    donation: DonationGoods,
    items: list[DonationGoodsItemCreatePayload],
    db: AsyncSession,
) -> None:
    donation.items = [
        goods_donation_item(
            donation,
            item_name=item.item_name,
            quantity=item.quantity,
            expiry_date=item.expiry_date,
        )
        for item in items
    ]
    await db.flush()