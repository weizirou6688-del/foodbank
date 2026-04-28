"""Admin 端 application 路由:审核、核销、作废。"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.database_errors import run_guarded_transaction
from app.core.db_utils import fetch_scalars
from app.core.redemption_codes import normalize_redemption_code
from app.core.security import enforce_admin_food_bank_scope, get_admin_food_bank_id, require_admin
from app.models.application import Application
from app.models.application_item import ApplicationItem
from app.routers._shared import require_one_or_404, require_scoped_by_id, single_page_response
from app.schemas.application import (
    ApplicationAdminItemOut,
    ApplicationAdminListResponse,
    ApplicationAdminRecordOut,
    ApplicationListResponse,
    ApplicationOut,
)


router = APIRouter()

ADMIN_APPLICATION_OPTIONS = (
    selectinload(Application.items).selectinload(ApplicationItem.package),
    selectinload(Application.items).selectinload(ApplicationItem.inventory_item),
)


async def _require_scoped_application(
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


def _serialize_admin_application(application: Application) -> ApplicationAdminRecordOut:
    items: list[ApplicationAdminItemOut] = []
    display_names: list[str] = []

    # 把 package 和 direct item 拉平成一个列表,前端不用关心库表结构
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


def _admin_applications_query(
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


@router.get("", response_model=ApplicationListResponse)
async def list_all_applications(
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return single_page_response(
        await fetch_scalars(db, _admin_applications_query(admin_user))
    )


@router.get("/admin/records", response_model=ApplicationAdminListResponse)
async def list_admin_application_records(
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    applications = await fetch_scalars(
        db,
        _admin_applications_query(admin_user, include_admin_relations=True),
    )
    items = [_serialize_admin_application(application) for application in applications]
    return single_page_response(items)


@router.get("/admin/by-code/{redemption_code}", response_model=ApplicationAdminRecordOut)
async def get_application_by_redemption_code(
    redemption_code: str,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    normalized_code = normalize_redemption_code(redemption_code)
    application = await require_one_or_404(
        db,
        select(Application)
        .options(*ADMIN_APPLICATION_OPTIONS)
        .where(Application.redemption_code == normalized_code),
        detail="Application not found for redemption code",
    )
    enforce_admin_food_bank_scope(
        admin_user,
        application.food_bank_id,
        detail="You can only access redemption codes for your assigned food bank",
    )
    return _serialize_admin_application(application)


@router.post("/admin/{application_id}/redeem", response_model=ApplicationAdminRecordOut)
async def redeem_application(
    application_id: uuid.UUID,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    async def action() -> ApplicationAdminRecordOut:
        application = await _require_scoped_application(
            db,
            application_id,
            admin_user,
            detail="You can only redeem records for your assigned food bank",
            include_admin_relations=True,
        )
        if application.deleted_at is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Voided redemption code cannot be redeemed",
            )
        if application.status == "collected":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Application already redeemed",
            )
        if application.status == "expired":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Expired redemption code cannot be redeemed",
            )

        # 核销是单向操作,只记第一次成功时间,不去管重复扫码的情况
        application.status = "collected"
        application.redeemed_at = datetime.now(timezone.utc)
        await db.flush()
        return _serialize_admin_application(application)

    return await run_guarded_transaction(
        db,
        failure_detail="Failed to redeem application",
        action=action,
    )


@router.post("/admin/{application_id}/void", response_model=ApplicationAdminRecordOut)
async def void_application(
    application_id: uuid.UUID,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    async def action() -> ApplicationAdminRecordOut:
        application = await _require_scoped_application(
            db,
            application_id,
            admin_user,
            detail="You can only void records for your assigned food bank",
            include_admin_relations=True,
        )
        if application.deleted_at is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Application already voided",
            )
        if application.status == "collected":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Redeemed application cannot be voided",
            )
        application.deleted_at = datetime.now(timezone.utc)
        await db.flush()
        return _serialize_admin_application(application)

    return await run_guarded_transaction(
        db,
        failure_detail="Failed to void application",
        action=action,
    )
