from __future__ import annotations

from datetime import datetime

from tests.stats_dashboard.helpers import build_dashboard_payload
from tests.stats_dashboard.factories import (
    TODAY,
    make_inventory_item,
    make_inventory_lot,
    make_waste_event,
)


def test_expiry_distribution_buckets_lots_by_remaining_shelf_life(monkeypatch) -> None:
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
            (
                make_inventory_lot(
                    lot_id=103,
                    inventory_item_id=formula.id,
                    quantity=2,
                    expiry_offset_days=120,
                    batch_reference="LOT-FORMULA",
                ),
                formula,
            ),
        ],
    )

    assert dashboard_payload.expiry.distribution.labels == [
        "Expiring in 30 Days",
        "30-90 Days",
        "90+ Days",
    ]
    assert dashboard_payload.expiry.distribution.data == [1.0, 1.0, 1.0]


def test_expiring_lot_rows_prioritize_batches_with_one_week_or_less_remaining(
    monkeypatch,
) -> None:
    rice = make_inventory_item(
        item_id=1,
        name="Rice",
        category="Grains & Pasta",
        unit="bags",
        threshold=10,
    )
    formula = make_inventory_item(
        item_id=2,
        name="Formula",
        category="Baby Food",
        unit="tins",
        threshold=6,
    )

    dashboard_payload = build_dashboard_payload(
        monkeypatch,
        today=TODAY,
        inventory_items=[rice, formula],
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
                    inventory_item_id=formula.id,
                    quantity=2,
                    expiry_offset_days=11,
                    batch_reference="LOT-FORMULA",
                ),
                formula,
            ),
        ],
    )

    expiring_lots = dashboard_payload.expiry.expiringLots
    assert len(expiring_lots) == 2

    assert expiring_lots[0].item_name == "Rice"
    assert expiring_lots[0].days_until_expiry == 6
    assert expiring_lots[0].status_tone == "error"

    assert expiring_lots[1].item_name == "Formula"
    assert expiring_lots[1].days_until_expiry == 11
    assert expiring_lots[1].status_tone == "warning"


def test_wastage_chart_tracks_units_disposed_in_the_current_period(monkeypatch) -> None:
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

    assert dashboard_payload.expiry.wastage.label == "Wasted Units"
    assert sum(dashboard_payload.expiry.wastage.data) == 3.0
