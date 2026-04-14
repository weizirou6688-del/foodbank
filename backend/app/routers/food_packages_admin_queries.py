from __future__ import annotations

from fastapi import Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import (
    enforce_admin_food_bank_scope,
    get_admin_food_bank_id,
    require_admin,
)
from app.models.food_package import FoodPackage
from app.models.inventory_item import InventoryItem
from app.models.package_item import PackageItem
from app.routers._shared import bank_scoped_clause


async def list_admin_packages(
    food_bank_id: int | None = Query(None, gt=0),
    category: str | None = Query(None, min_length=1, max_length=100),
    search: str | None = Query(None, min_length=1, max_length=200),
    include_inactive: bool = Query(False),
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    normalized_food_bank_id = food_bank_id if isinstance(food_bank_id, int) else None
    normalized_category = (
        category.strip() if isinstance(category, str) and category.strip() else None
    )
    normalized_search = search.strip() if isinstance(search, str) and search.strip() else ""
    normalized_include_inactive = (
        include_inactive if isinstance(include_inactive, bool) else False
    )

    admin_food_bank_id = get_admin_food_bank_id(admin_user)
    query = (
        select(FoodPackage)
        .options(
            selectinload(FoodPackage.package_items).selectinload(
                PackageItem.inventory_item
            )
        )
        .order_by(FoodPackage.id.asc())
    )

    if normalized_food_bank_id is not None:
        if admin_food_bank_id is not None:
            enforce_admin_food_bank_scope(
                admin_user,
                normalized_food_bank_id,
                detail="You can only view packages for your assigned food bank",
            )
        query = query.where(FoodPackage.food_bank_id == normalized_food_bank_id)
    else:
        query = query.where(bank_scoped_clause(FoodPackage, admin_user))

    if not normalized_include_inactive:
        query = query.where(FoodPackage.is_active.is_(True))

    if normalized_category is not None:
        query = query.where(FoodPackage.category == normalized_category)

    if normalized_search:
        search_pattern = f"%{normalized_search}%"
        query = (
            query.outerjoin(PackageItem, PackageItem.package_id == FoodPackage.id)
            .outerjoin(InventoryItem, InventoryItem.id == PackageItem.inventory_item_id)
            .where(
                or_(
                    FoodPackage.name.ilike(search_pattern),
                    FoodPackage.category.ilike(search_pattern),
                    FoodPackage.description.ilike(search_pattern),
                    InventoryItem.name.ilike(search_pattern),
                )
            )
            .distinct()
        )

    return (await db.execute(query)).scalars().unique().all()
