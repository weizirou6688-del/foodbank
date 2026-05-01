from __future__ import annotations

import pytest

from app.core.database_urls import to_plain_postgres_dsn, to_sync_sqlalchemy_url


LOCAL_RUNTIME_DATABASE_URL = "postgresql+asyncpg://foodbank:foodbank@localhost:5432/foodbank"
LOCAL_MIGRATION_DATABASE_URL = "postgresql+psycopg2://foodbank:foodbank@localhost:5432/foodbank"
DOCUMENTED_PRODUCTION_RUNTIME_DATABASE_URL = (
    "postgresql+asyncpg://produser:prodpass@prod-db.example.com:5432/foodbank_prod"
)
DOCUMENTED_PRODUCTION_MIGRATION_DATABASE_URL = (
    "postgresql+psycopg2://produser:prodpass@prod-db.example.com:5432/foodbank_prod"
)
LOCAL_SQLITE_DATABASE_URL = "sqlite:///./dev.db"


@pytest.mark.parametrize(
    ("database_url", "expected_url"),
    [
        pytest.param(
            LOCAL_RUNTIME_DATABASE_URL,
            LOCAL_MIGRATION_DATABASE_URL,
            id="readme_local_runtime_url",
        ),
        pytest.param(
            DOCUMENTED_PRODUCTION_RUNTIME_DATABASE_URL,
            DOCUMENTED_PRODUCTION_MIGRATION_DATABASE_URL,
            id="documented_production_runtime_url",
        ),
        pytest.param(
            LOCAL_SQLITE_DATABASE_URL,
            LOCAL_SQLITE_DATABASE_URL,
            id="local_sqlite_dev_file",
        ),
    ],
)
def test_to_sync_sqlalchemy_url_handles_runtime_and_documented_project_examples(
    database_url: str,
    expected_url: str,
) -> None:
    assert to_sync_sqlalchemy_url(database_url) == expected_url


@pytest.mark.parametrize(
    ("database_url", "expected_dsn"),
    [
        pytest.param(
            LOCAL_RUNTIME_DATABASE_URL,
            "postgresql://foodbank:foodbank@localhost:5432/foodbank",
            id="readme_local_asyncpg_url",
        ),
        pytest.param(
            LOCAL_MIGRATION_DATABASE_URL,
            "postgresql://foodbank:foodbank@localhost:5432/foodbank",
            id="readme_local_psycopg2_url",
        ),
        pytest.param(
            DOCUMENTED_PRODUCTION_RUNTIME_DATABASE_URL,
            "postgresql://produser:prodpass@prod-db.example.com:5432/foodbank_prod",
            id="documented_production_asyncpg_url",
        ),
        pytest.param(
            DOCUMENTED_PRODUCTION_MIGRATION_DATABASE_URL,
            "postgresql://produser:prodpass@prod-db.example.com:5432/foodbank_prod",
            id="documented_production_psycopg2_url",
        ),
    ],
)
def test_to_plain_postgres_dsn_normalizes_project_driver_specific_urls(
    database_url: str,
    expected_dsn: str,
) -> None:
    assert to_plain_postgres_dsn(database_url) == expected_dsn
