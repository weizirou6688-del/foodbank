"""Admin 端 inventory-item 路由,基于 lot 算 stock,不用可变计数器。"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.database_errors import run_guarded_transaction
from app.core.db_utils import fetch_one_or_none, flush_refresh, sync_model_fields
from app.core.security import require_admin
from app.models.inventory_item import InventoryItem
from app.models.inventory_lot import InventoryLot
from app.models.package_item import PackageItem
from app.routers._shared import require_scoped_by_id, resolve_admin_target_food_bank_id
from app.schemas.inventory_item import (
    InventoryItemCreateRequest,
    InventoryItemOut,
    InventoryItemUpdate,
    StockAdjustment,
)
from app.services.inventory_service import consume_inventory_lots


router = APIRouter()


def _default_lot_expiry_date(expiry_date: date | None = None) -> date:
    return expiry_date or date.today() + timedelta(days=365)


async def _get_inventory_item_for_admin(
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


async def _get_manageable_inventory_item(
    db: AsyncSession,
    item_id: int,
    admin_user: dict,
) -> InventoryItem:
    return await _get_inventory_item_for_admin(
        db,
        item_id,
        admin_user,
        detail="You can only manage inventory items for your assigned food bank",
    )


async def _get_deletable_inventory_item(
    db: AsyncSession,
    item_id: int,
    admin_user: dict,
) -> InventoryItem:
    return await _get_inventory_item_for_admin(
        db,
        item_id,
        admin_user,
        detail="You can only delete inventory items for your assigned food bank",
    )


async def _serialize_inventory_item(
    db: AsyncSession,
    item: InventoryItem,
) -> InventoryItemOut:
    # stock 从活着的 lot 算,过期和损耗会立刻反映到 admin UI 看到的总数上
    total_stock = int(
        (
            await db.scalar(
                select(func.coalesce(func.sum(InventoryLot.quantity), 0)).where(
                    InventoryLot.inventory_item_id == item.id,
                    InventoryLot.deleted_at.is_(None),
                    InventoryLot.expiry_date >= date.today(),
                )
            )
        )
        or 0
    )
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


async def _refreshed_inventory_item_out(
    db: AsyncSession,
    item: InventoryItem,
) -> InventoryItemOut:
    return await _serialize_inventory_item(db, await flush_refresh(db, item))


def _inventory_lot(
    *,
    inventory_item_id: int,
    quantity: int,
    batch_reference: str,
    expiry_date: date | None = None,
) -> InventoryLot:
    return InventoryLot(
        inventory_item_id=inventory_item_id,
        quantity=quantity,
        received_date=date.today(),
        expiry_date=_default_lot_expiry_date(expiry_date),
        batch_reference=batch_reference,
    )


async def _package_usage_count(
    db: AsyncSession,
    *,
    item_id: int,
) -> int:
    return int(
        await fetch_one_or_none(
            db,
            select(func.count(PackageItem.id)).where(
                PackageItem.inventory_item_id == item_id,
            ),
        )
        or 0
    )


@router.post(
    "",
    response_model=InventoryItemOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_inventory_item(
    item_in: InventoryItemCreateRequest,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    async def action() -> InventoryItemOut:
        target_food_bank_id = await resolve_admin_target_food_bank_id(
            db,
            item_in.food_bank_id,
            admin_user,
            scope_detail="You can only create inventory items for your assigned food bank",
            required_detail="food_bank_id is required for inventory item creation",
        )
        normalized_name = item_in.name.strip()
        duplicate_query = select(InventoryItem.id).where(
            func.lower(InventoryItem.name) == normalized_name.lower(),
            InventoryItem.food_bank_id == target_food_bank_id,
        )

        existing_item_id = await fetch_one_or_none(db, duplicate_query)
        if existing_item_id is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Inventory item name already exists",
            )

        item = InventoryItem(
            name=normalized_name,
            category=item_in.category,
            unit=item_in.unit,
            threshold=item_in.threshold,
            food_bank_id=target_food_bank_id,
        )
        db.add(item)
        await db.flush()

        # 初始 stock 当作第一个 lot 记下来,后面 stock-in、stock-out、wastage
        # 都用同一套 inventory 语言
        if item_in.initial_stock > 0:
            db.add(
                _inventory_lot(
                    inventory_item_id=item.id,
                    quantity=item_in.initial_stock,
                    batch_reference="initial-stock",
                )
            )

        return await _refreshed_inventory_item_out(db, item)

    return await run_guarded_transaction(
        db,
        action,
        conflict_detail="Inventory item conflict detected",
        failure_detail="Failed to create inventory item",
    )


@router.patch("/{item_id}", response_model=InventoryItemOut)
async def update_inventory_item(
    item_id: int,
    item_in: InventoryItemUpdate,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    updates = item_in.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided to update",
        )

    async def action() -> InventoryItemOut:
        item = await _get_manageable_inventory_item(db, item_id, admin_user)
        sync_model_fields(item, updates)
        return await _refreshed_inventory_item_out(db, item)

    return await run_guarded_transaction(
        db,
        action,
        conflict_detail="Inventory update conflict detected",
        failure_detail="Failed to update inventory item",
    )


@router.post("/{item_id}/stock-in", response_model=InventoryItemOut)
async def stock_in(
    item_id: int,
    adjustment_in: StockAdjustment,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    async def action() -> InventoryItemOut:
        item = await _get_manageable_inventory_item(db, item_id, admin_user)
        db.add(
            _inventory_lot(
                inventory_item_id=item.id,
                quantity=adjustment_in.quantity,
                expiry_date=adjustment_in.expiry_date,
                batch_reference=adjustment_in.reason[:100],
            )
        )
        return await _refreshed_inventory_item_out(db, item)

    return await run_guarded_transaction(
        db,
        action,
        failure_detail="Failed to increase inventory stock",
    )


@router.post("/{item_id}/stock-out", response_model=InventoryItemOut)
async def stock_out(
    item_id: int,
    adjustment_in: StockAdjustment,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    async def action() -> InventoryItemOut:
        item = await _get_manageable_inventory_item(db, item_id, admin_user)
        try:
            await consume_inventory_lots(item.id, adjustment_in.quantity, db)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc
        return await _refreshed_inventory_item_out(db, item)

    return await run_guarded_transaction(
        db,
        action,
        failure_detail="Failed to decrease inventory stock",
    )


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_inventory_item(
    item_id: int,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    async def action() -> None:
        item = await _get_deletable_inventory_item(db, item_id, admin_user)
        if await _package_usage_count(db, item_id=item_id) > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot delete inventory item used in packages",
            )

        await db.delete(item)
        await db.flush()

    return await run_guarded_transaction(
        db,
        action,
        failure_detail="Failed to delete inventory item",
    )
