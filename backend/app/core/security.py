"""
Security utilities for password hashing and JWT token management.

Provides bcrypt password hashing, JWT token creation/verification,
and FastAPI dependency for extracting current user from Authorization header.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.config import settings


# ==================== PASSWORD HASHING ====================

# Bcrypt password hashing context
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)


def get_password_hash(password: str) -> str:
    """
    Hash a plaintext password using bcrypt.
    
    Args:
        password: Plaintext password to hash.
        
    Returns:
        Bcrypt hash string (includes salt, safe to store in DB).
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plaintext password against a bcrypt hash.
    
    Args:
        plain_password: Plaintext password from user input.
        hashed_password: Bcrypt hash from database.
        
    Returns:
        True if password matches, False otherwise.
    """
    return pwd_context.verify(plain_password, hashed_password)


# ==================== JWT TOKEN GENERATION ====================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.
    
    Args:
        data: Payload to encode (e.g., {"sub": user_id, "role": "public"}).
        expires_delta: Optional custom expiration delta. Defaults to ACCESS_TOKEN_EXPIRE_MINUTES.
        
    Returns:
        Signed JWT token string.
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.access_token_expire_minutes
        )
    
    to_encode.update({"exp": expire, "type": "access"})
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.secret_key,
        algorithm=settings.algorithm,
    )
    return encoded_jwt


def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT refresh token.
    
    Args:
        data: Payload to encode (e.g., {"sub": user_id}).
        expires_delta: Optional custom expiration delta. Defaults to REFRESH_TOKEN_EXPIRE_DAYS.
        
    Returns:
        Signed JWT token string.
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            days=settings.refresh_token_expire_days
        )
    
    to_encode.update({"exp": expire, "type": "refresh"})
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.secret_key,
        algorithm=settings.algorithm,
    )
    return encoded_jwt


# ==================== TOKEN VERIFICATION ====================

def decode_token(token: str) -> dict:
    """
    Decode and verify a JWT token.
    
    Args:
        token: JWT token string to decode.
        
    Returns:
        Decoded payload dict.
        
    Raises:
        HTTPException (401): If token is invalid, expired, or verification fails.
    """
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


# ==================== DEPENDENCY: GET CURRENT USER ====================

security = HTTPBearer(description="Bearer token in Authorization header")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    FastAPI dependency that extracts and validates the current user from JWT token.
    
    Reads the Authorization header (Expected: "Bearer <token>"), decodes the JWT,
    and returns the decoded payload. Use in route handlers:
    
        @app.get("/me")
        async def get_profile(current_user: dict = Depends(get_current_user)):
            user_id = current_user["sub"]
            ...
    
    Args:
        credentials: Extracted from HTTP Authorization header via HTTPBearer.
        
    Returns:
        Decoded JWT payload (contains "sub" as user_id, "role", etc.).
        
    Raises:
        HTTPException (401): If token is invalid or missing.
    """
    token = credentials.credentials
    payload = decode_token(token)
    
    # Verify this is an access token (not refresh)
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return payload


async def require_admin(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Dependency for admin-only routes.

    Raises 403 if authenticated user is not an admin.
    """
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user


async def require_admin_or_supermarket(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Dependency for staff routes that are available to admin and supermarket roles.
    """
    if current_user.get("role") not in {"admin", "supermarket"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff privileges required",
        )
    return current_user


async def require_supermarket(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Dependency for supermarket-only routes.
    """
    if current_user.get("role") != "supermarket":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Supermarket privileges required",
        )
    return current_user
