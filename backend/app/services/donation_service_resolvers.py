from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import enforce_admin_food_bank_scope, get_admin_food_bank_id
from app.core.db_utils import fetch_scalars
from app.models.donation_cash import DonationCash
from app.models.donation_goods import DonationGoods
from app.models.food_bank import FoodBank
from app.routers._shared import require_by_id, require_scoped_by_id
from app.schemas.donation_goods import DonationGoodsCreate


GOODS_DONATION_OPTIONS = (selectinload(DonationGoods.items),)


def normalize_food_bank_match_text(value: str | None) -> str:
    return " ".join((value or "").strip().lower().split())


async def resolve_food_bank_from_metadata(
    *,
    food_bank_name: str | None,
    food_bank_address: str | None,
    db: AsyncSession,
) -> FoodBank | None:
    normalized_name = normalize_food_bank_match_text(food_bank_name)
    normalized_address = normalize_food_bank_match_text(food_bank_address)

    if not normalized_name and not normalized_address:
        return None

    banks = await fetch_scalars(db, select(FoodBank))
    best_match: FoodBank | None = None
    best_score = 0

    for bank in banks:
        bank_name = normalize_food_bank_match_text(bank.name)
        bank_address = normalize_food_bank_match_text(bank.address)
        score = 0

        if normalized_name:
            if bank_name == normalized_name:
                score += 4
            elif bank_name in normalized_name or normalized_name in bank_name:
                score += 2

        if normalized_address:
            if bank_address == normalized_address:
                score += 3
            elif bank_address in normalized_address or normalized_address in bank_address:
                score += 1

        if score > best_score:
            best_match = bank
            best_score = score

    return best_match


async def resolve_food_bank(food_bank_id: int, db: AsyncSession) -> FoodBank:
    return await require_by_id(db, FoodBank, food_bank_id, detail="Food bank not found")


async def require_goods_donation(
    db: AsyncSession,
    donation_id: uuid.UUID,
) -> DonationGoods:
    return await require_by_id(
        db,
        DonationGoods,
        donation_id,
        detail="Goods donation not found",
        options=GOODS_DONATION_OPTIONS,
    )


async def require_cash_donation(
    db: AsyncSession,
    donation_id: uuid.UUID,
) -> DonationCash:
    return await require_by_id(db, DonationCash, donation_id, detail="Cash donation not found")


async def require_admin_goods_donation(
    db: AsyncSession,
    donation_id: uuid.UUID,
    admin_user: dict,
    *,
    detail: str,
) -> DonationGoods:
    return await require_scoped_by_id(
        db,
        DonationGoods,
        donation_id,
        admin_user,
        detail=detail,
        not_found_detail="Goods donation not found",
        options=GOODS_DONATION_OPTIONS,
    )


async def resolve_selected_food_bank_for_goods_donation(
    donation_in: DonationGoodsCreate,
    current_user: dict | None,
    db: AsyncSession,
) -> FoodBank | None:
    requested_food_bank_id = donation_in.food_bank_id
    admin_food_bank_id = get_admin_food_bank_id(current_user)
    if admin_food_bank_id is not None:
        requested_food_bank_id = requested_food_bank_id or admin_food_bank_id
        enforce_admin_food_bank_scope(
            current_user,
            requested_food_bank_id,
            detail="You can only submit goods donations for your assigned food bank",
        )

    if requested_food_bank_id is not None:
        return await resolve_food_bank(requested_food_bank_id, db)

    return await resolve_food_bank_from_metadata(
        food_bank_name=donation_in.food_bank_name,
        food_bank_address=donation_in.food_bank_address,
        db=db,
    )