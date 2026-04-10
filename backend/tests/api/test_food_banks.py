from decimal import Decimal
from datetime import timedelta

import pytest
from fastapi import HTTPException

from app.models.food_bank import FoodBank
from app.models.inventory_item import InventoryItem
from app.routers.food_banks import (
    list_food_bank_inventory_items,
    list_food_banks,
    get_food_bank,
    create_food_bank,
    update_food_bank,
    delete_food_bank,
)
from app.schemas.food_bank import FoodBankCreate, FoodBankUpdate
from tests.support import ExecuteResult, utcnow


class FakeSession:
    def __init__(self, *, banks=None):
        self.banks = banks or {}
        self.added = []
        self.deleted = []

    async def execute(self, query):
        # Simplified: return all banks
        return ExecuteResult(list(self.banks.values()))

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


class FakeFoodBankInventorySession:
    def __init__(self, *, bank=None, rows=None):
        self.bank = bank
        self.rows = rows or []

    async def scalar(self, _query):
        return self.bank

    async def execute(self, _query):
        return ExecuteResult(self.rows)


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


@pytest.mark.asyncio
async def test_list_food_bank_inventory_items_returns_only_requested_bank_rows():
    bank = FoodBank(
        id=7,
        name="Downtown Community Food Bank",
        address="123 Main Street",
        lat=Decimal("51.500000"),
        lng=Decimal("-0.120000"),
    )
    own_item = InventoryItem(
        id=11,
        name="Rice",
        category="Grains & Pasta",
        unit="bags",
        threshold=10,
        food_bank_id=7,
    )
    own_item.updated_at = utcnow()
    other_item = InventoryItem(
        id=22,
        name="Beans",
        category="Canned Goods",
        unit="cans",
        threshold=6,
        food_bank_id=9,
    )
    other_item.updated_at = utcnow() - timedelta(hours=1)
    db = FakeFoodBankInventorySession(
        bank=bank,
        rows=[(own_item, 12)],
    )

    result = await list_food_bank_inventory_items(food_bank_id=7, db=db)

    assert result["total"] == 1
    assert result["items"][0].id == 11
    assert result["items"][0].name == "Rice"
    assert result["items"][0].food_bank_id == 7
    assert all(item.id != other_item.id for item in result["items"])


@pytest.mark.asyncio
async def test_list_food_bank_inventory_items_not_found():
    db = FakeFoodBankInventorySession(bank=None)

    with pytest.raises(HTTPException) as exc:
        await list_food_bank_inventory_items(food_bank_id=999, db=db)

    assert exc.value.status_code == 404
