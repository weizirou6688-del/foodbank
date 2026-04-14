from __future__ import annotations

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.food_package import FoodPackage
from app.models.package_item import PackageItem
from app.routers._shared import require_one_or_404


async def list_packages_for_bank(
    food_bank_id: int,
    db: AsyncSession = Depends(get_db),
):
    return (
        await db.execute(
            select(FoodPackage)
            .where(
                FoodPackage.food_bank_id == food_bank_id,
                FoodPackage.is_active.is_(True),
            )
            .order_by(FoodPackage.id)
        )
    ).scalars().all()


async def get_package_details(
    package_id: int,
    db: AsyncSession = Depends(get_db),
):
    return await require_one_or_404(
        db,
        select(FoodPackage)
        .options(
            selectinload(FoodPackage.package_items).selectinload(
                PackageItem.inventory_item
            )
        )
        .where(
            FoodPackage.id == package_id,
            FoodPackage.is_active.is_(True),
        ),
        detail="Package not found",
    )