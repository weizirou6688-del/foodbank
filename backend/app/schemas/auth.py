import re

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.user import UserOut


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


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


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    message: str


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    verification_code: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("verification_code")
    @classmethod
    def validate_verification_code(cls, value: str) -> str:
        if not value.isdigit():
            raise ValueError("Verification code must contain exactly 6 digits.")
        return value

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        if not _is_strong_password(value):
            raise ValueError(
                "Password must include English letters, numbers, and special characters, "
                "and must not contain spaces."
            )
        return value


class MessageResponse(BaseModel):
    message: str
