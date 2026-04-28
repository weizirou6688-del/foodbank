"""把底层数据库错误翻译成稳定的 HTTP 响应。"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import TypeVar

from fastapi import HTTPException, status
from sqlalchemy.exc import DBAPIError, IntegrityError, InterfaceError, OperationalError
from sqlalchemy.ext.asyncio import AsyncSession


DATABASE_UNAVAILABLE_DETAIL = "Database temporarily unavailable"
T = TypeVar("T")


def is_database_unavailable_exception(exc: Exception) -> bool:
    if isinstance(exc, (HTTPException, IntegrityError)):
        return False

    if isinstance(exc, (OperationalError, InterfaceError, ConnectionError, OSError)):
        return True

    if isinstance(exc, DBAPIError) and getattr(exc, "connection_invalidated", False):
        return True

    # SQLAlchemy 有时会把 asyncpg 的底层错误包好几层,所以要顺着异常链
    # 一直往下看,再决定要不要返回 503
    seen: set[int] = set()
    current: Exception | None = exc
    while current is not None and id(current) not in seen:
        seen.add(id(current))
        module_name = type(current).__module__.lower()
        class_name = type(current).__name__.lower()

        if "asyncpg" in module_name and any(
            keyword in class_name
            for keyword in ("connection", "cannotconnect", "interface", "client")
        ):
            return True

        current = current.__cause__ or current.__context__

    return False


def raise_database_unavailable_http_exception(
    detail: str = DATABASE_UNAVAILABLE_DETAIL,
) -> None:
    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail)


def raise_operation_failure_http_exception(exc: Exception, detail: str) -> None:
    if is_database_unavailable_exception(exc):
        raise_database_unavailable_http_exception()
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail) from exc


async def run_guarded_action(
    action: Callable[[], Awaitable[T]],
    *,
    failure_detail: str,
    conflict_detail: str | None = None,
) -> T:
    try:
        return await action()
    except HTTPException:
        raise
    except IntegrityError as exc:
        if conflict_detail is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=conflict_detail,
            ) from exc
        raise_operation_failure_http_exception(exc, failure_detail)
    except Exception as exc:
        raise_operation_failure_http_exception(exc, failure_detail)


async def run_guarded_transaction(
    db: AsyncSession,
    action: Callable[[], Awaitable[T]],
    *,
    failure_detail: str,
    conflict_detail: str | None = None,
) -> T:
    try:
        # 把事务边界集中在这里,路由处理函数能写得更短,
        # 而且 conflict / unavailable / failure 的映射在各处行为一致
        async with db.begin():
            return await action()
    except HTTPException:
        raise
    except IntegrityError as exc:
        if conflict_detail is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=conflict_detail,
            ) from exc
        raise_operation_failure_http_exception(exc, failure_detail)
    except Exception as exc:
        raise_operation_failure_http_exception(exc, failure_detail)
