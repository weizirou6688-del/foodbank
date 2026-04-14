from __future__ import annotations

ASYNC_POSTGRES_SCHEME = "postgresql+asyncpg://"
SYNC_POSTGRES_SCHEME = "postgresql+psycopg2://"


def to_sync_sqlalchemy_url(database_url: str) -> str:
    if database_url.startswith(ASYNC_POSTGRES_SCHEME):
        return SYNC_POSTGRES_SCHEME + database_url[len(ASYNC_POSTGRES_SCHEME) :]
    return database_url


def to_plain_postgres_dsn(database_url: str) -> str:
    if "+asyncpg" in database_url:
        return database_url.replace("+asyncpg", "", 1)
    if "+psycopg2" in database_url:
        return database_url.replace("+psycopg2", "", 1)
    return database_url
