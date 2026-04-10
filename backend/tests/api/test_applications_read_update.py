import uuid
from datetime import date, datetime, timezone

import pytest
from fastapi import HTTPException

from app.models.application import Application
from app.routers.applications import (
    _normalize_redemption_code,
    _serialize_admin_application,
    get_my_applications,
    list_all_applications,
    update_application_status,
)
from app.schemas.application import ApplicationUpdate
from tests.support import AsyncBegin, ExecuteResult


class FakeReadSession:
    def __init__(self, rows):
        self._rows = rows

    async def execute(self, query):
        try:
            params = query.compile().params
        except Exception:
            params = {}

        food_bank_filter = next(
            (
                value
                for key, value in params.items()
                if "food_bank_id" in str(key) and value is not None
            ),
            None,
        )
        if food_bank_filter is None:
            return ExecuteResult(self._rows)

        return ExecuteResult(
            [row for row in self._rows if getattr(row, "food_bank_id", None) == food_bank_filter]
        )


class FakeUpdateSession:
    def __init__(self, *, app_row=None, code_owner=None):
        self.app_row = app_row
        self.code_owner = code_owner
        self._scalar_calls = 0

    def begin(self):
        return AsyncBegin()

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
async def test_list_all_applications_local_admin_scopes_to_assigned_food_bank():
    rows = [
        Application(
            id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            food_bank_id=1,
            redemption_code="ABCD-EFGH",
            status="pending",
            week_start=date(2026, 3, 16),
            total_quantity=1,
        ),
        Application(
            id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            food_bank_id=2,
            redemption_code="WXYZ-2345",
            status="pending",
            week_start=date(2026, 3, 16),
            total_quantity=1,
        ),
    ]

    db = FakeReadSession(rows)
    result = await list_all_applications(admin_user={"role": "admin", "food_bank_id": 1}, db=db)

    assert result["total"] == 1
    assert len(result["items"]) == 1
    assert result["items"][0].food_bank_id == 1


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


def test_normalize_redemption_code_preserves_legacy_dash_format():
    assert _normalize_redemption_code("fb-b97d51") == "FBB9-7D51"


def test_application_update_accepts_legacy_redemption_code_format():
    payload = ApplicationUpdate(redemption_code="FB-B97D51")
    assert payload.redemption_code == "FBB9-7D51"


def test_serialize_admin_application_accepts_legacy_redemption_code():
    application = Application(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        food_bank_id=1,
        redemption_code="FB-B97D51",
        status="pending",
        week_start=date(2026, 3, 16),
        total_quantity=1,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    application.items = []

    result = _serialize_admin_application(application)

    assert result.redemption_code == "FBB9-7D51"


@pytest.mark.asyncio
async def test_update_application_status_rejects_other_food_bank_for_local_admin():
    app_id = uuid.uuid4()
    db = FakeUpdateSession(
        app_row=Application(
            id=app_id,
            user_id=uuid.uuid4(),
            food_bank_id=2,
            redemption_code="ABCD-EFGH",
            status="pending",
            week_start=date(2026, 3, 16),
            total_quantity=1,
        )
    )

    with pytest.raises(HTTPException) as exc:
        await update_application_status(
            application_id=app_id,
            application_in=ApplicationUpdate(status="collected"),
            admin_user={"role": "admin", "food_bank_id": 1},
            db=db,
        )

    assert exc.value.status_code == 403
    assert exc.value.detail == "You can only update records for your assigned food bank"
