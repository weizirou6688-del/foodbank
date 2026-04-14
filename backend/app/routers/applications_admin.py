from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.database_errors import run_guarded_transaction
from app.core.db_utils import fetch_one_or_none, fetch_scalars, flush_refresh
from app.core.redemption_codes import normalize_redemption_code, redemption_code_lookup_candidates
from app.core.security import enforce_admin_food_bank_scope, require_admin
from app.models.application import Application
from app.routers._shared import require_one_or_404, single_page_response
from app.routers.applications_shared import (
    ADMIN_APPLICATION_OPTIONS,
    admin_applications_query,
    require_scoped_application,
    run_admin_application_mutation,
    serialize_admin_application,
)
from app.schemas.application import (
    ApplicationAdminListResponse,
    ApplicationAdminRecordOut,
    ApplicationListResponse,
    ApplicationOut,
    ApplicationUpdate,
)


router = APIRouter()


@router.get("", response_model=ApplicationListResponse)
async def list_all_applications(
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return single_page_response(
        await fetch_scalars(db, admin_applications_query(admin_user))
    )


@router.get("/admin/records", response_model=ApplicationAdminListResponse)
async def list_admin_application_records(
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    applications = await fetch_scalars(
        db,
        admin_applications_query(admin_user, include_admin_relations=True),
    )
    items = [serialize_admin_application(application) for application in applications]
    return single_page_response(items)


@router.get("/admin/by-code/{redemption_code}", response_model=ApplicationAdminRecordOut)
async def get_application_by_redemption_code(
    redemption_code: str,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    lookup_codes = redemption_code_lookup_candidates(redemption_code)
    application = await require_one_or_404(
        db,
        select(Application)
        .options(*ADMIN_APPLICATION_OPTIONS)
        .where(Application.redemption_code.in_(lookup_codes)),
        detail="Application not found for redemption code",
    )
    enforce_admin_food_bank_scope(
        admin_user,
        application.food_bank_id,
        detail="You can only access redemption codes for your assigned food bank",
    )
    return serialize_admin_application(application)


@router.post("/admin/{application_id}/redeem", response_model=ApplicationAdminRecordOut)
async def redeem_application(
    application_id: uuid.UUID,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    def mutator(application: Application) -> None:
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

        application.status = "collected"
        application.redeemed_at = datetime.now(timezone.utc)

    return await run_admin_application_mutation(
        db,
        application_id,
        admin_user,
        detail="You can only redeem records for your assigned food bank",
        failure_detail="Failed to redeem application",
        mutator=mutator,
    )


@router.post("/admin/{application_id}/void", response_model=ApplicationAdminRecordOut)
async def void_application(
    application_id: uuid.UUID,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    def mutator(application: Application) -> None:
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

    return await run_admin_application_mutation(
        db,
        application_id,
        admin_user,
        detail="You can only void records for your assigned food bank",
        failure_detail="Failed to void application",
        mutator=mutator,
    )


@router.patch("/{application_id}", response_model=ApplicationOut)
async def update_application_status(
    application_id: uuid.UUID,
    application_in: ApplicationUpdate,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if application_in.status is None and application_in.redemption_code is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided to update",
        )

    async def action() -> ApplicationOut:
        application = await require_scoped_application(
            db,
            application_id,
            admin_user,
            detail="You can only update records for your assigned food bank",
        )

        if application_in.redemption_code is not None:
            normalized_code = normalize_redemption_code(application_in.redemption_code)
            lookup_codes = redemption_code_lookup_candidates(application_in.redemption_code)
            code_owner = await fetch_one_or_none(
                db,
                select(Application.id).where(
                    Application.redemption_code.in_(lookup_codes),
                    Application.id != application_id,
                ),
            )
            if code_owner is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Redemption code already in use",
                )
            application.redemption_code = normalized_code

        if application_in.status is not None:
            application.status = application_in.status
            if application_in.status == "collected":
                application.redeemed_at = application.redeemed_at or datetime.now(timezone.utc)
            elif application_in.status != "collected":
                application.redeemed_at = None

        return await flush_refresh(db, application)

    return await run_guarded_transaction(
        db,
        action,
        failure_detail="Failed to update application",
        conflict_detail="Application conflict detected, please retry",
    )
