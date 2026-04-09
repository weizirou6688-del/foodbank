import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.core.security import create_refresh_token, decode_token, get_password_hash, verify_password
from app.models.password_reset_token import PasswordResetToken
from app.models.user import User
from app.routers.auth import forgot_password, get_profile, login, logout, refresh, register, reset_password
from app.schemas.auth import ForgotPasswordRequest, LoginRequest, ResetPasswordRequest
from app.schemas.user import UserCreate


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class _Begin:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


class MockScalarResult:
    def __init__(self, rows):
        self._rows = [row for row in rows if row is not None]

    def first(self):
        return self._rows[0] if self._rows else None

    def all(self):
        return self._rows


class MockExecuteResult:
    def __init__(self, rows):
        self._rows = rows

    def scalar_one_or_none(self):
        return self._rows[0] if self._rows else None

    def scalars(self):
        return MockScalarResult(self._rows)


class FakeSession:
    def __init__(self, *, users=None, search_result=None, search_results=None, food_bank_name=None):
        self.users = users or {}
        self._search_result = search_result
        self._search_results = search_results or {}
        self._food_bank_name = food_bank_name
        self.added = []

    def begin(self):
        return _Begin()

    async def execute(self, query):
        entity = None
        descriptions = getattr(query, "column_descriptions", None) or []
        if descriptions:
            entity = descriptions[0].get("entity")

        if entity in self._search_results:
            result = self._search_results[entity]
            if result is None:
                return MockExecuteResult([])
            if isinstance(result, list):
                return MockExecuteResult(result)
            return MockExecuteResult([result])

        if self._search_result is not None:
            return MockExecuteResult([self._search_result])

        for user in self.users.values():
            return MockExecuteResult([user])
        return MockExecuteResult([])

    async def scalar(self, query):
        q = str(query)
        if "food_banks.name" in q or "FROM food_banks" in q:
            return self._food_bank_name
        return None

    def add(self, obj):
        self.added.append(obj)
        if isinstance(obj, (User, PasswordResetToken)) and getattr(obj, "id", None) is None:
            obj.id = uuid.uuid4()
        if isinstance(obj, User) and getattr(obj, "created_at", None) is None:
            obj.created_at = _utcnow()
        if isinstance(obj, User) and getattr(obj, "updated_at", None) is None:
            obj.updated_at = obj.created_at
        if isinstance(obj, PasswordResetToken) and getattr(obj, "created_at", None) is None:
            obj.created_at = _utcnow()

    async def flush(self):
        return None

    async def refresh(self, _obj):
        return None


@pytest.mark.asyncio
async def test_register_success():
    db = FakeSession()
    payload = UserCreate(
        name="Alice",
        email="alice@example.com",
        password="SecurePassword123!",
    )

    result = await register(user_in=payload, db=db)

    assert result.name == "Alice"
    assert result.email == "alice@example.com"
    assert result.role == "public"
    created_user = next(obj for obj in db.added if isinstance(obj, User))
    assert created_user.password_hash != payload.password


@pytest.mark.asyncio
async def test_register_email_conflict():
    existing_user = User(
        id=uuid.uuid4(),
        name="Bob",
        email="bob@example.com",
        password_hash="hashed",
        role="public",
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    db = FakeSession(search_result=existing_user)

    payload = UserCreate(
        name="Bobby",
        email="bob@example.com",
        password="Password123!",
    )

    with pytest.raises(HTTPException) as exc:
        await register(user_in=payload, db=db)

    assert exc.value.status_code == 409
    assert "already registered" in exc.value.detail


@pytest.mark.asyncio
async def test_register_weak_password_rejected():
    with pytest.raises(ValidationError) as exc:
        UserCreate(
            name="Weak",
            email="weak@example.com",
            password="Password123",
        )

    assert "Password must include English letters, numbers, and special characters" in str(exc.value)


@pytest.mark.asyncio
async def test_login_success():
    user = User(
        id=uuid.uuid4(),
        name="Charlie",
        email="charlie@example.com",
        password_hash=get_password_hash("MyPassword123"),
        role="admin",
        food_bank_id=7,
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    db = FakeSession(search_result=user, food_bank_name="South London Food Bank")

    payload = LoginRequest(
        email="charlie@example.com",
        password="MyPassword123",
    )

    result = await login(login_in=payload, db=db)

    assert result.access_token
    assert result.refresh_token
    assert result.token_type == "bearer"
    assert result.user.email == "charlie@example.com"
    assert result.user.food_bank_id == 7
    assert result.user.food_bank_name == "South London Food Bank"
    assert decode_token(result.access_token)["food_bank_id"] == 7


@pytest.mark.asyncio
async def test_login_invalid_password():
    user = User(
        id=uuid.uuid4(),
        name="David",
        email="david@example.com",
        password_hash=get_password_hash("CorrectPassword"),
        role="public",
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    db = FakeSession(search_result=user)

    payload = LoginRequest(
        email="david@example.com",
        password="WrongPassword",
    )

    with pytest.raises(HTTPException) as exc:
        await login(login_in=payload, db=db)

    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_logout_success():
    current_user = {"sub": str(uuid.uuid4()), "role": "public"}
    db = FakeSession()

    result = await logout(current_user=current_user, db=db)

    assert result is None


@pytest.mark.asyncio
async def test_refresh_token_success():
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        name="Eve",
        email="eve@example.com",
        password_hash="hashed",
        role="admin",
        food_bank_id=5,
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    db = FakeSession(search_result=user)

    refresh_token = create_refresh_token({"sub": str(user_id)})

    result = await refresh(refresh_token=refresh_token, db=db)

    assert "access_token" in result
    assert result["token_type"] == "bearer"
    assert decode_token(result["access_token"])["food_bank_id"] == 5


@pytest.mark.asyncio
async def test_get_profile_success():
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        name="Frank",
        email="frank@example.com",
        password_hash="hashed",
        role="admin",
        food_bank_id=3,
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    db = FakeSession(search_result=user, food_bank_name="North Bank")
    current_user = {"sub": str(user_id), "role": "admin", "food_bank_id": 3}

    result = await get_profile(current_user=current_user, db=db)

    assert result.name == "Frank"
    assert result.email == "frank@example.com"
    assert result.role == "admin"
    assert result.food_bank_id == 3
    assert result.food_bank_name == "North Bank"


@pytest.mark.asyncio
async def test_get_profile_not_found():
    uncached_user_id = uuid.uuid4()
    db = FakeSession()
    current_user = {"sub": str(uncached_user_id), "role": "public"}

    with pytest.raises(HTTPException) as exc:
        await get_profile(current_user=current_user, db=db)

    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_forgot_password_requires_smtp_configuration(monkeypatch):
    from app.modules.auth import router as auth_router

    monkeypatch.setattr(auth_router, "is_smtp_configured", lambda: False)

    with pytest.raises(HTTPException) as exc:
        await forgot_password(
            payload=ForgotPasswordRequest(email="reset@example.com"),
            db=FakeSession(),
        )

    assert exc.value.status_code == 503


@pytest.mark.asyncio
async def test_forgot_password_sends_email_verification_code(monkeypatch):
    from app.modules.auth import router as auth_router

    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        name="Reset User",
        email="reset@example.com",
        password_hash="hashed",
        role="public",
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    db = FakeSession(search_results={User: user})
    captured: dict[str, str | int] = {}

    monkeypatch.setattr(auth_router, "is_smtp_configured", lambda: True)

    async def _capture_send_password_reset_email(**kwargs):
        captured.update(kwargs)

    monkeypatch.setattr(auth_router, "send_password_reset_email", _capture_send_password_reset_email)

    result = await forgot_password(
        payload=ForgotPasswordRequest(email="reset@example.com"),
        db=db,
    )

    created_reset_record = next(obj for obj in db.added if isinstance(obj, PasswordResetToken))

    assert "verification code" in result.message.lower()
    assert captured["to_email"] == "reset@example.com"
    assert str(captured["verification_code"]).isdigit()
    assert len(str(captured["verification_code"])) == 6
    assert int(captured["expires_in_minutes"]) == 10
    assert verify_password(str(captured["verification_code"]), created_reset_record.token_hash)


@pytest.mark.asyncio
async def test_reset_password_updates_password_hash():
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        name="Reset User",
        email="reset@example.com",
        password_hash=get_password_hash("Original123!"),
        role="public",
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    reset_record = PasswordResetToken(
        id=uuid.uuid4(),
        user_id=user_id,
        token_hash=get_password_hash("123456"),
        expires_at=_utcnow() + timedelta(minutes=10),
        used_at=None,
        created_at=_utcnow(),
    )
    db = FakeSession(search_results={User: user, PasswordResetToken: reset_record})

    result = await reset_password(
        payload=ResetPasswordRequest(
            email="reset@example.com",
            verification_code="123456",
            new_password="NewPassword123!",
        ),
        db=db,
    )

    assert "successful" in result.message.lower()
    assert verify_password("NewPassword123!", user.password_hash)
    assert reset_record.used_at is not None
