"""
Donation submission and tracking routes.

Spec § 2.5: POST /cash, POST /goods, GET /list (admin with ?type filter)
"""

import logging
import uuid
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.database_errors import (
    is_database_unavailable_exception,
    raise_database_unavailable_http_exception,
)
from app.core.security import require_admin
from app.models.donation_cash import DonationCash
from app.models.donation_goods import DonationGoods
from app.models.donation_goods_item import DonationGoodsItem
from app.models.food_bank import FoodBank
from app.services.email_service import send_thank_you_email
from app.schemas.donation_cash import DonationCashCreate, DonationCashOut
from app.schemas.donation_goods import DonationGoodsCreate, DonationGoodsOut


router = APIRouter(tags=["Donations"])
logger = logging.getLogger("uvicorn.error")


@router.post("/cash", response_model=DonationCashOut, status_code=status.HTTP_201_CREATED)
async def submit_cash_donation(
    donation_in: DonationCashCreate,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
):
    """
    Submit cash donation (public, no auth required).
    
    Spec § 2.5: POST /donations/cash (no auth).
    
    DonationCashCreate includes:
    - amount: Decimal USD amount
    - donor_name, donor_email, donor_phone: Optional
    - message: Optional
    
    TODO: Create DonationCash record, record transaction
    """
    try:
        payment_reference = donation_in.payment_reference or f"WEB-{uuid.uuid4().hex[:12].upper()}"

        async with db.begin():
            donation = DonationCash(
                donor_name=donation_in.donor_name,
                donor_email=donation_in.donor_email,
                amount_pence=donation_in.amount_pence,
                payment_reference=payment_reference,
                status="completed",
            )
            db.add(donation)
            await db.flush()
            await db.refresh(donation)

            if donation_in.donor_email:
                background_tasks.add_task(
                    send_thank_you_email,
                    donation_in.donor_email,
                    "cash",
                    (
                        f"Donor: {donation_in.donor_name or 'Anonymous'} | "
                        f"Amount (pence): {donation_in.amount_pence} | "
                        f"Reference: {payment_reference}"
                    ),
                )
                logger.info("Queued cash donation thank-you email for %s", donation_in.donor_email)

            return donation
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cash donation conflict detected",
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        if is_database_unavailable_exception(exc):
            raise_database_unavailable_http_exception()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit cash donation",
        ) from exc


@router.post("/goods", response_model=DonationGoodsOut, status_code=status.HTTP_201_CREATED)
async def submit_goods_donation(
    donation_in: DonationGoodsCreate,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
):
    """
    Submit goods donation (public, no auth required).
    
    Spec § 2.5: POST /donations/goods (no auth).
    
    DonationGoodsCreate includes:
    - donor_name, donor_email, donor_phone: Optional
    - items: List[DonationGoodsItemCreatePayload] (item_name, count, unit)
    
    TODO: Create DonationGoods record and DonationGoodsItem entries
    """
    try:
        selected_food_bank: FoodBank | None = None
        donation_id: uuid.UUID | None = None

        async with db.begin():
            if donation_in.food_bank_id is not None:
                selected_food_bank = await db.scalar(
                    select(FoodBank).where(FoodBank.id == donation_in.food_bank_id)
                )
                if selected_food_bank is None:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Food bank not found",
                    )

            donation = DonationGoods(
                donor_user_id=donation_in.donor_user_id,
                food_bank_id=selected_food_bank.id if selected_food_bank is not None else None,
                food_bank_name=(
                    selected_food_bank.name
                    if selected_food_bank is not None
                    else donation_in.food_bank_name
                ),
                food_bank_address=(
                    selected_food_bank.address
                    if selected_food_bank is not None
                    else donation_in.food_bank_address
                ),
                donor_name=donation_in.donor_name,
                donor_email=donation_in.donor_email,
                donor_phone=donation_in.donor_phone,
                postcode=donation_in.postcode,
                pickup_date=donation_in.pickup_date,
                item_condition=donation_in.item_condition,
                estimated_quantity=donation_in.estimated_quantity,
                notes=donation_in.notes,
                status="pending",
            )
            db.add(donation)
            await db.flush()
            donation_id = donation.id

            for item in donation_in.items:
                db.add(
                    DonationGoodsItem(
                        donation_id=donation.id,
                        donation=donation,
                        item_name=item.item_name,
                        quantity=item.quantity,
                    )
                )

            await db.flush()

            if donation_in.donor_email:
                goods_details = ", ".join(
                    f"{item.item_name} x{item.quantity}" for item in donation_in.items
                )
                selected_food_bank_name = (
                    selected_food_bank.name
                    if selected_food_bank is not None
                    else donation_in.food_bank_name
                )
                if selected_food_bank_name:
                    goods_details = f"{goods_details} | Food bank: {selected_food_bank_name}"
                background_tasks.add_task(
                    send_thank_you_email,
                    donation_in.donor_email,
                    "goods",
                    goods_details,
                )
                logger.info("Queued goods donation thank-you email for %s", donation_in.donor_email)

        result = await db.execute(
            select(DonationGoods)
            .options(selectinload(DonationGoods.items))
            .where(DonationGoods.id == donation_id)
        )
        return result.scalar_one()
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Goods donation conflict detected",
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        if is_database_unavailable_exception(exc):
            raise_database_unavailable_http_exception()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit goods donation",
        ) from exc


@router.get("", response_model=List[dict])
async def list_donations(
    type: Optional[str] = None,  # "cash" or "goods"
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    List all donations (admin only, with optional type filter).
    
    Spec § 2.5: GET /donations?type= (requires admin).
    
    Supports filters:
    - ?type=cash → only DonationCash
    - ?type=goods → only DonationGoods
    
    TODO: Query donations with optional type filter
    """
    _ = admin_user

    normalized = type.lower() if type else None
    if normalized not in (None, "cash", "goods"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="type must be one of: cash, goods",
        )

    response: list[dict] = []

    if normalized in (None, "cash"):
        cash_rows = (
            await db.execute(
                select(DonationCash).order_by(DonationCash.created_at.desc())
            )
        ).scalars().all()
        for row in cash_rows:
            payload = DonationCashOut.model_validate(row).model_dump(mode="json")
            payload["donation_type"] = "cash"
            response.append(payload)

    if normalized in (None, "goods"):
        goods_rows = (
            await db.execute(
                select(DonationGoods)
                .options(selectinload(DonationGoods.items))
                .order_by(DonationGoods.created_at.desc())
            )
        ).scalars().all()
        for row in goods_rows:
            payload = DonationGoodsOut.model_validate(row).model_dump(mode="json")
            payload["donation_type"] = "goods"
            response.append(payload)

    response.sort(key=lambda d: d.get("created_at", ""), reverse=True)
    return response
