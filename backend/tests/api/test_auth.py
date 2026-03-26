import uuid
from datetime import datetime
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi import HTTPException

from app.models.user import User
from app.routers.auth import register, login, logout, refresh, get_profile
from app.schemas.auth import LoginRequest
from app.schemas.user import UserCreate
from app.core.security import create_refresh_token


class _Begin:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


class FakeSession:
    def __init__(self, *, users=None, search_result=None):
        self.users = users or {}
        self._search_result = search_result  # Explicit search result
        self.added = []

    def begin(self):
        return _Begin()

    async def execute(self, query):
        # Return explicit search result or first user in dict
        if self._search_result is not None:
            return MockExecuteResult([self._search_result])
        # Default: return first user
        for user in self.users.values():
            return MockExecuteResult([user])
        return MockExecuteResult([None])

    def add(self, obj):
        self.added.append(obj)
        if isinstance(obj, User) and getattr(obj, "id", None) is None:
            obj.id = uuid.uuid4()

    async def flush(self):
        return None

    async def refresh(self, _obj):
        return None


class MockExecuteResult:
    def __init__(self, rows):
        self._rows = rows

    def scalar_one_or_none(self):
        return self._rows[0] if self._rows else None


@pytest.mark.asyncio
async def test_register_success():
    db = FakeSession()
    payload = UserCreate(
        name="Alice",
        email="alice@example.com",
        password="SecurePassword123",
    )

    result = await register(user_in=payload, db=db)

    assert isinstance(result, User)
    assert result.name == "Alice"
    assert result.email == "alice@example.com"
    assert result.role == "public"
    assert result.password_hash != payload.password  # Hashed, not plaintext


@pytest.mark.asyncio
async def test_register_email_conflict():
    existing_user = User(
        id=uuid.uuid4(),
        name="Bob",
        email="bob@example.com",
        password_hash="hashed",
        role="public",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db = FakeSession(search_result=existing_user)

    payload = UserCreate(
        name="Bobby",
        email="bob@example.com",
        password="Password123",
    )

    with pytest.raises(HTTPException) as exc:
        await register(user_in=payload, db=db)

    assert exc.value.status_code == 409
    assert "already registered" in exc.value.detail


@pytest.mark.asyncio
async def test_login_success():
    from app.core.security import get_password_hash
    from datetime import datetime

    user = User(
        id=uuid.uuid4(),
        name="Charlie",
        email="charlie@example.com",
        password_hash=get_password_hash("MyPassword123"),
        role="public",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db = FakeSession(search_result=user)

    payload = LoginRequest(
        email="charlie@example.com",
        password="MyPassword123",
    )

    result = await login(login_in=payload, db=db)

    assert result.access_token
    assert result.refresh_token
    assert result.token_type == "bearer"
    assert result.user.email == "charlie@example.com"


@pytest.mark.asyncio
async def test_login_invalid_password():
    from app.core.security import get_password_hash

    user = User(
        id=uuid.uuid4(),
        name="David",
        email="david@example.com",
        password_hash=get_password_hash("CorrectPassword"),
        role="public",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
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
        role="supermarket",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db = FakeSession(search_result=user)

    refresh_token = create_refresh_token({"sub": str(user_id)})

    result = await refresh(refresh_token=refresh_token, db=db)

    assert "access_token" in result
    assert result["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_get_profile_success():
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        name="Frank",
        email="frank@example.com",
        password_hash="hashed",
        role="admin",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db = FakeSession(search_result=user)
    current_user = {"sub": str(user_id), "role": "admin"}

    result = await get_profile(current_user=current_user, db=db)

    assert result.name == "Frank"
    assert result.email == "frank@example.com"
    assert result.role == "admin"


@pytest.mark.asyncio
async def test_get_profile_not_found():
    uncached_user_id = uuid.uuid4()
    db = FakeSession(search_result=None)
    current_user = {"sub": str(uncached_user_id), "role": "public"}

    with pytest.raises(HTTPException) as exc:
        await get_profile(current_user=current_user, db=db)

    assert exc.value.status_code == 404
