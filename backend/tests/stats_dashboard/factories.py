from __future__ import annotations

from datetime import date, datetime, timedelta
from types import SimpleNamespace


TODAY = date(2026, 4, 14)


def make_inventory_item(
    *,
    item_id: int,
    name: str,
    category: str,
    unit: str,
    threshold: int,
):
    return SimpleNamespace(
        id=item_id,
        name=name,
        category=category,
        unit=unit,
        threshold=threshold,
        food_bank_id=1,
    )


def make_inventory_lot(
    *,
    lot_id: int,
    inventory_item_id: int,
    quantity: int,
    expiry_offset_days: int,
    batch_reference: str,
):
    return SimpleNamespace(
        id=lot_id,
        inventory_item_id=inventory_item_id,
        quantity=quantity,
        expiry_date=TODAY + timedelta(days=expiry_offset_days),
        batch_reference=batch_reference,
        deleted_at=None,
    )


def make_goods_donation(
    *,
    created_at: datetime,
    items: list[tuple[str, int]],
    status: str = "received",
    donor_name: str = "Donor",
    donor_email: str = "donor@example.com",
    donor_type: str | None = "individual",
):
    return SimpleNamespace(
        status=status,
        donor_type=donor_type,
        donor_email=donor_email,
        donor_name=donor_name,
        created_at=created_at,
        food_bank_id=1,
        items=[
            SimpleNamespace(item_name=item_name, quantity=quantity)
            for item_name, quantity in items
        ],
    )


def make_waste_event(
    *,
    quantity: int,
    occurred_at: datetime,
    inventory_item_id: int,
):
    return SimpleNamespace(
        quantity=quantity,
        occurred_at=occurred_at,
        inventory_item_id=inventory_item_id,
        inventory_lot_id=None,
    )
