import uuid
from datetime import date
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi import HTTPException

from app.models.application import Application
from app.routers.applications import get_my_applications, update_application_status
from app.schemas.application import ApplicationUpdate


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


class FakeReadSession:
    def __init__(self, rows):
        self._rows = rows

    async def execute(self, _query):
        return _ExecuteResult(self._rows)


class FakeUpdateSession:
    def __init__(self, *, app_row=None, code_owner=None):
        self.app_row = app_row
        self.code_owner = code_owner
        self._scalar_calls = 0

    def begin(self):
        return _Begin()

    async def scalar(self, _query):
        self._scalar_calls += 1
        if self._scalar_calls == 1:
            return self.app_row
        return self.code_owner

    async def flush(self):
        return None

    async def refresh(self, _obj):
        return None


@pytest.mark.asyncio
async def test_get_my_applications_returns_rows():
    user_id = uuid.uuid4()
    app1 = Application(
        id=uuid.uuid4(),
        user_id=user_id,
        food_bank_id=1,
        redemption_code="ABCD-EFGH",
        status="pending",
        week_start=date(2026, 3, 16),  # Monday of W12
        total_quantity=1,
    )
    app2 = Application(
        id=uuid.uuid4(),
        user_id=user_id,
        food_bank_id=1,
        redemption_code="WXYZ-2345",
        status="collected",
        week_start=date(2026, 3, 9),  # Monday of W11
        total_quantity=2,
    )

    db = FakeReadSession([app1, app2])
    result = await get_my_applications(current_user={"sub": str(user_id)}, db=db)

    assert result["total"] == 2
    assert len(result["items"]) == 2
    assert result["items"][0].redemption_code == "ABCD-EFGH"


@pytest.mark.asyncio
async def test_update_application_status_success():
    app_id = uuid.uuid4()
    app_row = Application(
        id=app_id,
        user_id=uuid.uuid4(),
        food_bank_id=1,
        redemption_code="ABCD-EFGH",
        status="pending",
        week_start=date(2026, 3, 16),  # Monday of W12
        total_quantity=1,
    )
    db = FakeUpdateSession(app_row=app_row, code_owner=None)

    result = await update_application_status(
        application_id=app_id,
        application_in=ApplicationUpdate(status="collected", redemption_code="ZZZZ-9999"),
        admin_user={"role": "admin"},
        db=db,
    )

    assert result.status == "collected"
    assert result.redemption_code == "ZZZZ-9999"


@pytest.mark.asyncio
async def test_update_application_status_not_found():
    db = FakeUpdateSession(app_row=None)

    with pytest.raises(HTTPException) as exc:
        await update_application_status(
            application_id=uuid.uuid4(),
            application_in=ApplicationUpdate(status="collected"),
            admin_user={"role": "admin"},
            db=db,
        )

    assert exc.value.status_code == 404
    assert exc.value.detail == "Application not found"


@pytest.mark.asyncio
async def test_update_application_status_code_conflict():
    app_id = uuid.uuid4()
    app_row = Application(
        id=app_id,
        user_id=uuid.uuid4(),
        food_bank_id=1,
        redemption_code="ABCD-EFGH",
        status="pending",
        week_start=date(2026, 3, 16),  # Monday of W12
        total_quantity=1,
    )
    db = FakeUpdateSession(app_row=app_row, code_owner=uuid.uuid4())

    with pytest.raises(HTTPException) as exc:
        await update_application_status(
            application_id=app_id,
            application_in=ApplicationUpdate(redemption_code="LMNP-2345"),
            admin_user={"role": "admin"},
            db=db,
        )

    assert exc.value.status_code == 409
    assert exc.value.detail == "Redemption code already in use"


@pytest.mark.asyncio
async def test_update_application_status_empty_payload_rejected():
    app_id = uuid.uuid4()
    db = FakeUpdateSession(
        app_row=Application(
            id=app_id,
            user_id=uuid.uuid4(),
            food_bank_id=1,
            redemption_code="ABCD-EFGH",
            status="pending",
            week_start=date(2026, 3, 16),  # Monday of W12
            total_quantity=1,
        )
    )

    with pytest.raises(HTTPException) as exc:
        await update_application_status(
            application_id=app_id,
            application_in=ApplicationUpdate(),
            admin_user={"role": "admin"},
            db=db,
        )

    assert exc.value.status_code == 400
    assert exc.value.detail == "No fields provided to update"
