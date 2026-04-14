import re
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


def _is_strong_password(value: str) -> bool:
    if not re.search(r"[A-Za-z]", value):
        return False
    if not re.search(r"\d", value):
        return False
    if not re.search(r"[^A-Za-z0-9]", value):
        return False
    if re.search(r"\s", value):
        return False
    return True


class UserBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    role: str = Field(pattern="^(public|supermarket|admin)$")
    food_bank_id: int | None = None
    food_bank_name: str | None = None


class UserCreate(BaseModel):
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


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
