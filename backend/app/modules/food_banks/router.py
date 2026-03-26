"""
Food Bank location management routes.

Spec § 2.2: GET /food-banks, GET /food-banks/:id, POST, PATCH, DELETE
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_admin
from app.models.food_bank import FoodBank
from app.modules.food_banks.schema import FoodBankCreate, FoodBankOut, FoodBankUpdate, FoodBankDetailOut


router = APIRouter(tags=["Food Banks"])


@router.get("", response_model=List[FoodBankOut])
async def list_food_banks(
    postcode: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    List all food banks.
    
    Spec § 2.2: GET /food-banks (no auth).
    Supports ?postcode= for proximity filtering (within 2km).
    
    Note: proximity filtering not implemented in basic version.
    """
    result = await db.execute(select(FoodBank))
    banks = result.scalars().all()
    return banks


@router.get("/{food_bank_id}", response_model=FoodBankDetailOut)
async def get_food_bank(
    food_bank_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Get single food bank with operating hours.
    
    Spec § 2.2: GET /food-banks/:id (no auth).
    """
    result = await db.execute(select(FoodBank).where(FoodBank.id == food_bank_id))
    bank = result.scalar_one_or_none()
    
    if not bank:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Food bank not found",
        )
    
    return bank


@router.post("", response_model=FoodBankOut, status_code=status.HTTP_201_CREATED)
async def create_food_bank(
    bank_in: FoodBankCreate,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Create new food bank location (admin only).
    
    Spec § 2.2: POST /food-banks (requires admin role).
    """
    _ = admin_user
    
    bank = FoodBank(
        name=bank_in.name,
        address=bank_in.address,
        lat=bank_in.lat,
        lng=bank_in.lng,
    )
    
    db.add(bank)
    await db.flush()
    await db.refresh(bank)
    
    return bank


@router.patch("/{food_bank_id}", response_model=FoodBankOut)
async def update_food_bank(
    food_bank_id: int,
    bank_in: FoodBankUpdate,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Update food bank details (admin only).
    
    Spec § 2.2: PATCH /food-banks/:id (requires admin).
    """
    _ = admin_user
    
    result = await db.execute(select(FoodBank).where(FoodBank.id == food_bank_id))
    bank = result.scalar_one_or_none()
    
    if not bank:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Food bank not found",
        )
    
    # Update non-null fields only
    update_data = bank_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if value is not None:
            setattr(bank, key, value)
    
    await db.flush()
    await db.refresh(bank)
    
    return bank


@router.delete("/{food_bank_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_food_bank(
    food_bank_id: int,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Delete food bank (admin only).
    
    Spec § 2.2: DELETE /food-banks/:id (requires admin).
    
    Note: Cascading delete removes related hours/packages.
    """
    _ = admin_user
    
    result = await db.execute(select(FoodBank).where(FoodBank.id == food_bank_id))
    bank = result.scalar_one_or_none()
    
    if not bank:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Food bank not found",
        )
    
    await db.delete(bank)
    return None
