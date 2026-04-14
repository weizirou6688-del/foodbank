from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import create_access_token, get_current_user
from app.schemas.auth import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    MessageResponse,
    ResetPasswordRequest,
    TokenResponse,
)
from app.schemas.user import UserCreate, UserOut
from app.services.auth_password_reset_service import (
    request_password_reset as _request_password_reset,
    reset_password as _reset_password,
)
from app.services.auth_user_service import (
    authenticate_user as _authenticate_user,
    build_access_token_payload as _access_token_payload,
    get_user_by_id as _user_by_id,
    register_user as _register_user,
    serialize_user as _serialize_user,
)


router = APIRouter(tags=["Authentication"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    user = await _register_user(db, user_in)
    return await _serialize_user(user, db)


@router.post("/login", response_model=TokenResponse, status_code=status.HTTP_200_OK)
async def login(
    login_in: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    user = await _authenticate_user(db, login_in.email, login_in.password)
    access_token = create_access_token(_access_token_payload(user))
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=await _serialize_user(user, db),
    )


@router.post("/forgot-password", response_model=ForgotPasswordResponse, status_code=status.HTTP_200_OK)
async def forgot_password(
    payload: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    return ForgotPasswordResponse(message=await _request_password_reset(db, payload.email))


@router.post("/reset-password", response_model=MessageResponse, status_code=status.HTTP_200_OK)
async def reset_password(
    payload: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    return MessageResponse(
        message=await _reset_password(
            db,
            email=payload.email,
            verification_code=payload.verification_code,
            new_password=payload.new_password,
        )
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    _current_user: dict = Depends(get_current_user),
):
    return None


@router.get("/me", response_model=UserOut)
async def get_profile(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user.get("sub")
    user = await _user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return await _serialize_user(user, db)
