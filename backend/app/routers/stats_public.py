"""Public impact metrics 路由。

公众首页用的影响力指标。带 admin token 时会限定到该管理员所属的 food bank。

TODO: 缓存层还没加,数据量大的时候每次都重算会慢。
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.analytics_utils import event_date as _event_date
from app.core.analytics_utils import in_period as _in_period
from app.core.analytics_utils import is_bank_scoped_record as _is_bank_scoped_record
from app.core.database import get_db
from app.core.db_utils import fetch_scalars as _fetch_scalars
from app.core.security import get_admin_food_bank_id, get_optional_current_user
from app.models.application import Application
from app.models.application_distribution_snapshot import ApplicationDistributionSnapshot
from app.models.application_item import ApplicationItem
from app.models.donation_goods import DonationGoods
from app.models.food_package import FoodPackage
from app.models.package_item import PackageItem
from app.schemas.stats import PublicImpactMetricOut, PublicImpactMetricsOut
from app.services.impact_metrics_service import calculate_goods_impact_snapshot
from app.services.stats_distribution_service import (
    _application_distribution_summary,
    _group_distribution_snapshots,
    _package_recipe_units,
)


router = APIRouter()

StatsRangeKey = Literal["month", "quarter", "year"]

RANGE_NOTES = {
    "month": "This Month",
    "quarter": "This Quarter",
    "year": "This Year",
}

_GOODS_DONATION_ITEM_OPTIONS = (selectinload(DonationGoods.items),)
_PACKAGE_ITEM_OPTIONS = (
    selectinload(FoodPackage.package_items).selectinload(PackageItem.inventory_item),
)
_APPLICATION_ITEM_OPTIONS = (
    selectinload(Application.items).selectinload(ApplicationItem.package),
    selectinload(Application.items).selectinload(ApplicationItem.inventory_item),
)


@dataclass(frozen=True)
class ChangeSummary:
    change: str
    positive: bool


@dataclass(frozen=True)
class PublicRangeContext:
    today: date
    current_start: date
    next_start: date
    previous_start: date
    current_end: date
    previous_end: date
    range_note: str


@dataclass(frozen=True)
class PublicImpactInputs:
    goods_donations: list[object]
    packages: list[object]
    applications: list[object]
    distribution_snapshots: list[object]


def _shift_month(day: date, offset: int) -> date:
    month_index = (day.year * 12 + (day.month - 1)) + offset
    year = month_index // 12
    month = month_index % 12 + 1
    return date(year, month, 1)


def _period_bounds(range_key: StatsRangeKey, today: date) -> tuple[date, date, date]:
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


def _percent_change(current: float, previous: float) -> float | None:
    if previous == 0:
        return 0.0 if current == 0 else None
    return ((current - previous) / previous) * 100


def _format_short_change(current: float, previous: float) -> ChangeSummary:
    change = _percent_change(current, previous)
    if change is None:
        return ChangeSummary(change="New", positive=True)
    return ChangeSummary(
        change=f"{'+' if change >= 0 else ''}{change:.1f}%",
        positive=change >= 0,
    )


def _format_short_absolute_change(
    current: int,
    previous: int,
    singular_unit: str,
    plural_unit: str | None = None,
) -> ChangeSummary:
    delta = current - previous
    unit = singular_unit if abs(delta) == 1 else (plural_unit or f"{singular_unit}s")
    sign = "+" if delta >= 0 else "-"
    return ChangeSummary(
        change=f"{sign}{abs(delta):,} {unit}",
        positive=delta >= 0,
    )


def _format_int(value: int) -> str:
    return f"{value:,}"


def _public_range_context(range_key: StatsRangeKey) -> PublicRangeContext:
    today = date.today()
    current_start, next_start, previous_start = _period_bounds(range_key, today)
    current_end = min(today + timedelta(days=1), next_start)
    previous_end = min(previous_start + (current_end - current_start), current_start)
    return PublicRangeContext(
        today=today,
        current_start=current_start,
        next_start=next_start,
        previous_start=previous_start,
        current_end=current_end,
        previous_end=previous_end,
        range_note=RANGE_NOTES[range_key],
    )


def _filter_bank_scoped_records(records: list[object]) -> list[object]:
    return [record for record in records if _is_bank_scoped_record(record)]


def _public_impact_scope_food_bank_id(current_user: object) -> int | None:
    if not isinstance(current_user, dict) or current_user.get("role") != "admin":
        return None
    return get_admin_food_bank_id(current_user)


def _scope_public_impact_inputs(
    impact_inputs: PublicImpactInputs,
    current_user: object,
) -> PublicImpactInputs:
    scoped_food_bank_id = _public_impact_scope_food_bank_id(current_user)
    if scoped_food_bank_id is None:
        return impact_inputs

    scoped_goods_donations = [
        donation
        for donation in impact_inputs.goods_donations
        if getattr(donation, "food_bank_id", None) == scoped_food_bank_id
    ]
    scoped_packages = [
        package
        for package in impact_inputs.packages
        if getattr(package, "food_bank_id", None) == scoped_food_bank_id
    ]
    scoped_applications = [
        application
        for application in impact_inputs.applications
        if getattr(application, "food_bank_id", None) == scoped_food_bank_id
    ]
    scoped_application_ids = {
        getattr(application, "id", None) for application in scoped_applications
    }
    scoped_distribution_snapshots = [
        snapshot
        for snapshot in impact_inputs.distribution_snapshots
        if getattr(snapshot, "application_id", None) in scoped_application_ids
    ]

    return PublicImpactInputs(
        goods_donations=scoped_goods_donations,
        packages=scoped_packages,
        applications=scoped_applications,
        distribution_snapshots=scoped_distribution_snapshots,
    )


async def _load_public_impact_inputs(
    db: AsyncSession,
    *,
    include_packages: bool = False,
    include_application_items: bool = False,
    include_snapshots: bool = False,
) -> PublicImpactInputs:
    # 公众指标页和 admin 视图复用同一份底层历史,
    # 不过只加载选中的卡片需要的那些数据集
    goods_donations = _filter_bank_scoped_records(
        await _fetch_scalars(
            db,
            select(DonationGoods)
            .options(*_GOODS_DONATION_ITEM_OPTIONS)
            .order_by(DonationGoods.created_at.asc()),
        )
    )
    packages = (
        _filter_bank_scoped_records(
            await _fetch_scalars(
                db,
                select(FoodPackage)
                .options(*_PACKAGE_ITEM_OPTIONS)
                .order_by(FoodPackage.name.asc()),
            )
        )
        if include_packages
        else []
    )
    applications_query = select(Application).order_by(Application.created_at.asc())
    if include_application_items:
        applications_query = applications_query.options(*_APPLICATION_ITEM_OPTIONS)
    applications = _filter_bank_scoped_records(
        await _fetch_scalars(
            db,
            applications_query,
        )
    )
    distribution_snapshots = (
        await _fetch_scalars(
            db,
            select(ApplicationDistributionSnapshot).order_by(
                ApplicationDistributionSnapshot.created_at.asc(),
                ApplicationDistributionSnapshot.id.asc(),
            ),
        )
        if include_snapshots
        else []
    )
    return PublicImpactInputs(
        goods_donations=goods_donations,
        packages=packages,
        applications=applications,
        distribution_snapshots=distribution_snapshots,
    )


def _application_pickup_date(application: object) -> date | None:
    return (
        _event_date(getattr(application, "redeemed_at", None))
        or _event_date(getattr(application, "updated_at", None))
        or _event_date(getattr(application, "created_at", None))
    )


def _completed_pickup_count(
    applications: list[object],
    start: date,
    end: date,
) -> int:
    return sum(
        getattr(application, "deleted_at", None) is None
        and getattr(application, "status", None) == "collected"
        and _in_period(_application_pickup_date(application), start, end)
        for application in applications
    )


@router.get("/public-impact", response_model=PublicImpactMetricsOut)
async def get_public_impact_metrics(
    range_key: StatsRangeKey = Query("month", alias="range"),
    current_user: dict | None = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    range_context = _public_range_context(range_key)
    # 公众端计数器靠存好的 distribution snapshot,后面 admin 改 package recipe
    # 也不会影响历史数据
    impact_inputs = _scope_public_impact_inputs(
        await _load_public_impact_inputs(
            db,
            include_packages=True,
            include_application_items=True,
            include_snapshots=True,
        ),
        current_user,
    )

    goods_impact_snapshot = calculate_goods_impact_snapshot(
        goods_donations=impact_inputs.goods_donations,
        applications=impact_inputs.applications,
        today=range_context.today,
        current_start=range_context.current_start,
        current_end=range_context.current_end,
        previous_start=range_context.previous_start,
        previous_end=range_context.previous_end,
    )

    distribution_snapshots_by_application_id = _group_distribution_snapshots(
        impact_inputs.distribution_snapshots
    )
    package_recipe_units = _package_recipe_units(impact_inputs.packages)

    all_time_food_units_distributed = 0
    all_time_food_units_before_current_period = 0

    for application in impact_inputs.applications:
        if application.deleted_at is not None:
            continue

        application_created = _event_date(application.created_at)
        distribution_summary = _application_distribution_summary(
            application,
            distribution_snapshots_by_application_id.get(application.id, []),
            package_recipe_units,
        )
        all_time_food_units_distributed += distribution_summary.food_units
        if (
            application_created is not None
            and application_created < range_context.current_start
        ):
            all_time_food_units_before_current_period += distribution_summary.food_units

    current_completed_pickups = _completed_pickup_count(
        impact_inputs.applications,
        range_context.current_start,
        range_context.current_end,
    )
    previous_completed_pickups = _completed_pickup_count(
        impact_inputs.applications,
        range_context.previous_start,
        range_context.previous_end,
    )
    food_units_change = _format_short_change(
        float(all_time_food_units_distributed),
        float(all_time_food_units_before_current_period),
    )
    families_change = _format_short_absolute_change(
        goods_impact_snapshot.all_time_families_supported_count,
        goods_impact_snapshot.all_time_families_supported_before_current_period_count,
        "family",
        "families",
    )
    pickups_change = _format_short_absolute_change(
        current_completed_pickups,
        previous_completed_pickups,
        "pickup",
        "pickups",
    )
    goods_units_change = _format_short_change(
        float(goods_impact_snapshot.current_year_goods_units),
        float(goods_impact_snapshot.previous_year_goods_units),
    )

    return PublicImpactMetricsOut(
        impactMetrics=[
            PublicImpactMetricOut(
                key="food_units_distributed",
                change=food_units_change.change,
                positive=food_units_change.positive,
                value=_format_int(all_time_food_units_distributed),
                label="Food Units Distributed",
                note="All Time",
            ),
            PublicImpactMetricOut(
                key="families_supported",
                change=families_change.change,
                positive=families_change.positive,
                value=_format_int(goods_impact_snapshot.all_time_families_supported_count),
                label="Families Supported",
                note="All Time",
            ),
            PublicImpactMetricOut(
                key="completed_food_pickups",
                change=pickups_change.change,
                positive=pickups_change.positive,
                value=_format_int(current_completed_pickups),
                label="Completed Food Pickups",
                note=range_context.range_note,
            ),
            PublicImpactMetricOut(
                key="goods_units_year",
                change=goods_units_change.change,
                positive=goods_units_change.positive,
                value=_format_int(goods_impact_snapshot.current_year_goods_units),
                label="Goods Donation Units",
                note="This Year",
            ),
        ]
    )
