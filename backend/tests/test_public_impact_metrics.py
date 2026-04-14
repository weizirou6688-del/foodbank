from __future__ import annotations

import asyncio
import sys
from datetime import date
from pathlib import Path
from types import SimpleNamespace

import pytest

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import app.routers.stats_public as stats_public_module
from app.services.impact_metrics_service import (
    GoodsImpactSnapshot,
    calculate_goods_impact_snapshot,
)


def _goods_donation(
    pickup_date: date,
    quantity: int,
    *,
    status: str = "received",
    food_bank_id: int | None = 1,
):
    return SimpleNamespace(
        status=status,
        food_bank_id=food_bank_id,
        pickup_date=pickup_date,
        created_at=pickup_date,
        items=[SimpleNamespace(quantity=quantity)],
    )


def _application(
    created_at: date,
    user_id: str,
    *,
    application_id: int = 1,
    deleted: bool = False,
    food_bank_id: int | None = 1,
    status: str = "collected",
    redeemed_at: date | None = None,
    updated_at: date | None = None,
):
    return SimpleNamespace(
        id=application_id,
        created_at=created_at,
        updated_at=updated_at or redeemed_at or created_at,
        redeemed_at=redeemed_at,
        status=status,
        deleted_at=date(2026, 4, 14) if deleted else None,
        user_id=user_id,
        food_bank_id=food_bank_id,
    )


def test_calculate_goods_impact_snapshot_tracks_ytd_and_all_time_growth_baselines() -> None:
    snapshot = calculate_goods_impact_snapshot(
        goods_donations=[
            _goods_donation(date(2026, 4, 5), 27),
            _goods_donation(date(2026, 3, 4), 18),
            _goods_donation(date(2026, 1, 10), 40),
            _goods_donation(date(2025, 2, 20), 8),
            _goods_donation(date(2025, 4, 5), 12),
            _goods_donation(date(2025, 8, 1), 99),
            _goods_donation(date(2026, 4, 9), 13, status="pending"),
            _goods_donation(date(2026, 4, 11), 15, food_bank_id=None),
        ],
        applications=[
            _application(date(2026, 3, 2), "family-a", application_id=1),
            _application(date(2026, 3, 10), "family-b", application_id=2),
            _application(date(2026, 4, 3), "family-c", application_id=3),
            _application(date(2026, 4, 5), "family-b", application_id=4),
            _application(date(2026, 4, 10), "family-d", application_id=5),
            _application(date(2026, 4, 12), "family-e", application_id=6, deleted=True),
            _application(date(2026, 4, 13), "family-f", application_id=7, food_bank_id=None),
        ],
        today=date(2026, 4, 14),
        current_start=date(2026, 4, 1),
        current_end=date(2026, 4, 15),
        previous_start=date(2026, 3, 1),
        previous_end=date(2026, 3, 15),
    )

    assert snapshot == GoodsImpactSnapshot(
        current_goods_units=27,
        previous_goods_units=18,
        current_year_goods_units=85,
        previous_year_goods_units=20,
        all_time_families_supported_count=4,
        all_time_families_supported_before_current_period_count=2,
        current_families_supported_count=3,
        previous_families_supported_count=2,
    )


def test_public_impact_metrics_align_change_with_displayed_totals(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    current_start = date(2026, 4, 1)
    current_end = date(2026, 4, 15)
    previous_start = date(2026, 3, 1)
    previous_end = date(2026, 3, 15)
    applications = [
        _application(
            date(2026, 3, 10),
            "family-a",
            application_id=1,
            redeemed_at=date(2026, 3, 12),
        ),
        _application(
            date(2026, 4, 5),
            "family-b",
            application_id=2,
            redeemed_at=date(2026, 4, 5),
        ),
        _application(
            date(2026, 3, 30),
            "family-c",
            application_id=3,
            redeemed_at=date(2026, 4, 8),
        ),
    ]
    observed_snapshot_bounds: dict[str, date] = {}

    monkeypatch.setattr(
        stats_public_module,
        "_public_range_context",
        lambda _range_key: (
            date(2026, 4, 14),
            current_start,
            date(2026, 5, 1),
            previous_start,
            "This Month",
        ),
    )

    async def _fake_load_public_impact_inputs(*_args, **_kwargs):
        return [], [], applications, []

    def _fake_calculate_goods_impact_snapshot(**kwargs):
        observed_snapshot_bounds["current_end"] = kwargs["current_end"]
        observed_snapshot_bounds["previous_end"] = kwargs["previous_end"]
        return GoodsImpactSnapshot(
            current_goods_units=27,
            previous_goods_units=1,
            current_year_goods_units=27,
            previous_year_goods_units=45,
            all_time_families_supported_count=146,
            all_time_families_supported_before_current_period_count=120,
            current_families_supported_count=146,
            previous_families_supported_count=1,
        )

    monkeypatch.setattr(
        stats_public_module,
        "_load_public_impact_inputs",
        _fake_load_public_impact_inputs,
    )
    monkeypatch.setattr(
        stats_public_module,
        "calculate_goods_impact_snapshot",
        _fake_calculate_goods_impact_snapshot,
    )
    monkeypatch.setattr(
        stats_public_module,
        "_group_distribution_snapshots",
        lambda _snapshots: {},
    )
    monkeypatch.setattr(
        stats_public_module,
        "_package_recipe_units",
        lambda _packages: {},
    )
    monkeypatch.setattr(
        stats_public_module,
        "_application_distribution_summary",
        lambda application, *_args, **_kwargs: (
            0,
            1000 if application.id == 1 else 149 if application.id == 2 else 0,
            0,
            0,
            [],
        ),
    )

    payload = asyncio.run(
        stats_public_module.get_public_impact_metrics(range_key="month", db=None)
    )

    assert observed_snapshot_bounds == {
        "current_end": current_end,
        "previous_end": previous_end,
    }

    metrics_by_key = {metric.key: metric for metric in payload.impactMetrics}

    assert metrics_by_key["food_units_distributed"].value == "1,149"
    assert metrics_by_key["food_units_distributed"].change == "+14.9%"
    assert metrics_by_key["families_supported"].value == "146"
    assert metrics_by_key["families_supported"].change == "+26 families"
    assert metrics_by_key["completed_food_pickups"].value == "2"
    assert metrics_by_key["completed_food_pickups"].change == "+1 pickup"
    assert metrics_by_key["goods_units_year"].value == "27"
    assert metrics_by_key["goods_units_year"].change == "-40.0%"
