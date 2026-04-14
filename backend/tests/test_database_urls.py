from __future__ import annotations

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.database_urls import to_plain_postgres_dsn, to_sync_sqlalchemy_url


def test_to_sync_sqlalchemy_url_converts_asyncpg_urls() -> None:
    assert to_sync_sqlalchemy_url(
        "postgresql+asyncpg://foodbank:foodbank@localhost:5432/foodbank"
    ) == "postgresql+psycopg2://foodbank:foodbank@localhost:5432/foodbank"


def test_to_sync_sqlalchemy_url_leaves_other_urls_unchanged() -> None:
    database_url = "sqlite:///./dev.db"
    assert to_sync_sqlalchemy_url(database_url) == database_url


def test_to_plain_postgres_dsn_removes_async_driver_marker() -> None:
    assert to_plain_postgres_dsn(
        "postgresql+asyncpg://foodbank:foodbank@localhost:5432/foodbank"
    ) == "postgresql://foodbank:foodbank@localhost:5432/foodbank"


def test_to_plain_postgres_dsn_removes_psycopg2_driver_marker() -> None:
    assert to_plain_postgres_dsn(
        "postgresql+psycopg2://foodbank:foodbank@localhost:5432/foodbank"
    ) == "postgresql://foodbank:foodbank@localhost:5432/foodbank"
