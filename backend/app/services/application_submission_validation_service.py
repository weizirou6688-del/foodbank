from __future__ import annotations

import uuid
from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db_utils import fetch_one_or_none, fetch_scalars
from app.models.application import Application
from app.models.application_item import ApplicationItem
from app.routers.applications_shared import (
    MAX_SINGLE_INDIVIDUAL_ITEM_QUANTITY,
    WEEKLY_INDIVIDUAL_ITEM_LIMIT,
    WEEKLY_PACKAGE_LIMIT,
)


def validate_requested_items(
    *,
    package_quantity: int,
    requested_inventory_quantities: dict[int, int],
) -> None:
    if package_quantity <= 0 and not requested_inventory_quantities:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Application must include at least one package or individual item",
        )

    if any(
        quantity > MAX_SINGLE_INDIVIDUAL_ITEM_QUANTITY
        for quantity in requested_inventory_quantities.values()
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Individual item quantity cannot exceed "
                f"{MAX_SINGLE_INDIVIDUAL_ITEM_QUANTITY}"
            ),
        )


async def validate_weekly_limits(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    week_start: date,
    package_quantity: int,
    requested_inventory_quantities: dict[int, int],
) -> None:
    existing_week_total = await fetch_one_or_none(
        db,
        select(func.coalesce(func.sum(Application.total_quantity), 0)).where(
            Application.user_id == user_id,
            Application.week_start == week_start,
        ),
    )
    existing_week_total = int(existing_week_total or 0)

    if existing_week_total + package_quantity > WEEKLY_PACKAGE_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Weekly limit exceeded",
        )

    if not requested_inventory_quantities:
        return

    existing_inventory_item_ids = {
        inventory_item_id
        for inventory_item_id in await fetch_scalars(
            db,
            select(ApplicationItem.inventory_item_id)
            .join(Application, Application.id == ApplicationItem.application_id)
            .where(
                Application.user_id == user_id,
                Application.week_start == week_start,
                ApplicationItem.inventory_item_id.is_not(None),
            ),
        )
        if inventory_item_id is not None
    }
    if (
        len(existing_inventory_item_ids.union(set(requested_inventory_quantities)))
        > WEEKLY_INDIVIDUAL_ITEM_LIMIT
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "You can request up to "
                f"{WEEKLY_INDIVIDUAL_ITEM_LIMIT} different individual items per week"
            ),
        )
