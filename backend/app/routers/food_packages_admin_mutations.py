"""Admin 端 package 写操作路由,包括 recipe 更新和从 lot 打包。"""

from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.database_errors import (
    raise_operation_failure_http_exception,
    run_guarded_action,
)
from app.core.db_utils import (
    fetch_one_or_none,
    fetch_scalars,
    sync_keyed_quantity_children,
    sync_model_fields,
)
from app.core.security import get_admin_food_bank_id, require_admin
from app.models.application_item import ApplicationItem
from app.models.food_package import FoodPackage
from app.models.inventory_item import InventoryItem
from app.models.inventory_lot import InventoryLot
from app.models.package_item import PackageItem
from app.routers._shared import require_scoped_by_id, resolve_admin_target_food_bank_id
from app.schemas.food_package import (
    FoodPackageCreateRequest,
    FoodPackageCreateResponse,
    FoodPackageOut,
    FoodPackageUpdate,
    PackRequest,
    PackResponse,
    PackageContentOut,
)


router = APIRouter()


def _ensure_unique_content_items(item_ids: list[int]) -> None:
    if len(set(item_ids)) != len(item_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate item_id in package contents",
        )


async def _get_package_for_admin(
    package_id: int,
    admin_user: dict,
    db: AsyncSession,
    *,
    load_items: bool = False,
) -> FoodPackage:
    return await require_scoped_by_id(
        db,
        FoodPackage,
        package_id,
        admin_user,
        detail="You can only manage packages for your assigned food bank",
        not_found_detail="Package not found",
        options=(selectinload(FoodPackage.package_items),) if load_items else (),
    )


async def _validate_package_contents(
    item_ids: list[int],
    target_food_bank_id: int,
    admin_user: dict,
    db: AsyncSession,
) -> None:
    # package contents 必须和 package 本身在同一个 food-bank scope 里,
    # 不然一个 bank 可能会误吃掉另一个 bank 的库存
    inventory_rows = await fetch_scalars(
        db,
        select(InventoryItem).where(InventoryItem.id.in_(item_ids)),
    )
    inventory_ids = {
        row.id if isinstance(row, InventoryItem) else int(row)
        for row in inventory_rows
    }
    if len(inventory_ids) != len(item_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more inventory items do not exist",
        )

    admin_food_bank_id = get_admin_food_bank_id(admin_user)
    if admin_food_bank_id is not None:
        inaccessible_items = [
            row.id
            for row in inventory_rows
            if isinstance(row, InventoryItem) and row.food_bank_id != admin_food_bank_id
        ]
        if inaccessible_items:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="One or more inventory items are outside your food bank scope",
            )

    mismatched_items = [
        row.id
        for row in inventory_rows
        if isinstance(row, InventoryItem) and row.food_bank_id != target_food_bank_id
    ]
    if mismatched_items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more inventory items are outside the selected food bank scope",
        )


@router.post(
    "/packages",
    response_model=FoodPackageCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_package(
    package_in: FoodPackageCreateRequest,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    item_ids = [content.item_id for content in package_in.contents]
    _ensure_unique_content_items(item_ids)

    async def action() -> FoodPackageCreateResponse:
        target_food_bank_id = await resolve_admin_target_food_bank_id(
            db,
            package_in.food_bank_id,
            admin_user,
            scope_detail="You can only manage packages for your assigned food bank",
            required_detail="food_bank_id is required for package creation",
        )
        await _validate_package_contents(
            item_ids,
            target_food_bank_id,
            admin_user,
            db,
        )

        package = FoodPackage(
            name=package_in.name.strip(),
            category=package_in.category,
            description=package_in.description,
            stock=0,
            threshold=package_in.threshold,
            applied_count=0,
            image_url=package_in.image_url,
            food_bank_id=target_food_bank_id,
            is_active=True,
        )
        async with db.begin():
            db.add(package)
            await db.flush()
            db.add_all(
                [
                    PackageItem(
                        package_id=package.id,
                        inventory_item_id=content.item_id,
                        quantity=content.quantity,
                    )
                    for content in package_in.contents
                ]
            )
        await db.refresh(package)
        return FoodPackageCreateResponse(
            id=package.id,
            name=package.name,
            category=package.category,
            description=package.description,
            stock=package.stock,
            threshold=package.threshold,
            applied_count=package.applied_count,
            image_url=package.image_url,
            food_bank_id=package.food_bank_id,
            is_active=package.is_active,
            created_at=package.created_at,
            contents=[
                PackageContentOut(item_id=content.item_id, quantity=content.quantity)
                for content in package_in.contents
            ],
        )

    return await run_guarded_action(
        action,
        conflict_detail="Package conflict detected",
        failure_detail="Failed to create package",
    )


@router.patch("/packages/{package_id}", response_model=FoodPackageOut)
async def update_package(
    package_id: int,
    package_in: FoodPackageUpdate,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    package = await _get_package_for_admin(
        package_id,
        admin_user,
        db,
        load_items=True,
    )

    update_data = package_in.model_dump(exclude_unset=True, exclude={"contents"})
    contents_payload = (
        package_in.contents if "contents" in package_in.model_fields_set else None
    )

    if "food_bank_id" in package_in.model_fields_set:
        if package_in.food_bank_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="food_bank_id cannot be cleared from a package",
            )
        update_data["food_bank_id"] = await resolve_admin_target_food_bank_id(
            db,
            package_in.food_bank_id,
            admin_user,
            scope_detail="You can only manage packages for your assigned food bank",
            required_detail="food_bank_id is required for package creation",
        )
    target_food_bank_id = int(update_data.get("food_bank_id", package.food_bank_id))
    sync_model_fields(
        package,
        {key: value for key, value in update_data.items() if value is not None},
    )

    if contents_payload is not None:
        item_ids = [content.item_id for content in contents_payload]
        _ensure_unique_content_items(item_ids)

        await _validate_package_contents(
            item_ids,
            target_food_bank_id,
            admin_user,
            db,
        )

        existing_items = list(package.package_items) or await fetch_scalars(
            db,
            select(PackageItem).where(PackageItem.package_id == package_id),
        )
        await sync_keyed_quantity_children(
            db,
            existing_items=existing_items,
            desired_quantities={
                content.item_id: content.quantity for content in contents_payload
            },
            key_getter=lambda item: item.inventory_item_id,
            build_child=lambda item_id, quantity: PackageItem(
                package_id=package.id,
                inventory_item_id=item_id,
                quantity=quantity,
            ),
        )
    elif "food_bank_id" in package_in.model_fields_set and package.package_items:
        await _validate_package_contents(
            [item.inventory_item_id for item in package.package_items],
            target_food_bank_id,
            admin_user,
            db,
        )

    await db.flush()
    await db.refresh(package)

    return package


@router.delete("/packages/{package_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_package(
    package_id: int,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    package = await _get_package_for_admin(
        package_id,
        admin_user,
        db,
    )

    application_usage_count = await db.scalar(
        select(func.count(ApplicationItem.id)).where(ApplicationItem.package_id == package_id)
    )

    if int(application_usage_count or 0) > 0:
        package.is_active = False
    else:
        await db.delete(package)
    await db.flush()

    return None


@router.post(
    "/packages/{package_id}/pack",
    response_model=PackResponse,
    status_code=status.HTTP_200_OK,
)
async def pack_package(
    package_id: int,
    pack_in: PackRequest,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        await _get_package_for_admin(package_id, admin_user, db)
        admin_food_bank_id = get_admin_food_bank_id(admin_user)
        if admin_food_bank_id is not None:
            inventory_items = (
                await db.execute(
                    select(InventoryItem)
                    .join(PackageItem, PackageItem.inventory_item_id == InventoryItem.id)
                    .where(PackageItem.package_id == package_id)
                )
            ).scalars().all()
            if any(item.food_bank_id != admin_food_bank_id for item in inventory_items):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="One or more inventory items are outside your food bank scope",
                )

        try:
            async with db.begin():
                package = await fetch_one_or_none(
                    db,
                    select(FoodPackage).where(FoodPackage.id == package_id),
                )
                if package is None:
                    raise ValueError(f"Package {package_id} not found")

                recipe_items = await fetch_scalars(
                    db,
                    select(PackageItem).where(PackageItem.package_id == package_id),
                )
                if not recipe_items:
                    raise ValueError(f"Package {package_id} has no recipe items")

                consumed_lots: list[dict[str, object]] = []

                for recipe_item in recipe_items:
                    item_id = recipe_item.inventory_item_id
                    total_required = recipe_item.quantity * pack_in.quantity
                    lots = await fetch_scalars(
                        db,
                        select(InventoryLot)
                        .where(
                            InventoryLot.inventory_item_id == item_id,
                            InventoryLot.deleted_at.is_(None),
                            InventoryLot.expiry_date >= date.today(),
                        )
                        # 优先打最先过期的 lot,packaged stock 走和直接发货相同的 FEFO 逻辑
                        .order_by(InventoryLot.expiry_date),
                    )
                    if not lots:
                        raise ValueError(
                            f"No available inventory for item {item_id} (required: {total_required})"
                        )

                    remaining_needed = total_required
                    for lot in lots:
                        if remaining_needed <= 0:
                            break

                        quantity_used = min(lot.quantity, remaining_needed)
                        remaining_in_lot = lot.quantity - quantity_used
                        remaining_needed -= quantity_used

                        consumed_lots.append(
                            {
                                "item_id": item_id,
                                "lot_id": lot.id,
                                "quantity_used": quantity_used,
                                "remaining_in_lot": remaining_in_lot,
                                "expiry_date": str(lot.expiry_date),
                                "batch_reference": lot.batch_reference,
                            }
                        )

                        if remaining_in_lot == 0:
                            lot.deleted_at = datetime.now(timezone.utc)
                        else:
                            lot.quantity = remaining_in_lot

                    if remaining_needed > 0:
                        raise ValueError(
                            f"Insufficient inventory for item {item_id}. "
                            f"Need: {total_required}, Available: {total_required - remaining_needed}"
                        )

                package.stock += pack_in.quantity
            await db.refresh(package)
        except ValueError:
            raise
        except IntegrityError as exc:
            raise ValueError("Database integrity error during packing") from exc
        except Exception as exc:
            raise ValueError(f"Unexpected error during packing: {str(exc)}") from exc

        return PackResponse(
            package_id=package.id,
            package_name=package.name,
            quantity=pack_in.quantity,
            new_stock=package.stock,
            consumed_lots=consumed_lots,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise_operation_failure_http_exception(exc, str(exc))
