from __future__ import annotations

from datetime import datetime

from tests.stats_dashboard.helpers import build_dashboard_payload
from tests.stats_dashboard.factories import (
    TODAY,
    make_goods_donation,
    make_inventory_item,
    make_inventory_lot,
)


def test_donation_source_chart_groups_received_donations_by_donor_type(
    monkeypatch,
) -> None:
    dashboard_payload = build_dashboard_payload(
        monkeypatch,
        today=TODAY,
        goods_donations=[
            make_goods_donation(
                donor_name="Fresh Market",
                donor_email="corp@example.com",
                donor_type="supermarket",
                created_at=datetime(2026, 4, 10, 9, 0),
                items=[("Rice", 5)],
            ),
            make_goods_donation(
                donor_name="Alice",
                donor_email="alice@example.com",
                donor_type="individual",
                created_at=datetime(2026, 4, 11, 10, 0),
                items=[("Milk", 2)],
            ),
            make_goods_donation(
                donor_name="Walk-in donor",
                donor_email="",
                donor_type=None,
                created_at=datetime(2026, 4, 12, 10, 0),
                items=[("Formula", 1)],
            ),
            make_goods_donation(
                donor_name="Ignored",
                donor_email="ignored@example.com",
                donor_type="organization",
                created_at=datetime(2026, 4, 13, 10, 0),
                items=[("Beans", 9)],
                status="pending",
            ),
        ],
    )

    assert dashboard_payload.donation.source.labels == [
        "Supermarket",
        "Individual",
        "Organization",
        "Unspecified",
    ]
    assert dashboard_payload.donation.source.data == [1.0, 1.0, 0.0, 1.0]


def test_donation_category_chart_rolls_up_received_units_by_inventory_category(
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
    formula = make_inventory_item(
        item_id=3,
        name="Formula",
        category="Baby Food",
        unit="tins",
        threshold=6,
    )

    dashboard_payload = build_dashboard_payload(
        monkeypatch,
        today=TODAY,
        inventory_items=[rice, milk, formula],
        goods_donations=[
            make_goods_donation(
                donor_name="Fresh Market",
                donor_email="corp@example.com",
                donor_type="supermarket",
                created_at=datetime(2026, 4, 10, 9, 0),
                items=[("Rice", 5)],
            ),
            make_goods_donation(
                donor_name="Alice",
                donor_email="alice@example.com",
                donor_type="individual",
                created_at=datetime(2026, 4, 11, 10, 0),
                items=[("Milk", 2), ("Formula", 1)],
            ),
        ],
    )

    assert dashboard_payload.donation.category.labels == [
        "Grains & Pasta",
        "Dairy",
        "Baby Food",
    ]
    assert dashboard_payload.donation.category.data == [5.0, 2.0, 1.0]


def test_low_stock_alerts_show_items_that_are_below_threshold_or_out_of_stock(
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
                    expiry_offset_days=45,
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

    low_stock_alerts = dashboard_payload.inventory.lowStockAlerts
    assert len(low_stock_alerts) == 2

    assert low_stock_alerts[0].item_name == "Beans"
    assert low_stock_alerts[0].status == "Out of Stock"
    assert low_stock_alerts[0].status_tone == "error"

    assert low_stock_alerts[1].item_name == "Rice"
    assert low_stock_alerts[1].status == "Low Stock"
    assert low_stock_alerts[1].status_tone == "warning"
