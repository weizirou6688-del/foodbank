from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database_errors import run_guarded_transaction
from app.core.db_utils import flush_refresh
from app.models.application import Application
from app.models.food_bank import FoodBank
from app.routers._shared import require_one_or_404
from app.routers.applications_shared import (
    current_week_start,
    extract_user_id,
    requested_quantities,
)
from app.schemas.application import ApplicationCreate
from app.services.application_submission_item_service import (
    apply_package_allocations,
    build_inventory_application_items,
    build_package_application_items,
)
from app.services.application_submission_resource_service import (
    consume_requested_inventory,
    create_pending_application,
    load_requested_inventory_items,
    load_requested_packages,
)
from app.services.application_submission_validation_service import (
    validate_requested_items,
    validate_weekly_limits,
)
from app.services.dashboard_distribution_snapshot_service import (
    record_application_distribution_snapshots,
)


async def submit_public_application(
    application_in: ApplicationCreate,
    current_user: dict,
    db: AsyncSession,
) -> Application:
    user_id = extract_user_id(current_user)
    week_start = application_in.week_start or current_week_start()
    (
        package_quantity,
        requested_inventory_quantities,
        requested_package_quantities,
    ) = requested_quantities(application_in)

    validate_requested_items(
        package_quantity=package_quantity,
        requested_inventory_quantities=requested_inventory_quantities,
    )

    async def action() -> Application:
        await require_one_or_404(
            db,
            select(FoodBank.id).where(FoodBank.id == application_in.food_bank_id),
            detail="Food bank not found",
        )
        await validate_weekly_limits(
            db,
            user_id=user_id,
            week_start=week_start,
            package_quantity=package_quantity,
            requested_inventory_quantities=requested_inventory_quantities,
        )

        packages = await load_requested_packages(
            db,
            food_bank_id=application_in.food_bank_id,
            requested_package_quantities=requested_package_quantities,
        )
        inventory_items = await load_requested_inventory_items(
            db,
            food_bank_id=application_in.food_bank_id,
            requested_inventory_quantities=requested_inventory_quantities,
        )

        application = await create_pending_application(
            db,
            user_id=user_id,
            food_bank_id=application_in.food_bank_id,
            week_start=week_start,
            package_quantity=package_quantity,
        )

        apply_package_allocations(packages, requested_package_quantities)
        db.add_all(
            build_package_application_items(
                application.id,
                requested_package_quantities,
            )
        )

        await consume_requested_inventory(db, requested_inventory_quantities)
        db.add_all(
            build_inventory_application_items(
                application.id,
                requested_inventory_quantities,
            )
        )

        await record_application_distribution_snapshots(
            db,
            application.id,
            requested_package_quantities,
            packages,
            requested_inventory_quantities,
            inventory_items,
            snapshot_created_at=application.created_at,
        )
        return await flush_refresh(db, application)

    return await run_guarded_transaction(
        db,
        action,
        failure_detail="Failed to submit application",
        conflict_detail="Application conflict detected, please retry",
    )
