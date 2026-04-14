from __future__ import annotations

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.db_utils import fetch_scalars
from app.core.security import get_current_user
from app.models.application import Application
from app.routers._shared import single_page_response
from app.routers.applications_shared import extract_user_id
from app.schemas.application import ApplicationCreate
from app.services.application_submission_service import submit_public_application


async def submit_application(
    application_in: ApplicationCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await submit_public_application(
        application_in=application_in,
        current_user=current_user,
        db=db,
    )


async def get_my_applications(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = extract_user_id(current_user)
    return single_page_response(
        await fetch_scalars(
            db,
            select(Application)
            .where(Application.user_id == user_id)
            .order_by(Application.created_at.desc()),
        )
    )