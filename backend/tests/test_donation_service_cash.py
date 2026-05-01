from __future__ import annotations

from datetime import date
from decimal import Decimal

from fastapi import BackgroundTasks

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


def test_cash_thank_you_email_to_donor_mentions_food_bank_and_recurring_details() -> None:
    background_tasks = BackgroundTasks()
    donation = DonationCashCreate(
        donor_name="Alex Donor",
        donor_email="alex@example.com",
        amount_pence=2500,
        donation_frequency="monthly",
        card_last4="4242",
    )
    selected_food_bank = FoodBank(
        id=7,
        name="Northside Food Bank",
        address="1 High Street",
        notification_email="northside@example.com",
        lat=Decimal("51.500000"),
        lng=Decimal("-0.120000"),
    )

    queue_cash_thank_you_email(
        background_tasks,
        donation,
        "MON-REF-123456",
        selected_food_bank=selected_food_bank,
        subscription_reference="SUB-REF-123456",
        next_charge_date=date(2026, 5, 14),
    )

    assert len(background_tasks.tasks) == 1

    task = background_tasks.tasks[0]
    assert task.func is send_thank_you_email
    assert task.args[0] == donation.donor_email
    assert task.args[1] == "cash"

    description = task.args[2]
    assert "Food bank: Northside Food Bank" in description
    assert "Subscription: SUB-REF-123456" in description
    assert "Next charge date: 2026-05-14" in description


def test_cash_notification_email_routes_to_food_bank_contact_with_donor_and_payment_context() -> None:
    background_tasks = BackgroundTasks()
    donation = DonationCashCreate(
        donor_name="Alex Donor",
        donor_email="alex@example.com",
        amount_pence=2500,
        donation_frequency="monthly",
        card_last4="4242",
    )
    selected_food_bank = FoodBank(
        id=7,
        name="Northside Food Bank",
        address="1 High Street",
        notification_email="northside@example.com",
        lat=Decimal("51.500000"),
        lng=Decimal("-0.120000"),
    )

    queue_cash_notification_email(
        background_tasks,
        donation,
        selected_food_bank=selected_food_bank,
        payment_reference="MON-REF-123456",
        subscription_reference="SUB-REF-123456",
        next_charge_date=date(2026, 5, 14),
    )

    assert len(background_tasks.tasks) == 1

    task = background_tasks.tasks[0]
    assert task.func is send_cash_donation_notification
    assert task.kwargs["notification_email"] == selected_food_bank.notification_email
    assert task.kwargs["food_bank_name"] == selected_food_bank.name
    assert task.kwargs["donor_name"] == donation.donor_name
    assert task.kwargs["donor_email"] == donation.donor_email
    assert task.kwargs["amount_pence"] == donation.amount_pence
    assert task.kwargs["donation_frequency"] == donation.donation_frequency
    assert task.kwargs["payment_reference"] == "MON-REF-123456"
    assert task.kwargs["subscription_reference"] == "SUB-REF-123456"
    assert task.kwargs["next_charge_date"] == "2026-05-14"
