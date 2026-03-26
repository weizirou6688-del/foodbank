"""
Statistics and reporting routes.

Spec § 2.8: GET /donations, GET /packages, GET /stock-gap (all admin only)
"""

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_admin
from app.models.application_item import ApplicationItem
from app.models.donation_cash import DonationCash
from app.models.donation_goods import DonationGoods
from app.models.food_package import FoodPackage
from app.schemas.stats import StockGapPackageOut


router = APIRouter(tags=["Statistics"])


@router.get("/donations", response_model=dict)
async def get_donation_stats(
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Get donation trends and statistics (admin only).
    
    Spec § 2.8: GET /stats/donations (requires admin).
    
    Returns:
    - total_cash_donations: Decimal
    - total_goods_donations: int (count)
    - average_cash_per_donation: Decimal
    - donations_by_week: List[{week: str, cash: Decimal, goods_count: int}]
    
    TODO: Query and aggregate donation statistics
    """
    _ = admin_user

    cash_totals_rows = (
        await db.execute(
            select(
                func.coalesce(func.sum(DonationCash.amount_pence), 0).label("total_cash"),
                func.coalesce(func.avg(DonationCash.amount_pence), 0).label("avg_cash"),
            )
        )
    ).all()
    total_cash_raw, avg_cash_raw = cash_totals_rows[0] if cash_totals_rows else (0, 0)
    total_cash = int(total_cash_raw or 0)
    average_cash = int(avg_cash_raw or 0)

    goods_total_rows = (
        await db.execute(
            select(func.count(DonationGoods.id).label("total_goods"))
        )
    ).all()
    total_goods = int(goods_total_rows[0][0] or 0) if goods_total_rows else 0

    weekly_cash_rows = (
        await db.execute(
            select(
                func.to_char(
                    func.date_trunc("week", DonationCash.created_at),
                    'IYYY-"W"IW',
                ).label("week"),
                func.coalesce(func.sum(DonationCash.amount_pence), 0).label("cash"),
            )
            .group_by("week")
        )
    ).all()

    weekly_goods_rows = (
        await db.execute(
            select(
                func.to_char(
                    func.date_trunc("week", DonationGoods.created_at),
                    'IYYY-"W"IW',
                ).label("week"),
                func.count(DonationGoods.id).label("goods_count"),
            )
            .group_by("week")
        )
    ).all()

    weekly: dict[str, dict[str, int | str]] = {}

    for week, cash in weekly_cash_rows:
        weekly[str(week)] = {
            "week": str(week),
            "cash": int(cash or 0),
            "goods_count": 0,
        }

    for week, goods_count in weekly_goods_rows:
        existing = weekly.get(str(week))
        if existing:
            existing["goods_count"] = int(goods_count or 0)
        else:
            weekly[str(week)] = {
                "week": str(week),
                "cash": 0,
                "goods_count": int(goods_count or 0),
            }

    donations_by_week = sorted(weekly.values(), key=lambda w: str(w["week"]), reverse=True)

    return {
        "total_cash_donations": total_cash,
        "total_goods_donations": total_goods,
        "average_cash_per_donation": average_cash,
        "donations_by_week": donations_by_week,
    }


@router.get("/packages", response_model=List[dict])
async def get_package_stats(
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Get most frequent packages and request patterns (admin only).
    
    Spec § 2.8: GET /stats/packages (requires admin).
    
    Returns:
    - package_id, package_name, request_count, total_requested_items
    - Sorted by request_count DESC
    
    TODO: Query ApplicationItem aggregation on package_id
    """
    _ = admin_user

    rows = (
        await db.execute(
            select(
                ApplicationItem.package_id.label("package_id"),
                FoodPackage.name.label("package_name"),
                func.count(ApplicationItem.id).label("request_count"),
                func.coalesce(func.sum(ApplicationItem.quantity), 0).label("total_requested_items"),
            )
            .join(FoodPackage, FoodPackage.id == ApplicationItem.package_id)
            .group_by(ApplicationItem.package_id, FoodPackage.name)
            .order_by(
                func.count(ApplicationItem.id).desc(),
                func.coalesce(func.sum(ApplicationItem.quantity), 0).desc(),
            )
        )
    ).all()

    return [
        {
            "package_id": int(package_id),
            "package_name": str(package_name),
            "request_count": int(request_count or 0),
            "total_requested_items": int(total_requested_items or 0),
        }
        for package_id, package_name, request_count, total_requested_items in rows
    ]


@router.get("/stock-gap", response_model=List[StockGapPackageOut])
async def get_stock_gap_analysis(
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Identify food packages below stock threshold (admin only).
    
    Spec § 2.8: GET /stats/stock-gap (requires admin).
    
    Returns packages where:
    - stock < threshold
    - Ordered by gap (threshold - stock) DESC
    
    Response fields:
    - package_id, package_name, stock, threshold, gap
    """
    _ = admin_user

    gap_expr = (FoodPackage.threshold - FoodPackage.stock).label("gap")
    rows = (
        await db.execute(
            select(
                FoodPackage.id.label("package_id"),
                FoodPackage.name.label("package_name"),
                FoodPackage.stock.label("stock"),
                FoodPackage.threshold.label("threshold"),
                gap_expr,
            )
            .where(FoodPackage.stock < FoodPackage.threshold)
            .order_by(gap_expr.desc())
        )
    ).all()

    return [
        {
            "package_id": int(package_id),
            "package_name": str(package_name),
            "stock": int(stock or 0),
            "threshold": int(threshold or 0),
            "gap": int(gap or 0),
        }
        for package_id, package_name, stock, threshold, gap in rows
    ]
