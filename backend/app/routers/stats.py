"""
Statistics and reporting routes.

These analytics endpoints back the admin dashboard and are intentionally aligned
with the same database tables used by Inventory Management.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from statistics import mean
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.goods_donation_format import parse_goods_pickup_date
from app.core.security import get_admin_food_bank_id, require_admin
from app.models.application import Application
from app.models.application_distribution_snapshot import ApplicationDistributionSnapshot
from app.models.application_item import ApplicationItem
from app.models.donation_cash import DonationCash
from app.models.donation_goods import DonationGoods
from app.models.food_package import FoodPackage
from app.models.inventory_item import InventoryItem
from app.models.inventory_lot import InventoryLot
from app.models.inventory_waste_event import InventoryWasteEvent
from app.models.package_item import PackageItem
from app.schemas.stats import (
    DashboardAnalyticsOut,
    DashboardChartOut,
    DashboardDisplayCardOut,
    DashboardDonationAnalyticsOut,
    DashboardExpiryAnalyticsOut,
    DashboardExpiryChartOut,
    DashboardExpiringLotOut,
    DashboardImpactMetricOut,
    DashboardInventoryAnalyticsOut,
    DashboardKpiOut,
    DashboardKpiTrendsOut,
    DashboardLowStockAlertOut,
    DashboardPackageAnalyticsOut,
    DashboardRedemptionAnalyticsOut,
    DashboardVerificationRecordOut,
    PublicImpactMetricOut,
    PublicImpactMetricsOut,
    StockGapPackageOut,
)
from app.services.impact_metrics_service import calculate_shared_goods_impact_snapshot


router = APIRouter(tags=["Statistics"])

COMPARISON_LABELS = {
    "month": "last month",
    "quarter": "last quarter",
    "year": "last year",
}

RANGE_NOTES = {
    "month": "This Month",
    "quarter": "This Quarter",
    "year": "This Year",
}


def _as_utc_naive(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def _event_date(value: date | datetime | None) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        normalized = _as_utc_naive(value)
        return normalized.date() if normalized is not None else None
    return value


def _month_start(day: date) -> date:
    return day.replace(day=1)


def _shift_month(day: date, offset: int) -> date:
    month_index = (day.year * 12 + (day.month - 1)) + offset
    year = month_index // 12
    month = month_index % 12 + 1
    return date(year, month, 1)


def _trend_bucket_key(
    target: date | None,
    range_key: Literal["month", "quarter", "year"],
) -> date | None:
    if target is None:
        return None
    if range_key == "month":
        return target
    return _month_start(target)


def _trend_buckets(
    range_key: Literal["month", "quarter", "year"],
    today: date,
    current_start: date,
    next_start: date,
) -> tuple[list[date], dict[date, int], list[str]]:
    if range_key == "month":
        period_end = min(today + timedelta(days=1), next_start)
        buckets: list[date] = []
        cursor = current_start
        while cursor < period_end:
            buckets.append(cursor)
            cursor += timedelta(days=1)
        if not buckets:
            buckets = [current_start]
        labels = [f"{bucket.strftime('%b')} {bucket.day}" for bucket in buckets]
        return buckets, {bucket: index for index, bucket in enumerate(buckets)}, labels

    period_end = min(next_start, _shift_month(_month_start(today), 1))
    buckets = []
    cursor = current_start
    while cursor < period_end:
        buckets.append(cursor)
        cursor = _shift_month(cursor, 1)
    if not buckets:
        buckets = [current_start]
    labels = [bucket.strftime("%b") for bucket in buckets]
    return buckets, {bucket: index for index, bucket in enumerate(buckets)}, labels


def _period_bounds(
    range_key: Literal["month", "quarter", "year"],
    today: date,
) -> tuple[date, date, date]:
    if range_key == "year":
        current_start = date(today.year, 1, 1)
        next_start = date(today.year + 1, 1, 1)
        previous_start = date(today.year - 1, 1, 1)
        return current_start, next_start, previous_start

    if range_key == "quarter":
        quarter_month = ((today.month - 1) // 3) * 3 + 1
        current_start = date(today.year, quarter_month, 1)
        next_start = _shift_month(current_start, 3)
        previous_start = _shift_month(current_start, -3)
        return current_start, next_start, previous_start

    current_start = date(today.year, today.month, 1)
    next_start = _shift_month(current_start, 1)
    previous_start = _shift_month(current_start, -1)
    return current_start, next_start, previous_start


def _in_period(target: date | None, start: date, end: date) -> bool:
    return target is not None and start <= target < end


def _percent_change(current: float, previous: float) -> float | None:
    if previous == 0:
        if current == 0:
            return 0.0
        return None
    return ((current - previous) / previous) * 100


def _format_change(current: float, previous: float, comparison_label: str) -> str:
    change = _percent_change(current, previous)
    if change is None:
        return f"New vs {comparison_label}"
    sign = "+" if change >= 0 else ""
    return f"{sign}{change:.1f}% vs {comparison_label}"


def _format_int(value: int) -> str:
    return f"{value:,}"


def _format_currency_from_pence(value: float) -> str:
    return f"\u00A3{value / 100:,.2f}"


def _format_decimal(value: float, decimals: int = 1) -> str:
    return f"{value:.{decimals}f}"


def _format_short_change(current: float, previous: float) -> tuple[str, bool]:
    change = _percent_change(current, previous)
    if change is None:
        return "New", True
    return f"{'+' if change >= 0 else ''}{change:.1f}%", change >= 0


def _format_table_quantity(value: int, unit: str) -> str:
    safe_unit = (unit or "units").strip()
    return f"{value} {safe_unit}"


def _normalize_donor_type(raw_value: str | None) -> str:
    normalized = (raw_value or "").strip().lower()
    if normalized == "supermarket":
        return "Supermarket"
    if normalized == "organization":
        return "Organization"
    if normalized == "individual":
        return "Individual"
    return "Unspecified"


def _donor_identity(email: str | None, name: str | None) -> str | None:
    if email and email.strip():
        return email.strip().lower()
    if name and name.strip():
        return f"name:{name.strip().lower()}"
    return None


def _chart(labels: list[str], data: list[float], empty_label: str = "No data") -> DashboardChartOut:
    if not labels:
        return DashboardChartOut(labels=[empty_label], data=[0.0])
    return DashboardChartOut(labels=labels, data=[float(value) for value in data])


def _package_display_name(application: Application) -> str:
    names: list[str] = []
    for item in application.items:
        if item.package is not None:
            names.append(item.package.name)
        elif item.inventory_item is not None:
            names.append(item.inventory_item.name)
    unique_names = list(dict.fromkeys(names))
    if not unique_names:
        return "Direct Item Support"
    return ", ".join(unique_names)


def _filter_records_by_food_bank_id(records: list[object], food_bank_id: int) -> list[object]:
    return [
        record
        for record in records
        if getattr(record, "food_bank_id", None) == food_bank_id
    ]


@router.get("/donations", response_model=dict)
async def get_donation_stats(
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    admin_food_bank_id = get_admin_food_bank_id(admin_user)

    cash_totals_query = select(
        func.coalesce(func.sum(DonationCash.amount_pence), 0).label("total_cash"),
        func.coalesce(func.avg(DonationCash.amount_pence), 0).label("avg_cash"),
    ).where(DonationCash.status == "completed")
    if admin_food_bank_id is not None:
        cash_totals_query = cash_totals_query.where(
            DonationCash.food_bank_id == admin_food_bank_id
        )

    cash_totals_rows = (
        await db.execute(cash_totals_query)
    ).all()
    total_cash_raw, avg_cash_raw = cash_totals_rows[0] if cash_totals_rows else (0, 0)
    total_cash = int(total_cash_raw or 0)
    average_cash = int(avg_cash_raw or 0)

    goods_total_query = select(func.count(DonationGoods.id).label("total_goods")).where(
        DonationGoods.status == "received"
    )
    if admin_food_bank_id is not None:
        goods_total_query = goods_total_query.where(
            DonationGoods.food_bank_id == admin_food_bank_id
        )

    goods_total_rows = (await db.execute(goods_total_query)).all()
    total_goods = int(goods_total_rows[0][0] or 0) if goods_total_rows else 0

    weekly_cash_query = (
        select(
            func.to_char(
                func.date_trunc("week", DonationCash.created_at),
                'IYYY-"W"IW',
            ).label("week"),
            func.coalesce(func.sum(DonationCash.amount_pence), 0).label("cash"),
        )
        .where(DonationCash.status == "completed")
        .group_by("week")
    )
    if admin_food_bank_id is not None:
        weekly_cash_query = weekly_cash_query.where(
            DonationCash.food_bank_id == admin_food_bank_id
        )

    weekly_cash_rows = (await db.execute(weekly_cash_query)).all()

    weekly_goods_query = (
        select(
            func.to_char(
                func.date_trunc("week", DonationGoods.created_at),
                'IYYY-"W"IW',
            ).label("week"),
            func.count(DonationGoods.id).label("goods_count"),
        )
        .where(DonationGoods.status == "received")
        .group_by("week")
    )
    if admin_food_bank_id is not None:
        weekly_goods_query = weekly_goods_query.where(
            DonationGoods.food_bank_id == admin_food_bank_id
        )

    weekly_goods_rows = (await db.execute(weekly_goods_query)).all()

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

    donations_by_week = sorted(weekly.values(), key=lambda row: str(row["week"]), reverse=True)

    return {
        "total_cash_donations": total_cash,
        "total_goods_donations": total_goods,
        "average_cash_per_donation": average_cash,
        "donations_by_week": donations_by_week,
    }


@router.get("/packages", response_model=list[dict])
async def get_package_stats(
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    admin_food_bank_id = get_admin_food_bank_id(admin_user)

    query = (
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
    if admin_food_bank_id is not None:
        query = query.where(FoodPackage.food_bank_id == admin_food_bank_id)

    rows = (await db.execute(query)).all()

    return [
        {
            "package_id": int(package_id),
            "package_name": str(package_name),
            "request_count": int(request_count or 0),
            "total_requested_items": int(total_requested_items or 0),
        }
        for package_id, package_name, request_count, total_requested_items in rows
    ]


@router.get("/stock-gap", response_model=list[StockGapPackageOut])
async def get_stock_gap_analysis(
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    admin_food_bank_id = get_admin_food_bank_id(admin_user)

    gap_expr = (FoodPackage.threshold - FoodPackage.stock).label("gap")
    query = (
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
    if admin_food_bank_id is not None:
        query = query.where(FoodPackage.food_bank_id == admin_food_bank_id)

    rows = (await db.execute(query)).all()

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


@router.get("/public-impact", response_model=PublicImpactMetricsOut)
async def get_public_impact_metrics(
    range_key: Literal["month", "quarter", "year"] = Query("month", alias="range"),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    current_start, next_start, previous_start = _period_bounds(range_key, today)
    range_note = RANGE_NOTES[range_key]

    goods_donations = list(
        (
            await db.execute(
                select(DonationGoods)
                .options(selectinload(DonationGoods.items))
                .order_by(DonationGoods.created_at.asc())
            )
        ).scalars().all()
    )
    packages = list(
        (
            await db.execute(
                select(FoodPackage)
                .options(selectinload(FoodPackage.package_items))
                .order_by(FoodPackage.name.asc())
            )
        ).scalars().all()
    )
    applications = list(
        (
            await db.execute(
                select(Application)
                .options(
                    selectinload(Application.items).selectinload(ApplicationItem.package),
                    selectinload(Application.items).selectinload(ApplicationItem.inventory_item),
                )
                .order_by(Application.created_at.asc())
            )
        ).scalars().all()
    )
    distribution_snapshots = list(
        (
            await db.execute(
                select(ApplicationDistributionSnapshot).order_by(
                    ApplicationDistributionSnapshot.created_at.asc(),
                    ApplicationDistributionSnapshot.id.asc(),
                )
            )
        ).scalars().all()
    )

    goods_impact_snapshot = calculate_shared_goods_impact_snapshot(
        cash_donations=[],
        goods_donations=goods_donations,
        applications=applications,
        today=today,
        current_start=current_start,
        next_start=next_start,
        previous_start=previous_start,
    )

    distribution_snapshots_by_application_id: dict[object, list[ApplicationDistributionSnapshot]] = defaultdict(list)
    for snapshot in distribution_snapshots:
        distribution_snapshots_by_application_id[snapshot.application_id].append(snapshot)

    package_recipe_units = {
        package.id: sum(package_item.quantity for package_item in package.package_items)
        for package in packages
    }

    all_time_food_units_distributed = 0
    current_food_units_distributed = 0
    previous_food_units_distributed = 0
    resolved_current_total = 0
    resolved_current_success = 0
    resolved_previous_total = 0
    resolved_previous_success = 0

    for application in applications:
        application_created = _event_date(application.created_at)
        in_current_period = _in_period(application_created, current_start, next_start)
        in_previous_period = _in_period(application_created, previous_start, current_start)

        if in_current_period:
            if application.deleted_at is not None or application.status == "expired":
                resolved_current_total += 1
            elif application.status == "collected":
                resolved_current_total += 1
                resolved_current_success += 1
        if in_previous_period:
            if application.deleted_at is not None or application.status == "expired":
                resolved_previous_total += 1
            elif application.status == "collected":
                resolved_previous_total += 1
                resolved_previous_success += 1

        if application.deleted_at is not None:
            continue

        application_snapshots = distribution_snapshots_by_application_id.get(application.id, [])
        component_snapshots = [
            snapshot
            for snapshot in application_snapshots
            if snapshot.snapshot_type == "package_component"
        ]
        direct_item_snapshots = [
            snapshot
            for snapshot in application_snapshots
            if snapshot.snapshot_type == "direct_item"
        ]

        application_food_units = 0
        if component_snapshots or direct_item_snapshots:
            application_food_units += sum(
                snapshot.distributed_quantity for snapshot in component_snapshots
            )
            application_food_units += sum(
                snapshot.distributed_quantity for snapshot in direct_item_snapshots
            )
        else:
            for item in application.items:
                if item.package_id is not None:
                    application_food_units += package_recipe_units.get(item.package_id, 0) * item.quantity
                elif item.inventory_item_id is not None:
                    application_food_units += item.quantity

        all_time_food_units_distributed += application_food_units
        if in_current_period:
            current_food_units_distributed += application_food_units
        if in_previous_period:
            previous_food_units_distributed += application_food_units

    current_redemption_rate = (
        round((resolved_current_success / resolved_current_total) * 100, 1)
        if resolved_current_total
        else 0.0
    )
    previous_redemption_rate = (
        round((resolved_previous_success / resolved_previous_total) * 100, 1)
        if resolved_previous_total
        else 0.0
    )

    food_units_change, food_units_positive = _format_short_change(
        float(current_food_units_distributed),
        float(previous_food_units_distributed),
    )
    families_change, families_positive = _format_short_change(
        float(goods_impact_snapshot.current_families_supported_count),
        float(goods_impact_snapshot.previous_families_supported_count),
    )
    redemption_change, redemption_positive = _format_short_change(
        float(current_redemption_rate),
        float(previous_redemption_rate),
    )
    goods_change, goods_positive = _format_short_change(
        float(goods_impact_snapshot.current_goods_units),
        float(goods_impact_snapshot.previous_goods_units),
    )

    return PublicImpactMetricsOut(
        impactMetrics=[
            PublicImpactMetricOut(
                key="food_units_distributed",
                change=food_units_change,
                positive=food_units_positive,
                value=_format_int(all_time_food_units_distributed),
                label="Food Units Distributed",
                note="All Time",
            ),
            PublicImpactMetricOut(
                key="families_supported",
                change=families_change,
                positive=families_positive,
                value=_format_int(goods_impact_snapshot.all_time_families_supported_count),
                label="Families Supported",
                note="All Time",
            ),
            PublicImpactMetricOut(
                key="aid_redemption_success_rate",
                change=redemption_change,
                positive=redemption_positive,
                value=f"{_format_decimal(current_redemption_rate)}%",
                label="Aid Redemption Success Rate",
                note=range_note,
            ),
            PublicImpactMetricOut(
                key="goods_units_year",
                change=goods_change,
                positive=goods_positive,
                value=_format_int(goods_impact_snapshot.current_year_goods_units),
                label="Goods Donation Units",
                note="This Year",
            ),
        ]
    )

@router.get("/public-goods-impact", response_model=PublicImpactMetricsOut)
async def get_public_goods_impact_metrics(
    range_key: Literal["month", "quarter", "year"] = Query("month", alias="range"),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    current_start, next_start, previous_start = _period_bounds(range_key, today)
    range_note = RANGE_NOTES[range_key]

    cash_donations = list(
        (
            await db.execute(
                select(DonationCash).order_by(DonationCash.created_at.asc())
            )
        ).scalars().all()
    )
    goods_donations = list(
        (
            await db.execute(
                select(DonationGoods)
                .options(selectinload(DonationGoods.items))
                .order_by(DonationGoods.created_at.asc())
            )
        ).scalars().all()
    )
    applications = list(
        (
            await db.execute(
                select(Application).order_by(Application.created_at.asc())
            )
        ).scalars().all()
    )

    goods_impact_snapshot = calculate_shared_goods_impact_snapshot(
        cash_donations=cash_donations,
        goods_donations=goods_donations,
        applications=applications,
        today=today,
        current_start=current_start,
        next_start=next_start,
        previous_start=previous_start,
    )

    goods_change, goods_positive = _format_short_change(
        float(goods_impact_snapshot.current_goods_units),
        float(goods_impact_snapshot.previous_goods_units),
    )
    families_change, families_positive = _format_short_change(
        float(goods_impact_snapshot.current_families_supported_count),
        float(goods_impact_snapshot.previous_families_supported_count),
    )

    return PublicImpactMetricsOut(
        impactMetrics=[
            PublicImpactMetricOut(
                key="goods_units_current_period",
                change=goods_change,
                positive=goods_positive,
                value=_format_int(goods_impact_snapshot.current_goods_units),
                label=f"Items Donated {range_note}",
                note=range_note,
            ),
            PublicImpactMetricOut(
                key="families_supported",
                change=families_change,
                positive=families_positive,
                value=_format_int(goods_impact_snapshot.all_time_families_supported_count),
                label="Families Helped",
                note="All Time",
            ),
            PublicImpactMetricOut(
                key="partner_organizations",
                change="",
                positive=True,
                value=_format_int(goods_impact_snapshot.partner_organizations_count),
                label="Partner Organizations",
                note="All Time",
            ),
        ]
    )

@router.get("/dashboard", response_model=DashboardAnalyticsOut)
async def get_dashboard_analytics(
    range_key: Literal["month", "quarter", "year"] = Query("month", alias="range"),
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    current_start, next_start, previous_start = _period_bounds(range_key, today)
    comparison_label = COMPARISON_LABELS[range_key]
    trend_buckets, trend_index, trend_labels = _trend_buckets(
        range_key,
        today,
        current_start,
        next_start,
    )

    cash_donations = list(
        (
            await db.execute(
                select(DonationCash).order_by(DonationCash.created_at.asc())
            )
        ).scalars().all()
    )
    goods_donations = list(
        (
            await db.execute(
                select(DonationGoods)
                .options(selectinload(DonationGoods.items))
                .order_by(DonationGoods.created_at.asc())
            )
        ).scalars().all()
    )
    inventory_items = list(
        (
            await db.execute(
                select(InventoryItem).order_by(InventoryItem.name.asc())
            )
        ).scalars().all()
    )
    inventory_lot_rows = list(
        (
            await db.execute(
                select(InventoryLot, InventoryItem)
                .join(InventoryItem, InventoryItem.id == InventoryLot.inventory_item_id)
                .order_by(InventoryLot.expiry_date.asc(), InventoryLot.id.asc())
            )
        ).all()
    )
    packages = list(
        (
            await db.execute(
                select(FoodPackage)
                .options(
                    selectinload(FoodPackage.package_items).selectinload(PackageItem.inventory_item)
                )
                .order_by(FoodPackage.name.asc())
            )
        ).scalars().all()
    )
    applications = list(
        (
            await db.execute(
                select(Application)
                .options(
                    selectinload(Application.items).selectinload(ApplicationItem.package),
                    selectinload(Application.items).selectinload(ApplicationItem.inventory_item),
                )
                .order_by(Application.created_at.asc())
            )
        ).scalars().all()
    )
    distribution_snapshots = list(
        (
            await db.execute(
                select(ApplicationDistributionSnapshot).order_by(
                    ApplicationDistributionSnapshot.created_at.asc(),
                    ApplicationDistributionSnapshot.id.asc(),
                )
            )
        ).scalars().all()
    )
    waste_events = list(
        (
            await db.execute(
                select(InventoryWasteEvent).order_by(
                    InventoryWasteEvent.occurred_at.asc(),
                    InventoryWasteEvent.id.asc(),
                )
            )
        ).scalars().all()
    )
    admin_food_bank_id = get_admin_food_bank_id(admin_user)
    if admin_food_bank_id is not None:
        cash_donations = [
            donation
            for donation in cash_donations
            if donation.food_bank_id == admin_food_bank_id
        ]
        goods_donations = _filter_records_by_food_bank_id(goods_donations, admin_food_bank_id)
        packages = _filter_records_by_food_bank_id(packages, admin_food_bank_id)
        applications = _filter_records_by_food_bank_id(applications, admin_food_bank_id)
        scoped_application_ids = {application.id for application in applications}
        distribution_snapshots = [
            snapshot
            for snapshot in distribution_snapshots
            if snapshot.application_id in scoped_application_ids
        ]
        inventory_items = []
        inventory_lot_rows = []
        waste_events = []

    goods_impact_snapshot = calculate_shared_goods_impact_snapshot(
        cash_donations=cash_donations,
        goods_donations=goods_donations,
        applications=applications,
        today=today,
        current_start=current_start,
        next_start=next_start,
        previous_start=previous_start,
    )
    distribution_snapshots_by_application_id: dict[
        object, list[ApplicationDistributionSnapshot]
    ] = defaultdict(list)
    for snapshot in distribution_snapshots:
        distribution_snapshots_by_application_id[snapshot.application_id].append(snapshot)

    package_recipe_units = {
        package.id: sum(package_item.quantity for package_item in package.package_items)
        for package in packages
    }
    inventory_items_by_name = sorted(
        inventory_items,
        key=lambda item: len(item.name.strip()),
        reverse=True,
    )

    def resolve_item_category(item_name: str) -> str:
        normalized_name = item_name.strip().lower()
        if not normalized_name:
            return "Uncategorized"
        for inventory_item in inventory_items_by_name:
            candidate = inventory_item.name.strip().lower()
            if candidate == normalized_name or candidate.startswith(normalized_name) or normalized_name.startswith(candidate):
                return inventory_item.category
        return "Uncategorized"

    valid_cash_donations = [row for row in cash_donations if row.status == "completed"]
    valid_goods_donations = [row for row in goods_donations if row.status == "received"]

    donation_source_labels = ["Supermarket", "Individual", "Organization", "Unspecified"]
    donation_source_counts = {label: 0 for label in donation_source_labels}
    donor_frequency: dict[str, dict[str, int | bool]] = defaultdict(
        lambda: {"count": 0, "corporate": False, "supermarket": False}
    )
    donation_trend_totals = [0.0] * len(trend_buckets)
    donation_category_totals: dict[str, int] = defaultdict(int)

    for donation in valid_cash_donations:
        donation_date = _event_date(donation.created_at)
        donor_label = _normalize_donor_type(donation.donor_type)
        donation_source_counts[donor_label] += 1
        donor_key = _donor_identity(donation.donor_email, donation.donor_name)
        if donor_key is not None:
            donor_frequency[donor_key]["count"] = int(donor_frequency[donor_key]["count"]) + 1
            donor_frequency[donor_key]["corporate"] = bool(
                donor_frequency[donor_key]["corporate"]
            ) or donor_label in {"Supermarket", "Organization"}
            donor_frequency[donor_key]["supermarket"] = bool(
                donor_frequency[donor_key]["supermarket"]
            ) or donor_label == "Supermarket"

    for donation in valid_goods_donations:
        donation_date = parse_goods_pickup_date(donation.pickup_date) or _event_date(donation.created_at)
        donor_label = _normalize_donor_type(donation.donor_type)
        donation_source_counts[donor_label] += 1

        donor_key = _donor_identity(donation.donor_email, donation.donor_name)
        if donor_key is not None:
            donor_frequency[donor_key]["count"] = int(donor_frequency[donor_key]["count"]) + 1
            donor_frequency[donor_key]["corporate"] = bool(
                donor_frequency[donor_key]["corporate"]
            ) or donor_label in {"Supermarket", "Organization"}
            donor_frequency[donor_key]["supermarket"] = bool(
                donor_frequency[donor_key]["supermarket"]
            ) or donor_label == "Supermarket"

        donation_quantity = sum(item.quantity for item in donation.items)

        if donation_date is not None:
            trend_bucket = _trend_bucket_key(donation_date, range_key)
            if trend_bucket in trend_index:
                donation_trend_totals[trend_index[trend_bucket]] += donation_quantity

        for item in donation.items:
            donation_category_totals[resolve_item_category(item.item_name)] += item.quantity

    donor_type_regular = 0
    donor_type_one_time = 0
    donor_type_corporate = 0
    for donor_summary in donor_frequency.values():
        if bool(donor_summary["corporate"]):
            donor_type_corporate += 1
        elif int(donor_summary["count"]) <= 1:
            donor_type_one_time += 1
        else:
            donor_type_regular += 1

    current_cash_amounts = [
        donation.amount_pence
        for donation in valid_cash_donations
        if _in_period(_event_date(donation.created_at), current_start, next_start)
    ]
    previous_cash_amounts = [
        donation.amount_pence
        for donation in valid_cash_donations
        if _in_period(_event_date(donation.created_at), previous_start, current_start)
    ]
    current_average_cash = float(mean(current_cash_amounts)) if current_cash_amounts else 0.0
    previous_average_cash = float(mean(previous_cash_amounts)) if previous_cash_amounts else 0.0

    current_stock_by_item_id: dict[int, int] = defaultdict(int)
    stock_by_category: dict[str, int] = defaultdict(int)
    expiring_lot_rows: list[DashboardExpiringLotOut] = []
    expiry_distribution_counts = [0, 0, 0]
    wastage_trend_totals = [0.0] * len(trend_buckets)
    current_wastage_units = 0
    previous_wastage_units = 0

    for waste_event in waste_events:
        waste_date = _event_date(waste_event.occurred_at)
        if _in_period(waste_date, current_start, next_start):
            current_wastage_units += waste_event.quantity
        if _in_period(waste_date, previous_start, current_start):
            previous_wastage_units += waste_event.quantity
        if waste_date is not None:
            trend_bucket = _trend_bucket_key(waste_date, range_key)
            if trend_bucket in trend_index:
                wastage_trend_totals[trend_index[trend_bucket]] += waste_event.quantity

    for lot, inventory_item in inventory_lot_rows:
        if lot.deleted_at is not None:
            continue

        if lot.expiry_date < today:
            continue

        current_stock_by_item_id[lot.inventory_item_id] += lot.quantity
        stock_by_category[inventory_item.category] += lot.quantity

        days_until_expiry = (lot.expiry_date - today).days
        if days_until_expiry <= 30:
            expiry_distribution_counts[0] += 1
            expiring_lot_rows.append(
                DashboardExpiringLotOut(
                    item_name=inventory_item.name,
                    lot_number=lot.batch_reference or f"LOT-{lot.id}",
                    expiry_date=lot.expiry_date.isoformat(),
                    remaining_stock=lot.quantity,
                    remaining_stock_label=_format_table_quantity(lot.quantity, inventory_item.unit),
                    days_until_expiry=days_until_expiry,
                    status_tone="error" if days_until_expiry <= 7 else "warning",
                )
            )
        elif days_until_expiry <= 90:
            expiry_distribution_counts[1] += 1
        else:
            expiry_distribution_counts[2] += 1

    low_stock_alerts: list[DashboardLowStockAlertOut] = []
    inventory_health_counts = {"In Stock": 0, "Low Stock": 0, "Out of Stock": 0}

    for inventory_item in inventory_items:
        current_stock = int(current_stock_by_item_id.get(inventory_item.id, 0))
        if current_stock <= 0:
            inventory_health_counts["Out of Stock"] += 1
        elif current_stock < inventory_item.threshold:
            inventory_health_counts["Low Stock"] += 1
        else:
            inventory_health_counts["In Stock"] += 1

        if current_stock < inventory_item.threshold:
            deficit = inventory_item.threshold - current_stock
            is_critical = current_stock <= 0
            low_stock_alerts.append(
                DashboardLowStockAlertOut(
                    item_name=inventory_item.name,
                    category=inventory_item.category,
                    current_stock=current_stock,
                    current_stock_label=_format_table_quantity(current_stock, inventory_item.unit),
                    threshold=inventory_item.threshold,
                    threshold_label=_format_table_quantity(inventory_item.threshold, inventory_item.unit),
                    deficit=deficit,
                    status="Critical Stock" if is_critical else "Low Stock",
                    status_tone="error" if is_critical else "warning",
                )
            )

    low_stock_alerts.sort(key=lambda row: (row.deficit, -row.current_stock), reverse=True)

    package_trend_totals = [0.0] * len(trend_buckets)
    package_type_totals: dict[str, int] = defaultdict(int)
    food_units_distributed = 0
    aid_packages_distributed = 0
    current_package_quantity = 0
    previous_package_quantity = 0
    support_weeks_by_user: dict[str, set[date]] = defaultdict(set)
    snapshot_package_units_total = 0
    snapshot_package_quantity_total = 0

    redemption_chart_counts = {"Redeemed": 0, "Pending": 0, "Expired / Void": 0}
    redemption_breakdown_counts = {"Success": 0, "Invalid": 0, "Expired": 0}
    redemption_rate_success = [0] * len(trend_buckets)
    redemption_rate_resolved = [0] * len(trend_buckets)
    verification_records: list[tuple[datetime, DashboardVerificationRecordOut]] = []

    for application in applications:
        application_created = _event_date(application.created_at)
        if application.deleted_at is not None:
            redemption_chart_counts["Expired / Void"] += 1
            redemption_breakdown_counts["Invalid"] += 1
            verification_timestamp = _as_utc_naive(application.deleted_at) or _as_utc_naive(application.updated_at) or _as_utc_naive(application.created_at) or datetime.min
            verification_records.append(
                (
                    verification_timestamp,
                    DashboardVerificationRecordOut(
                        redemption_code=application.redemption_code,
                        package_type=_package_display_name(application),
                        verified_at=verification_timestamp.strftime("%Y-%m-%d %H:%M"),
                        status="Invalid",
                        status_tone="error",
                    ),
                )
            )
        elif application.status == "collected":
            redemption_chart_counts["Redeemed"] += 1
            redemption_breakdown_counts["Success"] += 1
            verification_timestamp = _as_utc_naive(application.redeemed_at) or _as_utc_naive(application.updated_at) or _as_utc_naive(application.created_at) or datetime.min
            verification_records.append(
                (
                    verification_timestamp,
                    DashboardVerificationRecordOut(
                        redemption_code=application.redemption_code,
                        package_type=_package_display_name(application),
                        verified_at=verification_timestamp.strftime("%Y-%m-%d %H:%M"),
                        status="Success",
                        status_tone="success",
                    ),
                )
            )
        elif application.status == "expired":
            redemption_chart_counts["Expired / Void"] += 1
            redemption_breakdown_counts["Expired"] += 1
            verification_timestamp = _as_utc_naive(application.updated_at) or _as_utc_naive(application.created_at) or datetime.min
            verification_records.append(
                (
                    verification_timestamp,
                    DashboardVerificationRecordOut(
                        redemption_code=application.redemption_code,
                        package_type=_package_display_name(application),
                        verified_at=verification_timestamp.strftime("%Y-%m-%d %H:%M"),
                        status="Expired",
                        status_tone="warning",
                    ),
                )
            )
        else:
            redemption_chart_counts["Pending"] += 1

        if application_created is not None:
            trend_bucket = _trend_bucket_key(application_created, range_key)
            if trend_bucket in trend_index:
                bucket_index = trend_index[trend_bucket]
                if application.deleted_at is not None or application.status == "expired":
                    redemption_rate_resolved[bucket_index] += 1
                elif application.status == "collected":
                    redemption_rate_success[bucket_index] += 1
                    redemption_rate_resolved[bucket_index] += 1

        if application.deleted_at is not None:
            continue

        support_weeks_by_user[str(application.user_id)].add(application.week_start)

        application_bucket = _trend_bucket_key(application_created, range_key)
        application_snapshots = distribution_snapshots_by_application_id.get(application.id, [])
        package_snapshots = [
            snapshot
            for snapshot in application_snapshots
            if snapshot.snapshot_type == "package"
        ]
        component_snapshots = [
            snapshot
            for snapshot in application_snapshots
            if snapshot.snapshot_type == "package_component"
        ]
        direct_item_snapshots = [
            snapshot
            for snapshot in application_snapshots
            if snapshot.snapshot_type == "direct_item"
        ]

        if package_snapshots or component_snapshots or direct_item_snapshots:
            package_quantity = sum(snapshot.requested_quantity for snapshot in package_snapshots)
            aid_packages_distributed += package_quantity
            food_units_distributed += sum(
                snapshot.distributed_quantity for snapshot in component_snapshots
            )
            food_units_distributed += sum(
                snapshot.distributed_quantity for snapshot in direct_item_snapshots
            )
            snapshot_package_units_total += sum(
                (snapshot.recipe_unit_total or 0) * snapshot.requested_quantity
                for snapshot in package_snapshots
            )
            snapshot_package_quantity_total += package_quantity

            if _in_period(application_created, current_start, next_start):
                current_package_quantity += package_quantity
            if _in_period(application_created, previous_start, current_start):
                previous_package_quantity += package_quantity

            if application_bucket in trend_index:
                package_trend_totals[trend_index[application_bucket]] += package_quantity

            for snapshot in package_snapshots:
                package_type_totals[snapshot.package_category or "Uncategorized"] += (
                    snapshot.requested_quantity
                )
        else:
            for item in application.items:
                if item.package_id is not None:
                    aid_packages_distributed += item.quantity
                    food_units_distributed += package_recipe_units.get(item.package_id, 0) * item.quantity

                    if _in_period(application_created, current_start, next_start):
                        current_package_quantity += item.quantity
                    if _in_period(application_created, previous_start, current_start):
                        previous_package_quantity += item.quantity

                    if application_bucket in trend_index:
                        package_trend_totals[trend_index[application_bucket]] += item.quantity

                    if item.package is not None:
                        package_type_totals[item.package.category] += item.quantity
                elif item.inventory_item_id is not None:
                    food_units_distributed += item.quantity

    resolved_current_total = 0
    resolved_current_success = 0
    for application in applications:
        application_created = _event_date(application.created_at)
        if not _in_period(application_created, current_start, next_start):
            continue
        if application.deleted_at is not None or application.status == "expired":
            resolved_current_total += 1
        elif application.status == "collected":
            resolved_current_total += 1
            resolved_current_success += 1

    redemption_rate_value = (
        round((resolved_current_success / resolved_current_total) * 100, 1)
        if resolved_current_total
        else 0.0
    )

    average_support_duration = (
        mean(len(weeks) for weeks in support_weeks_by_user.values())
        if support_weeks_by_user
        else 0.0
    )

    if snapshot_package_quantity_total:
        average_items_per_package = snapshot_package_units_total / snapshot_package_quantity_total
    else:
        active_packages = [package for package in packages if package.is_active]
        weighted_recipe_units = 0
        weighted_recipe_weight = 0
        for package in active_packages:
            recipe_units = package_recipe_units.get(package.id, 0)
            weight = package.applied_count if package.applied_count > 0 else 1
            weighted_recipe_units += recipe_units * weight
            weighted_recipe_weight += weight
        average_items_per_package = (
            weighted_recipe_units / weighted_recipe_weight
            if weighted_recipe_weight
            else 0.0
        )

    donation_category_pairs = sorted(
        donation_category_totals.items(),
        key=lambda pair: pair[1],
        reverse=True,
    )[:6]
    inventory_category_pairs = sorted(
        stock_by_category.items(),
        key=lambda pair: pair[1],
        reverse=True,
    )[:6]
    package_type_pairs = sorted(
        package_type_totals.items(),
        key=lambda pair: pair[1],
        reverse=True,
    )[:6]

    expiring_lot_rows.sort(key=lambda row: (row.days_until_expiry, row.item_name))
    verification_records.sort(key=lambda pair: pair[0], reverse=True)

    donation_analytics = DashboardDonationAnalyticsOut(
        source=_chart(
            donation_source_labels,
            [donation_source_counts[label] for label in donation_source_labels],
        ),
        trend=_chart(trend_labels, donation_trend_totals),
        category=_chart(
            [label for label, _ in donation_category_pairs],
            [value for _, value in donation_category_pairs],
        ),
        donorType=_chart(
            ["Regular Donors", "One-Time Donors", "Corporate Partners"],
            [donor_type_regular, donor_type_one_time, donor_type_corporate],
        ),
        averageValue=DashboardDisplayCardOut(
            title="Average Donation Value",
            value=_format_currency_from_pence(current_average_cash),
            subtitle="Per completed cash donation",
            trend=_format_change(current_average_cash, previous_average_cash, comparison_label),
        ),
    )

    inventory_analytics = DashboardInventoryAnalyticsOut(
        health=_chart(
            ["In Stock", "Low Stock", "Out of Stock"],
            [
                inventory_health_counts["In Stock"],
                inventory_health_counts["Low Stock"],
                inventory_health_counts["Out of Stock"],
            ],
        ),
        category=_chart(
            [label for label, _ in inventory_category_pairs],
            [value for _, value in inventory_category_pairs],
        ),
        lowStockAlerts=low_stock_alerts[:10],
    )

    package_analytics = DashboardPackageAnalyticsOut(
        trend=_chart(trend_labels, package_trend_totals),
        redemption=_chart(
            ["Redeemed", "Pending", "Expired / Void"],
            [
                redemption_chart_counts["Redeemed"],
                redemption_chart_counts["Pending"],
                redemption_chart_counts["Expired / Void"],
            ],
        ),
        packageType=_chart(
            [label for label, _ in package_type_pairs],
            [value for _, value in package_type_pairs],
        ),
        averageSupportDuration=DashboardDisplayCardOut(
            title="Average Family Support Duration",
            value=_format_decimal(float(average_support_duration)),
            subtitle="Distinct support weeks per household",
            trend=None,
        ),
        itemsPerPackage=DashboardDisplayCardOut(
            title="Items Per Package",
            value=_format_decimal(float(average_items_per_package)),
            subtitle="Average ingredient units per distributed package",
            trend=None,
        ),
    )

    expiry_analytics = DashboardExpiryAnalyticsOut(
        distribution=_chart(
            ["Expiring in 30 Days", "30-90 Days", "90+ Days"],
            expiry_distribution_counts,
        ),
        wastage=DashboardExpiryChartOut(
            labels=trend_labels,
            data=[float(value) for value in wastage_trend_totals],
            label="Wasted Units",
        ),
        expiringLots=expiring_lot_rows[:10],
    )

    redemption_rate_values = [
        round((success / resolved) * 100, 1) if resolved else 0.0
        for success, resolved in zip(redemption_rate_success, redemption_rate_resolved)
    ]
    redemption_analytics = DashboardRedemptionAnalyticsOut(
        rateTrend=_chart(trend_labels, redemption_rate_values),
        breakdown=_chart(
            ["Success", "Invalid", "Expired"],
            [
                redemption_breakdown_counts["Success"],
                redemption_breakdown_counts["Invalid"],
                redemption_breakdown_counts["Expired"],
            ],
        ),
        recentVerificationRecords=[record for _, record in verification_records[:8]],
    )

    kpi = DashboardKpiOut(
        totalDonation=goods_impact_snapshot.current_goods_units,
        totalSku=len(inventory_items),
        totalPackageDistributed=current_package_quantity,
        lowStockCount=len(low_stock_alerts),
        expiringLotCount=len(expiring_lot_rows),
        redemptionRate=redemption_rate_value,
        trends=DashboardKpiTrendsOut(
            donation=_format_change(
                goods_impact_snapshot.current_goods_units,
                goods_impact_snapshot.previous_goods_units,
                comparison_label,
            ),
            package=_format_change(current_package_quantity, previous_package_quantity, comparison_label),
            lowStock=f"{len(low_stock_alerts)} live inventory alert(s)",
            wastage=_format_change(current_wastage_units, previous_wastage_units, comparison_label),
        ),
    )

    impact_metrics = [
        DashboardImpactMetricOut(
            key="families_supported",
            value=_format_int(goods_impact_snapshot.all_time_families_supported_count),
            label="Families Supported",
        ),
        DashboardImpactMetricOut(
            key="food_units_distributed",
            value=_format_int(food_units_distributed),
            label="Food Units Distributed",
        ),
        DashboardImpactMetricOut(
            key="partner_organizations",
            value=_format_int(goods_impact_snapshot.partner_organizations_count),
            label="Partner Organizations",
        ),
        DashboardImpactMetricOut(
            key="goods_units_year",
            value=_format_int(goods_impact_snapshot.current_year_goods_units),
            label="Goods Donation Units / Year",
        ),
        DashboardImpactMetricOut(
            key="aid_packages_distributed",
            value=_format_int(aid_packages_distributed),
            label="Aid Packages Distributed",
        ),
    ]

    return DashboardAnalyticsOut(
        impactMetrics=impact_metrics,
        kpi=kpi,
        donation=donation_analytics,
        inventory=inventory_analytics,
        package=package_analytics,
        expiry=expiry_analytics,
        redemption=redemption_analytics,
    )
