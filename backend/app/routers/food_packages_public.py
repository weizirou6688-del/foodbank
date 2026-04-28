from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.food_package import FoodPackage
from app.models.package_item import PackageItem
from app.routers._shared import require_one_or_404
from app.schemas.food_package import FoodPackageDetailOut, FoodPackageOut


router = APIRouter()


@router.get("/food-banks/{food_bank_id}/packages", response_model=list[FoodPackageOut])
async def list_packages_for_bank(
    food_bank_id: int,
    db: AsyncSession = Depends(get_db),
):
    # 公众列表只暴露 active 的 package,未发布或已下架的 template 留给 admin 侧处理
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


@router.get("/packages/{package_id}", response_model=FoodPackageDetailOut)
async def get_package_details(
    package_id: int,
    db: AsyncSession = Depends(get_db),
):
    # 详情接口直接 eager load package contents,前端把 package 和明细当成一份契约渲染
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
