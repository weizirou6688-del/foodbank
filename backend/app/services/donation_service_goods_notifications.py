from __future__ import annotations

import logging

from fastapi import BackgroundTasks

from app.models.food_bank import FoodBank
from app.schemas.donation_goods import DonationGoodsCreate, DonationGoodsItemCreatePayload
from app.services.donation_service_common import food_bank_snapshot
from app.services.email_service import (
    send_goods_donation_notification,
    send_thank_you_email,
)


logger = logging.getLogger("uvicorn.error")


def goods_items_summary(items: list[DonationGoodsItemCreatePayload]) -> str:
    return ", ".join(f"{item.item_name} x{item.quantity}" for item in items)


def queue_goods_emails(
    background_tasks: BackgroundTasks,
    donation_in: DonationGoodsCreate,
    selected_food_bank: FoodBank | None,
) -> None:
    food_bank_id, food_bank_name, food_bank_address, notification_email = food_bank_snapshot(
        selected_food_bank,
        fallback_name=donation_in.food_bank_name,
        fallback_address=donation_in.food_bank_address,
        fallback_email=donation_in.food_bank_email,
    )
    items_summary = goods_items_summary(donation_in.items)
    goods_details = items_summary
    if food_bank_name:
        goods_details = f"{goods_details} | Food bank: {food_bank_name}"
    background_tasks.add_task(
        send_thank_you_email,
        donation_in.donor_email,
        "goods",
        goods_details,
    )
    logger.info("Queued goods donation thank-you email for %s", donation_in.donor_email)
    background_tasks.add_task(
        send_goods_donation_notification,
        notification_email=notification_email,
        food_bank_name=food_bank_name,
        food_bank_address=food_bank_address,
        donor_name=donation_in.donor_name,
        donor_email=donation_in.donor_email,
        donor_phone=donation_in.donor_phone,
        items_summary=items_summary,
        pickup_date=donation_in.pickup_date,
        notes=donation_in.notes,
    )
    logger.info(
        "Queued goods donation notification for food_bank_id=%s recipient=%s",
        food_bank_id,
        notification_email,
    )
