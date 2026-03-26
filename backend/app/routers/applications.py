"""
Application submission and management routes.

Spec § 2.4: POST (submit), GET /my (user's), PATCH/:id (admin status update)
"""

import secrets
import string
import uuid
from datetime import date, datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.models.application import Application
from app.models.application_item import ApplicationItem
from app.models.food_package import FoodPackage
from app.schemas.application import ApplicationCreate, ApplicationOut, ApplicationUpdate


router = APIRouter(tags=["Applications"])


def _new_redemption_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "FB-" + "".join(secrets.choice(alphabet) for _ in range(6))


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

    total_quantity = sum(item.quantity for item in application_in.items)
    if total_quantity <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Application must include at least one package quantity",
        )

    requested_by_package: dict[int, int] = {}
    for item in application_in.items:
        requested_by_package[item.package_id] = (
            requested_by_package.get(item.package_id, 0) + item.quantity
        )

    try:
        async with db.begin():
            existing_week_total = await db.scalar(
                select(func.coalesce(func.sum(Application.total_quantity), 0)).where(
                    Application.user_id == user_id,
                    Application.week_start == week_start,
                )
            )
            existing_week_total = int(existing_week_total or 0)

            if existing_week_total + total_quantity > 3:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Weekly limit exceeded",
                )

            package_ids = list(requested_by_package.keys())
            packages_result = await db.execute(
                select(FoodPackage)
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
            food_bank_id = next(iter(food_bank_ids))

            if application_in.food_bank_id != food_bank_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Provided food_bank_id does not match selected packages",
                )

            for package_id, requested_qty in requested_by_package.items():
                package = packages[package_id]

                if package.stock < requested_qty:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Insufficient stock for package {package_id}",
                    )

            redemption_code = await _generate_unique_redemption_code(db)

            application = Application(
                user_id=user_id,
                food_bank_id=food_bank_id,
                redemption_code=redemption_code,
                status="pending",
                week_start=week_start,
                total_quantity=total_quantity,
            )
            db.add(application)
            await db.flush()

            for package_id, requested_qty in requested_by_package.items():
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit application",
        ) from exc


@router.get("/my", response_model=List[ApplicationOut])
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
    return list(result.scalars().all())


@router.get("", response_model=List[ApplicationOut])
async def list_all_applications(
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    List all applications (admin only).

    Spec § 2.4: Admin application listing endpoint.
    """
    _ = admin_user
    result = await db.execute(select(Application))
    applications = result.scalars().all()
    return applications


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
    - status: Status enum (pending, approved, rejected, cancelled)
    - admin_comment: Optional string
    
    TODO: Admin-only endpoint to update status and comments
    """
    _ = admin_user

    if application_in.status is None and application_in.redemption_code is None:
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

            if application_in.redemption_code is not None:
                code_owner = await db.scalar(
                    select(Application.id).where(
                        Application.redemption_code == application_in.redemption_code,
                        Application.id != application_id,
                    )
                )
                if code_owner is not None:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Redemption code already in use",
                    )
                application.redemption_code = application_in.redemption_code

            if application_in.status is not None:
                application.status = application_in.status

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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update application",
        ) from exc
