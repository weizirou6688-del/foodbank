"""Email sending service for donation thank-you messages."""

import logging
import os
from email.message import EmailMessage
from pathlib import Path
from typing import Any

import aiosmtplib
from dotenv import load_dotenv
from email_validator import EmailNotValidError, validate_email


logger = logging.getLogger(__name__)

# Ensure backend/.env values are available for SMTP configuration.
load_dotenv(Path(__file__).resolve().parents[2] / ".env")


async def send_thank_you_email(to_email: str, donation_type: str, details: Any) -> None:
    """
    Send a donation thank-you email through SMTP.

    Environment variables:
    - SMTP_USERNAME (required)
    - SMTP_PASSWORD (required)
    - SMTP_FROM_EMAIL (optional, falls back to SMTP_USERNAME)
    - SMTP_HOST (optional, default: smtp.gmail.com)
    - SMTP_PORT (optional, default: 587)
    """
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from_email = os.getenv("SMTP_FROM_EMAIL") or smtp_username
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))

    if smtp_password:
        smtp_password = smtp_password.replace(" ", "")

    if not smtp_username or not smtp_password or not smtp_from_email:
        logger.warning("SMTP config missing; skip thank-you email send")
        return

    if not to_email:
        logger.warning("Recipient email is empty; skip thank-you email send")
        return

    try:
        normalized = validate_email(to_email, check_deliverability=False)
        recipient = normalized.email
    except EmailNotValidError as exc:
        logger.warning("Invalid recipient email '%s': %s", to_email, exc)
        return

    donation_label = "现金" if donation_type == "cash" else "物资"

    message = EmailMessage()
    message["From"] = smtp_from_email
    message["To"] = recipient
    message["Subject"] = "感谢您的捐赠 | ABC Community Food Bank"
    message.set_content(
        "感谢您支持 ABC Community Food Bank！\n\n"
        f"捐赠类型: {donation_label}\n"
        f"捐赠详情: {details}\n\n"
        "您的善举将帮助更多有需要的家庭。\n"
        "谢谢！"
    )

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
        logger.info("Thank-you email sent to %s", recipient)
    except Exception as exc:
        logger.exception("Failed to send thank-you email to %s: %s", recipient, exc)
