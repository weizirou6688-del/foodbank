from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from types import SimpleNamespace

import pytest

import app.routers.food_banks_public as food_banks_public_module
from tests.helpers import async_return, patch_attrs, run_async


def _food_bank(*, bank_id: int, name: str, email: str) -> SimpleNamespace:
    return SimpleNamespace(
        id=bank_id,
        name=name,
        address=f"{name} Address",
        notification_email=email,
        lat=Decimal("51.500000"),
        lng=Decimal("-0.100000"),
        created_at=datetime(2026, 4, 16, 12, 0, 0),
    )


def test_list_food_banks_marks_which_rows_have_linked_local_admin_accounts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    downtown_bank = _food_bank(
        bank_id=1,
        name="Downtown",
        email="downtown@example.com",
    )
    westside_bank = _food_bank(
        bank_id=2,
        name="Westside",
        email="westside@example.com",
    )

    patch_attrs(
        monkeypatch,
        food_banks_public_module,
        fetch_scalars=async_return([downtown_bank, westside_bank]),
        _food_bank_ids_with_local_admin_accounts=async_return({2}),
    )

    payload = run_async(food_banks_public_module.list_food_banks(db=object()))

    assert payload["total"] == 2
    assert payload["items"][0].name == "Downtown"
    assert payload["items"][0].has_local_admin_account is False
    assert payload["items"][1].name == "Westside"
    assert payload["items"][1].has_local_admin_account is True
