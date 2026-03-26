"""
Food Package management routes.

Spec § 2.3: GET (for food bank), GET/:id, POST, PATCH, DELETE
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_admin
from app.models.food_package import FoodPackage
from app.models.inventory_item import InventoryItem
from app.models.package_item import PackageItem
from app.schemas.food_package import (
    FoodPackageCreateRequest,
    FoodPackageCreateResponse,
    FoodPackageDetailOut,
    FoodPackageOut,
    PackageContentOut,
    FoodPackageUpdate,
)


router = APIRouter(tags=["Food Packages"])


@router.get("/food-banks/{food_bank_id}/packages", response_model=List[FoodPackageOut])
async def list_packages_for_bank(
    food_bank_id: int,
    db: AsyncSession = Depends(get_db),
):
    """List available packages for a specific food bank."""
    result = await db.execute(
        select(FoodPackage).where(FoodPackage.food_bank_id == food_bank_id)
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
        select(FoodPackage).where(FoodPackage.id == package_id)
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
    _ = admin_user

    item_ids = [content.item_id for content in package_in.contents]
    if len(set(item_ids)) != len(item_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate item_id in package contents",
        )

    try:
        inventory_rows = (
            await db.execute(
                select(InventoryItem.id).where(InventoryItem.id.in_(item_ids))
            )
        ).scalars().all()
        if len(inventory_rows) != len(item_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more inventory items do not exist",
            )

        package = FoodPackage(
            name=package_in.name.strip(),
            category=package_in.category,
            description=package_in.description,
            stock=0,
            threshold=package_in.threshold,
            applied_count=0,
            image_url=package_in.image_url,
            food_bank_id=package_in.food_bank_id,
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
    _ = admin_user
    
    result = await db.execute(
        select(FoodPackage).where(FoodPackage.id == package_id)
    )
    package = result.scalar_one_or_none()
    
    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found",
        )
    
    # Update non-null fields only
    update_data = package_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if value is not None:
            setattr(package, key, value)
    
    await db.flush()
    await db.refresh(package)
    
    return package


@router.delete("/packages/{package_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_package(
    package_id: int,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete/soft-delete a food package (admin only)."""
    _ = admin_user
    
    result = await db.execute(
        select(FoodPackage).where(FoodPackage.id == package_id)
    )
    package = result.scalar_one_or_none()
    
    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found",
        )
    
    # Soft delete: mark as inactive
    package.is_active = False
    await db.flush()
    
    return None
