import uuid

import pytest
from fastapi import HTTPException

from app.core.database import get_db
from app.routers.applications import submit_application
from app.routers.donations import submit_cash_donation
from app.routers.food_packages import create_package
from app.routers.inventory import create_inventory_item
from app.routers.restock import create_restock_request
from app.schemas.application import ApplicationCreate, ApplicationItemCreatePayload
from app.schemas.donation_cash import DonationCashCreate
from app.schemas.food_package import FoodPackageCreateRequest
from app.schemas.inventory_item import InventoryItemCreateRequest
from app.schemas.restock_request import RestockRequestCreate
from tests.support import AsyncBegin


class FailingTransactionSession:
    def begin(self):
        return AsyncBegin()

    async def scalar(self, _query):
        raise ConnectionError("database offline")

    async def flush(self):
        raise ConnectionError("database offline")

    async def refresh(self, _obj):
        return None

    def add(self, _obj):
        return None

    async def rollback(self):
        return None


class FailingPackageSession(FailingTransactionSession):
    async def execute(self, _query):
        raise ConnectionError("database offline")


@pytest.mark.asyncio
async def test_submit_application_returns_503_when_database_unavailable():
    db = FailingTransactionSession()
    payload = ApplicationCreate(
        food_bank_id=10,
        items=[ApplicationItemCreatePayload(package_id=1, quantity=1)],
    )

    with pytest.raises(HTTPException) as exc:
        await submit_application(
            application_in=payload,
            current_user={"sub": str(uuid.uuid4())},
            db=db,
        )

    assert exc.value.status_code == 503
    assert exc.value.detail == "Database temporarily unavailable"


@pytest.mark.asyncio
async def test_submit_cash_donation_returns_503_when_database_unavailable():
    db = FailingTransactionSession()
    payload = DonationCashCreate(
        donor_email="donor@example.com",
        amount_pence=1200,
        payment_reference="PAY-503",
    )

    with pytest.raises(HTTPException) as exc:
        await submit_cash_donation(donation_in=payload, db=db)

    assert exc.value.status_code == 503
    assert exc.value.detail == "Database temporarily unavailable"


@pytest.mark.asyncio
async def test_create_inventory_item_returns_503_when_database_unavailable():
    db = FailingTransactionSession()
    payload = InventoryItemCreateRequest(
        food_bank_id=10,
        name="Rice",
        category="Grains & Pasta",
        initial_stock=3,
        unit="kg",
        threshold=1,
    )

    with pytest.raises(HTTPException) as exc:
        await create_inventory_item(item_in=payload, admin_user={"role": "admin"}, db=db)

    assert exc.value.status_code == 503
    assert exc.value.detail == "Database temporarily unavailable"


@pytest.mark.asyncio
async def test_create_restock_request_returns_503_when_database_unavailable():
    db = FailingTransactionSession()
    payload = RestockRequestCreate(
        inventory_item_id=1,
        current_stock=0,
        threshold=5,
        urgency="high",
    )

    with pytest.raises(HTTPException) as exc:
        await create_restock_request(request_in=payload, admin_user={"role": "admin"}, db=db)

    assert exc.value.status_code == 503
    assert exc.value.detail == "Database temporarily unavailable"


@pytest.mark.asyncio
async def test_create_package_returns_503_when_database_unavailable():
    db = FailingPackageSession()
    payload = FoodPackageCreateRequest(
        name="Starter Pack",
        category="Breakfast",
        threshold=2,
        contents=[{"item_id": 1, "quantity": 1}],
        food_bank_id=1,
    )

    with pytest.raises(HTTPException) as exc:
        await create_package(package_in=payload, admin_user={"role": "admin"}, db=db)

    assert exc.value.status_code == 503
    assert exc.value.detail == "Database temporarily unavailable"


def test_global_handler_returns_503_for_auth_route_database_failure(
    api_client,
    override_dependency,
):
    class FailingReadSession:
        async def execute(self, _query):
            raise ConnectionError("database offline")

    async def override_get_db():
        yield FailingReadSession()

    override_dependency(get_db, override_get_db)
    response = api_client.post(
        "/api/v1/auth/login",
        json={"email": "user@example.com", "password": "Password123"},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "Database temporarily unavailable"
