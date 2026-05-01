from __future__ import annotations

import pytest

from app.core.bootstrap_demo_legacy import (
    demo_seed_batch_reference,
    is_expected_demo_seed_lot,
)


@pytest.mark.parametrize(
    ("item_name", "food_bank_id", "expected_reference"),
    [
        ("Canned Beans", 12, "seed-stock-canned-beans-bank-12"),
        ("Long Life Milk", 3, "seed-stock-long-life-milk-bank-3"),
    ],
)
def test_demo_seed_batch_reference_rebuilds_bank_scope_for_legacy_seed_cleanup(
    item_name: str,
    food_bank_id: int,
    expected_reference: str,
) -> None:
    assert demo_seed_batch_reference(item_name, food_bank_id) == expected_reference


@pytest.mark.parametrize(
    ("item_name", "item_food_bank_id", "batch_reference", "expected"),
    [
        ("Canned Beans", 3, "seed-stock-canned-beans-bank-3", True),
        ("Canned Beans", 3, "demo-seed-canned-beans-bank-3", True),
        ("Canned Beans", None, "demo-seed-canned-beans-bank-3", False),
        ("Canned Beans", 3, "seed-stock-canned-beans-bank-7", False),
        ("Long Life Milk", 4, "seed-stock-long-life-milk-bank-4", False),
    ],
)
def test_is_expected_demo_seed_lot_only_keeps_bank_scoped_rows_after_legacy_split(
    item_name: str,
    item_food_bank_id: int | None,
    batch_reference: str,
    expected: bool,
) -> None:
    assert (
        is_expected_demo_seed_lot(
            item_name=item_name,
            item_food_bank_id=item_food_bank_id,
            batch_reference=batch_reference,
        )
        is expected
    )
