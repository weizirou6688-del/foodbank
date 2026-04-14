from __future__ import annotations

import logging
from dataclasses import dataclass
from email.message import EmailMessage
from typing import Any

import aiosmtplib
from email_validator import EmailNotValidError, validate_email

from app.core.config import settings


logger = logging.getLogger("uvicorn.error")


@dataclass(frozen=True, slots=True)
class SmtpSettings:
    username: str | None
    password: str | None
    sender_email: str | None
    host: str | None
    port: int | None

    @property
    def is_configured(self) -> bool:
        return bool(self.username and self.password and self.sender_email)


def _load_smtp_settings() -> SmtpSettings:
    smtp_password = settings.smtp_password
    if smtp_password:
        smtp_password = smtp_password.replace(" ", "")

    return SmtpSettings(
        username=settings.smtp_username,
        password=smtp_password,
        sender_email=settings.smtp_sender_email,
        host=settings.smtp_host,
        port=settings.smtp_port,
    )


def _normalize_recipient(to_email: str | None) -> str | None:
    if not to_email:
        return None

    try:
        normalized = validate_email(to_email, check_deliverability=False)
        return normalized.email
    except EmailNotValidError as exc:
        logger.warning("Invalid recipient email '%s': %s", to_email, exc)
        return None


def _resolve_notification_recipient(notification_email: str | None) -> str | None:
    return _normalize_recipient(notification_email) or _normalize_recipient(
        settings.operations_fallback_email
    )


def _require_sender_email(
    smtp_settings: SmtpSettings,
    *,
    raise_on_failure: bool = False,
) -> str | None:
    if smtp_settings.sender_email:
        return smtp_settings.sender_email

    logger.warning("SMTP sender email missing; skip email send")
    if raise_on_failure:
        raise RuntimeError("SMTP config missing")
    return None


def is_smtp_configured() -> bool:
    return _load_smtp_settings().is_configured


def _build_message(
    *,
    sender_email: str,
    recipient: str,
    subject: str,
    body: str,
) -> EmailMessage:
    message = EmailMessage()
    message["From"] = sender_email
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(body)
    return message


async def _send_email_message(
    message: EmailMessage,
    *,
    raise_on_failure: bool = False,
) -> bool:
    smtp_settings = _load_smtp_settings()
    if not smtp_settings.is_configured:
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
            hostname=smtp_settings.host,
            port=smtp_settings.port,
            username=smtp_settings.username,
            password=smtp_settings.password,
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


async def _send_simple_email(
    *,
    recipient: str | None,
    subject: str,
    body: str,
    invalid_recipient_detail: str,
    missing_recipient_detail: str,
    raise_on_failure: bool = False,
) -> bool:
    normalized_recipient = _normalize_recipient(recipient)
    if normalized_recipient is None:
        logger.warning("%s", invalid_recipient_detail)
        if raise_on_failure:
            raise ValueError(missing_recipient_detail)
        return False

    smtp_settings = _load_smtp_settings()
    sender_email = _require_sender_email(
        smtp_settings,
        raise_on_failure=raise_on_failure,
    )
    if sender_email is None:
        return False

    message = _build_message(
        sender_email=sender_email,
        recipient=normalized_recipient,
        subject=subject,
        body=body,
    )
    return await _send_email_message(message, raise_on_failure=raise_on_failure)


async def send_thank_you_email(to_email: str, donation_type: str, details: Any) -> None:
    logger.info(
        "Email task started for recipient=%s donation_type=%s",
        to_email,
        donation_type,
    )

    donation_label = "Cash" if donation_type == "cash" else "Goods"
    await _send_simple_email(
        recipient=to_email,
        subject="Thank You for Your Donation | ABC Community Food Bank",
        body=(
            "Thank you for supporting ABC Community Food Bank!\n\n"
            f"Donation Type: {donation_label}\n"
            f"Donation Details: {details}\n\n"
            "Your generosity helps more families in need.\n"
            "Thank you!"
        ),
        invalid_recipient_detail="Recipient email is empty or invalid; skip thank-you email send",
        missing_recipient_detail="Recipient email is empty or invalid",
    )


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
    recipient = _resolve_notification_recipient(notification_email)
    if recipient is None:
        logger.warning("No valid notification email configured for goods donation alert")
        return

    await _send_simple_email(
        recipient=recipient,
        subject="New Goods Donation Request | ABC Community Food Bank",
        body=(
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
        ),
        invalid_recipient_detail="No valid notification email configured for goods donation alert",
        missing_recipient_detail="Recipient email missing",
    )


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
    recipient = _resolve_notification_recipient(notification_email)
    if recipient is None:
        logger.warning("No valid notification email configured for cash donation alert")
        return

    donation_scope = food_bank_name or "Platform operations"
    amount_gbp = amount_pence / 100
    frequency_label = "Monthly" if donation_frequency == "monthly" else "One-off"
    await _send_simple_email(
        recipient=recipient,
        subject="New Cash Donation | ABC Community Food Bank",
        body=(
            "A new cash donation has been submitted.\n\n"
            f"Donation Route: {donation_scope}\n"
            f"Donor Name: {donor_name or 'Anonymous'}\n"
            f"Donor Email: {donor_email}\n"
            f"Amount: GBP {amount_gbp:.2f}\n"
            f"Frequency: {frequency_label}\n"
            f"Payment Reference: {payment_reference}\n"
            f"Subscription Reference: {subscription_reference or 'Not applicable'}\n"
            f"Next Charge Date: {next_charge_date or 'Not applicable'}\n"
        ),
        invalid_recipient_detail="No valid notification email configured for cash donation alert",
        missing_recipient_detail="Recipient email missing",
    )


async def send_password_reset_email(
    *,
    to_email: str,
    verification_code: str,
    expires_in_minutes: int,
) -> None:
    await _send_simple_email(
        recipient=to_email,
        subject="Password Reset Verification Code | ABC Community Food Bank",
        body=(
            "We received a request to reset your password.\n\n"
            "Use the following verification code in the app:\n"
            f"{verification_code}\n\n"
            f"This code will expire in {expires_in_minutes} minutes. "
            "If you did not request a reset, you can ignore this email."
        ),
        invalid_recipient_detail="Recipient email is empty or invalid",
        missing_recipient_detail="Recipient email is empty or invalid",
        raise_on_failure=True,
    )
