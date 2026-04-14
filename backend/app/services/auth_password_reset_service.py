from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db_utils import fetch_one_or_none
from app.core.security import get_password_hash, verify_password
from app.models.password_reset_token import PasswordResetToken
from app.services.auth_user_service import get_user_by_email
from app.services.email_service import is_smtp_configured, send_password_reset_email

PASSWORD_RESET_CODE_LENGTH = 6
PASSWORD_RESET_CODE_EXPIRE_MINUTES = 10
PASSWORD_RESET_GENERIC_MESSAGE = "If this email exists, a verification code has been sent."
PASSWORD_RESET_INVALID_CODE_DETAIL = "Invalid or expired verification code"
PASSWORD_RESET_SUCCESS_MESSAGE = "Password reset successful. You can now sign in with the new password."


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def generate_password_reset_code() -> str:
    return f"{secrets.randbelow(10**PASSWORD_RESET_CODE_LENGTH):0{PASSWORD_RESET_CODE_LENGTH}d}"


async def request_password_reset(db: AsyncSession, email: str) -> str:
    if not is_smtp_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password reset email service is unavailable.",
        )

    user = await get_user_by_email(db, email)
    if user is None:
        return PASSWORD_RESET_GENERIC_MESSAGE

    verification_code = generate_password_reset_code()
    reset_record = PasswordResetToken(
        user_id=user.id,
        token_hash=get_password_hash(verification_code),
        expires_at=utcnow() + timedelta(minutes=PASSWORD_RESET_CODE_EXPIRE_MINUTES),
    )
    db.add(reset_record)
    await db.flush()

    try:
        await send_password_reset_email(
            to_email=user.email,
            verification_code=verification_code,
            expires_in_minutes=PASSWORD_RESET_CODE_EXPIRE_MINUTES,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password reset email could not be sent. Please try again later.",
        ) from exc

    return PASSWORD_RESET_GENERIC_MESSAGE


async def reset_password(
    db: AsyncSession,
    *,
    email: str,
    verification_code: str,
    new_password: str,
) -> str:
    user = await get_user_by_email(db, email)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=PASSWORD_RESET_INVALID_CODE_DETAIL,
        )

    reset_record = await fetch_one_or_none(
        db,
        select(PasswordResetToken)
        .where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > utcnow(),
        )
        .order_by(PasswordResetToken.created_at.desc())
        .limit(1),
    )
    if reset_record is None or not verify_password(verification_code, reset_record.token_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=PASSWORD_RESET_INVALID_CODE_DETAIL,
        )

    reset_record.used_at = utcnow()
    user.password_hash = get_password_hash(new_password)
    await db.flush()
    await db.refresh(user)
    return PASSWORD_RESET_SUCCESS_MESSAGE
