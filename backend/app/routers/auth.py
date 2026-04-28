"""认证相关路由。

登录 / 注册 / 登出 / 重置密码 / 刷新 token。
具体校验规则放在 services 和 core/security 里,这里只做请求转发。

注意:重置密码走的是 verification code,不直接发新密码。
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.db_utils import fetch_one_or_none
from app.core.security import (
    create_access_token,
    get_current_user,
    get_password_hash,
    verify_password,
)
from app.models.food_bank import FoodBank
from app.models.user import User
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


router = APIRouter(tags=["Authentication"])


async def _get_user_by_email(db: AsyncSession, email: str) -> User | None:
    return await fetch_one_or_none(db, select(User).where(User.email == email))


async def _user_by_id(db: AsyncSession, user_id: str) -> User | None:
    return await fetch_one_or_none(db, select(User).where(User.id == user_id))


def _build_access_token_payload(user: User) -> dict[str, str | int | None]:
    return {"sub": str(user.id), "role": user.role, "food_bank_id": user.food_bank_id}


async def _serialize_user(user: User, db: AsyncSession) -> UserOut:
    # 顺手带一份 food bank name,省掉前端再请求一次
    return UserOut.model_validate(
        {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "food_bank_id": user.food_bank_id,
            "food_bank_name": (
                await db.scalar(select(FoodBank.name).where(FoodBank.id == user.food_bank_id))
                if user.food_bank_id is not None
                else None
            ),
            "created_at": user.created_at,
            "updated_at": user.updated_at,
        }
    )


async def _register_user(db: AsyncSession, user_in: UserCreate) -> User:
    existing_user = await _get_user_by_email(db, user_in.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        name=user_in.name,
        email=user_in.email,
        password_hash=get_password_hash(user_in.password),
        role="public",
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def _authenticate_user(db: AsyncSession, email: str, password: str) -> User:
    user = await _get_user_by_email(db, email)
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return user


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
    # token payload 故意保持很小;更详细的字段还是走 DB 拉的 profile 响应
    access_token = create_access_token(_build_access_token_payload(user))
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
