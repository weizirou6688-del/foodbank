from __future__ import annotations

import uuid
from collections.abc import AsyncIterator, Iterator
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

import app.core.database as database_module
import app.core.security as security_module
import app.routers.auth as auth_module
import app.routers.inventory_items as inventory_items_module


@pytest.fixture
def client(client_factory) -> Iterator[TestClient]:
    async def _dummy_db() -> AsyncIterator[object]:
        yield object()

    with client_factory(
        dependency_overrides={database_module.get_db: _dummy_db},
    ) as test_client:
        yield test_client


def _headers(*, role: str, food_bank_id: int | None = None, subject: str = "smoke-user") -> dict[str, str]:
    token = security_module.create_access_token(
        {"sub": subject, "role": role, "food_bank_id": food_bank_id}
    )
    return {"Authorization": f"Bearer {token}"}


def test_auth_me_returns_admin_profile_for_signed_admin_token(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user_id = uuid.uuid4()
    user_payload = {
        "id": str(user_id),
        "name": "Smoke Admin",
        "email": "admin@example.com",
        "role": "admin",
        "food_bank_id": 1,
        "food_bank_name": "Central Bank",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    async def _user_by_id(_db, requested_user_id: str):
        assert requested_user_id == str(user_id)
        return SimpleNamespace(id=user_id)

    async def _serialize_user(_user, _db):
        return user_payload

    monkeypatch.setattr(auth_module, "_user_by_id", _user_by_id)
    monkeypatch.setattr(auth_module, "_serialize_user", _serialize_user)

    response = client.get(
        "/api/v1/auth/me",
        headers=_headers(role="admin", food_bank_id=1, subject=str(user_id)),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(user_id)
    assert body["role"] == "admin"
    assert body["food_bank_id"] == 1


def test_inventory_list_allows_admin_token_when_inventory_query_returns_empty(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _fetch_scalars(_db, _query):
        return []

    monkeypatch.setattr(inventory_items_module, "fetch_scalars", _fetch_scalars)

    response = client.get(
        "/api/v1/inventory",
        headers=_headers(role="admin", food_bank_id=1),
    )

    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0, "page": 1, "size": 0, "pages": 1}


@pytest.mark.parametrize(
    ("headers", "expected_detail"),
    [
        (None, "Not authenticated"),
        (_headers(role="public"), "Admin privileges required"),
    ],
    ids=["missing_bearer_token", "public_role_token"],
)
def test_inventory_list_rejects_missing_or_non_admin_tokens(
    client: TestClient,
    headers: dict[str, str] | None,
    expected_detail: str,
) -> None:
    response = client.get("/api/v1/inventory", headers=headers)

    assert response.status_code == 403
    assert response.json()["detail"] == expected_detail
