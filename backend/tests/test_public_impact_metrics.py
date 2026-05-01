from __future__ import annotations

from datetime import date
from types import SimpleNamespace

import pytest

import app.routers.stats_public as stats_public_module
from app.services.impact_metrics_service import (
    GoodsImpactSnapshot,
    calculate_goods_impact_snapshot,
)
from tests.helpers import async_return, patch_attrs, run_async

CURRENT_START = date(2026, 4, 1)
CURRENT_END = date(2026, 4, 15)
PREVIOUS_START = date(2026, 3, 1)
PREVIOUS_END = date(2026, 3, 15)
TODAY = date(2026, 4, 14)


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


def _install_month_range_context(monkeypatch: pytest.MonkeyPatch) -> None:
    patch_attrs(
        monkeypatch,
        stats_public_module,
        _public_range_context=lambda _range_key: stats_public_module.PublicRangeContext(
            today=TODAY,
            current_start=CURRENT_START,
            next_start=date(2026, 5, 1),
            previous_start=PREVIOUS_START,
            current_end=CURRENT_END,
            previous_end=PREVIOUS_END,
            range_note="This Month",
        ),
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
        today=TODAY,
        current_start=CURRENT_START,
        current_end=CURRENT_END,
        previous_start=PREVIOUS_START,
        previous_end=PREVIOUS_END,
    )

    assert isinstance(snapshot, GoodsImpactSnapshot)
    assert snapshot.current_goods_units == 27
    assert snapshot.previous_goods_units == 18
    assert snapshot.current_year_goods_units == 85
    assert snapshot.previous_year_goods_units == 20
    assert snapshot.all_time_families_supported_count == 4
    assert snapshot.all_time_families_supported_before_current_period_count == 2
    assert snapshot.current_families_supported_count == 3
    assert snapshot.previous_families_supported_count == 2


def test_public_impact_metrics_align_change_with_displayed_totals(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
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

    _install_month_range_context(monkeypatch)

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

    patch_attrs(
        monkeypatch,
        stats_public_module,
        _load_public_impact_inputs=async_return(
            stats_public_module.PublicImpactInputs(
                goods_donations=[],
                packages=[],
                applications=applications,
                distribution_snapshots=[],
            )
        ),
        calculate_goods_impact_snapshot=_fake_calculate_goods_impact_snapshot,
        _group_distribution_snapshots=lambda _snapshots: {},
        _package_recipe_units=lambda _packages: {},
        _application_distribution_summary=lambda application, *_args, **_kwargs: SimpleNamespace(
            food_units=1000 if application.id == 1 else 149 if application.id == 2 else 0
        ),
    )

    payload = run_async(
        stats_public_module.get_public_impact_metrics(range_key="month", db=None)
    )

    assert observed_snapshot_bounds == {
        "current_end": CURRENT_END,
        "previous_end": PREVIOUS_END,
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


def test_public_impact_metrics_scope_to_local_admin_food_bank(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    applications = [
        _application(
            date(2026, 3, 10),
            "family-a",
            application_id=1,
            food_bank_id=1,
            redeemed_at=date(2026, 3, 12),
        ),
        _application(
            date(2026, 4, 6),
            "family-b",
            application_id=2,
            food_bank_id=2,
            redeemed_at=date(2026, 4, 6),
        ),
        _application(
            date(2026, 4, 5),
            "family-c",
            application_id=3,
            food_bank_id=1,
            redeemed_at=date(2026, 4, 8),
        ),
    ]
    observed_scope: dict[str, list[int]] = {}

    _install_month_range_context(monkeypatch)

    def _fake_calculate_goods_impact_snapshot(**kwargs):
        observed_scope["goods_donation_food_bank_ids"] = [
            donation.food_bank_id for donation in kwargs["goods_donations"]
        ]
        observed_scope["application_food_bank_ids"] = [
            application.food_bank_id for application in kwargs["applications"]
        ]
        return GoodsImpactSnapshot(
            current_goods_units=12,
            previous_goods_units=0,
            current_year_goods_units=50,
            previous_year_goods_units=25,
            all_time_families_supported_count=5,
            all_time_families_supported_before_current_period_count=4,
            current_families_supported_count=1,
            previous_families_supported_count=1,
        )

    patch_attrs(
        monkeypatch,
        stats_public_module,
        _load_public_impact_inputs=async_return(
            stats_public_module.PublicImpactInputs(
                goods_donations=[
                    _goods_donation(date(2026, 4, 4), 12, food_bank_id=1),
                    _goods_donation(date(2026, 4, 7), 99, food_bank_id=2),
                ],
                packages=[],
                applications=applications,
                distribution_snapshots=[
                    SimpleNamespace(application_id=1),
                    SimpleNamespace(application_id=2),
                    SimpleNamespace(application_id=3),
                ],
            )
        ),
        calculate_goods_impact_snapshot=_fake_calculate_goods_impact_snapshot,
        _group_distribution_snapshots=lambda snapshots: {
            snapshot.application_id: [snapshot] for snapshot in snapshots
        },
        _package_recipe_units=lambda _packages: {},
        _application_distribution_summary=lambda application, *_args, **_kwargs: SimpleNamespace(
            food_units=100 if application.id == 1 else 30 if application.id == 3 else 999
        ),
    )

    payload = run_async(
        stats_public_module.get_public_impact_metrics(
            range_key="month",
            current_user={"role": "admin", "food_bank_id": 1},
            db=None,
        )
    )

    assert observed_scope == {
        "goods_donation_food_bank_ids": [1],
        "application_food_bank_ids": [1, 1],
    }

    metrics_by_key = {metric.key: metric for metric in payload.impactMetrics}

    assert metrics_by_key["food_units_distributed"].value == "130"
    assert metrics_by_key["food_units_distributed"].change == "+30.0%"

    assert metrics_by_key["families_supported"].value == "5"
    assert metrics_by_key["families_supported"].change == "+1 family"

    assert metrics_by_key["completed_food_pickups"].value == "1"
    assert metrics_by_key["completed_food_pickups"].change == "+0 pickups"

    assert metrics_by_key["goods_units_year"].value == "50"
    assert metrics_by_key["goods_units_year"].change == "+100.0%"
