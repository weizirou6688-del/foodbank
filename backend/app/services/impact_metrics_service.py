from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Sequence

from app.core.analytics_utils import (
    event_date as _event_date,
    in_period as _in_period,
    is_bank_scoped_record as _is_bank_scoped,
)
from app.core.goods_donation_format import parse_goods_pickup_date


@dataclass(frozen=True)
class GoodsImpactSnapshot:
    current_goods_units: int
    previous_goods_units: int
    current_year_goods_units: int
    previous_year_goods_units: int
    all_time_families_supported_count: int
    all_time_families_supported_before_current_period_count: int
    current_families_supported_count: int
    previous_families_supported_count: int


@dataclass(frozen=True)
class GoodsImpactWindow:
    current_start: date
    current_end: date
    previous_start: date
    previous_end: date
    current_year_start: date
    current_year_end: date
    previous_year_start: date
    previous_year_end: date


def _build_goods_impact_window(
    *,
    today: date,
    current_start: date,
    current_end: date,
    previous_start: date,
    previous_end: date,
) -> GoodsImpactWindow:
    current_year_start = date(today.year, 1, 1)
    next_year_start = date(today.year + 1, 1, 1)
    current_year_end = min(today + timedelta(days=1), next_year_start)
    previous_year_start = date(today.year - 1, 1, 1)
    previous_year_end = previous_year_start + (current_year_end - current_year_start)
    return GoodsImpactWindow(
        current_start=current_start,
        current_end=current_end,
        previous_start=previous_start,
        previous_end=previous_end,
        current_year_start=current_year_start,
        current_year_end=current_year_end,
        previous_year_start=previous_year_start,
        previous_year_end=previous_year_end,
    )


def _goods_donation_date(donation: object) -> date | None:
    return parse_goods_pickup_date(getattr(donation, "pickup_date", None)) or _event_date(
        getattr(donation, "created_at", None)
    )


def _goods_donation_units(donation: object) -> int:
    return sum(getattr(item, "quantity", 0) for item in getattr(donation, "items", []))


def _valid_goods_donations(goods_donations: Sequence[object]) -> list[object]:
    return [
        row
        for row in goods_donations
        if getattr(row, "status", None) == "received" and _is_bank_scoped(row)
    ]


def _sum_goods_units_in_period(
    goods_donations: Sequence[object],
    *,
    start: date,
    end: date,
) -> int:
    total = 0
    for donation in goods_donations:
        if _in_period(_goods_donation_date(donation), start, end):
            total += _goods_donation_units(donation)
    return total


def _supported_family_sets(
    applications: Sequence[object],
    *,
    current_start: date,
    current_end: date,
    previous_start: date,
    previous_end: date,
) -> tuple[set[str], set[str], set[str], set[str]]:
    all_time_families_supported: set[str] = set()
    all_time_before_current_period: set[str] = set()
    current_families_supported: set[str] = set()
    previous_families_supported: set[str] = set()

    for application in applications:
        if not _is_bank_scoped(application):
            continue
        if getattr(application, "deleted_at", None) is not None:
            continue

        application_created = _event_date(getattr(application, "created_at", None))
        user_id = str(getattr(application, "user_id"))
        all_time_families_supported.add(user_id)

        if application_created is not None and application_created < current_start:
            all_time_before_current_period.add(user_id)
        if _in_period(application_created, current_start, current_end):
            current_families_supported.add(user_id)
        if _in_period(application_created, previous_start, previous_end):
            previous_families_supported.add(user_id)

    return (
        all_time_families_supported,
        all_time_before_current_period,
        current_families_supported,
        previous_families_supported,
    )


def calculate_goods_impact_snapshot(
    *,
    goods_donations: Sequence[object],
    applications: Sequence[object],
    today: date,
    current_start: date,
    current_end: date,
    previous_start: date,
    previous_end: date,
) -> GoodsImpactSnapshot:
    window = _build_goods_impact_window(
        today=today,
        current_start=current_start,
        current_end=current_end,
        previous_start=previous_start,
        previous_end=previous_end,
    )
    valid_goods_donations = _valid_goods_donations(goods_donations)
    (
        all_time_families_supported,
        all_time_before_current_period,
        current_families_supported,
        previous_families_supported,
    ) = _supported_family_sets(
        applications,
        current_start=window.current_start,
        current_end=window.current_end,
        previous_start=window.previous_start,
        previous_end=window.previous_end,
    )

    return GoodsImpactSnapshot(
        current_goods_units=_sum_goods_units_in_period(
            valid_goods_donations,
            start=window.current_start,
            end=window.current_end,
        ),
        previous_goods_units=_sum_goods_units_in_period(
            valid_goods_donations,
            start=window.previous_start,
            end=window.previous_end,
        ),
        current_year_goods_units=_sum_goods_units_in_period(
            valid_goods_donations,
            start=window.current_year_start,
            end=window.current_year_end,
        ),
        previous_year_goods_units=_sum_goods_units_in_period(
            valid_goods_donations,
            start=window.previous_year_start,
            end=window.previous_year_end,
        ),
        all_time_families_supported_count=len(all_time_families_supported),
        all_time_families_supported_before_current_period_count=len(
            all_time_before_current_period
        ),
        current_families_supported_count=len(current_families_supported),
        previous_families_supported_count=len(previous_families_supported),
    )
