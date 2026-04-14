from __future__ import annotations

from datetime import date

from fastapi import Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.db_utils import fetch_one_or_none, sync_model_fields
from app.core.security import require_admin
from app.models.inventory_item import InventoryItem
from app.models.inventory_lot import InventoryLot
from app.models.package_item import PackageItem
from app.routers._shared import resolve_admin_target_food_bank_id
from app.routers.inventory_shared import (
    flush_refresh_serialize_inventory_item,
    future_expiry_date,
    get_inventory_item_for_admin,
    run_inventory_transaction,
    run_stock_adjustment,
)
from app.schemas.inventory_item import (
    InventoryItemCreateRequest,
    InventoryItemOut,
    InventoryItemUpdate,
    StockAdjustment,
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

        if item_in.initial_stock > 0:
            db.add(
                InventoryLot(
                    inventory_item_id=item.id,
                    quantity=item_in.initial_stock,
                    received_date=date.today(),
                    expiry_date=future_expiry_date(),
                    batch_reference="initial-stock",
                )
            )

        return await flush_refresh_serialize_inventory_item(db, item)

    return await run_inventory_transaction(
        db,
        action,
        conflict_detail="Inventory item conflict detected",
        failure_detail="Failed to create inventory item",
    )


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
        item = await get_inventory_item_for_admin(
            db,
            item_id,
            admin_user,
            detail="You can only manage inventory items for your assigned food bank",
        )
        sync_model_fields(item, updates)
        return await flush_refresh_serialize_inventory_item(db, item)

    return await run_inventory_transaction(
        db,
        action,
        conflict_detail="Inventory update conflict detected",
        failure_detail="Failed to update inventory item",
    )


async def stock_in(
    item_id: int,
    adjustment_in: StockAdjustment,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await run_stock_adjustment(
        db,
        item_id,
        adjustment_in,
        admin_user,
        stock_in=True,
        failure_detail="Failed to increase inventory stock",
    )


async def stock_out(
    item_id: int,
    adjustment_in: StockAdjustment,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await run_stock_adjustment(
        db,
        item_id,
        adjustment_in,
        admin_user,
        stock_in=False,
        failure_detail="Failed to decrease inventory stock",
    )


async def delete_inventory_item(
    item_id: int,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    async def action() -> None:
        item = await get_inventory_item_for_admin(
            db,
            item_id,
            admin_user,
            detail="You can only delete inventory items for your assigned food bank",
        )

        package_usage_count = await fetch_one_or_none(
            db,
            select(func.count(PackageItem.id)).where(
                PackageItem.inventory_item_id == item_id,
            ),
        )
        if int(package_usage_count or 0) > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot delete inventory item used in packages",
            )

        await db.delete(item)
        await db.flush()

    return await run_inventory_transaction(
        db,
        action,
        failure_detail="Failed to delete inventory item",
    )
