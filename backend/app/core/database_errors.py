"""
Helpers for normalizing database connectivity failures into HTTP 503 responses.
"""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.exc import DBAPIError, IntegrityError, InterfaceError, OperationalError


DATABASE_UNAVAILABLE_DETAIL = "Database temporarily unavailable"


def is_database_unavailable_exception(exc: Exception) -> bool:
    """
    Return True when the exception indicates the database connection is unavailable.

    Integrity or business-rule failures should not be treated as service outages.
    """
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


def database_unavailable_http_exception(
    detail: str = DATABASE_UNAVAILABLE_DETAIL,
) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=detail,
    )


def raise_database_unavailable_http_exception(
    detail: str = DATABASE_UNAVAILABLE_DETAIL,
) -> None:
    raise database_unavailable_http_exception(detail)
