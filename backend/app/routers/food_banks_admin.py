from __future__ import annotations

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.db_utils import flush_refresh, sync_model_fields
from app.core.security import require_admin
from app.models.food_bank import FoodBank
from app.routers.food_banks_shared import get_food_bank_or_404
from app.schemas.food_bank import FoodBankCreate, FoodBankUpdate


async def create_food_bank(
    bank_in: FoodBankCreate,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    bank = FoodBank(
        name=bank_in.name,
        address=bank_in.address,
        notification_email=bank_in.notification_email,
        lat=bank_in.lat,
        lng=bank_in.lng,
    )
    db.add(bank)
    return await flush_refresh(db, bank)


async def update_food_bank(
    food_bank_id: int,
    bank_in: FoodBankUpdate,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    bank = await get_food_bank_or_404(db, food_bank_id)
    sync_model_fields(
        bank,
        {
            key: value
            for key, value in bank_in.model_dump(exclude_unset=True).items()
            if value is not None
        },
    )
    return await flush_refresh(db, bank)


async def delete_food_bank(
    food_bank_id: int,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    bank = await get_food_bank_or_404(db, food_bank_id)
    await db.delete(bank)
    return None
