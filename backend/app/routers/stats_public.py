from __future__ import annotations

from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.analytics_utils import event_date as _event_date
from app.core.analytics_utils import in_period as _in_period
from app.services.stats_distribution_service import (
    _application_distribution_summary,
    _group_distribution_snapshots,
    _package_recipe_units,
)
from app.services.stats_input_loading_service import _load_public_impact_inputs
from app.routers.stats_formatters import (
    _absolute_changed_public_metric,
    _changed_public_metric,
    _format_int,
    _public_range_context,
)
from app.schemas.stats import PublicImpactMetricsOut
from app.services.impact_metrics_service import calculate_goods_impact_snapshot


router = APIRouter()


def _application_pickup_date(application: object) -> date | None:
    return (
        _event_date(getattr(application, "redeemed_at", None))
        or _event_date(getattr(application, "updated_at", None))
        or _event_date(getattr(application, "created_at", None))
    )


def _completed_pickup_count(
    applications: list[object], start: date, end: date
) -> int:
    return sum(
        getattr(application, "deleted_at", None) is None
        and getattr(application, "status", None) == "collected"
        and _in_period(_application_pickup_date(application), start, end)
        for application in applications
    )


@router.get("/public-impact", response_model=PublicImpactMetricsOut)
async def get_public_impact_metrics(
    range_key: Literal["month", "quarter", "year"] = Query("month", alias="range"),
    db: AsyncSession = Depends(get_db),
):
    today, current_start, next_start, previous_start, range_note = _public_range_context(
        range_key
    )
    current_end = min(today + timedelta(days=1), next_start)
    previous_end = min(previous_start + (current_end - current_start), current_start)
    goods_donations, packages, applications, distribution_snapshots = (
        await _load_public_impact_inputs(
            db,
            include_packages=True,
            include_application_items=True,
            include_snapshots=True,
        )
    )

    goods_impact_snapshot = calculate_goods_impact_snapshot(
        goods_donations=goods_donations,
        applications=applications,
        today=today,
        current_start=current_start,
        current_end=current_end,
        previous_start=previous_start,
        previous_end=previous_end,
    )

    distribution_snapshots_by_application_id = _group_distribution_snapshots(
        distribution_snapshots
    )
    package_recipe_units = _package_recipe_units(packages)

    all_time_food_units_distributed = 0
    all_time_food_units_before_current_period = 0

    for application in applications:
        if application.deleted_at is not None:
            continue

        application_created = _event_date(application.created_at)
        application_food_units = _application_distribution_summary(
            application, distribution_snapshots_by_application_id.get(application.id, []), package_recipe_units
        )[1]
        all_time_food_units_distributed += application_food_units
        if application_created is not None and application_created < current_start:
            all_time_food_units_before_current_period += application_food_units

    current_completed_pickups = _completed_pickup_count(
        applications, current_start, current_end
    )
    previous_completed_pickups = _completed_pickup_count(
        applications, previous_start, previous_end
    )

    return PublicImpactMetricsOut(
        impactMetrics=[
            _changed_public_metric("food_units_distributed", all_time_food_units_distributed, all_time_food_units_before_current_period, _format_int(all_time_food_units_distributed), "Food Units Distributed", "All Time"),
            _absolute_changed_public_metric(
                "families_supported",
                goods_impact_snapshot.all_time_families_supported_count,
                goods_impact_snapshot.all_time_families_supported_before_current_period_count,
                _format_int(goods_impact_snapshot.all_time_families_supported_count),
                "Families Supported",
                "All Time",
                singular_unit="family",
                plural_unit="families",
            ),
            _absolute_changed_public_metric(
                "completed_food_pickups",
                current_completed_pickups,
                previous_completed_pickups,
                _format_int(current_completed_pickups),
                "Completed Food Pickups",
                range_note,
                singular_unit="pickup",
                plural_unit="pickups",
            ),
            _changed_public_metric("goods_units_year", goods_impact_snapshot.current_year_goods_units, goods_impact_snapshot.previous_year_goods_units, _format_int(goods_impact_snapshot.current_year_goods_units), "Goods Donation Units", "This Year"),
        ]
    )
