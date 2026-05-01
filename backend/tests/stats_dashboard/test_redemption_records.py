from __future__ import annotations

from datetime import date, datetime
from types import SimpleNamespace

from tests.stats_dashboard.helpers import build_dashboard_payload
from tests.stats_dashboard.factories import TODAY


def make_successful_redemption_application():
    return SimpleNamespace(
        id="success-app",
        user_id="household-1",
        food_bank_id=1,
        redemption_code="COLLECTED-1",
        status="collected",
        week_start=date(2026, 4, 7),
        created_at=datetime(2026, 4, 10, 9, 0),
        updated_at=datetime(2026, 4, 11, 9, 0),
        redeemed_at=datetime(2026, 4, 11, 10, 30),
        deleted_at=None,
        items=[],
    )


def make_invalid_redemption_application():
    return SimpleNamespace(
        id="invalid-app",
        user_id="household-2",
        food_bank_id=1,
        redemption_code="INVALID-1",
        status="pending",
        week_start=date(2026, 4, 14),
        created_at=datetime(2026, 4, 13, 8, 0),
        updated_at=datetime(2026, 4, 13, 8, 0),
        redeemed_at=None,
        deleted_at=datetime(2026, 4, 13, 9, 15),
        items=[],
    )


def make_expired_redemption_application():
    return SimpleNamespace(
        id="expired-app",
        user_id="household-3",
        food_bank_id=1,
        redemption_code="EXPIRED-1",
        status="expired",
        week_start=date(2026, 4, 1),
        created_at=datetime(2026, 4, 9, 8, 0),
        updated_at=datetime(2026, 4, 10, 12, 0),
        redeemed_at=None,
        deleted_at=None,
        items=[],
    )


def test_recent_redemption_records_show_success_invalid_and_expired_states(
    monkeypatch,
) -> None:
    dashboard_payload = build_dashboard_payload(
        monkeypatch,
        today=TODAY,
        applications=[
            make_successful_redemption_application(),
            make_invalid_redemption_application(),
            make_expired_redemption_application(),
        ],
    )

    assert dashboard_payload.redemption.breakdown.labels == [
        "Success",
        "Invalid",
        "Expired",
    ]
    assert dashboard_payload.redemption.breakdown.data == [1.0, 1.0, 1.0]

    recent_records = dashboard_payload.redemption.recentVerificationRecords
    assert len(recent_records) == 3

    assert recent_records[0].redemption_code == "INVALID-1"
    assert recent_records[0].status == "Invalid"
    assert recent_records[0].status_tone == "error"

    assert recent_records[1].redemption_code == "COLLECTED-1"
    assert recent_records[1].status == "Success"
    assert recent_records[1].status_tone == "success"

    assert recent_records[2].redemption_code == "EXPIRED-1"
    assert recent_records[2].status == "Expired"
    assert recent_records[2].status_tone == "warning"
