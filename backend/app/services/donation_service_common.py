from __future__ import annotations

from datetime import date

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database_errors import run_guarded_transaction
from app.core.goods_donation_format import parse_goods_pickup_date
from app.models.donation_goods import DonationGoods
from app.models.food_bank import FoodBank


def ensure_pending_goods_pickup_date_is_not_past(
    pickup_date: date | str | None,
    status_value: str,
) -> None:
    parsed_pickup_date = parse_goods_pickup_date(pickup_date)
    if (
        parsed_pickup_date is not None
        and status_value == "pending"
        and parsed_pickup_date < date.today()
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pending goods donations must use a pickup date on or after today",
        )


def food_bank_snapshot(
    food_bank: FoodBank | None,
    *,
    fallback_name: str | None = None,
    fallback_address: str | None = None,
    fallback_email: str | None = None,
) -> tuple[int | None, str | None, str | None, str | None]:
    return (
        food_bank.id if food_bank is not None else None,
        food_bank.name if food_bank is not None else fallback_name,
        food_bank.address if food_bank is not None else fallback_address,
        (food_bank.notification_email if food_bank is not None else None)
        or fallback_email,
    )


def require_update_fields(has_updates: bool) -> None:
    if has_updates:
        return
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="No fields provided to update",
    )


async def create_goods_donation(
    db: AsyncSession,
    *,
    selected_food_bank: FoodBank | None,
    fallback_name: str | None = None,
    fallback_address: str | None = None,
    status: str,
    **payload,
) -> DonationGoods:
    food_bank_id, food_bank_name, food_bank_address, _ = food_bank_snapshot(
        selected_food_bank,
        fallback_name=fallback_name,
        fallback_address=fallback_address,
    )
    donation = DonationGoods(
        food_bank_id=food_bank_id,
        food_bank_name=food_bank_name,
        food_bank_address=food_bank_address,
        status=status,
        **payload,
    )
    db.add(donation)
    await db.flush()
    return donation


async def delete_donation(
    db: AsyncSession,
    loader,
    *,
    failure_detail: str,
) -> None:
    async def action() -> None:
        donation = await loader()
        await db.delete(donation)
        await db.flush()

    return await run_guarded_transaction(db, action, failure_detail=failure_detail)