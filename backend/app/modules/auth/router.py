"""Authentication routes."""

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    get_password_hash,
    verify_password,
)
from app.models.food_bank import FoodBank
from app.models.password_reset_token import PasswordResetToken
from app.models.user import User
from app.modules.auth.schema import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    MessageResponse,
    ResetPasswordRequest,
    TokenResponse,
)
from app.schemas.user import UserCreate, UserOut
from app.services.email_service import is_smtp_configured, send_password_reset_email


router = APIRouter(tags=["Authentication"])
router.is_smtp_configured = is_smtp_configured
router.send_password_reset_email = send_password_reset_email

PASSWORD_RESET_CODE_LENGTH = 6
PASSWORD_RESET_CODE_EXPIRE_MINUTES = 10


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _generate_password_reset_code() -> str:
    upper_bound = 10**PASSWORD_RESET_CODE_LENGTH
    return f"{secrets.randbelow(upper_bound):0{PASSWORD_RESET_CODE_LENGTH}d}"


async def _serialize_user(user: User, db: AsyncSession) -> UserOut:
    food_bank_name: str | None = None
    if user.food_bank_id is not None:
        food_bank_name = await db.scalar(
            select(FoodBank.name).where(FoodBank.id == user.food_bank_id)
        )

    return UserOut.model_validate(
        {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "food_bank_id": user.food_bank_id,
            "food_bank_name": food_bank_name,
            "created_at": user.created_at,
            "updated_at": user.updated_at,
        }
    )


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    """Register a new public user account."""
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == user_in.email))
    existing_user = result.scalar_one_or_none()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    
    # Hash password and create user (role always 'public')
    user = User(
        name=user_in.name,
        email=user_in.email,
        password_hash=get_password_hash(user_in.password),
        role="public",
    )
    
    db.add(user)
    await db.flush()
    await db.refresh(user)
    
    return await _serialize_user(user, db)


@router.post("/login", response_model=TokenResponse, status_code=status.HTTP_200_OK)
async def login(
    login_in: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Login with email and password."""
    # Look up user by email
    result = await db.execute(select(User).where(User.email == login_in.email))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(login_in.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    
    # Generate tokens
    access_token = create_access_token(
        {
            "sub": str(user.id),
            "role": user.role,
            "food_bank_id": user.food_bank_id,
        }
    )
    refresh_token = create_refresh_token({"sub": str(user.id)})
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=await _serialize_user(user, db),
    )


@router.post("/forgot-password", response_model=ForgotPasswordResponse, status_code=status.HTTP_200_OK)
async def forgot_password(
    payload: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Start a password reset flow by emailing a short-lived verification code.
    """
    if not router.is_smtp_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password reset email service is unavailable.",
        )

    generic_message = "If this email exists, a verification code has been sent."

    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if user is None:
        return ForgotPasswordResponse(message=generic_message)

    verification_code = _generate_password_reset_code()
    reset_record = PasswordResetToken(
        user_id=user.id,
        token_hash=get_password_hash(verification_code),
        expires_at=_utcnow() + timedelta(minutes=PASSWORD_RESET_CODE_EXPIRE_MINUTES),
    )
    db.add(reset_record)
    await db.flush()

    try:
        await router.send_password_reset_email(
            to_email=user.email,
            verification_code=verification_code,
            expires_in_minutes=PASSWORD_RESET_CODE_EXPIRE_MINUTES,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password reset email could not be sent. Please try again later.",
        ) from exc

    return ForgotPasswordResponse(
        message=generic_message,
    )


@router.post("/reset-password", response_model=MessageResponse, status_code=status.HTTP_200_OK)
async def reset_password(
    payload: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Complete a password reset using the latest email verification code.
    """
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired verification code",
        )

    latest_code_result = await db.execute(
        select(PasswordResetToken)
        .where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > _utcnow(),
        )
        .order_by(PasswordResetToken.created_at.desc())
        .limit(1)
    )
    reset_record = latest_code_result.scalar_one_or_none()

    if reset_record is None or not verify_password(payload.verification_code, reset_record.token_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired verification code",
        )

    reset_record.used_at = _utcnow()
    user.password_hash = get_password_hash(payload.new_password)
    await db.flush()
    await db.refresh(user)

    return MessageResponse(message="Password reset successful. You can now sign in with the new password.")


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Invalidate the current session."""
    _ = current_user
    _ = db
    # Note: In a simple implementation, we rely on token expiration.
    # Production systems would maintain a token blacklist.
    return None


@router.post("/refresh", status_code=status.HTTP_200_OK)
async def refresh(
    refresh_token: str,
    db: AsyncSession = Depends(get_db),
):
    """Exchange a refresh token for a new access token."""
    # Decode and verify refresh token
    payload = decode_token(refresh_token)
    
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )
    
    user_id = payload.get("sub")
    
    # Look up user to get current role
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    
    # Generate new access token
    new_access_token = create_access_token(
        {
            "sub": str(user.id),
            "role": user.role,
            "food_bank_id": user.food_bank_id,
        }
    )
    
    return {
        "access_token": new_access_token,
        "token_type": "bearer",
    }


@router.get("/me", response_model=UserOut)
async def get_profile(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the current authenticated user's profile."""
    user_id = current_user.get("sub")
    
    # Fetch full user record from DB by user_id in token
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    return await _serialize_user(user, db)
