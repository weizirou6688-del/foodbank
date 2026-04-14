from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.config import settings


pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def _encode_token(
    data: dict,
    *,
    token_type: str,
    default_expires: timedelta,
    expires_delta: Optional[timedelta] = None,
) -> str:
    to_encode = data.copy()
    to_encode.update(
        {
            "exp": datetime.now(timezone.utc) + (expires_delta or default_expires),
            "type": token_type,
        }
    )
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    return _encode_token(
        data,
        token_type="access",
        default_expires=timedelta(minutes=settings.access_token_expire_minutes),
        expires_delta=expires_delta,
    )


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm],
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


security = HTTPBearer(description="Bearer token in Authorization header")
optional_security = HTTPBearer(
    auto_error=False,
    description="Optional bearer token in Authorization header",
)


def _validate_access_payload(payload: dict) -> dict:
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


def _user_from_credentials(credentials: HTTPAuthorizationCredentials) -> dict:
    return _validate_access_payload(decode_token(credentials.credentials))


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    return _user_from_credentials(credentials)


async def get_optional_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_security),
) -> dict | None:
    if credentials is None:
        return None
    return _user_from_credentials(credentials)


def get_admin_food_bank_id(current_user: dict | None) -> int | None:
    if not isinstance(current_user, dict):
        return None

    raw_value = current_user.get("food_bank_id")
    if raw_value in (None, ""):
        return None

    try:
        return int(raw_value)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid food bank scope in token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def is_local_food_bank_admin(current_user: dict | None) -> bool:
    return (
        isinstance(current_user, dict)
        and current_user.get("role") == "admin"
        and get_admin_food_bank_id(current_user) is not None
    )


def enforce_admin_food_bank_scope(
    current_user: dict,
    food_bank_id: int | None,
    *,
    allow_platform_records: bool = False,
    detail: str = "You do not have access to this food bank scope",
) -> None:
    admin_food_bank_id = get_admin_food_bank_id(current_user)
    if admin_food_bank_id is None:
        return

    if food_bank_id is None:
        if allow_platform_records:
            return
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )

    if int(food_bank_id) != admin_food_bank_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )


async def require_admin(
    current_user: dict = Depends(get_current_user),
) -> dict:
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user


async def require_platform_admin(
    current_user: dict = Depends(require_admin),
) -> dict:
    if is_local_food_bank_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform admin privileges required",
        )
    return current_user


async def require_admin_or_supermarket(
    current_user: dict = Depends(get_current_user),
) -> dict:
    if current_user.get("role") not in {"admin", "supermarket"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff privileges required",
        )
    return current_user


async def require_supermarket(
    current_user: dict = Depends(get_current_user),
) -> dict:
    if current_user.get("role") != "supermarket":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Supermarket privileges required",
        )
    return current_user
