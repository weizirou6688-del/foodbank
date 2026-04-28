"""Goods donation 业务流程。

三种来源:公众捐赠者(自助提交)、超市合作伙伴(批量)、管理员补录。
落地后建 InventoryLot 进库存,带 expiry_date。

TODO: supermarket 那一块的批量接口还在调,先按 dataclass 兼容着。
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import date, timedelta

from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database_errors import run_guarded_transaction
from app.core.db_utils import fetch_one_or_none, fetch_scalars
from app.core.goods_donation_format import parse_goods_pickup_date
from app.core.security import enforce_admin_food_bank_scope, get_admin_food_bank_id
from app.models.donation_goods import DonationGoods
from app.models.donation_goods_item import DonationGoodsItem
from app.models.food_bank import FoodBank
from app.models.inventory_item import InventoryItem
from app.models.inventory_lot import InventoryLot
from app.models.user import User
from app.routers._shared import require_by_id, require_scoped_by_id
from app.schemas.donation_goods import (
    DonationGoodsCreate,
    DonationGoodsItemCreatePayload,
    DonationGoodsUpdate,
    SupermarketDonationCreate,
    SupermarketDonationItemPayload,
)
from app.services.email_service import (
    send_goods_donation_notification,
    send_thank_you_email,
)


logger = logging.getLogger("uvicorn.error")

GOODS_DONATION_OPTIONS = (selectinload(DonationGoods.items),)

DEFAULT_INVENTORY_CATEGORY = "Canned Goods"
DEFAULT_INVENTORY_UNIT = "units"

_EXACT_NAME_SCORE = 4
_PARTIAL_NAME_SCORE = 2
_EXACT_ADDRESS_SCORE = 3
_PARTIAL_ADDRESS_SCORE = 1


@dataclass(frozen=True)
class FoodBankSnapshot:
    food_bank_id: int | None
    food_bank_name: str | None
    food_bank_address: str | None
    notification_email: str | None


async def _resolve_food_bank(food_bank_id: int, db: AsyncSession) -> FoodBank:
    return await require_by_id(db, FoodBank, food_bank_id, detail="Food bank not found")


async def _require_goods_donation(
    db: AsyncSession,
    donation_id: uuid.UUID,
) -> DonationGoods:
    return await require_by_id(
        db,
        DonationGoods,
        donation_id,
        detail="Goods donation not found",
        options=GOODS_DONATION_OPTIONS,
    )


async def _require_admin_goods_donation(
    db: AsyncSession,
    donation_id: uuid.UUID,
    admin_user: dict,
    *,
    detail: str,
) -> DonationGoods:
    return await require_scoped_by_id(
        db,
        DonationGoods,
        donation_id,
        admin_user,
        detail=detail,
        not_found_detail="Goods donation not found",
        options=GOODS_DONATION_OPTIONS,
    )


def _normalize_food_bank_match_text(value: str | None) -> str:
    return " ".join((value or "").strip().lower().split())


def _score_food_bank_match(
    bank: FoodBank,
    *,
    normalized_name: str,
    normalized_address: str,
) -> int:
    bank_name = _normalize_food_bank_match_text(bank.name)
    bank_address = _normalize_food_bank_match_text(bank.address)
    score = 0

    if normalized_name:
        if bank_name == normalized_name:
            score += _EXACT_NAME_SCORE
        elif bank_name in normalized_name or normalized_name in bank_name:
            score += _PARTIAL_NAME_SCORE

    if normalized_address:
        if bank_address == normalized_address:
            score += _EXACT_ADDRESS_SCORE
        elif bank_address in normalized_address or normalized_address in bank_address:
            score += _PARTIAL_ADDRESS_SCORE

    return score


async def _resolve_food_bank_from_metadata(
    *,
    food_bank_name: str | None,
    food_bank_address: str | None,
    db: AsyncSession,
) -> FoodBank | None:
    normalized_name = _normalize_food_bank_match_text(food_bank_name)
    normalized_address = _normalize_food_bank_match_text(food_bank_address)
    if not normalized_name and not normalized_address:
        return None

    best_match: FoodBank | None = None
    best_score = 0
    for bank in await fetch_scalars(db, select(FoodBank)):
        score = _score_food_bank_match(
            bank,
            normalized_name=normalized_name,
            normalized_address=normalized_address,
        )
        if score > best_score:
            best_score = score
            best_match = bank

    return best_match if best_score > 0 else None


async def _resolve_selected_food_bank_for_goods_donation(
    donation_in: DonationGoodsCreate,
    current_user: dict | None,
    db: AsyncSession,
) -> FoodBank | None:
    requested_food_bank_id = donation_in.food_bank_id
    admin_food_bank_id = get_admin_food_bank_id(current_user)
    if admin_food_bank_id is not None:
        requested_food_bank_id = requested_food_bank_id or admin_food_bank_id
        enforce_admin_food_bank_scope(
            current_user,
            requested_food_bank_id,
            detail="You can only submit goods donations for your assigned food bank",
        )

    if requested_food_bank_id is not None:
        return await _resolve_food_bank(requested_food_bank_id, db)

    # 公众捐赠者有时是从外部 listing 来的,没有内部 bank id,
    # 这里 best-effort 用元数据匹配,不直接丢线索。
    return await _resolve_food_bank_from_metadata(
        food_bank_name=donation_in.food_bank_name,
        food_bank_address=donation_in.food_bank_address,
        db=db,
    )


def _ensure_pending_goods_pickup_date_is_not_past(
    pickup_date: date | str | None,
    status_value: str,
) -> None:
    parsed_pickup_date = parse_goods_pickup_date(pickup_date)
    if (
        parsed_pickup_date is not None
        and status_value == "pending"
        and parsed_pickup_date < date.today()
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pending goods donations must use a pickup date on or after today",
        )


def _food_bank_snapshot(
    food_bank: FoodBank | None,
    *,
    fallback_name: str | None = None,
    fallback_address: str | None = None,
    fallback_email: str | None = None,
) -> FoodBankSnapshot:
    return FoodBankSnapshot(
        food_bank_id=food_bank.id if food_bank is not None else None,
        food_bank_name=food_bank.name if food_bank is not None else fallback_name,
        food_bank_address=(
            food_bank.address if food_bank is not None else fallback_address
        ),
        notification_email=(
            (food_bank.notification_email if food_bank is not None else None)
            or fallback_email
        ),
    )


async def _create_goods_donation(
    db: AsyncSession,
    *,
    selected_food_bank: FoodBank | None,
    fallback_name: str | None = None,
    fallback_address: str | None = None,
    status: str,
    **payload,
) -> DonationGoods:
    # 把选中的 bank 信息快照到 donation 上,
    # 即使 master food-bank 记录之后改了,下游邮件、导出、历史仍然能读。
    food_bank_snapshot = _food_bank_snapshot(
        selected_food_bank,
        fallback_name=fallback_name,
        fallback_address=fallback_address,
    )
    donation = DonationGoods(
        food_bank_id=food_bank_snapshot.food_bank_id,
        food_bank_name=food_bank_snapshot.food_bank_name,
        food_bank_address=food_bank_snapshot.food_bank_address,
        status=status,
        **payload,
    )
    db.add(donation)
    await db.flush()
    return donation


def _apply_food_bank_snapshot_updates(
    updates: dict[str, object],
    selected_food_bank: FoodBank | None,
) -> None:
    if selected_food_bank is None:
        updates["food_bank_name"] = None
        updates["food_bank_address"] = None
        return

    updates["food_bank_id"] = selected_food_bank.id
    updates["food_bank_name"] = selected_food_bank.name
    updates["food_bank_address"] = selected_food_bank.address


def _queue_goods_emails(
    background_tasks: BackgroundTasks,
    donation_in: DonationGoodsCreate,
    selected_food_bank: FoodBank | None,
) -> None:
    food_bank_snapshot = _food_bank_snapshot(
        selected_food_bank,
        fallback_name=donation_in.food_bank_name,
        fallback_address=donation_in.food_bank_address,
        fallback_email=donation_in.food_bank_email,
    )
    items_summary = ", ".join(
        f"{item.item_name} x{item.quantity}" for item in donation_in.items
    )
    goods_details = items_summary
    if food_bank_snapshot.food_bank_name:
        goods_details = f"{goods_details} | Food bank: {food_bank_snapshot.food_bank_name}"

    background_tasks.add_task(
        send_thank_you_email,
        donation_in.donor_email,
        "goods",
        goods_details,
    )
    logger.info("Queued goods donation thank-you email for %s", donation_in.donor_email)

    background_tasks.add_task(
        send_goods_donation_notification,
        notification_email=food_bank_snapshot.notification_email,
        food_bank_name=food_bank_snapshot.food_bank_name,
        food_bank_address=food_bank_snapshot.food_bank_address,
        donor_name=donation_in.donor_name,
        donor_email=donation_in.donor_email,
        donor_phone=donation_in.donor_phone,
        items_summary=items_summary,
        pickup_date=donation_in.pickup_date,
        notes=donation_in.notes,
    )
    logger.info(
        "Queued goods donation notification for food_bank_id=%s recipient=%s",
        food_bank_snapshot.food_bank_id,
        food_bank_snapshot.notification_email,
    )


async def _apply_goods_donation_food_bank_update(
    updates: dict[str, object],
    *,
    food_bank_id: int | None,
    admin_user: dict,
    db: AsyncSession,
) -> None:
    enforce_admin_food_bank_scope(
        admin_user,
        food_bank_id,
        detail="You can only assign goods donations to your own food bank",
    )
    if food_bank_id is None:
        _apply_food_bank_snapshot_updates(updates, None)
        return

    selected_food_bank = await _resolve_food_bank(food_bank_id, db)
    _apply_food_bank_snapshot_updates(updates, selected_food_bank)


def _should_validate_pending_goods_pickup_date_update(
    donation_in: DonationGoodsUpdate,
    resulting_status: str,
) -> bool:
    return "pickup_date" in donation_in.model_fields_set or (
        "status" in donation_in.model_fields_set and resulting_status == "pending"
    )


def _normalized_inventory_item_name(item_name: str | None) -> str:
    return (item_name or "").strip()


async def _inventory_item_by_name(
    *,
    item_name: str,
    food_bank_id: int | None,
    db: AsyncSession,
    allow_prefix_match: bool,
) -> InventoryItem | None:
    normalized_name = _normalized_inventory_item_name(item_name)
    if not normalized_name:
        return None

    queries = [
        select(InventoryItem).where(func.lower(InventoryItem.name) == normalized_name.lower())
    ]
    if allow_prefix_match:
        queries.append(
            select(InventoryItem)
            .where(func.lower(InventoryItem.name).like(f"{normalized_name.lower()}%"))
            .order_by(InventoryItem.id)
        )

    for query in queries:
        if food_bank_id is None:
            scoped_query = query.where(InventoryItem.food_bank_id.is_not(None))
        else:
            scoped_query = query.where(InventoryItem.food_bank_id == food_bank_id)
        inventory_item = await fetch_one_or_none(db, scoped_query)
        if inventory_item is not None:
            return inventory_item

    return None


def _goods_donation_items(
    donation: DonationGoods,
    items: list[
        DonationGoodsItem
        | DonationGoodsItemCreatePayload
        | SupermarketDonationItemPayload
    ],
) -> list[DonationGoodsItem]:
    return [
        DonationGoodsItem(
            donation_id=donation.id,
            donation=donation,
            item_name=item.item_name,
            quantity=item.quantity,
            expiry_date=item.expiry_date,
        )
        for item in items
    ]


def _goods_donation_items_from_resolved_inventory_items(
    donation: DonationGoods,
    resolved_items: list[tuple[SupermarketDonationItemPayload, InventoryItem]],
) -> list[DonationGoodsItem]:
    return [
        DonationGoodsItem(
            donation_id=donation.id,
            donation=donation,
            item_name=inventory_item.name,
            quantity=item.quantity,
            expiry_date=item.expiry_date,
        )
        for item, inventory_item in resolved_items
    ]


def _inventory_lot_from_goods_item(
    *,
    donation_id: uuid.UUID,
    inventory_item_id: int,
    quantity: int,
    received_date: date,
    expiry_date: date | None,
    batch_reference_prefix: str,
) -> InventoryLot:
    return InventoryLot(
        inventory_item_id=inventory_item_id,
        quantity=quantity,
        received_date=received_date,
        expiry_date=expiry_date or (received_date + timedelta(days=365)),
        batch_reference=f"{batch_reference_prefix}-{donation_id}",
    )


def _goods_inventory_lots(
    *,
    donation_id: uuid.UUID,
    resolved_items: list[tuple[object, InventoryItem]],
    received_date: date,
    batch_reference_prefix: str,
) -> list[InventoryLot]:
    return [
        _inventory_lot_from_goods_item(
            donation_id=donation_id,
            inventory_item_id=inventory_item.id,
            quantity=item.quantity,
            received_date=received_date,
            expiry_date=item.expiry_date,
            batch_reference_prefix=batch_reference_prefix,
        )
        for item, inventory_item in resolved_items
    ]


def _resolved_goods_received_date(pickup_date: date | str | None) -> date:
    return parse_goods_pickup_date(pickup_date) or date.today()


async def _resolve_or_create_inventory_item(
    item_name: str,
    food_bank_id: int | None,
    db: AsyncSession,
) -> InventoryItem:
    if food_bank_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Received goods donations must target a specific food bank",
        )

    normalized_name = _normalized_inventory_item_name(item_name)
    inventory_item = await _inventory_item_by_name(
        item_name=normalized_name,
        food_bank_id=food_bank_id,
        db=db,
        allow_prefix_match=True,
    )
    if inventory_item is not None:
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


async def _resolve_goods_inventory_items(
    items: list[DonationGoodsItem | DonationGoodsItemCreatePayload],
    *,
    food_bank_id: int,
    db: AsyncSession,
) -> list[tuple[DonationGoodsItem | DonationGoodsItemCreatePayload, InventoryItem]]:
    resolved_items: list[
        tuple[DonationGoodsItem | DonationGoodsItemCreatePayload, InventoryItem]
    ] = []
    for item in items:
        inventory_item = await _resolve_or_create_inventory_item(
            item.item_name,
            food_bank_id,
            db,
        )
        resolved_items.append((item, inventory_item))
    return resolved_items


async def _sync_goods_donation_inventory(
    donation: DonationGoods,
    db: AsyncSession,
    items: list[DonationGoodsItem | DonationGoodsItemCreatePayload] | None = None,
) -> None:
    if donation.food_bank_id is None:
        return

    # 只有被标记为 received 时才建库存;pending 的捐赠不计入实际库存,
    # 这样可用量的数字才靠谱。
    received_date = _resolved_goods_received_date(donation.pickup_date)
    donation_items = items if items is not None else list(donation.items)
    resolved_items = await _resolve_goods_inventory_items(
        donation_items,
        food_bank_id=donation.food_bank_id,
        db=db,
    )
    db.add_all(
        _goods_inventory_lots(
            donation_id=donation.id,
            resolved_items=resolved_items,
            received_date=received_date,
            batch_reference_prefix="donation",
        )
    )
    await db.flush()


async def _replace_goods_donation_items(
    donation: DonationGoods,
    items_payload: list[DonationGoodsItemCreatePayload],
    db: AsyncSession,
) -> None:
    donation.items = _goods_donation_items(donation, items_payload)
    await db.flush()


async def _sync_goods_donation_inventory_if_received(
    donation: DonationGoods,
    *,
    previous_status: str,
    db: AsyncSession,
) -> None:
    if previous_status != "received" and donation.status == "received":
        await _sync_goods_donation_inventory(donation, db)


async def _resolve_supermarket_inventory_item(
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

    normalized_name = _normalized_inventory_item_name(item_in.item_name)
    inventory_item = await _inventory_item_by_name(
        item_name=normalized_name,
        food_bank_id=None,
        db=db,
        allow_prefix_match=False,
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


async def _require_authenticated_supermarket_user(
    current_user: dict,
    db: AsyncSession,
) -> User:
    return await require_by_id(
        db,
        User,
        current_user.get("sub"),
        detail="Authenticated supermarket user not found",
    )


async def _resolve_supermarket_donation_items(
    items: list[SupermarketDonationItemPayload],
    db: AsyncSession,
) -> list[tuple[SupermarketDonationItemPayload, InventoryItem]]:
    resolved_items: list[tuple[SupermarketDonationItemPayload, InventoryItem]] = []
    for item in items:
        resolved_items.append((item, await _resolve_supermarket_inventory_item(item, db)))
    return resolved_items


def _single_food_bank_id_from_supermarket_items(
    resolved_items: list[tuple[SupermarketDonationItemPayload, InventoryItem]],
) -> int:
    scoped_food_bank_ids = {
        int(inventory_item.food_bank_id) for _, inventory_item in resolved_items
    }
    if len(scoped_food_bank_ids) != 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="All supermarket donation items must belong to the same food bank",
        )
    return scoped_food_bank_ids.pop()
async def submit_goods_donation(
    donation_in: DonationGoodsCreate,
    background_tasks: BackgroundTasks,
    current_user: dict | None,
    db: AsyncSession,
) -> DonationGoods:
    resolved_status = donation_in.status or "pending"
    _ensure_pending_goods_pickup_date_is_not_past(donation_in.pickup_date, resolved_status)

    async def action() -> DonationGoods:
        selected_food_bank = await _resolve_selected_food_bank_for_goods_donation(
            donation_in,
            current_user,
            db,
        )
        donation = await _create_goods_donation(
            db,
            selected_food_bank=selected_food_bank,
            fallback_name=donation_in.food_bank_name,
            fallback_address=donation_in.food_bank_address,
            donor_user_id=donation_in.donor_user_id,
            donor_name=donation_in.donor_name,
            donor_type=donation_in.donor_type,
            donor_email=donation_in.donor_email,
            donor_phone=donation_in.donor_phone,
            postcode=donation_in.postcode,
            pickup_date=donation_in.pickup_date,
            item_condition=donation_in.item_condition,
            estimated_quantity=donation_in.estimated_quantity,
            notes=donation_in.notes,
            status=resolved_status,
        )
        created_items = _goods_donation_items(donation, donation_in.items)
        db.add_all(created_items)
        await db.flush()
        if resolved_status == "received":
            await _sync_goods_donation_inventory(donation, db, created_items)

        _queue_goods_emails(background_tasks, donation_in, selected_food_bank)
        return await _require_goods_donation(db, donation.id)

    return await run_guarded_transaction(
        db,
        action,
        conflict_detail="Goods donation conflict detected",
        failure_detail="Failed to submit goods donation",
    )


async def submit_supermarket_goods_donation(
    donation_in: SupermarketDonationCreate,
    current_user: dict,
    db: AsyncSession,
) -> DonationGoods:
    async def action() -> DonationGoods:
        # 超市用户是针对已有的 low-stock inventory item 捐赠,
        # 所以先把 payload 解析成一条 bank scoped 的 inventory 路径再落库。
        supermarket_user = await _require_authenticated_supermarket_user(current_user, db)
        resolved_items = await _resolve_supermarket_donation_items(donation_in.items, db)
        selected_food_bank = await _resolve_food_bank(
            _single_food_bank_id_from_supermarket_items(resolved_items),
            db,
        )
        donation = await _create_goods_donation(
            db,
            selected_food_bank=selected_food_bank,
            donor_user_id=supermarket_user.id,
            donor_name=supermarket_user.name,
            donor_type="supermarket",
            donor_email=supermarket_user.email,
            donor_phone=donation_in.donor_phone or "00000000000",
            pickup_date=donation_in.pickup_date,
            notes=donation_in.notes,
            status="pending",
        )
        db.add_all(
            _goods_donation_items_from_resolved_inventory_items(
                donation,
                resolved_items,
            )
        )

        await db.flush()
        return await _require_goods_donation(db, donation.id)

    return await run_guarded_transaction(
        db,
        action,
        conflict_detail="Supermarket donation conflict detected",
        failure_detail="Failed to submit supermarket donation",
    )


async def update_goods_donation(
    donation_id: uuid.UUID,
    donation_in: DonationGoodsUpdate,
    admin_user: dict,
    db: AsyncSession,
) -> DonationGoods:
    updates = donation_in.model_dump(exclude_unset=True, exclude={"items"})
    items_payload = donation_in.items if "items" in donation_in.model_fields_set else None
    if not updates and items_payload is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided to update",
        )

    async def action() -> DonationGoods:
        donation = await _require_admin_goods_donation(
            db,
            donation_id,
            admin_user,
            detail="You can only manage goods donations for your assigned food bank",
        )

        previous_status = donation.status
        if "food_bank_id" in donation_in.model_fields_set:
            await _apply_goods_donation_food_bank_update(
                updates,
                food_bank_id=donation_in.food_bank_id,
                admin_user=admin_user,
                db=db,
            )

        resulting_status = updates.get("status", donation.status)
        resulting_pickup_date = updates.get("pickup_date", donation.pickup_date)
        if _should_validate_pending_goods_pickup_date_update(
            donation_in,
            resulting_status,
        ):
            _ensure_pending_goods_pickup_date_is_not_past(
                resulting_pickup_date,
                resulting_status,
            )

        for field_name, value in updates.items():
            setattr(donation, field_name, value)

        if items_payload is not None:
            await _replace_goods_donation_items(donation, items_payload, db)
        # 进入 "received" 是关键的状态切换——那时捐赠才变成真库存,
        # 所以只在这个迁移点同步 inventory。
        await _sync_goods_donation_inventory_if_received(
            donation,
            previous_status=previous_status,
            db=db,
        )

        await db.flush()
        return await _require_goods_donation(db, donation_id)

    return await run_guarded_transaction(
        db,
        action,
        conflict_detail="Goods donation conflict detected",
        failure_detail="Failed to update goods donation",
    )


async def delete_goods_donation(
    donation_id: uuid.UUID,
    admin_user: dict,
    db: AsyncSession,
) -> None:
    async def action() -> None:
        donation = await _require_admin_goods_donation(
            db,
            donation_id,
            admin_user,
            detail="You can only delete goods donations for your assigned food bank",
        )
        await db.delete(donation)
        await db.flush()

    return await run_guarded_transaction(
        db,
        action,
        failure_detail="Failed to delete goods donation",
    )
