from decimal import Decimal
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi import HTTPException

from app.models.food_bank import FoodBank
from app.routers.food_banks import (
    list_food_banks,
    get_food_bank,
    create_food_bank,
    update_food_bank,
    delete_food_bank,
)
from app.schemas.food_bank import FoodBankCreate, FoodBankUpdate


class _ExecuteResult:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return _ScalarResult(self._rows)

    def scalar_one_or_none(self):
        return self._rows[0] if self._rows else None


class _ScalarResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class FakeSession:
    def __init__(self, *, banks=None):
        self.banks = banks or {}
        self.added = []
        self.deleted = []

    async def execute(self, query):
        # Simplified: return all banks
        return _ExecuteResult(list(self.banks.values()))

    async def delete(self, obj):
        self.deleted.append(obj)

    def add(self, obj):
        self.added.append(obj)
        if isinstance(obj, FoodBank) and getattr(obj, "id", None) is None:
            obj.id = 999

    async def flush(self):
        return None

    async def refresh(self, _obj):
        return None


@pytest.mark.asyncio
async def test_list_food_banks_empty():
    db = FakeSession()
    result = await list_food_banks(db=db)
    assert result["items"] == []
    assert result["total"] == 0


@pytest.mark.asyncio
async def test_list_food_banks_returns_rows():
    bank = FoodBank(
        id=1,
        name="Main Center",
        address="123 Main St",
        lat=Decimal("51.123456"),
        lng=Decimal("-0.123456"),
    )
    db = FakeSession(banks={1: bank})

    result = await list_food_banks(db=db)

    assert len(result["items"]) == 1
    assert result["items"][0].name == "Main Center"


@pytest.mark.asyncio
async def test_get_food_bank_success():
    bank = FoodBank(
        id=1,
        name="West Branch",
        address="456 West St",
        lat=Decimal("51.234567"),
        lng=Decimal("-0.234567"),
    )
    db = FakeSession(banks={1: bank})

    result = await get_food_bank(food_bank_id=1, db=db)

    assert result.name == "West Branch"


@pytest.mark.asyncio
async def test_get_food_bank_not_found():
    db = FakeSession(banks={})

    with pytest.raises(HTTPException) as exc:
        await get_food_bank(food_bank_id=999, db=db)

    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_create_food_bank_success():
    db = FakeSession()
    admin = {"role": "admin"}

    payload = FoodBankCreate(
        name="New North Center",
        address="789 North St",
        lat=Decimal("51.345678"),
        lng=Decimal("-0.345678"),
    )

    result = await create_food_bank(bank_in=payload, admin_user=admin, db=db)

    assert isinstance(result, FoodBank)
    assert result.name == "New North Center"
    assert len(db.added) == 1


@pytest.mark.asyncio
async def test_update_food_bank_success():
    bank = FoodBank(
        id=1,
        name="South Center",
        address="111 South St",
        lat=Decimal("51.456789"),
        lng=Decimal("-0.456789"),
    )
    db = FakeSession(banks={1: bank})
    admin = {"role": "admin"}

    payload = FoodBankUpdate(name="South Center Updated")

    result = await update_food_bank(
        food_bank_id=1, bank_in=payload, admin_user=admin, db=db
    )

    assert result.name == "South Center Updated"


@pytest.mark.asyncio
async def test_update_food_bank_not_found():
    db = FakeSession(banks={})
    admin = {"role": "admin"}

    payload = FoodBankUpdate(name="New Name")

    with pytest.raises(HTTPException) as exc:
        await update_food_bank(
            food_bank_id=999, bank_in=payload, admin_user=admin, db=db
        )

    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_delete_food_bank_success():
    bank = FoodBank(
        id=1,
        name="East Center",
        address="222 East St",
        lat=Decimal("51.567890"),
        lng=Decimal("-0.567890"),
    )
    db = FakeSession(banks={1: bank})
    admin = {"role": "admin"}

    result = await delete_food_bank(food_bank_id=1, admin_user=admin, db=db)

    assert result is None
    assert len(db.deleted) == 1


@pytest.mark.asyncio
async def test_delete_food_bank_not_found():
    db = FakeSession(banks={})
    admin = {"role": "admin"}

    with pytest.raises(HTTPException) as exc:
        await delete_food_bank(food_bank_id=999, admin_user=admin, db=db)

    assert exc.value.status_code == 404
