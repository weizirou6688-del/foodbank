from __future__ import annotations

import sys
from datetime import date
from decimal import Decimal
from pathlib import Path

from fastapi import BackgroundTasks

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.models.food_bank import FoodBank
from app.schemas.donation_cash import DonationCashCreate
from app.services.donation_service_cash import (
    queue_cash_notification_email,
    queue_cash_thank_you_email,
)
from app.services.email_service import (
    send_cash_donation_notification,
    send_thank_you_email,
)


def make_cash_donation() -> DonationCashCreate:
    return DonationCashCreate(
        donor_name="Alex Donor",
        donor_email="alex@example.com",
        amount_pence=2500,
        donation_frequency="monthly",
        card_last4="4242",
    )


def make_food_bank() -> FoodBank:
    return FoodBank(
        id=7,
        name="Northside Food Bank",
        address="1 High Street",
        notification_email="northside@example.com",
        lat=Decimal("51.500000"),
        lng=Decimal("-0.120000"),
    )


def test_queue_cash_thank_you_email_includes_food_bank_details() -> None:
    background_tasks = BackgroundTasks()

    queue_cash_thank_you_email(
        background_tasks,
        make_cash_donation(),
        "MON-REF-123456",
        selected_food_bank=make_food_bank(),
        subscription_reference="SUB-REF-123456",
        next_charge_date=date(2026, 5, 14),
    )

    assert len(background_tasks.tasks) == 1
    task = background_tasks.tasks[0]
    assert task.func is send_thank_you_email
    assert task.args[0] == "alex@example.com"
    assert task.args[1] == "cash"
    assert "Food bank: Northside Food Bank" in task.args[2]
    assert "Subscription: SUB-REF-123456" in task.args[2]
    assert "Next charge date: 2026-05-14" in task.args[2]


def test_queue_cash_notification_email_targets_food_bank_notification_inbox() -> None:
    background_tasks = BackgroundTasks()

    queue_cash_notification_email(
        background_tasks,
        make_cash_donation(),
        selected_food_bank=make_food_bank(),
        payment_reference="MON-REF-123456",
        subscription_reference="SUB-REF-123456",
        next_charge_date=date(2026, 5, 14),
    )

    assert len(background_tasks.tasks) == 1
    task = background_tasks.tasks[0]
    assert task.func is send_cash_donation_notification
    assert task.kwargs["notification_email"] == "northside@example.com"
    assert task.kwargs["food_bank_name"] == "Northside Food Bank"
    assert task.kwargs["donor_name"] == "Alex Donor"
    assert task.kwargs["donor_email"] == "alex@example.com"
    assert task.kwargs["amount_pence"] == 2500
    assert task.kwargs["donation_frequency"] == "monthly"
    assert task.kwargs["payment_reference"] == "MON-REF-123456"
    assert task.kwargs["subscription_reference"] == "SUB-REF-123456"
    assert task.kwargs["next_charge_date"] == "2026-05-14"
