from __future__ import annotations

import sys
import uuid
from collections.abc import AsyncIterator, Iterator
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import app.main as main_module
import app.core.database as database_module
import app.core.security as security_module
import app.routers.auth as auth_module
import app.routers.inventory_items as inventory_items_module


@pytest.fixture
def client(monkeypatch) -> Iterator[TestClient]:
    async def _healthy_connection() -> tuple[bool, str | None]:
        return True, None

    async def _noop() -> None:
        return None

    async def _dummy_db() -> AsyncIterator[object]:
        yield object()

    monkeypatch.setattr(main_module, "check_database_connection", _healthy_connection)
    monkeypatch.setattr(main_module, "ensure_full_demo_data", _noop)
    monkeypatch.setattr(main_module, "ensure_canonical_redemption_codes", _noop)
    monkeypatch.setattr(main_module, "ensure_dashboard_history", _noop)
    monkeypatch.setattr(main_module, "close_db", _noop)
    main_module.app.dependency_overrides[database_module.get_db] = _dummy_db

    with TestClient(main_module.app) as test_client:
        yield test_client

    main_module.app.dependency_overrides.clear()


def _headers(*, role: str, food_bank_id: int | None = None, subject: str = "smoke-user") -> dict[str, str]:
    token = security_module.create_access_token(
        {"sub": subject, "role": role, "food_bank_id": food_bank_id}
    )
    return {"Authorization": f"Bearer {token}"}


def test_profile_route_accepts_authenticated_access_token(
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


def test_admin_route_rejects_requests_without_token(client: TestClient) -> None:
    response = client.get("/api/v1/inventory")

    assert response.status_code == 403
    assert response.json()["detail"] == "Not authenticated"


def test_admin_route_allows_admin_token_when_query_returns_empty_list(
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



def test_admin_route_rejects_public_user_token(client: TestClient) -> None:
    response = client.get(
        "/api/v1/inventory",
        headers=_headers(role="public"),
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Admin privileges required"
