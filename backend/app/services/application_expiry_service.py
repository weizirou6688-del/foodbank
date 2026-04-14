from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.application import Application


logger = logging.getLogger(__name__)


def application_expiry_cutoff(*, now: datetime | None = None) -> datetime:
    reference_time = now or datetime.now(UTC).replace(tzinfo=None)
    return reference_time - timedelta(days=settings.application_expiry_days)


async def expire_overdue_applications(db: AsyncSession, *, now: datetime | None = None) -> int:
    result = await db.execute(
        update(Application)
        .where(
            Application.status == "pending",
            Application.deleted_at.is_(None),
            Application.created_at <= application_expiry_cutoff(now=now),
        )
        .values(status="expired", updated_at=func.now())
    )
    return int(result.rowcount or 0)


async def run_application_expiry_pass() -> int:
    async with AsyncSessionLocal() as db:
        async with db.begin():
            expired_count = await expire_overdue_applications(db)

    if expired_count > 0:
        logger.info("Expired %s overdue applications", expired_count)

    return expired_count


async def run_application_expiry_loop() -> None:
    interval_seconds = max(settings.application_expiry_check_seconds, 60)

    while True:
        try:
            await run_application_expiry_pass()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Application expiry pass failed")

        await asyncio.sleep(interval_seconds)
