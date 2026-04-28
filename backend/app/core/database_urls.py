"""把运行时的异步数据库 URL 转换成工具友好形式的辅助函数。"""

from __future__ import annotations

ASYNC_POSTGRES_SCHEME = "postgresql+asyncpg://"
SYNC_POSTGRES_SCHEME = "postgresql+psycopg2://"


def to_sync_sqlalchemy_url(database_url: str) -> str:
    # Alembic 和其他只支持同步的客户端没法用 asyncpg 那一套 SQLAlchemy scheme
    if database_url.startswith(ASYNC_POSTGRES_SCHEME):
        return SYNC_POSTGRES_SCHEME + database_url[len(ASYNC_POSTGRES_SCHEME) :]
    return database_url


def to_plain_postgres_dsn(database_url: str) -> str:
    # 有些外部工具只认不带 SQLAlchemy 驱动后缀的纯 postgres DSN
    if "+asyncpg" in database_url:
        return database_url.replace("+asyncpg", "", 1)
    if "+psycopg2" in database_url:
        return database_url.replace("+psycopg2", "", 1)
    return database_url
