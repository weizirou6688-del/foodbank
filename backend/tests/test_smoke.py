from __future__ import annotations

import sys
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import app.main as main_module


@pytest.fixture
def client(monkeypatch) -> Iterator[TestClient]:
    async def _healthy_connection() -> tuple[bool, str | None]:
        return True, None

    async def _noop() -> None:
        return None

    monkeypatch.setattr(main_module, "check_database_connection", _healthy_connection)
    monkeypatch.setattr(main_module, "ensure_canonical_redemption_codes", _noop)
    monkeypatch.setattr(main_module, "ensure_dashboard_history", _noop)
    monkeypatch.setattr(main_module, "close_db", _noop)

    with TestClient(main_module.app) as test_client:
        yield test_client


def test_root_endpoint_returns_service_metadata(client: TestClient) -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {
        "message": "ABC Community Food Bank API",
        "status": "running",
        "version": "1.0.0",
    }


def test_health_endpoint_reports_connected_when_startup_succeeds(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "connected"}


def test_health_endpoint_reports_degraded_when_database_state_flips(client: TestClient) -> None:
    main_module.app.state.db_ready = False
    main_module.app.state.db_error = "mock database failure"

    response = client.get("/health")

    assert response.status_code == 503
    assert response.json() == {
        "status": "degraded",
        "database": "unavailable",
        "detail": "mock database failure",
    }


def test_openapi_lists_key_backend_paths(client: TestClient) -> None:
    response = client.get("/openapi.json")

    assert response.status_code == 200
    paths = response.json()["paths"]
    for path in (
        "/health",
        "/api/v1/auth/login",
        "/api/v1/donations/cash",
        "/api/v1/inventory",
        "/api/v1/stats/dashboard",
    ):
        assert path in paths


def test_validation_errors_use_structured_bad_request_payload(client: TestClient) -> None:
    response = client.post("/api/v1/auth/login", json={})

    assert response.status_code == 400
    payload = response.json()
    assert payload["status_code"] == 400
    assert payload["message"] == "Validation error"
    assert {error["field"] for error in payload["errors"]} >= {"email", "password"}
