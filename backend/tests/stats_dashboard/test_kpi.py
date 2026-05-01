from __future__ import annotations

from datetime import date, datetime
from types import SimpleNamespace

from tests.stats_dashboard.helpers import build_dashboard_payload
from tests.stats_dashboard.factories import (
    TODAY,
    make_goods_donation,
    make_inventory_item,
    make_inventory_lot,
    make_waste_event,
)


def make_support_package():
    return SimpleNamespace(
        id=10,
        name="Emergency Pack A",
        category="Emergency Pack",
        applied_count=0,
        food_bank_id=1,
        package_items=[
            SimpleNamespace(
                inventory_item_id=1,
                quantity=2,
                inventory_item=SimpleNamespace(id=1, name="Rice"),
            )
        ],
    )


def make_package_application(
    *,
    application_id: str,
    package,
    quantity: int,
    created_at: datetime,
    week_start: date,
    status: str,
    redeemed_at: datetime | None = None,
    updated_at: datetime | None = None,
):
    return SimpleNamespace(
        id=application_id,
        user_id="household-1",
        food_bank_id=1,
        redemption_code=f"CODE-{application_id}",
        status=status,
        week_start=week_start,
        created_at=created_at,
        updated_at=updated_at or created_at,
        redeemed_at=redeemed_at,
        deleted_at=None,
        items=[
            SimpleNamespace(
                package_id=package.id,
                inventory_item_id=None,
                quantity=quantity,
                package=package,
                inventory_item=None,
            )
        ],
    )


def test_kpi_donation_totals_only_count_received_goods_in_the_current_period(
    monkeypatch,
) -> None:
    dashboard_payload = build_dashboard_payload(
        monkeypatch,
        today=TODAY,
        goods_donations=[
            make_goods_donation(
                created_at=datetime(2026, 4, 10, 9, 0),
                items=[("Rice", 4)],
            ),
            make_goods_donation(
                created_at=datetime(2026, 3, 10, 9, 0),
                items=[("Rice", 2)],
            ),
            make_goods_donation(
                created_at=datetime(2026, 4, 11, 9, 0),
                items=[("Rice", 9)],
                status="pending",
            ),
        ],
    )

    assert dashboard_payload.kpi.totalDonation == 4
    assert dashboard_payload.kpi.trends.donation == "+100.0% vs last month"


def test_kpi_inventory_totals_reflect_sku_count_low_stock_items_and_expiring_lots(
    monkeypatch,
) -> None:
    rice = make_inventory_item(
        item_id=1,
        name="Rice",
        category="Grains & Pasta",
        unit="bags",
        threshold=10,
    )
    milk = make_inventory_item(
        item_id=2,
        name="Milk",
        category="Dairy",
        unit="cartons",
        threshold=5,
    )
    beans = make_inventory_item(
        item_id=3,
        name="Beans",
        category="Canned Goods",
        unit="cans",
        threshold=4,
    )

    dashboard_payload = build_dashboard_payload(
        monkeypatch,
        today=TODAY,
        inventory_items=[rice, milk, beans],
        inventory_lot_rows=[
            (
                make_inventory_lot(
                    lot_id=101,
                    inventory_item_id=rice.id,
                    quantity=8,
                    expiry_offset_days=6,
                    batch_reference="LOT-RICE",
                ),
                rice,
            ),
            (
                make_inventory_lot(
                    lot_id=102,
                    inventory_item_id=milk.id,
                    quantity=6,
                    expiry_offset_days=60,
                    batch_reference="LOT-MILK",
                ),
                milk,
            ),
        ],
    )

    assert dashboard_payload.kpi.totalSku == 3
    assert dashboard_payload.kpi.lowStockCount == 2
    assert dashboard_payload.kpi.expiringLotCount == 1
    assert dashboard_payload.kpi.trends.lowStock == "2 live inventory alert(s)"
    assert dashboard_payload.kpi.trends.expiringLots == "+0.0% vs last month"


def test_kpi_package_distribution_and_redemption_rate_use_current_period_applications(
    monkeypatch,
) -> None:
    support_package = make_support_package()

    dashboard_payload = build_dashboard_payload(
        monkeypatch,
        today=TODAY,
        packages=[support_package],
        applications=[
            make_package_application(
                application_id="current-collected",
                package=support_package,
                quantity=2,
                created_at=datetime(2026, 4, 10, 9, 0),
                redeemed_at=datetime(2026, 4, 11, 10, 30),
                week_start=date(2026, 4, 7),
                status="collected",
            ),
            make_package_application(
                application_id="current-expired",
                package=support_package,
                quantity=1,
                created_at=datetime(2026, 4, 12, 8, 0),
                updated_at=datetime(2026, 4, 13, 12, 0),
                week_start=date(2026, 4, 7),
                status="expired",
            ),
            make_package_application(
                application_id="previous-collected",
                package=support_package,
                quantity=1,
                created_at=datetime(2026, 3, 10, 9, 0),
                redeemed_at=datetime(2026, 3, 11, 10, 30),
                week_start=date(2026, 3, 9),
                status="collected",
            ),
        ],
    )

    assert dashboard_payload.kpi.totalPackageDistributed == 3
    assert dashboard_payload.kpi.redemptionRate == 50.0
    assert dashboard_payload.kpi.trends.package == "+200.0% vs last month"


def test_kpi_wastage_trend_compares_current_month_to_last_month(
    monkeypatch,
) -> None:
    rice = make_inventory_item(
        item_id=1,
        name="Rice",
        category="Grains & Pasta",
        unit="bags",
        threshold=10,
    )

    dashboard_payload = build_dashboard_payload(
        monkeypatch,
        today=TODAY,
        inventory_items=[rice],
        waste_events=[
            make_waste_event(
                quantity=3,
                occurred_at=datetime(2026, 4, 9, 14, 0),
                inventory_item_id=rice.id,
            ),
            make_waste_event(
                quantity=1,
                occurred_at=datetime(2026, 3, 9, 14, 0),
                inventory_item_id=rice.id,
            ),
        ],
    )

    assert dashboard_payload.kpi.trends.wastage == "+200.0% vs last month"
