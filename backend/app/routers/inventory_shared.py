from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database_errors import run_guarded_action, run_guarded_transaction
from app.core.db_utils import fetch_one_or_none, flush_refresh
from app.core.security import enforce_admin_food_bank_scope
from app.models.inventory_item import InventoryItem
from app.models.inventory_lot import InventoryLot
from app.routers._shared import require_by_id, require_scoped_by_id
from app.schemas.inventory_item import InventoryItemOut, StockAdjustment
from app.schemas.inventory_lot import InventoryLotOut
from app.services.inventory_service import consume_inventory_lots


def future_expiry_date() -> date:
    return date.today() + timedelta(days=365)


def active_inventory_lot_filters():
    return InventoryLot.deleted_at.is_(None), InventoryLot.expiry_date >= date.today()


def serialize_inventory_lot_row(lot: InventoryLot, item_name: str) -> InventoryLotOut:
    status_value = (
        "wasted"
        if lot.deleted_at is not None
        else "expired" if lot.expiry_date < date.today() else "active"
    )
    return InventoryLotOut(
        id=lot.id,
        inventory_item_id=lot.inventory_item_id,
        item_name=item_name,
        quantity=lot.quantity,
        expiry_date=lot.expiry_date,
        received_date=lot.received_date,
        batch_reference=lot.batch_reference,
        status=status_value,
        deleted_at=lot.deleted_at,
    )


async def get_inventory_item_for_admin(
    db: AsyncSession,
    item_id: int,
    admin_user: dict,
    *,
    detail: str,
) -> InventoryItem:
    return await require_scoped_by_id(
        db,
        InventoryItem,
        item_id,
        admin_user,
        detail=detail,
        not_found_detail="Inventory item not found",
    )


async def get_inventory_lot_for_admin(
    db: AsyncSession,
    lot_id: int,
    admin_user: dict,
    *,
    detail: str,
) -> tuple[InventoryLot, InventoryItem]:
    lot = await require_by_id(
        db,
        InventoryLot,
        lot_id,
        detail="Inventory lot not found",
    )
    inventory_item = await require_by_id(
        db,
        InventoryItem,
        lot.inventory_item_id,
        detail="Inventory item not found for lot",
    )

    enforce_admin_food_bank_scope(
        admin_user,
        inventory_item.food_bank_id,
        detail=detail,
    )
    return lot, inventory_item


async def get_total_stock_for_item(db: AsyncSession, item_id: int) -> int:
    return int((await fetch_one_or_none(
        db,
        select(func.coalesce(func.sum(InventoryLot.quantity), 0)).where(
            InventoryLot.inventory_item_id == item_id,
            *active_inventory_lot_filters(),
        ),
    )) or 0)


async def serialize_inventory_item(db: AsyncSession, item: InventoryItem) -> InventoryItemOut:
    total_stock = await get_total_stock_for_item(db, item.id)
    updated_at = item.updated_at or datetime.now(timezone.utc)
    return InventoryItemOut(
        id=item.id,
        name=item.name,
        category=item.category,
        stock=total_stock,
        total_stock=total_stock,
        unit=item.unit,
        threshold=item.threshold,
        food_bank_id=item.food_bank_id,
        updated_at=updated_at,
    )


async def flush_refresh_serialize_inventory_item(
    db: AsyncSession,
    item: InventoryItem,
) -> InventoryItemOut:
    return await serialize_inventory_item(db, await flush_refresh(db, item))


async def run_inventory_action(action, *, failure_detail: str):
    return await run_guarded_action(action, failure_detail=failure_detail)


async def run_inventory_transaction(
    db: AsyncSession,
    action,
    *,
    failure_detail: str,
    conflict_detail: str | None = None,
):
    return await run_guarded_transaction(
        db,
        action,
        failure_detail=failure_detail,
        conflict_detail=conflict_detail,
    )


async def change_inventory_item_stock(
    db: AsyncSession,
    item_id: int,
    adjustment_in: StockAdjustment,
    admin_user: dict,
    *,
    stock_in: bool,
) -> InventoryItemOut:
    item = await get_inventory_item_for_admin(
        db,
        item_id,
        admin_user,
        detail="You can only manage inventory items for your assigned food bank",
    )

    if stock_in:
        db.add(
            InventoryLot(
                inventory_item_id=item.id,
                quantity=adjustment_in.quantity,
                received_date=date.today(),
                expiry_date=adjustment_in.expiry_date or future_expiry_date(),
                batch_reference=adjustment_in.reason[:100],
            )
        )
    else:
        try:
            await consume_inventory_lots(item.id, adjustment_in.quantity, db)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

    return await flush_refresh_serialize_inventory_item(db, item)


async def run_stock_adjustment(
    db: AsyncSession,
    item_id: int,
    adjustment_in: StockAdjustment,
    admin_user: dict,
    *,
    stock_in: bool,
    failure_detail: str,
) -> InventoryItemOut:
    async def action() -> InventoryItemOut:
        return await change_inventory_item_stock(
            db,
            item_id,
            adjustment_in,
            admin_user,
            stock_in=stock_in,
        )

    return await run_inventory_transaction(db, action, failure_detail=failure_detail)
