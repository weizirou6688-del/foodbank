import logging
import os
from email.message import EmailMessage
from pathlib import Path
from typing import Any

import aiosmtplib
from dotenv import load_dotenv
from email_validator import EmailNotValidError, validate_email


logger = logging.getLogger("uvicorn.error")

load_dotenv(Path(__file__).resolve().parents[2] / ".env")


def _load_smtp_settings() -> dict[str, str | int | None]:
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from_email = os.getenv("SMTP_FROM_EMAIL") or smtp_username
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))

    if smtp_password:
        smtp_password = smtp_password.replace(" ", "")

    return {
        "smtp_username": smtp_username,
        "smtp_password": smtp_password,
        "smtp_from_email": smtp_from_email,
        "smtp_host": smtp_host,
        "smtp_port": smtp_port,
    }


def _normalize_recipient(to_email: str | None) -> str | None:
    if not to_email:
        return None

    try:
        normalized = validate_email(to_email, check_deliverability=False)
        return normalized.email
    except EmailNotValidError as exc:
        logger.warning("Invalid recipient email '%s': %s", to_email, exc)
        return None


def _operations_fallback_email() -> str | None:
    return (
        os.getenv("PLATFORM_OPERATIONS_EMAIL")
        or os.getenv("OPERATIONS_NOTIFICATION_EMAIL")
        or os.getenv("SMTP_FROM_EMAIL")
        or os.getenv("SMTP_USERNAME")
    )


def is_smtp_configured() -> bool:
    smtp_settings = _load_smtp_settings()
    return bool(
        smtp_settings["smtp_username"]
        and smtp_settings["smtp_password"]
        and smtp_settings["smtp_from_email"]
    )


async def _send_email_message(
    message: EmailMessage,
    *,
    raise_on_failure: bool = False,
) -> bool:
    smtp_settings = _load_smtp_settings()
    smtp_username = smtp_settings["smtp_username"]
    smtp_password = smtp_settings["smtp_password"]
    smtp_from_email = smtp_settings["smtp_from_email"]
    smtp_host = smtp_settings["smtp_host"]
    smtp_port = smtp_settings["smtp_port"]

    if not smtp_username or not smtp_password or not smtp_from_email:
        logger.warning("SMTP config missing; skip email send")
        if raise_on_failure:
            raise RuntimeError("SMTP config missing")
        return False

    if not message.get("To"):
        logger.warning("Recipient email missing; skip email send")
        if raise_on_failure:
            raise RuntimeError("Recipient email missing")
        return False

    try:
        await aiosmtplib.send(
            message,
            hostname=smtp_host,
            port=smtp_port,
            username=smtp_username,
            password=smtp_password,
            start_tls=True,
            timeout=20,
        )
        logger.info("Email sent to %s", message["To"])
        return True
    except Exception as exc:
        logger.exception("Failed to send email to %s: %s", message["To"], exc)
        if raise_on_failure:
            raise
        return False


async def send_thank_you_email(to_email: str, donation_type: str, details: Any) -> None:
    logger.info("Email task started for recipient=%s donation_type=%s", to_email, donation_type)

    recipient = _normalize_recipient(to_email)
    if recipient is None:
        logger.warning("Recipient email is empty or invalid; skip thank-you email send")
        return

    donation_label = "Cash" if donation_type == "cash" else "Goods"
    smtp_from_email = _load_smtp_settings()["smtp_from_email"]

    message = EmailMessage()
    message["From"] = smtp_from_email
    message["To"] = recipient
    message["Subject"] = "Thank You for Your Donation | ABC Community Food Bank"
    message.set_content(
        "Thank you for supporting ABC Community Food Bank!\n\n"
        f"Donation Type: {donation_label}\n"
        f"Donation Details: {details}\n\n"
        "Your generosity helps more families in need.\n"
        "Thank you!"
    )

    await _send_email_message(message)


async def send_goods_donation_notification(
    *,
    notification_email: str | None,
    food_bank_name: str | None,
    food_bank_address: str | None,
    donor_name: str,
    donor_email: str,
    donor_phone: str,
    items_summary: str,
    pickup_date: str | None,
    notes: str | None,
) -> None:
    recipient = _normalize_recipient(notification_email) or _normalize_recipient(
        _operations_fallback_email()
    )
    if recipient is None:
        logger.warning("No valid notification email configured for goods donation alert")
        return

    smtp_from_email = _load_smtp_settings()["smtp_from_email"]

    message = EmailMessage()
    message["From"] = smtp_from_email
    message["To"] = recipient
    message["Subject"] = "New Goods Donation Request | ABC Community Food Bank"
    message.set_content(
        "A new goods donation request has been submitted.\n\n"
        f"Food Bank: {food_bank_name or 'Unassigned / external listing'}\n"
        f"Address: {food_bank_address or 'Not provided'}\n"
        f"Donor Name: {donor_name}\n"
        f"Donor Email: {donor_email}\n"
        f"Donor Phone: {donor_phone}\n"
        f"Items: {items_summary}\n"
        f"Preferred Pickup Date: {pickup_date or 'Not provided'}\n"
        f"Notes: {notes or 'None'}\n\n"
        "Please contact the donor to arrange collection or drop-off."
    )

    await _send_email_message(message)


async def send_cash_donation_notification(
    *,
    notification_email: str | None,
    food_bank_name: str | None,
    donor_name: str | None,
    donor_email: str,
    amount_pence: int,
    donation_frequency: str,
    payment_reference: str,
    subscription_reference: str | None = None,
    next_charge_date: str | None = None,
) -> None:
    recipient = _normalize_recipient(notification_email) or _normalize_recipient(
        _operations_fallback_email()
    )
    if recipient is None:
        logger.warning("No valid notification email configured for cash donation alert")
        return

    smtp_from_email = _load_smtp_settings()["smtp_from_email"]
    donation_scope = food_bank_name or "Platform operations"
    amount_gbp = amount_pence / 100
    frequency_label = "Monthly" if donation_frequency == "monthly" else "One-off"

    message = EmailMessage()
    message["From"] = smtp_from_email
    message["To"] = recipient
    message["Subject"] = "New Cash Donation | ABC Community Food Bank"
    message.set_content(
        "A new cash donation has been submitted.\n\n"
        f"Donation Route: {donation_scope}\n"
        f"Donor Name: {donor_name or 'Anonymous'}\n"
        f"Donor Email: {donor_email}\n"
        f"Amount: GBP {amount_gbp:.2f}\n"
        f"Frequency: {frequency_label}\n"
        f"Payment Reference: {payment_reference}\n"
        f"Subscription Reference: {subscription_reference or 'Not applicable'}\n"
        f"Next Charge Date: {next_charge_date or 'Not applicable'}\n"
    )

    await _send_email_message(message)


async def send_password_reset_email(
    *,
    to_email: str,
    verification_code: str,
    expires_in_minutes: int,
) -> None:
    recipient = _normalize_recipient(to_email)
    if recipient is None:
        raise ValueError("Recipient email is empty or invalid")

    smtp_from_email = _load_smtp_settings()["smtp_from_email"]

    message = EmailMessage()
    message["From"] = smtp_from_email
    message["To"] = recipient
    message["Subject"] = "Password Reset Verification Code | ABC Community Food Bank"
    message.set_content(
        "We received a request to reset your password.\n\n"
        "Use the following verification code in the app:\n"
        f"{verification_code}\n\n"
        f"This code will expire in {expires_in_minutes} minutes. "
        "If you did not request a reset, you can ignore this email."
    )

    await _send_email_message(message, raise_on_failure=True)
