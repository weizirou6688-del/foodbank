from datetime import datetime
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi import HTTPException

from app.models.inventory_item import InventoryItem
from app.models.restock_request import RestockRequest
from app.routers.restock import (
    create_restock_request,
    decline_restock_request,
    fulfil_restock_request,
    list_restock_requests,
)
from app.schemas.restock_request import RestockRequestCreate, RestockRequestFulfil


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


class FakeSession:
    def __init__(self, *, scalar_values=None, execute_rows=None):
        self.scalar_values = list(scalar_values or [])
        self.execute_rows = list(execute_rows or [])
        self.added = []

    def begin(self):
        return _Begin()

    async def scalar(self, _query):
        if self.scalar_values:
            return self.scalar_values.pop(0)
        return None

    async def execute(self, _query):
        return _ExecuteResult(self.execute_rows)

    def add(self, obj):
        self.added.append(obj)
        if isinstance(obj, RestockRequest) and getattr(obj, "id", None) is None:
            obj.id = 77
            obj.created_at = datetime.utcnow()

    async def flush(self):
        return None

    async def refresh(self, _obj):
        return None


@pytest.mark.asyncio
async def test_list_restock_requests_returns_rows():
    request = RestockRequest(
        id=1,
        inventory_item_id=2,
        current_stock=1,
        threshold=5,
        urgency="Critical",
        status="open",
    )
    db = FakeSession(execute_rows=[request])

    result = await list_restock_requests(admin_user={"role": "admin"}, db=db)

    assert len(result) == 1
    assert result[0].id == 1


@pytest.mark.asyncio
async def test_create_restock_request_not_found_inventory_item():
    payload = RestockRequestCreate(
        inventory_item_id=10,
        current_stock=1,
        threshold=5,
        urgency="Urgent",
    )
    db = FakeSession(scalar_values=[None])

    with pytest.raises(HTTPException) as exc:
        await create_restock_request(request_in=payload, admin_user={"role": "admin"}, db=db)

    assert exc.value.status_code == 404
    assert exc.value.detail == "Inventory item not found"


@pytest.mark.asyncio
async def test_create_restock_request_success():
    item = InventoryItem(
        id=10,
        name="Rice",
        category="Grains",
        stock=1,
        unit="kg",
        threshold=5,
    )
    payload = RestockRequestCreate(
        inventory_item_id=10,
        current_stock=1,
        threshold=5,
        urgency="Critical",
    )
    db = FakeSession(scalar_values=[item])

    result = await create_restock_request(request_in=payload, admin_user={"role": "admin"}, db=db)

    assert isinstance(result, RestockRequest)
    assert result.status == "open"
    assert result.inventory_item_id == 10


@pytest.mark.asyncio
async def test_decline_restock_request_fulfilled_conflict():
    request = RestockRequest(
        id=1,
        inventory_item_id=2,
        current_stock=1,
        threshold=5,
        urgency="Critical",
        status="fulfilled",
    )
    db = FakeSession(scalar_values=[request])

    with pytest.raises(HTTPException) as exc:
        await decline_restock_request(request_id=1, admin_user={"role": "admin"}, db=db)

    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_decline_restock_request_success():
    request = RestockRequest(
        id=1,
        inventory_item_id=2,
        current_stock=1,
        threshold=5,
        urgency="Low",
        status="open",
    )
    db = FakeSession(scalar_values=[request])

    result = await decline_restock_request(request_id=1, admin_user={"role": "admin"}, db=db)

    assert result is None
    assert request.status == "cancelled"


@pytest.mark.asyncio
async def test_fulfil_restock_request_cancelled_conflict():
    request = RestockRequest(
        id=1,
        inventory_item_id=2,
        current_stock=1,
        threshold=5,
        urgency="Critical",
        status="cancelled",
    )
    db = FakeSession(scalar_values=[request])

    with pytest.raises(HTTPException) as exc:
        await fulfil_restock_request(
            request_id=1,
            fulfil_in=RestockRequestFulfil(notes="done"),
            admin_user={"role": "admin"},
            db=db,
        )

    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_fulfil_restock_request_success_updates_stock_to_threshold():
    request = RestockRequest(
        id=1,
        inventory_item_id=2,
        current_stock=1,
        threshold=5,
        urgency="Critical",
        status="open",
    )
    item = InventoryItem(
        id=2,
        name="Beans",
        category="Protein",
        stock=2,
        unit="can",
        threshold=5,
    )
    db = FakeSession(scalar_values=[request, item])

    result = await fulfil_restock_request(
        request_id=1,
        fulfil_in=RestockRequestFulfil(notes="received"),
        admin_user={"role": "admin"},
        db=db,
    )

    assert result.status == "fulfilled"
    assert item.stock == 5
