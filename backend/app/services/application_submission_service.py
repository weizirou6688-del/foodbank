"""公众用户提交 application 的流程,包含每周限额和库存扣减。"""

from __future__ import annotations

import uuid
from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database_errors import run_guarded_transaction
from app.core.db_utils import fetch_one_or_none, fetch_scalars, flush_refresh
from app.core.redemption_codes import new_redemption_code
from app.models.application import Application
from app.models.application_item import ApplicationItem
from app.models.food_bank import FoodBank
from app.models.food_package import FoodPackage
from app.models.inventory_item import InventoryItem
from app.models.package_item import PackageItem
from app.routers._shared import require_one_or_404
from app.schemas.application import ApplicationCreate
from app.services.dashboard_distribution_snapshot_service import (
    record_application_distribution_snapshots,
)
from app.services.inventory_service import consume_inventory_lots


WEEKLY_PACKAGE_LIMIT = 3
WEEKLY_INDIVIDUAL_ITEM_LIMIT = 5
MAX_SINGLE_INDIVIDUAL_ITEM_QUANTITY = 5


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


def requested_quantities(
    application_in: ApplicationCreate,
) -> tuple[int, dict[int, int], dict[int, int]]:
    requested_inventory_quantities: dict[int, int] = {}
    requested_package_quantities: dict[int, int] = {}

    # 一个请求里可能同时有 package 和 direct item,所以这里先拆开,
    # 后面两条路径各自做校验。
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


def _validate_requested_items(
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


async def _validate_weekly_limits(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    week_start: date,
    package_quantity: int,
    requested_inventory_quantities: dict[int, int],
) -> None:
    # package 限的是每周数量总和,direct item 限的是种类数。
    # 一个政策、两个角度。
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


async def _load_requested_packages(
    db: AsyncSession,
    *,
    food_bank_id: int,
    requested_package_quantities: dict[int, int],
) -> dict[int, FoodPackage]:
    if not requested_package_quantities:
        return {}

    package_ids = list(requested_package_quantities)
    packages = {
        package.id: package
        for package in await fetch_scalars(
            db,
            select(FoodPackage)
            .options(
                selectinload(FoodPackage.package_items).selectinload(
                    PackageItem.inventory_item
                )
            )
            .where(FoodPackage.id.in_(package_ids))
            # 锁住选中的 package,避免两笔并发提交同时扣同一份库存。
            .with_for_update(),
        )
    }

    missing_package_ids = [
        package_id for package_id in package_ids if package_id not in packages
    ]
    if missing_package_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Package(s) not found: {missing_package_ids}",
        )

    if any(not package.is_active for package in packages.values()):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="One or more selected packages are inactive",
        )

    food_bank_ids = {package.food_bank_id for package in packages.values()}
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
    if food_bank_id != next(iter(food_bank_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provided food_bank_id does not match selected packages",
        )

    for package_id, requested_quantity in requested_package_quantities.items():
        package = packages[package_id]
        if package.stock < requested_quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock for package {package_id}",
            )
        if not package.package_items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Package {package_id} cannot be applied for because it has no "
                    "configured contents"
                ),
            )

    return packages


async def _load_requested_inventory_items(
    db: AsyncSession,
    *,
    food_bank_id: int,
    requested_inventory_quantities: dict[int, int],
) -> dict[int, InventoryItem]:
    if not requested_inventory_quantities:
        return {}

    inventory_item_ids = list(requested_inventory_quantities)
    inventory_items = {
        item.id: item
        for item in await fetch_scalars(
            db,
            select(InventoryItem)
            .where(InventoryItem.id.in_(inventory_item_ids))
            # direct item 会立即扣 lot,所以先把行锁住。
            .with_for_update(),
        )
    }

    missing_inventory_item_ids = [
        item_id for item_id in inventory_item_ids if item_id not in inventory_items
    ]
    if missing_inventory_item_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inventory item(s) not found: {missing_inventory_item_ids}",
        )

    if any(item.food_bank_id != food_bank_id for item in inventory_items.values()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provided food_bank_id does not match selected inventory items",
        )

    return inventory_items


async def _create_pending_application(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    food_bank_id: int,
    week_start: date,
    package_quantity: int,
) -> Application:
    application = Application(
        user_id=user_id,
        food_bank_id=food_bank_id,
        redemption_code=await generate_unique_redemption_code(db),
        status="pending",
        week_start=week_start,
        total_quantity=package_quantity,
        redeemed_at=None,
    )
    db.add(application)
    await db.flush()
    return application


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

    _validate_requested_items(
        package_quantity=package_quantity,
        requested_inventory_quantities=requested_inventory_quantities,
    )

    async def action() -> Application:
        # 建 application、扣 package 库存、消耗 inventory lot、写 distribution snapshot,
        # 全放在一个 transaction 里,这样报表看到的是一致的承诺记录。
        await require_one_or_404(
            db,
            select(FoodBank.id).where(FoodBank.id == application_in.food_bank_id),
            detail="Food bank not found",
        )
        await _validate_weekly_limits(
            db,
            user_id=user_id,
            week_start=week_start,
            package_quantity=package_quantity,
            requested_inventory_quantities=requested_inventory_quantities,
        )

        packages = await _load_requested_packages(
            db,
            food_bank_id=application_in.food_bank_id,
            requested_package_quantities=requested_package_quantities,
        )
        inventory_items = await _load_requested_inventory_items(
            db,
            food_bank_id=application_in.food_bank_id,
            requested_inventory_quantities=requested_inventory_quantities,
        )

        application = await _create_pending_application(
            db,
            user_id=user_id,
            food_bank_id=application_in.food_bank_id,
            week_start=week_start,
            package_quantity=package_quantity,
        )

        for package_id, requested_quantity in requested_package_quantities.items():
            package = packages[package_id]
            package.stock -= requested_quantity
            package.applied_count += requested_quantity
            db.add(
                ApplicationItem(
                    application_id=application.id,
                    package_id=package_id,
                    quantity=requested_quantity,
                )
            )

        for inventory_item_id, requested_quantity in requested_inventory_quantities.items():
            try:
                await consume_inventory_lots(inventory_item_id, requested_quantity, db)
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Insufficient stock for inventory item {inventory_item_id}: {exc}",
                ) from exc

            db.add(
                ApplicationItem(
                    application_id=application.id,
                    inventory_item_id=inventory_item_id,
                    quantity=requested_quantity,
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
