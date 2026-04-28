"""公众用户的申请相关路由。

提交申请 + 查自己历史。提交逻辑(周限额、锁库存、写 snapshot)都在 service 里,
路由层只做参数解包和返回。
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.db_utils import fetch_scalars
from app.core.security import get_current_user
from app.models.application import Application
from app.routers._shared import single_page_response
from app.schemas.application import ApplicationCreate, ApplicationListResponse, ApplicationOut
from app.services.application_submission_service import (
    extract_user_id,
    submit_public_application,
)


router = APIRouter()


@router.post("", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
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


@router.get("/my", response_model=ApplicationListResponse)
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
