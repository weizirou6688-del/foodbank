import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_optional_current_user, require_admin, require_platform_admin, require_supermarket
from app.schemas.donation_cash import DonationCashCreate, DonationCashOut
from app.schemas.donation_goods import DonationGoodsCreate, DonationGoodsOut, DonationGoodsUpdate, SupermarketDonationCreate
from app.services import donation_service


router = APIRouter(tags=["Donations"])


@router.post("/cash", response_model=DonationCashOut, status_code=status.HTTP_201_CREATED)
async def submit_cash_donation(
    donation_in: DonationCashCreate,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
):
    return await donation_service.submit_cash_donation(donation_in=donation_in, background_tasks=background_tasks, db=db)


@router.post("/goods", response_model=DonationGoodsOut, status_code=status.HTTP_201_CREATED)
async def submit_goods_donation(
    donation_in: DonationGoodsCreate,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: dict | None = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await donation_service.submit_goods_donation(
        donation_in=donation_in, background_tasks=background_tasks, current_user=current_user, db=db,
    )


@router.post("/goods/supermarket", response_model=DonationGoodsOut, status_code=status.HTTP_201_CREATED)
async def submit_supermarket_goods_donation(
    donation_in: SupermarketDonationCreate,
    current_user: dict = Depends(require_supermarket),
    db: AsyncSession = Depends(get_db),
):
    return await donation_service.submit_supermarket_goods_donation(donation_in=donation_in, current_user=current_user, db=db)


@router.delete("/cash/{donation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cash_donation(
    donation_id: uuid.UUID,
    _admin_user: dict = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    return await donation_service.delete_cash_donation(donation_id=donation_id, db=db)


@router.patch("/goods/{donation_id}", response_model=DonationGoodsOut)
async def update_goods_donation(
    donation_id: uuid.UUID,
    donation_in: DonationGoodsUpdate,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await donation_service.update_goods_donation(
        donation_id=donation_id, donation_in=donation_in, admin_user=admin_user, db=db,
    )


@router.delete("/goods/{donation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goods_donation(
    donation_id: uuid.UUID,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await donation_service.delete_goods_donation(donation_id=donation_id, admin_user=admin_user, db=db)


@router.get("", response_model=list[dict])
async def list_donations(
    type: str | None = None,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await donation_service.list_donations(type=type, admin_user=admin_user, db=db)
