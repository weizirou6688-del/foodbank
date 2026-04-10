"""
Food Package management routes.

Spec § 2.3: GET (for food bank), GET/:id, POST, PATCH, DELETE
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.database_errors import (
    is_database_unavailable_exception,
    raise_database_unavailable_http_exception,
)
from app.core.security import (
    enforce_admin_food_bank_scope,
    get_admin_food_bank_id,
    require_admin,
)
from app.models.food_bank import FoodBank
from app.models.food_package import FoodPackage
from app.models.inventory_item import InventoryItem
from app.models.application_item import ApplicationItem
from app.models.package_item import PackageItem
from app.schemas.food_package import (
    FoodPackageCreateRequest,
    FoodPackageCreateResponse,
    FoodPackageDetailOut,
    FoodPackageOut,
    PackageContentOut,
    FoodPackageUpdate,
    PackRequest,
    PackResponse,
)
from app.services.pack_service import pack_package_transaction


router = APIRouter(tags=["Food Packages"])


async def _resolve_package_food_bank_id(
    requested_food_bank_id: int | None,
    admin_user: dict,
    db: AsyncSession,
) -> int:
    admin_food_bank_id = get_admin_food_bank_id(admin_user)
    if admin_food_bank_id is not None:
        if requested_food_bank_id is not None:
            enforce_admin_food_bank_scope(
                admin_user,
                requested_food_bank_id,
                detail="You can only manage packages for your assigned food bank",
            )
        target_food_bank_id = admin_food_bank_id
    else:
        if requested_food_bank_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="food_bank_id is required for package creation",
            )
        target_food_bank_id = requested_food_bank_id

    food_bank_exists = await db.scalar(
        select(FoodBank.id).where(FoodBank.id == target_food_bank_id)
    )
    if food_bank_exists is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Food bank not found",
        )

    return target_food_bank_id


async def _get_package_for_admin(
    package_id: int,
    admin_user: dict,
    db: AsyncSession,
    *,
    load_items: bool = False,
) -> FoodPackage:
    query = select(FoodPackage).where(FoodPackage.id == package_id)
    if load_items:
        query = query.options(selectinload(FoodPackage.package_items))

    result = await db.execute(query)
    package = result.scalar_one_or_none()
    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found",
        )

    enforce_admin_food_bank_scope(
        admin_user,
        package.food_bank_id,
        detail="You can only manage packages for your assigned food bank",
    )
    return package


async def _validate_package_contents(
    item_ids: list[int],
    target_food_bank_id: int,
    admin_user: dict,
    db: AsyncSession,
) -> None:
    inventory_rows = (
        await db.execute(
            select(InventoryItem).where(InventoryItem.id.in_(item_ids))
        )
    ).scalars().all()

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
            if isinstance(row, InventoryItem)
            and row.food_bank_id != admin_food_bank_id
        ]
        if inaccessible_items:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="One or more inventory items are outside your food bank scope",
            )

    mismatched_items = [
        row.id
        for row in inventory_rows
        if isinstance(row, InventoryItem)
        and row.food_bank_id != target_food_bank_id
    ]
    if mismatched_items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more inventory items are outside the selected food bank scope",
        )


@router.get("/packages", response_model=List[FoodPackageDetailOut])
async def list_admin_packages(
    food_bank_id: int | None = Query(None, gt=0),
    category: str | None = Query(None, min_length=1, max_length=100),
    search: str | None = Query(None, min_length=1, max_length=200),
    include_inactive: bool = Query(False),
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List admin-visible packages with optional DB-backed scope and search filters."""
    normalized_food_bank_id = food_bank_id if isinstance(food_bank_id, int) else None
    normalized_category = category.strip() if isinstance(category, str) and category.strip() else None
    normalized_search = search.strip() if isinstance(search, str) and search.strip() else ""
    normalized_include_inactive = include_inactive if isinstance(include_inactive, bool) else False

    admin_food_bank_id = get_admin_food_bank_id(admin_user)
    query = (
        select(FoodPackage)
        .options(
            selectinload(FoodPackage.package_items).selectinload(PackageItem.inventory_item)
        )
        .order_by(FoodPackage.id.asc())
    )

    if normalized_food_bank_id is not None:
        if admin_food_bank_id is not None:
            enforce_admin_food_bank_scope(
                admin_user,
                normalized_food_bank_id,
                detail="You can only view packages for your assigned food bank",
            )
        query = query.where(FoodPackage.food_bank_id == normalized_food_bank_id)
    elif admin_food_bank_id is not None:
        query = query.where(FoodPackage.food_bank_id == admin_food_bank_id)
    else:
        query = query.where(FoodPackage.food_bank_id.is_not(None))

    if not normalized_include_inactive:
        query = query.where(FoodPackage.is_active.is_(True))

    if normalized_category is not None:
        query = query.where(FoodPackage.category == normalized_category)

    if normalized_search:
        search_pattern = f"%{normalized_search}%"
        query = (
            query
            .outerjoin(PackageItem, PackageItem.package_id == FoodPackage.id)
            .outerjoin(InventoryItem, InventoryItem.id == PackageItem.inventory_item_id)
            .where(
                or_(
                    FoodPackage.name.ilike(search_pattern),
                    FoodPackage.category.ilike(search_pattern),
                    FoodPackage.description.ilike(search_pattern),
                    InventoryItem.name.ilike(search_pattern),
                )
            )
            .distinct()
        )

    result = await db.execute(query)
    return result.scalars().unique().all()


@router.get("/food-banks/{food_bank_id}/packages", response_model=List[FoodPackageOut])
async def list_packages_for_bank(
    food_bank_id: int,
    db: AsyncSession = Depends(get_db),
):
    """List available packages for a specific food bank."""
    result = await db.execute(
        select(FoodPackage)
        .where(
            FoodPackage.food_bank_id == food_bank_id,
            FoodPackage.is_active.is_(True),
        )
        .order_by(FoodPackage.id)
    )
    packages = result.scalars().all()
    return packages


@router.get("/packages/{package_id}", response_model=FoodPackageDetailOut)
async def get_package_details(
    package_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get package details including package composition items."""
    result = await db.execute(
        select(FoodPackage)
        .options(
            selectinload(FoodPackage.package_items).selectinload(PackageItem.inventory_item)
        )
        .where(
            FoodPackage.id == package_id,
            FoodPackage.is_active.is_(True),
        )
    )
    package = result.scalar_one_or_none()
    
    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found",
        )
    
    return package


@router.post("/packages", response_model=FoodPackageCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_package(
    package_in: FoodPackageCreateRequest,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a food package with package contents in one transaction (admin only)."""
    item_ids = [content.item_id for content in package_in.contents]
    if len(set(item_ids)) != len(item_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate item_id in package contents",
        )

    try:
        target_food_bank_id = await _resolve_package_food_bank_id(
            package_in.food_bank_id,
            admin_user,
            db,
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
        db.add(package)
        await db.flush()

        for content in package_in.contents:
            db.add(
                PackageItem(
                    package_id=package.id,
                    inventory_item_id=content.item_id,
                    quantity=content.quantity,
                )
            )

        await db.commit()
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
    except HTTPException:
        await db.rollback()
        raise
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Package conflict detected",
        ) from exc
    except Exception as exc:
        await db.rollback()
        if is_database_unavailable_exception(exc):
            raise_database_unavailable_http_exception()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create package",
        ) from exc


@router.patch("/packages/{package_id}", response_model=FoodPackageOut)
async def update_package(
    package_id: int,
    package_in: FoodPackageUpdate,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update a food package (admin only)."""
    package = await _get_package_for_admin(
        package_id,
        admin_user,
        db,
        load_items=True,
    )

    update_data = package_in.model_dump(exclude_unset=True, exclude={"contents"})
    contents_payload = package_in.contents if "contents" in package_in.model_fields_set else None

    if "food_bank_id" in package_in.model_fields_set:
        if package_in.food_bank_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="food_bank_id cannot be cleared from a package",
            )
        update_data["food_bank_id"] = await _resolve_package_food_bank_id(
            package_in.food_bank_id,
            admin_user,
            db,
        )
    target_food_bank_id = int(update_data.get("food_bank_id", package.food_bank_id))

    for key, value in update_data.items():
        if value is not None:
            setattr(package, key, value)

    if contents_payload is not None:
        item_ids = [content.item_id for content in contents_payload]
        if len(set(item_ids)) != len(item_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Duplicate item_id in package contents",
            )

        await _validate_package_contents(
            item_ids,
            target_food_bank_id,
            admin_user,
            db,
        )

        existing_items = (
            await db.execute(
                select(PackageItem).where(PackageItem.package_id == package_id)
            )
        ).scalars().all()
        for existing_item in existing_items:
            await db.delete(existing_item)

        await db.flush()

        for content in contents_payload:
            db.add(
                PackageItem(
                    package_id=package.id,
                    inventory_item_id=content.item_id,
                    quantity=content.quantity,
                )
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
    """Delete a package when safe, otherwise soft-delete it for history retention."""
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


@router.post("/packages/{package_id}/pack", response_model=PackResponse, status_code=status.HTTP_200_OK)
async def pack_package(
    package_id: int,
    pack_in: PackRequest,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Pack food packages by deducting ingredients from inventory lots (admin only).
    
    Spec § 2.3: POST /packages/:id/pack (admin only, atomic operation)
    
    This endpoint converts inventory lot items into pre-assembled food packages
    following the FEFO (First Expiry First Out) principle. Admin provides the
    number of packages to pack, and the service automatically deducts required
    ingredients from inventory lots and increases package stock.
    
    Transaction flow:
    1. Fetch package and verify it's active
    2. For each ingredient in package recipe:
       - Calculate required quantity (recipe_qty × packages_to_pack)
       - Get inventory lots sorted by expiry_date (FEFO)
       - Verify sufficient inventory
       - Deduct from lots in order, soft-delete empty lots
    3. Increase package stock
    4. Return updated package
    
    If any ingredient lacks sufficient inventory, entire transaction
    is rolled back and a 400 error is returned.
    
    Args:
        package_id: ID of the package to pack
        pack_in: PackRequest with quantity (number of packages to pack)
        admin_user: Current authenticated admin user
        db: Database session
        
    Returns:
        PackResponse with updated package details and consumed lots
        
    Raises:
        404: Package not found
        400: Insufficient inventory for an ingredient
    """
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
            inaccessible_items = [
                item.id
                for item in inventory_items
                if item.food_bank_id != admin_food_bank_id
            ]
            if inaccessible_items:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="One or more inventory items are outside your food bank scope",
                )

        result = await pack_package_transaction(package_id, pack_in.quantity, db)
        return PackResponse(**result)
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except Exception as exc:
        if is_database_unavailable_exception(exc):
            raise_database_unavailable_http_exception()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )
