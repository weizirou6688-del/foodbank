from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db_utils import fetch_one_or_none
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.food_bank import FoodBank
from app.models.user import User
from app.schemas.user import UserCreate, UserOut


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    return await fetch_one_or_none(db, select(User).where(User.email == email))


async def get_user_by_id(db: AsyncSession, user_id: str) -> User | None:
    return await fetch_one_or_none(db, select(User).where(User.id == user_id))


def build_access_token_payload(user: User) -> dict[str, str | int | None]:
    return {"sub": str(user.id), "role": user.role, "food_bank_id": user.food_bank_id}


async def serialize_user(user: User, db: AsyncSession) -> UserOut:
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


async def register_user(db: AsyncSession, user_in: UserCreate) -> User:
    existing_user = await get_user_by_email(db, user_in.email)
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


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User:
    user = await get_user_by_email(db, email)
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return user
