import uuid
from datetime import datetime
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi import HTTPException

from app.models.application import Application
from app.models.application_item import ApplicationItem
from app.models.food_package import FoodPackage
from app.routers.applications import submit_application
from app.schemas.application import ApplicationCreate, ApplicationItemCreatePayload


class _Begin:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _ScalarResult:
    def __init__(self, packages):
        self._packages = packages

    def all(self):
        return self._packages


class _ExecuteResult:
    def __init__(self, packages):
        self._packages = packages

    def scalars(self):
        return _ScalarResult(self._packages)


class FakeSession:
    def __init__(self, *, existing_week_total, packages, unique_code_exists=False):
        self._existing_week_total = existing_week_total
        self._packages = packages
        self._unique_code_exists = unique_code_exists
        self.added = []
        self._scalar_calls = 0

    def begin(self):
        return _Begin()

    async def scalar(self, _query):
        self._scalar_calls += 1
        if self._scalar_calls == 1:
            return self._existing_week_total
        if self._unique_code_exists:
            self._unique_code_exists = False
            return uuid.uuid4()
        return None

    async def execute(self, _query):
        return _ExecuteResult(list(self._packages.values()))

    def add(self, obj):
        self.added.append(obj)
        if isinstance(obj, Application) and getattr(obj, "id", None) is None:
            obj.id = uuid.uuid4()

    async def flush(self):
        return None

    async def refresh(self, _obj):
        return None


def _iso_week_now():
    year, week, _ = datetime.now().isocalendar()
    return f"{year}-W{week:02d}"


@pytest.mark.asyncio
async def test_submit_application_success_deducts_stock_and_creates_rows():
    package = FoodPackage(
        id=1,
        name="Basic",
        category="General",
        stock=5,
        threshold=1,
        applied_count=0,
        food_bank_id=10,
        is_active=True,
    )
    db = FakeSession(existing_week_total=1, packages={1: package})

    application_in = ApplicationCreate(
        food_bank_id=10,
        weekly_period="1999-W01",  # endpoint should ignore this and use current ISO week
        items=[
            ApplicationItemCreatePayload(package_id=1, quantity=1),
            ApplicationItemCreatePayload(package_id=1, quantity=1),
        ],
    )

    result = await submit_application(
        application_in=application_in,
        current_user={"sub": str(uuid.uuid4())},
        db=db,
    )

    assert isinstance(result, Application)
    assert result.total_quantity == 2
    assert result.status == "pending"
    assert result.weekly_period == _iso_week_now()
    assert result.food_bank_id == 10
    assert result.redemption_code.startswith("FB-")

    # Duplicate package requests are aggregated; stock/apply_count should reflect total 2.
    assert package.stock == 3
    assert package.applied_count == 2

    app_rows = [row for row in db.added if isinstance(row, Application)]
    item_rows = [row for row in db.added if isinstance(row, ApplicationItem)]
    assert len(app_rows) == 1
    assert len(item_rows) == 1
    assert item_rows[0].quantity == 2


@pytest.mark.asyncio
async def test_submit_application_weekly_limit_exceeded():
    package = FoodPackage(
        id=1,
        name="Basic",
        category="General",
        stock=10,
        threshold=1,
        applied_count=0,
        food_bank_id=10,
        is_active=True,
    )
    db = FakeSession(existing_week_total=3, packages={1: package})

    application_in = ApplicationCreate(
        food_bank_id=10,
        weekly_period="2026-W12",
        items=[ApplicationItemCreatePayload(package_id=1, quantity=1)],
    )

    with pytest.raises(HTTPException) as exc:
        await submit_application(
            application_in=application_in,
            current_user={"sub": str(uuid.uuid4())},
            db=db,
        )

    assert exc.value.status_code == 400
    assert exc.value.detail == "Weekly limit exceeded"


@pytest.mark.asyncio
async def test_submit_application_insufficient_stock():
    package = FoodPackage(
        id=1,
        name="Basic",
        category="General",
        stock=1,
        threshold=1,
        applied_count=0,
        food_bank_id=10,
        is_active=True,
    )
    db = FakeSession(existing_week_total=0, packages={1: package})

    application_in = ApplicationCreate(
        food_bank_id=10,
        weekly_period="2026-W12",
        items=[ApplicationItemCreatePayload(package_id=1, quantity=2)],
    )

    with pytest.raises(HTTPException) as exc:
        await submit_application(
            application_in=application_in,
            current_user={"sub": str(uuid.uuid4())},
            db=db,
        )

    assert exc.value.status_code == 400
    assert exc.value.detail == "Insufficient stock for package 1"


@pytest.mark.asyncio
async def test_submit_application_rejects_mixed_food_banks():
    package1 = FoodPackage(
        id=1,
        name="A",
        category="General",
        stock=10,
        threshold=1,
        applied_count=0,
        food_bank_id=10,
        is_active=True,
    )
    package2 = FoodPackage(
        id=2,
        name="B",
        category="General",
        stock=10,
        threshold=1,
        applied_count=0,
        food_bank_id=20,
        is_active=True,
    )
    db = FakeSession(existing_week_total=0, packages={1: package1, 2: package2})

    application_in = ApplicationCreate(
        food_bank_id=10,
        weekly_period="2026-W12",
        items=[
            ApplicationItemCreatePayload(package_id=1, quantity=1),
            ApplicationItemCreatePayload(package_id=2, quantity=1),
        ],
    )

    with pytest.raises(HTTPException) as exc:
        await submit_application(
            application_in=application_in,
            current_user={"sub": str(uuid.uuid4())},
            db=db,
        )

    assert exc.value.status_code == 400
    assert exc.value.detail == "All selected packages must belong to the same food bank"


@pytest.mark.asyncio
async def test_submit_application_package_not_found():
    db = FakeSession(existing_week_total=0, packages={})

    application_in = ApplicationCreate(
        food_bank_id=10,
        weekly_period="2026-W12",
        items=[ApplicationItemCreatePayload(package_id=999, quantity=1)],
    )

    with pytest.raises(HTTPException) as exc:
        await submit_application(
            application_in=application_in,
            current_user={"sub": str(uuid.uuid4())},
            db=db,
        )

    assert exc.value.status_code == 404
    assert "Package(s) not found" in str(exc.value.detail)
