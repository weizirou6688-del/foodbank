"""
Authentication routes: user registration, login, logout, token refresh, profile.

Spec § 2.1: All endpoints prefixed with /api/v1/auth
"""

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_password_reset_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    get_password_hash,
    verify_password,
)
from app.models.food_bank import FoodBank
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
    """
    Register a new public user account.
    
    Spec § 2.1: POST /auth/register (no auth required).
    Role is always set to 'public' for new registrations.
    
    Returns UserOut (id, name, email, role, timestamps).
    """
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
    """
    Login with email and password.
    
    Spec § 2.1: POST /auth/login (no auth required).
    Returns access_token, refresh_token, and user profile.
    """
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
    Start a password reset flow.

    Returns a generic response even when the email does not exist, to avoid
    leaking which accounts are registered. In local development, when SMTP is
    not configured, a short-lived reset token is returned directly so the UI can
    continue the reset flow.
    """
    generic_message = "If this email exists, password reset instructions are now available."

    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if user is None:
        return ForgotPasswordResponse(message=generic_message)

    reset_token = create_password_reset_token(
        {"sub": str(user.id), "email": user.email},
        expires_delta=timedelta(minutes=30),
    )

    if is_smtp_configured():
        await send_password_reset_email(to_email=user.email, reset_token=reset_token)
        return ForgotPasswordResponse(message=generic_message)

    return ForgotPasswordResponse(
        message="Local reset token generated. Continue below to choose a new password.",
        reset_token=reset_token,
    )


@router.post("/reset-password", response_model=MessageResponse, status_code=status.HTTP_200_OK)
async def reset_password(
    payload: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Complete a password reset using a short-lived reset token.
    """
    token_payload = decode_token(payload.reset_token)
    if token_payload.get("type") != "password_reset":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password reset token",
        )

    user_id = token_payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user.password_hash = get_password_hash(payload.new_password)
    await db.flush()
    await db.refresh(user)

    return MessageResponse(message="Password reset successful. You can now sign in with the new password.")


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Invalidate refresh token (logout).
    
    Spec § 2.1: POST /auth/logout (requires auth).
    In a production system, store blacklist of revoked tokens.
    
    Returns 204 No Content.
    """
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
    """
    Exchange refresh token for new access token.
    
    Spec § 2.1: POST /auth/refresh (no auth required, bring refresh_token in body).
    """
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
    """
    Get current authenticated user's profile.
    
    Spec § 2.1: GET /auth/me (requires auth).
    """
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
