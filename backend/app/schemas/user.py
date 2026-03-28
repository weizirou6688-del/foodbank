"""
Pydantic schemas for User entity validation and serialization.

These schemas handle:
- UserCreate: Accepts name, email, role, and password for registration.
  Password validation enforces 8-128 chars; role limited to enum values.
- UserUpdate: Partial updates to user profile (all fields optional).
  Allows changing name, email, role, or password independently.
- UserOut: Response schema returned from API endpoints.
  Includes user ID, timestamps, but excludes password_hash (security).

All schemas use from_attributes=True to enable ORM model conversion.
EmailStr from pydantic validates email format.
Regex pattern enforces role constraint from spec § 1 (only public|supermarket|admin).
"""

import re
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


def _is_strong_password(value: str) -> bool:
  """Require English letters, numbers, and special characters (no spaces)."""
  if not re.search(r"[A-Za-z]", value):
    return False
  if not re.search(r"\d", value):
    return False
  if not re.search(r"[^A-Za-z0-9]", value):
    return False
  if re.search(r"\s", value):
    return False
  return True


# Base schema containing common user fields (name, email, role).
# Used as parent for Create and Out schemas to avoid duplication.
class UserBase(BaseModel):
    # From spec: name: VARCHAR(100), NOT NULL
    # Validation: 1-100 characters (non-empty, max 100).
    name: str = Field(min_length=1, max_length=100)

    # From spec: email: VARCHAR(255), NOT NULL, UNIQUE
    # Validation: EmailStr ensures valid email format per RFC 5332.
    email: EmailStr

    # From spec: role: VARCHAR(20), NOT NULL, CHECK(role IN ('public','supermarket','admin'))
    # Validation: Regex enforces exactly one of three allowed role values.
    role: str = Field(pattern="^(public|supermarket|admin)$")


# Schema for user registration / account creation.
class UserCreate(BaseModel):
    # Password field present only in Create schema (authentication).
    # Validation: 8-128 chars (reasonable for bcrypt + UI convenience).
    # Raw password sent here; service layer hashes before storage.
    # Note: role NOT accepted here; new users always created as 'public'.
    #       Admin/supermarket accounts created via separate authenticated endpoint.
    
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
      if not _is_strong_password(value):
        raise ValueError(
          "Password must include English letters, numbers, and special characters, "
          "and must not contain spaces."
        )
      return value


# Schema for partial user profile updates.
class UserUpdate(BaseModel):
    # All fields optional (None) to allow granular updates.
    # E.g., update only name without touching email or role.

    name: str | None = Field(default=None, min_length=1, max_length=100)
    email: EmailStr | None = None
    role: str | None = Field(default=None, pattern="^(public|supermarket|admin)$")
    password: str | None = Field(default=None, min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_optional_password_strength(cls, value: str | None) -> str | None:
      if value is None:
        return value
      if not _is_strong_password(value):
        raise ValueError(
          "Password must include English letters, numbers, and special characters, "
          "and must not contain spaces."
        )
      return value


# Schema for API responses (reading user data).
class UserOut(UserBase):
    # ConfigDict(from_attributes=True) enables conversion from ORM User model.
    # This is Pydantic v2 syntax (replaces orm_mode=True in v1).
    model_config = ConfigDict(from_attributes=True)

    # From spec: id: UUID (PK)
    # Included in response so client knows the user's system ID.
    id: uuid.UUID

    # From spec: created_at: TIMESTAMP, NOT NULL, DEFAULT NOW()
    # Audit field: returned for client-side record tracking.
    created_at: datetime

    # From spec: updated_at: TIMESTAMP, NOT NULL, DEFAULT NOW()
    # Audit field: returned for client-side caching/update detection.
    updated_at: datetime

    # Note: password_hash intentionally excluded (security best practice).
    # API never exposes password hashes to clients.
