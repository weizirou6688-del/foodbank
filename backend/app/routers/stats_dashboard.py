from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_admin
from app.schemas.stats import DashboardAnalyticsOut
from app.services.stats_dashboard_service import build_dashboard_analytics


router = APIRouter()


@router.get("/dashboard", response_model=DashboardAnalyticsOut)
async def get_dashboard_analytics(
    range_key: Literal["month", "quarter", "year"] = Query("month", alias="range"),
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await build_dashboard_analytics(
        range_key=range_key,
        admin_user=admin_user,
        db=db,
    )