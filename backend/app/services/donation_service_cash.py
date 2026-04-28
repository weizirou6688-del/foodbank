from __future__ import annotations

import logging
import uuid
from calendar import monthrange
from datetime import date

from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database_errors import run_guarded_transaction
from app.core.db_utils import flush_refresh
from app.models.donation_cash import DonationCash
from app.models.food_bank import FoodBank
from app.routers._shared import require_by_id
from app.schemas.donation_cash import DonationCashCreate
from app.services.email_service import (
    send_cash_donation_notification,
    send_thank_you_email,
)


logger = logging.getLogger("uvicorn.error")
CASH_DONATION_FREQUENCIES = {"one_time", "monthly"}


async def _resolve_food_bank(food_bank_id: int, db: AsyncSession) -> FoodBank:
    return await require_by_id(db, FoodBank, food_bank_id, detail="Food bank not found")


async def _require_cash_donation(
    db: AsyncSession,
    donation_id: uuid.UUID,
) -> DonationCash:
    return await require_by_id(
        db,
        DonationCash,
        donation_id,
        detail="Cash donation not found",
    )


def _food_bank_snapshot(
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


def next_monthly_charge_date(anchor: date) -> date:
    # 下个月尽量保持同一日,如果下个月天数不够就退到当月最后一天。
    if anchor.month == 12:
        target_year = anchor.year + 1
        target_month = 1
    else:
        target_year = anchor.year
        target_month = anchor.month + 1

    target_day = min(anchor.day, monthrange(target_year, target_month)[1])
    return date(target_year, target_month, target_day)


def queue_cash_thank_you_email(
    background_tasks: BackgroundTasks,
    donation_in: DonationCashCreate,
    payment_reference: str,
    *,
    selected_food_bank: FoodBank | None = None,
    subscription_reference: str | None = None,
    next_charge_date: date | None = None,
) -> None:
    details_parts = [
        f"Donor: {donation_in.donor_name or 'Anonymous'}",
        f"Amount (pence): {donation_in.amount_pence}",
        f"Frequency: {'Monthly' if donation_in.donation_frequency == 'monthly' else 'One-off'}",
        f"Reference: {payment_reference}",
    ]
    if selected_food_bank is not None:
        details_parts.append(f"Food bank: {selected_food_bank.name}")
    if subscription_reference:
        details_parts.append(f"Subscription: {subscription_reference}")
    if next_charge_date:
        details_parts.append(f"Next charge date: {next_charge_date.isoformat()}")

    background_tasks.add_task(
        send_thank_you_email,
        donation_in.donor_email,
        "cash",
        " | ".join(details_parts),
    )
    logger.info("Queued cash donation thank-you email for %s", donation_in.donor_email)


def queue_cash_notification_email(
    background_tasks: BackgroundTasks,
    donation_in: DonationCashCreate,
    *,
    selected_food_bank: FoodBank | None = None,
    payment_reference: str,
    subscription_reference: str | None = None,
    next_charge_date: date | None = None,
) -> None:
    food_bank_id, food_bank_name, _, notification_email = _food_bank_snapshot(
        selected_food_bank
    )
    background_tasks.add_task(
        send_cash_donation_notification,
        notification_email=notification_email,
        food_bank_name=food_bank_name,
        donor_name=donation_in.donor_name,
        donor_email=donation_in.donor_email,
        amount_pence=donation_in.amount_pence,
        donation_frequency=donation_in.donation_frequency,
        payment_reference=payment_reference,
        subscription_reference=subscription_reference,
        next_charge_date=next_charge_date.isoformat() if next_charge_date else None,
    )
    logger.info(
        "Queued cash donation notification for food_bank_id=%s recipient=%s",
        food_bank_id,
        notification_email,
    )


async def submit_cash_donation(
    donation_in: DonationCashCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession,
) -> DonationCash:
    async def action() -> DonationCash:
        donation_frequency = donation_in.donation_frequency or "one_time"
        selected_food_bank = (
            await _resolve_food_bank(donation_in.food_bank_id, db)
            if donation_in.food_bank_id is not None
            else None
        )
        if donation_frequency not in CASH_DONATION_FREQUENCIES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="donation_frequency must be one of: one_time, monthly",
            )
        if donation_frequency == "monthly" and not donation_in.card_last4:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Monthly donations require card_last4",
            )

        # 这两个 reference 暂时代替支付方的 ID,但格式保持稳定,
        # admin 能据此追踪一次性和按月两条流程。
        payment_reference_prefix = "MON" if donation_frequency == "monthly" else "WEB"
        payment_reference = donation_in.payment_reference or f"{payment_reference_prefix}-{uuid.uuid4().hex[:12].upper()}"
        subscription_reference = (
            f"SUB-{uuid.uuid4().hex[:12].upper()}"
            if donation_frequency == "monthly"
            else None
        )
        next_charge = (
            next_monthly_charge_date(date.today())
            if donation_frequency == "monthly"
            else None
        )
        donation = DonationCash(
            donor_name=donation_in.donor_name,
            donor_type=donation_in.donor_type,
            donor_email=donation_in.donor_email,
            food_bank_id=donation_in.food_bank_id,
            amount_pence=donation_in.amount_pence,
            donation_frequency=donation_frequency,
            payment_reference=payment_reference,
            subscription_reference=subscription_reference,
            card_last4=donation_in.card_last4,
            next_charge_date=next_charge,
            status="completed",
        )
        db.add(donation)
        await flush_refresh(db, donation)
        queue_cash_thank_you_email(
            background_tasks,
            donation_in,
            payment_reference,
            selected_food_bank=selected_food_bank,
            subscription_reference=subscription_reference,
            next_charge_date=next_charge,
        )
        queue_cash_notification_email(
            background_tasks,
            donation_in,
            selected_food_bank=selected_food_bank,
            payment_reference=payment_reference,
            subscription_reference=subscription_reference,
            next_charge_date=next_charge,
        )
        return donation

    return await run_guarded_transaction(
        db,
        action,
        conflict_detail="Cash donation conflict detected",
        failure_detail="Failed to submit cash donation",
    )


async def delete_cash_donation(
    donation_id: uuid.UUID,
    db: AsyncSession,
) -> None:
    async def action() -> None:
        donation = await _require_cash_donation(db, donation_id)
        await db.delete(donation)
        await db.flush()

    return await run_guarded_transaction(
        db,
        action,
        failure_detail="Failed to delete cash donation",
    )
