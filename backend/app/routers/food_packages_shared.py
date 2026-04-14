from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db_utils import fetch_scalars
from app.core.security import get_admin_food_bank_id
from app.models.food_package import FoodPackage
from app.models.inventory_item import InventoryItem
from app.models.package_item import PackageItem
from app.routers._shared import require_scoped_by_id


def ensure_unique_content_items(item_ids: list[int]) -> None:
    if len(set(item_ids)) != len(item_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate item_id in package contents",
        )


async def get_package_for_admin(
    package_id: int,
    admin_user: dict,
    db: AsyncSession,
    *,
    load_items: bool = False,
) -> FoodPackage:
    return await require_scoped_by_id(
        db,
        FoodPackage,
        package_id,
        admin_user,
        detail="You can only manage packages for your assigned food bank",
        not_found_detail="Package not found",
        options=(selectinload(FoodPackage.package_items),) if load_items else (),
    )


async def validate_package_contents(
    item_ids: list[int],
    target_food_bank_id: int,
    admin_user: dict,
    db: AsyncSession,
) -> None:
    inventory_rows = await fetch_scalars(
        db,
        select(InventoryItem).where(InventoryItem.id.in_(item_ids)),
    )
    inventory_ids = {
        row.id if isinstance(row, InventoryItem) else int(row)
        for row in inventory_rows
    }
    if len(inventory_ids) != len(item_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more inventory items do not exist",
        )

    admin_food_bank_id = get_admin_food_bank_id(admin_user)
    if admin_food_bank_id is not None:
        inaccessible_items = [
            row.id
            for row in inventory_rows
            if isinstance(row, InventoryItem) and row.food_bank_id != admin_food_bank_id
        ]
        if inaccessible_items:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="One or more inventory items are outside your food bank scope",
            )

    mismatched_items = [
        row.id
        for row in inventory_rows
        if isinstance(row, InventoryItem) and row.food_bank_id != target_food_bank_id
    ]
    if mismatched_items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more inventory items are outside the selected food bank scope",
        )


async def validate_package_inventory_scope(
    package_id: int,
    admin_user: dict,
    db: AsyncSession,
) -> None:
    admin_food_bank_id = get_admin_food_bank_id(admin_user)
    if admin_food_bank_id is None:
        return

    inventory_items = (
        await db.execute(
            select(InventoryItem)
            .join(PackageItem, PackageItem.inventory_item_id == InventoryItem.id)
            .where(PackageItem.package_id == package_id)
        )
    ).scalars().all()
    inaccessible_items = [
        item.id
        for item in inventory_items
        if item.food_bank_id != admin_food_bank_id
    ]
    if inaccessible_items:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="One or more inventory items are outside your food bank scope",
        )