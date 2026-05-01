from __future__ import annotations

import sys
from collections.abc import Callable, Iterator
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import app.main as main_module

DependencyOverrides = dict[Callable[..., object], Callable[..., object]]


@pytest.fixture
def app_with_healthy_startup(
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[FastAPI]:
    async def _healthy_connection() -> tuple[bool, str | None]:
        return True, None

    async def _noop() -> None:
        return None

    app = main_module.app
    previous_db_ready = getattr(app.state, "db_ready", None)
    previous_db_error = getattr(app.state, "db_error", None)

    monkeypatch.setattr(main_module, "check_database_connection", _healthy_connection)
    monkeypatch.setattr(main_module, "ensure_dashboard_history", _noop)
    monkeypatch.setattr(main_module, "close_db", _noop)

    app.state.db_ready = True
    app.state.db_error = None

    yield app

    app.dependency_overrides.clear()
    app.state.db_ready = previous_db_ready
    app.state.db_error = previous_db_error


@pytest.fixture
def client_factory(app_with_healthy_startup: FastAPI):
    def _create(
        *,
        dependency_overrides: DependencyOverrides | None = None,
    ) -> TestClient:
        if dependency_overrides:
            app_with_healthy_startup.dependency_overrides.update(dependency_overrides)
        return TestClient(app_with_healthy_startup)

    return _create


@pytest.fixture
def client(client_factory) -> Iterator[TestClient]:
    with client_factory() as test_client:
        yield test_client
