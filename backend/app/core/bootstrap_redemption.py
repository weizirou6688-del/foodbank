from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.db_utils import fetch_scalars as _fetch_scalars
from app.core.redemption_codes import (
    is_canonical_redemption_code,
    normalize_redemption_code,
)
from app.models.application import Application


async def ensure_canonical_redemption_codes() -> None:
    async with AsyncSessionLocal() as db:
        applications = await _fetch_scalars(db, select(Application))
        owners_by_code = {
            application.redemption_code: application.id
            for application in applications
        }
        pending_targets: dict[str, str] = {}
        updates: list[tuple[Application, str]] = []

        for application in applications:
            current_code = application.redemption_code
            if is_canonical_redemption_code(current_code):
                continue

            normalized_code = normalize_redemption_code(current_code)
            if normalized_code == current_code:
                continue

            existing_owner = owners_by_code.get(normalized_code)
            if existing_owner is not None and existing_owner != application.id:
                raise RuntimeError(
                    f"Cannot normalize redemption code {current_code} to {normalized_code}: target already exists"
                )

            pending_owner = pending_targets.get(normalized_code)
            if pending_owner is not None and pending_owner != str(application.id):
                raise RuntimeError(
                    f"Cannot normalize redemption code {current_code} to {normalized_code}: target would collide"
                )

            pending_targets[normalized_code] = str(application.id)
            updates.append((application, normalized_code))

        if not updates:
            return

        for application, normalized_code in updates:
            application.redemption_code = normalized_code

        await db.commit()