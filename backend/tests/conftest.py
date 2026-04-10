from collections.abc import Callable, Generator
from pathlib import Path
import sys

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.main import app


@pytest.fixture(scope="session")
def test_app() -> FastAPI:
    return app


@pytest.fixture(autouse=True)
def clear_dependency_overrides(test_app: FastAPI) -> Generator[None, None, None]:
    yield
    test_app.dependency_overrides.clear()


@pytest.fixture(scope="module")
def api_client(test_app: FastAPI) -> Generator[TestClient, None, None]:
    with TestClient(test_app) as client:
        yield client


@pytest.fixture
def override_dependency(
    test_app: FastAPI,
) -> Callable[[Callable[..., object], Callable[..., object]], None]:
    def register(
        dependency: Callable[..., object],
        override: Callable[..., object],
    ) -> None:
        test_app.dependency_overrides[dependency] = override

    return register
