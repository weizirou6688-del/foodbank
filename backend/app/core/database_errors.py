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
    async def _wrapped_action() -> T:
        async with db.begin():
            return await action()

    return await run_guarded_action(
        _wrapped_action,
        failure_detail=failure_detail,
        conflict_detail=conflict_detail,
    )
