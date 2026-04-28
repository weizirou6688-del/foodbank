"""Donation 路由:在 cash 和 goods 两套独立的 service 之上对外暴露统一的 API。"""

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.db_utils import fetch_scalars
from app.core.security import (
    get_admin_food_bank_id,
    get_optional_current_user,
    require_admin,
    require_platform_admin,
    require_supermarket,
)
from app.models.donation_cash import DonationCash
from app.models.donation_goods import DonationGoods
from app.routers._shared import bank_scoped_clause
from app.schemas.donation_cash import DonationCashCreate, DonationCashOut
from app.schemas.donation_goods import (
    DonationGoodsCreate,
    DonationGoodsOut,
    DonationGoodsUpdate,
    SupermarketDonationCreate,
)
from app.services.donation_service_cash import (
    delete_cash_donation as _delete_cash_donation,
    submit_cash_donation as _submit_cash_donation,
)
from app.services.donation_service_goods import (
    delete_goods_donation as _delete_goods_donation,
    submit_goods_donation as _submit_goods_donation,
    submit_supermarket_goods_donation as _submit_supermarket_goods_donation,
    update_goods_donation as _update_goods_donation,
)


router = APIRouter(tags=["Donations"])

GOODS_DONATION_OPTIONS = (selectinload(DonationGoods.items),)


async def _list_scoped_donations(
    donation_type: str | None,
    admin_user: dict,
    db: AsyncSession,
) -> list[dict]:
    normalized = donation_type.lower() if donation_type else None
    if normalized not in (None, "cash", "goods"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="type must be one of: cash, goods",
        )

    platform_admin = get_admin_food_bank_id(admin_user) is None
    response: list[dict] = []
    # admin 看的是 cash + goods 合并的时间线
    query_specs = [
        (
            "cash",
            normalized in (None, "cash"),
            select(DonationCash)
            .where(bank_scoped_clause(DonationCash, admin_user))
            .order_by(DonationCash.created_at.desc()),
            DonationCashOut,
        ),
        (
            "goods",
            normalized in (None, "goods"),
            select(DonationGoods)
            .options(*GOODS_DONATION_OPTIONS)
            .where(bank_scoped_clause(DonationGoods, admin_user))
            .order_by(DonationGoods.created_at.desc()),
            DonationGoodsOut,
        ),
    ]
    for current_type, enabled, query, schema in query_specs:
        if not enabled:
            continue
        rows = await fetch_scalars(db, query)
        if platform_admin:
            rows = [row for row in rows if getattr(row, "food_bank_id", None) is not None]
        response.extend(
            {
                **schema.model_validate(row).model_dump(mode="json"),
                "donation_type": current_type,
            }
            for row in rows
        )

    response.sort(key=lambda donation: donation.get("created_at", ""), reverse=True)
    return response


@router.post("/cash", response_model=DonationCashOut, status_code=status.HTTP_201_CREATED)
async def submit_cash_donation(
    donation_in: DonationCashCreate,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
):
    return await _submit_cash_donation(
        donation_in=donation_in,
        background_tasks=background_tasks,
        db=db,
    )


@router.post("/goods", response_model=DonationGoodsOut, status_code=status.HTTP_201_CREATED)
async def submit_goods_donation(
    donation_in: DonationGoodsCreate,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: dict | None = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _submit_goods_donation(
        donation_in=donation_in, background_tasks=background_tasks, current_user=current_user, db=db,
    )


@router.post("/goods/supermarket", response_model=DonationGoodsOut, status_code=status.HTTP_201_CREATED)
async def submit_supermarket_goods_donation(
    donation_in: SupermarketDonationCreate,
    current_user: dict = Depends(require_supermarket),
    db: AsyncSession = Depends(get_db),
):
    return await _submit_supermarket_goods_donation(
        donation_in=donation_in,
        current_user=current_user,
        db=db,
    )


@router.delete("/cash/{donation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cash_donation(
    donation_id: uuid.UUID,
    _admin_user: dict = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    return await _delete_cash_donation(donation_id=donation_id, db=db)


@router.patch("/goods/{donation_id}", response_model=DonationGoodsOut)
async def update_goods_donation(
    donation_id: uuid.UUID,
    donation_in: DonationGoodsUpdate,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await _update_goods_donation(
        donation_id=donation_id, donation_in=donation_in, admin_user=admin_user, db=db,
    )


@router.delete("/goods/{donation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goods_donation(
    donation_id: uuid.UUID,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await _delete_goods_donation(
        donation_id=donation_id,
        admin_user=admin_user,
        db=db,
    )


@router.get("", response_model=list[dict])
async def list_donations(
    type: str | None = None,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await _list_scoped_donations(type, admin_user, db)
