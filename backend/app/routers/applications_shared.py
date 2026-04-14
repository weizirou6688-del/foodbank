from __future__ import annotations

import uuid
from collections.abc import Callable
from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database_errors import run_guarded_transaction
from app.core.db_utils import fetch_one_or_none
from app.core.redemption_codes import new_redemption_code
from app.core.security import get_admin_food_bank_id
from app.models.application import Application
from app.models.application_item import ApplicationItem
from app.routers._shared import require_scoped_by_id
from app.schemas.application import (
    ApplicationAdminItemOut,
    ApplicationAdminRecordOut,
    ApplicationCreate,
    ApplicationOut,
)


WEEKLY_PACKAGE_LIMIT = 3
WEEKLY_INDIVIDUAL_ITEM_LIMIT = 5
MAX_SINGLE_INDIVIDUAL_ITEM_QUANTITY = 5
ADMIN_APPLICATION_OPTIONS = (
    selectinload(Application.items).selectinload(ApplicationItem.package),
    selectinload(Application.items).selectinload(ApplicationItem.inventory_item),
)


async def generate_unique_redemption_code(db: AsyncSession) -> str:
    for _ in range(10):
        code = new_redemption_code()
        existing_id = await fetch_one_or_none(
            db,
            select(Application.id).where(Application.redemption_code == code),
        )
        if existing_id is None:
            return code
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Failed to generate unique redemption code",
    )


def current_week_start() -> date:
    today = date.today()
    return date.fromordinal(today.toordinal() - today.weekday())


def extract_user_id(current_user: dict | object) -> uuid.UUID:
    user_ref = None
    if isinstance(current_user, dict):
        user_ref = current_user.get("id") or current_user.get("sub")
    else:
        user_ref = getattr(current_user, "id", None)

    if not user_ref:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user token payload",
        )

    try:
        return uuid.UUID(str(user_ref))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user identifier in token",
        ) from exc


async def require_scoped_application(
    db: AsyncSession,
    application_id: uuid.UUID,
    admin_user: dict,
    *,
    detail: str,
    include_admin_relations: bool = False,
) -> Application:
    return await require_scoped_by_id(
        db,
        Application,
        application_id,
        admin_user,
        detail=detail,
        not_found_detail="Application not found",
        options=ADMIN_APPLICATION_OPTIONS if include_admin_relations else (),
    )


def serialize_admin_application(application: Application) -> ApplicationAdminRecordOut:
    items: list[ApplicationAdminItemOut] = []
    display_names: list[str] = []

    for item in application.items:
        if item.package is not None:
            item_name = item.package.name
        elif item.inventory_item is not None:
            item_name = item.inventory_item.name
        else:
            item_name = f"Item #{item.id}"

        items.append(
            ApplicationAdminItemOut(
                id=item.id,
                package_id=item.package_id,
                inventory_item_id=item.inventory_item_id,
                name=item_name,
                quantity=item.quantity,
            )
        )
        display_names.append(item_name)

    package_name = ", ".join(dict.fromkeys(display_names)) if display_names else None
    base_payload = ApplicationOut.model_validate(application).model_dump()
    return ApplicationAdminRecordOut(
        **base_payload,
        items=items,
        package_name=package_name,
        is_voided=application.deleted_at is not None,
        voided_at=application.deleted_at,
    )


def requested_quantities(
    application_in: ApplicationCreate,
) -> tuple[int, dict[int, int], dict[int, int]]:
    requested_inventory_quantities: dict[int, int] = {}
    requested_package_quantities: dict[int, int] = {}

    for item in application_in.items:
        quantity_map = (
            requested_package_quantities
            if item.package_id is not None
            else requested_inventory_quantities
        )
        item_id = item.package_id if item.package_id is not None else item.inventory_item_id
        if item_id is not None:
            quantity_map[item_id] = quantity_map.get(item_id, 0) + item.quantity

    return (
        sum(requested_package_quantities.values()),
        requested_inventory_quantities,
        requested_package_quantities,
    )


def admin_applications_query(
    admin_user: dict,
    *,
    include_admin_relations: bool = False,
):
    query = select(Application).order_by(Application.created_at.desc())
    if include_admin_relations:
        query = query.options(*ADMIN_APPLICATION_OPTIONS)

    admin_food_bank_id = get_admin_food_bank_id(admin_user)
    return (
        query.where(Application.food_bank_id == admin_food_bank_id)
        if admin_food_bank_id is not None
        else query
    )


async def run_admin_application_mutation(
    db: AsyncSession,
    application_id: uuid.UUID,
    admin_user: dict,
    *,
    detail: str,
    failure_detail: str,
    mutator: Callable[[Application], None],
) -> ApplicationAdminRecordOut:
    async def action() -> ApplicationAdminRecordOut:
        application = await require_scoped_application(
            db,
            application_id,
            admin_user,
            detail=detail,
            include_admin_relations=True,
        )
        mutator(application)
        await db.flush()
        return serialize_admin_application(application)

    return await run_guarded_transaction(db, action, failure_detail=failure_detail)
