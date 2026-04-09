"""
Application submission and management routes.

Spec § 2.4: POST (submit), GET /my (user's), PATCH/:id (admin status update)
"""

import uuid
from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.database_errors import (
    is_database_unavailable_exception,
    raise_database_unavailable_http_exception,
)
from app.core.redemption_codes import (
    new_redemption_code,
    normalize_redemption_code,
    redemption_code_lookup_candidates,
)
from app.core.security import (
    enforce_admin_food_bank_scope,
    get_admin_food_bank_id,
    get_current_user,
    require_admin,
)
from app.models.application import Application
from app.models.application_item import ApplicationItem
from app.models.food_bank import FoodBank
from app.models.food_package import FoodPackage
from app.models.inventory_item import InventoryItem
from app.models.package_item import PackageItem
from app.schemas.application import (
    ApplicationCreate,
    ApplicationAdminItemOut,
    ApplicationAdminListResponse,
    ApplicationAdminRecordOut,
    ApplicationListResponse,
    ApplicationOut,
    ApplicationUpdate,
)
from app.services.inventory_service import consume_inventory_lots
from app.services.dashboard_history_service import (
    record_application_distribution_snapshots,
)


router = APIRouter(tags=["Applications"])

WEEKLY_PACKAGE_LIMIT = 3
WEEKLY_INDIVIDUAL_ITEM_LIMIT = 5
MAX_SINGLE_INDIVIDUAL_ITEM_QUANTITY = 5


def _new_redemption_code() -> str:
    return new_redemption_code()


def _normalize_redemption_code(raw_code: str) -> str:
    return normalize_redemption_code(raw_code)


async def _generate_unique_redemption_code(db: AsyncSession) -> str:
    for _ in range(10):
        code = _new_redemption_code()
        existing_id = await db.scalar(
            select(Application.id).where(Application.redemption_code == code)
        )
        if existing_id is None:
            return code
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Failed to generate unique redemption code",
    )


def _extract_user_id(current_user: dict | object) -> uuid.UUID:
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


async def _load_admin_application(
    db: AsyncSession,
    application_id: uuid.UUID,
) -> Application | None:
    result = await db.execute(
        select(Application)
        .options(
            selectinload(Application.items).selectinload(ApplicationItem.package),
            selectinload(Application.items).selectinload(ApplicationItem.inventory_item),
        )
        .where(Application.id == application_id)
    )
    return result.scalar_one_or_none()


def _serialize_admin_application(application: Application) -> ApplicationAdminRecordOut:
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


@router.post("", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
async def submit_application(
    application_in: ApplicationCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Submit food assistance application.
    
    Spec § 2.4: POST /applications (requires auth, any user role).
    
    ApplicationCreate includes:
    - items: List[ApplicationItemCreatePayload]
    - week_start: DATE (week start date in YYYY-MM-DD format)
    
    TODO: Verify <= 1 active app per user per week
    """
    user_id = _extract_user_id(current_user)

    # Use provided week_start or generate from current date (Monday of current week)
    week_start = application_in.week_start
    if week_start is None:
        today = date.today()
        # Calculate Monday of the current week (0=Monday, 1=Tuesday, ..., 6=Sunday)
        days_since_monday = today.weekday()
        week_start = date.fromordinal(today.toordinal() - days_since_monday)

    package_quantity = sum(
        item.quantity
        for item in application_in.items
        if item.package_id is not None
    )
    requested_inventory_quantities: dict[int, int] = {}
    requested_package_quantities: dict[int, int] = {}

    for item in application_in.items:
        if item.package_id is not None:
            requested_package_quantities[item.package_id] = (
                requested_package_quantities.get(item.package_id, 0) + item.quantity
            )
            continue

        if item.inventory_item_id is not None:
            requested_inventory_quantities[item.inventory_item_id] = (
                requested_inventory_quantities.get(item.inventory_item_id, 0) + item.quantity
            )

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
            detail=f"Individual item quantity cannot exceed {MAX_SINGLE_INDIVIDUAL_ITEM_QUANTITY}",
        )

    try:
        async with db.begin():
            food_bank_exists = await db.scalar(
                select(FoodBank.id).where(FoodBank.id == application_in.food_bank_id)
            )
            if food_bank_exists is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Food bank not found",
                )

            existing_week_total = await db.scalar(
                select(func.coalesce(func.sum(Application.total_quantity), 0)).where(
                    Application.user_id == user_id,
                    Application.week_start == week_start,
                )
            )
            existing_week_total = int(existing_week_total or 0)

            if existing_week_total + package_quantity > WEEKLY_PACKAGE_LIMIT:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Weekly limit exceeded",
                )

            if requested_inventory_quantities:
                existing_inventory_item_ids = {
                    inventory_item_id
                    for inventory_item_id in (
                        await db.execute(
                            select(ApplicationItem.inventory_item_id)
                            .join(Application, Application.id == ApplicationItem.application_id)
                            .where(
                                Application.user_id == user_id,
                                Application.week_start == week_start,
                                ApplicationItem.inventory_item_id.is_not(None),
                            )
                        )
                    ).scalars().all()
                    if inventory_item_id is not None
                }

                requested_inventory_item_ids = set(requested_inventory_quantities.keys())
                if len(existing_inventory_item_ids.union(requested_inventory_item_ids)) > WEEKLY_INDIVIDUAL_ITEM_LIMIT:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"You can request up to {WEEKLY_INDIVIDUAL_ITEM_LIMIT} different individual items per week",
                    )

            packages: dict[int, FoodPackage] = {}
            inventory_items: dict[int, InventoryItem] = {}
            if requested_package_quantities:
                package_ids = list(requested_package_quantities.keys())
                packages_result = await db.execute(
                    select(FoodPackage)
                    .options(
                        selectinload(FoodPackage.package_items).selectinload(PackageItem.inventory_item)
                    )
                    .where(
                        FoodPackage.id.in_(package_ids),
                    )
                    .with_for_update()
                )
                packages = {pkg.id: pkg for pkg in packages_result.scalars().all()}

                missing_package_ids = [pkg_id for pkg_id in package_ids if pkg_id not in packages]
                if missing_package_ids:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Package(s) not found: {missing_package_ids}",
                    )

                if any(not pkg.is_active for pkg in packages.values()):
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="One or more selected packages are inactive",
                    )

                food_bank_ids = {pkg.food_bank_id for pkg in packages.values()}
                if None in food_bank_ids:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Selected package is not bound to a food bank",
                    )
                if len(food_bank_ids) != 1:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="All selected packages must belong to the same food bank",
                    )
                package_food_bank_id = next(iter(food_bank_ids))

                if application_in.food_bank_id != package_food_bank_id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Provided food_bank_id does not match selected packages",
                    )

                recipe_package_ids = (
                    await db.execute(
                        select(PackageItem.package_id).where(PackageItem.package_id.in_(package_ids))
                    )
                ).scalars().all()
                package_ids_with_recipes = set(recipe_package_ids)

                # Applications consume already-packed package stock.
                for package_id, requested_qty in requested_package_quantities.items():
                    package = packages[package_id]

                    if package.stock < requested_qty:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Insufficient stock for package {package_id}",
                        )
                    if package_id not in package_ids_with_recipes:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Package {package_id} cannot be applied for because it has no configured contents",
                        )

            if requested_inventory_quantities:
                inventory_item_ids = list(requested_inventory_quantities.keys())
                inventory_result = await db.execute(
                    select(InventoryItem)
                    .where(InventoryItem.id.in_(inventory_item_ids))
                    .with_for_update()
                )
                inventory_items = {item.id: item for item in inventory_result.scalars().all()}

                missing_inventory_item_ids = [
                    item_id for item_id in inventory_item_ids if item_id not in inventory_items
                ]
                if missing_inventory_item_ids:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Inventory item(s) not found: {missing_inventory_item_ids}",
                    )

            redemption_code = await _generate_unique_redemption_code(db)

            application = Application(
                user_id=user_id,
                food_bank_id=application_in.food_bank_id,
                redemption_code=redemption_code,
                status="pending",
                week_start=week_start,
                total_quantity=package_quantity,
                redeemed_at=None,
            )
            db.add(application)
            await db.flush()

            # Deduct package stock and create application items
            for package_id, requested_qty in requested_package_quantities.items():
                package = packages[package_id]
                package.stock -= requested_qty
                package.applied_count += requested_qty

                db.add(
                    ApplicationItem(
                        application_id=application.id,
                        package_id=package_id,
                        quantity=requested_qty,
                    )
                )

            for inventory_item_id, requested_qty in requested_inventory_quantities.items():
                try:
                    await consume_inventory_lots(inventory_item_id, requested_qty, db)
                except ValueError as exc:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Insufficient stock for inventory item {inventory_item_id}: {exc}",
                    ) from exc

                db.add(
                    ApplicationItem(
                        application_id=application.id,
                        inventory_item_id=inventory_item_id,
                        quantity=requested_qty,
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

            await db.flush()
            await db.refresh(application)

            return application
    except HTTPException:
        raise
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Application conflict detected, please retry",
        ) from exc
    except Exception as exc:
        if is_database_unavailable_exception(exc):
            raise_database_unavailable_http_exception()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit application",
        ) from exc


@router.get("/my", response_model=ApplicationListResponse)
async def get_my_applications(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all applications for current user.
    
    Spec § 2.4: GET /applications/my (requires auth).
    
    TODO: Query all applications where user_id = current_user.id
    """
    user_id = _extract_user_id(current_user)
    result = await db.execute(
        select(Application)
        .where(Application.user_id == user_id)
        .order_by(Application.created_at.desc())
    )
    items = list(result.scalars().all())
    total = len(items)
    # TODO: 实现真实分页
    return {
        "items": items,
        "total": total,
        "page": 1,
        "size": total,
        "pages": 1,
    }


@router.get("", response_model=ApplicationListResponse)
async def list_all_applications(
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    List all applications (admin only).

    Spec § 2.4: Admin application listing endpoint.
    """
    query = select(Application).order_by(Application.created_at.desc())
    admin_food_bank_id = get_admin_food_bank_id(admin_user)
    if admin_food_bank_id is not None:
        query = query.where(Application.food_bank_id == admin_food_bank_id)

    result = await db.execute(query)
    items = list(result.scalars().all())
    total = len(items)
    # TODO: 实现真实分页
    return {
        "items": items,
        "total": total,
        "page": 1,
        "size": total,
        "pages": 1,
    }


@router.get("/admin/records", response_model=ApplicationAdminListResponse)
async def list_admin_application_records(
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Application)
        .options(
            selectinload(Application.items).selectinload(ApplicationItem.package),
            selectinload(Application.items).selectinload(ApplicationItem.inventory_item),
        )
        .order_by(Application.created_at.desc())
    )
    admin_food_bank_id = get_admin_food_bank_id(admin_user)
    if admin_food_bank_id is not None:
        query = query.where(Application.food_bank_id == admin_food_bank_id)

    result = await db.execute(query)
    applications = list(result.scalars().all())
    items = [_serialize_admin_application(application) for application in applications]
    total = len(items)
    return {
        "items": items,
        "total": total,
        "page": 1,
        "size": total,
        "pages": 1,
    }


@router.get("/admin/by-code/{redemption_code}", response_model=ApplicationAdminRecordOut)
async def get_application_by_redemption_code(
    redemption_code: str,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    lookup_codes = redemption_code_lookup_candidates(redemption_code)
    result = await db.execute(
        select(Application)
        .options(
            selectinload(Application.items).selectinload(ApplicationItem.package),
            selectinload(Application.items).selectinload(ApplicationItem.inventory_item),
        )
        .where(Application.redemption_code.in_(lookup_codes))
    )
    application = result.scalar_one_or_none()
    if application is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
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
    try:
        async with db.begin():
            application = await _load_admin_application(db, application_id)
            if application is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Application not found",
                )

            enforce_admin_food_bank_scope(
                admin_user,
                application.food_bank_id,
                detail="You can only redeem records for your assigned food bank",
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

            application.status = "collected"
            application.redeemed_at = datetime.now(timezone.utc)
            await db.flush()

        refreshed = await _load_admin_application(db, application_id)
        if refreshed is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Application not found",
            )
        return _serialize_admin_application(refreshed)
    except HTTPException:
        raise
    except Exception as exc:
        if is_database_unavailable_exception(exc):
            raise_database_unavailable_http_exception()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to redeem application",
        ) from exc


@router.post("/admin/{application_id}/void", response_model=ApplicationAdminRecordOut)
async def void_application(
    application_id: uuid.UUID,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        async with db.begin():
            application = await _load_admin_application(db, application_id)
            if application is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Application not found",
                )

            enforce_admin_food_bank_scope(
                admin_user,
                application.food_bank_id,
                detail="You can only void records for your assigned food bank",
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

        refreshed = await _load_admin_application(db, application_id)
        if refreshed is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Application not found",
            )
        return _serialize_admin_application(refreshed)
    except HTTPException:
        raise
    except Exception as exc:
        if is_database_unavailable_exception(exc):
            raise_database_unavailable_http_exception()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to void application",
        ) from exc


@router.patch("/{application_id}", response_model=ApplicationOut)
async def update_application_status(
    application_id: uuid.UUID,
    application_in: ApplicationUpdate,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Update application status (admin only).
    
    Spec § 2.4: PATCH /applications/:id (requires admin role).
    
    ApplicationUpdate includes:
    - status: Status enum (pending, collected, expired)
    - admin_comment: Optional string
    
    TODO: Admin-only endpoint to update status and comments
    """
    if (
        application_in.status is None
        and application_in.redemption_code is None
        and application_in.admin_comment is None
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided to update",
        )

    try:
        async with db.begin():
            application = await db.scalar(
                select(Application).where(Application.id == application_id)
            )
            if application is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Application not found",
                )

            enforce_admin_food_bank_scope(
                admin_user,
                application.food_bank_id,
                detail="You can only update records for your assigned food bank",
            )

            if application_in.redemption_code is not None:
                normalized_code = _normalize_redemption_code(application_in.redemption_code)
                lookup_codes = redemption_code_lookup_candidates(application_in.redemption_code)
                code_owner = await db.scalar(
                    select(Application.id).where(
                        Application.redemption_code.in_(lookup_codes),
                        Application.id != application_id,
                    )
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

            _ = application_in.admin_comment

            await db.flush()
            await db.refresh(application)
            return application
    except HTTPException:
        raise
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Application conflict detected, please retry",
        ) from exc
    except Exception as exc:
        if is_database_unavailable_exception(exc):
            raise_database_unavailable_http_exception()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update application",
        ) from exc
