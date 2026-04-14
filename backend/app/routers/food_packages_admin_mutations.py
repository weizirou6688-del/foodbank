from __future__ import annotations

from fastapi import Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.database_errors import (
    raise_operation_failure_http_exception,
    run_guarded_action,
)
from app.core.db_utils import (
    fetch_scalars,
    sync_keyed_quantity_children,
    sync_model_fields,
)
from app.core.security import require_admin
from app.models.application_item import ApplicationItem
from app.models.food_package import FoodPackage
from app.models.package_item import PackageItem
from app.routers._shared import resolve_admin_target_food_bank_id
from app.routers.food_packages_shared import (
    ensure_unique_content_items,
    get_package_for_admin,
    validate_package_contents,
    validate_package_inventory_scope,
)
from app.schemas.food_package import (
    FoodPackageCreateRequest,
    FoodPackageCreateResponse,
    FoodPackageUpdate,
    PackRequest,
    PackResponse,
    PackageContentOut,
)
from app.services.pack_service import pack_package_transaction


async def create_package(
    package_in: FoodPackageCreateRequest,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    item_ids = [content.item_id for content in package_in.contents]
    ensure_unique_content_items(item_ids)

    async def _action() -> FoodPackageCreateResponse:
        target_food_bank_id = await resolve_admin_target_food_bank_id(
            db,
            package_in.food_bank_id,
            admin_user,
            scope_detail="You can only manage packages for your assigned food bank",
            required_detail="food_bank_id is required for package creation",
        )
        await validate_package_contents(
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
        _action,
        conflict_detail="Package conflict detected",
        failure_detail="Failed to create package",
    )


async def update_package(
    package_id: int,
    package_in: FoodPackageUpdate,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    package = await get_package_for_admin(
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
        ensure_unique_content_items(item_ids)

        await validate_package_contents(
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
        await validate_package_contents(
            [item.inventory_item_id for item in package.package_items],
            target_food_bank_id,
            admin_user,
            db,
        )

    await db.flush()
    await db.refresh(package)

    return package


async def delete_package(
    package_id: int,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    package = await get_package_for_admin(
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


async def pack_package(
    package_id: int,
    pack_in: PackRequest,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        await get_package_for_admin(package_id, admin_user, db)
        await validate_package_inventory_scope(package_id, admin_user, db)

        result = await pack_package_transaction(package_id, pack_in.quantity, db)
        return PackResponse(**result)
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise_operation_failure_http_exception(exc, str(exc))
