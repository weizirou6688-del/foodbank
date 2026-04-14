from __future__ import annotations

import uuid
from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db_utils import fetch_scalars
from app.models.application import Application
from app.models.food_package import FoodPackage
from app.models.inventory_item import InventoryItem
from app.models.package_item import PackageItem
from app.routers.applications_shared import generate_unique_redemption_code
from app.services.inventory_service import consume_inventory_lots


async def load_requested_packages(
    db: AsyncSession,
    *,
    food_bank_id: int,
    requested_package_quantities: dict[int, int],
) -> dict[int, FoodPackage]:
    if not requested_package_quantities:
        return {}

    package_ids = list(requested_package_quantities)
    packages = {
        package.id: package
        for package in await fetch_scalars(
            db,
            select(FoodPackage)
            .options(
                selectinload(FoodPackage.package_items).selectinload(
                    PackageItem.inventory_item
                )
            )
            .where(FoodPackage.id.in_(package_ids))
            .with_for_update(),
        )
    }

    missing_package_ids = [
        package_id for package_id in package_ids if package_id not in packages
    ]
    if missing_package_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Package(s) not found: {missing_package_ids}",
        )

    if any(not package.is_active for package in packages.values()):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="One or more selected packages are inactive",
        )

    food_bank_ids = {package.food_bank_id for package in packages.values()}
    if None in food_bank_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected package is not bound to a food bank",
        )
    if len(food_bank_ids) != 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="All selected packages must belong to the same food bank",
        )
    if food_bank_id != next(iter(food_bank_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provided food_bank_id does not match selected packages",
        )

    for package_id, requested_quantity in requested_package_quantities.items():
        package = packages[package_id]
        if package.stock < requested_quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock for package {package_id}",
            )
        if not package.package_items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Package {package_id} cannot be applied for because it has no "
                    "configured contents"
                ),
            )

    return packages


async def load_requested_inventory_items(
    db: AsyncSession,
    *,
    food_bank_id: int,
    requested_inventory_quantities: dict[int, int],
) -> dict[int, InventoryItem]:
    if not requested_inventory_quantities:
        return {}

    inventory_item_ids = list(requested_inventory_quantities)
    inventory_items = {
        item.id: item
        for item in await fetch_scalars(
            db,
            select(InventoryItem)
            .where(InventoryItem.id.in_(inventory_item_ids))
            .with_for_update(),
        )
    }

    missing_inventory_item_ids = [
        item_id for item_id in inventory_item_ids if item_id not in inventory_items
    ]
    if missing_inventory_item_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inventory item(s) not found: {missing_inventory_item_ids}",
        )

    if any(item.food_bank_id != food_bank_id for item in inventory_items.values()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provided food_bank_id does not match selected inventory items",
        )

    return inventory_items


async def create_pending_application(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    food_bank_id: int,
    week_start: date,
    package_quantity: int,
) -> Application:
    application = Application(
        user_id=user_id,
        food_bank_id=food_bank_id,
        redemption_code=await generate_unique_redemption_code(db),
        status="pending",
        week_start=week_start,
        total_quantity=package_quantity,
        redeemed_at=None,
    )
    db.add(application)
    await db.flush()
    return application


async def consume_requested_inventory(
    db: AsyncSession,
    requested_inventory_quantities: dict[int, int],
) -> None:
    for inventory_item_id, requested_quantity in requested_inventory_quantities.items():
        try:
            await consume_inventory_lots(inventory_item_id, requested_quantity, db)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock for inventory item {inventory_item_id}: {exc}",
            ) from exc
