from datetime import date, datetime
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi import HTTPException

from app.models.inventory_item import InventoryItem
from app.models.inventory_lot import InventoryLot
from app.routers.inventory import (
    create_inventory_item,
    delete_inventory_lot,
    delete_inventory_item,
    list_inventory,
    stock_in,
    stock_out,
    update_inventory_item,
)
from app.schemas.inventory_item import InventoryItemUpdate, StockAdjustment
from app.schemas.inventory_item import InventoryItemCreateRequest


class _Begin:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _ScalarResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class _ExecuteResult:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return _ScalarResult(self._rows)

    def all(self):
        return self._rows


class FakeSession:
    def __init__(self, *, scalar_values=None, execute_rows_seq=None):
        self.scalar_values = list(scalar_values or [])
        self.execute_rows_seq = list(execute_rows_seq or [])
        self.added = []
        self.deleted = []
        self.did_commit = False
        self.did_rollback = False

    def begin(self):
        return _Begin()

    async def scalar(self, _query):
        if self.scalar_values:
            return self.scalar_values.pop(0)
        return None

    async def execute(self, _query):
        if self.execute_rows_seq:
            return _ExecuteResult(self.execute_rows_seq.pop(0))
        return _ExecuteResult([])

    def add(self, obj):
        self.added.append(obj)
        if isinstance(obj, InventoryItem) and getattr(obj, "id", None) is None:
            obj.id = 99
            obj.updated_at = datetime.utcnow()
        if isinstance(obj, InventoryLot) and getattr(obj, "id", None) is None:
            obj.id = 199

    async def flush(self):
        return None

    async def refresh(self, _obj):
        return None

    async def commit(self):
        self.did_commit = True

    async def rollback(self):
        self.did_rollback = True

    async def delete(self, obj):
        self.deleted.append(obj)


@pytest.mark.asyncio
async def test_list_inventory_returns_rows():
    item = InventoryItem(
        id=1,
        name="Rice",
        category="Grains & Pasta",
        unit="kg",
        threshold=2,
    )
    db = FakeSession(execute_rows_seq=[[item]], scalar_values=[10])

    result = await list_inventory(food_bank_id=1, admin_user={"role": "admin"}, db=db)

    assert len(result["items"]) == 1
    assert result["items"][0].name == "Rice"
    assert result["items"][0].total_stock == 10


@pytest.mark.asyncio
async def test_create_inventory_item_success():
    db = FakeSession(scalar_values=[None, 4])
    payload = InventoryItemCreateRequest(
        name="Beans",
        category="Proteins & Meat",
        initial_stock=4,
        unit="can",
        threshold=1,
    )

    result = await create_inventory_item(item_in=payload, admin_user={"role": "admin"}, db=db)

    assert result.name == "Beans"
    assert result.total_stock == 4
    assert any(isinstance(obj, InventoryLot) for obj in db.added)


@pytest.mark.asyncio
async def test_create_inventory_item_conflict_when_name_exists():
    db = FakeSession(scalar_values=[1])
    payload = InventoryItemCreateRequest(
        name="Beans",
        category="Proteins & Meat",
        initial_stock=4,
        unit="can",
        threshold=1,
    )

    with pytest.raises(HTTPException) as exc:
        await create_inventory_item(item_in=payload, admin_user={"role": "admin"}, db=db)

    assert exc.value.status_code == 409
    assert exc.value.detail == "Inventory item name already exists"


@pytest.mark.asyncio
async def test_update_inventory_item_ignores_legacy_stock_field():
    item = InventoryItem(
        id=1,
        name="Rice",
        category="Grains & Pasta",
        unit="kg",
        threshold=1,
    )
    db = FakeSession(scalar_values=[item, 3])

    result = await update_inventory_item(
        item_id=1,
        item_in=InventoryItemUpdate(stock=8, threshold=5),
        admin_user={"role": "admin"},
        db=db,
    )

    assert result.name == "Rice"
    assert item.threshold == 5
    assert result.total_stock == 3


@pytest.mark.asyncio
async def test_update_inventory_item_not_found():
    db = FakeSession(scalar_values=[None])

    with pytest.raises(HTTPException) as exc:
        await update_inventory_item(
            item_id=1,
            item_in=InventoryItemUpdate(name="New"),
            admin_user={"role": "admin"},
            db=db,
        )

    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_update_inventory_item_success():
    item = InventoryItem(
        id=1,
        name="Rice",
        category="Grains & Pasta",
        unit="kg",
        threshold=1,
    )
    db = FakeSession(scalar_values=[item, 3])

    result = await update_inventory_item(
        item_id=1,
        item_in=InventoryItemUpdate(name="Brown Rice"),
        admin_user={"role": "admin"},
        db=db,
    )

    assert result.name == "Brown Rice"
    assert result.total_stock == 3


@pytest.mark.asyncio
async def test_stock_in_success():
    item = InventoryItem(
        id=1,
        name="Milk",
        category="Dairy",
        unit="box",
        threshold=1,
    )
    db = FakeSession(scalar_values=[item, 5])

    result = await stock_in(
        item_id=1,
        adjustment_in=StockAdjustment(quantity=3, reason="donation"),
        admin_user={"role": "admin"},
        db=db,
    )

    assert result.total_stock == 5
    assert any(isinstance(obj, InventoryLot) for obj in db.added)


@pytest.mark.asyncio
async def test_stock_in_uses_supplied_expiry_date():
    item = InventoryItem(
        id=1,
        name="Milk",
        category="Dairy",
        unit="box",
        threshold=1,
    )
    db = FakeSession(scalar_values=[item, 5])
    expiry_date = date(2026, 5, 1)

    await stock_in(
        item_id=1,
        adjustment_in=StockAdjustment(quantity=3, reason="donation", expiry_date=expiry_date),
        admin_user={"role": "admin"},
        db=db,
    )

    created_lot = next(obj for obj in db.added if isinstance(obj, InventoryLot))
    assert created_lot.expiry_date == expiry_date


@pytest.mark.asyncio
async def test_stock_out_insufficient_stock():
    item = InventoryItem(
        id=1,
        name="Oil",
        category="Beverages",
        unit="bottle",
        threshold=1,
    )
    active_lot = InventoryLot(
        id=10,
        inventory_item_id=1,
        quantity=1,
        received_date=date.today(),
        expiry_date=date.today(),
        batch_reference="lot-1",
    )
    db = FakeSession(scalar_values=[item], execute_rows_seq=[[active_lot]])

    with pytest.raises(HTTPException) as exc:
        await stock_out(
            item_id=1,
            adjustment_in=StockAdjustment(quantity=2, reason="distribution"),
            admin_user={"role": "admin"},
            db=db,
        )

    assert exc.value.status_code == 400
    assert exc.value.detail == "Insufficient stock"


@pytest.mark.asyncio
async def test_delete_inventory_item_conflict_when_used_in_package():
    item = InventoryItem(
        id=1,
        name="Flour",
        category="Grains & Pasta",
        unit="kg",
        threshold=2,
    )
    db = FakeSession(scalar_values=[item, 2])

    with pytest.raises(HTTPException) as exc:
        await delete_inventory_item(item_id=1, admin_user={"role": "admin"}, db=db)

    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_delete_inventory_item_success():
    item = InventoryItem(
        id=1,
        name="Salt",
        category="Snacks",
        unit="pack",
        threshold=1,
    )
    db = FakeSession(scalar_values=[item, 0])

    result = await delete_inventory_item(item_id=1, admin_user={"role": "admin"}, db=db)

    assert result is None
    assert db.deleted == [item]


@pytest.mark.asyncio
async def test_delete_inventory_lot_success():
    lot = InventoryLot(
        id=7,
        inventory_item_id=1,
        quantity=2,
        received_date=date.today(),
        expiry_date=date.today(),
        batch_reference="lot-7",
    )
    db = FakeSession(scalar_values=[lot])

    result = await delete_inventory_lot(lot_id=7, admin_user={"role": "admin"}, db=db)

    assert result is None
    assert db.deleted == [lot]
