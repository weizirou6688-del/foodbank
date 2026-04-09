"""
Pydantic schemas for Application entity validation and serialization.

These schemas handle:
- ApplicationCreate: Client submits food_bank_id, week_start, total_quantity.
  Redemption code generated server-side; user_id from auth context.
- ApplicationUpdate: Admin updates status (pending->collected/expired) or regenerates code.
- ApplicationOut: Response includes all application details with timestamps.

Redemption codes are normalized to the primary 4-4 format while still accepting
older demo values during validation.
Status lifecycle: pending -> collected (or expired).
Week start enforces business rule: max 3 packages per user per week.
"""

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.redemption_codes import (
    SUPPORTED_REDEMPTION_CODE_PATTERN,
    normalize_redemption_code,
)


ApplicationStatus = Literal["pending", "collected", "expired"]
APPLICATION_REDEMPTION_CODE_PATTERN = SUPPORTED_REDEMPTION_CODE_PATTERN


# ==================== INNER PAYLOADS ====================
# Used only in ApplicationCreate to specify package items
class ApplicationItemCreatePayload(BaseModel):
    """Inner payload: specifies which package and quantity in an application."""
    # One payload row can target either a package or an inventory item.
    package_id: int | None = Field(default=None, gt=0, description="Package ID to apply for")
    inventory_item_id: int | None = Field(default=None, gt=0, description="Inventory item ID to apply for directly")
    quantity: int = Field(ge=1, description="Number of this package requested")

    @model_validator(mode="after")
    def validate_target(self) -> "ApplicationItemCreatePayload":
        has_package = self.package_id is not None
        has_inventory_item = self.inventory_item_id is not None

        if has_package == has_inventory_item:
            raise ValueError("Exactly one of package_id or inventory_item_id must be provided")

        return self


# Common fields for application responses and base data.
class ApplicationBase(BaseModel):
    # From spec: user_id: UUID, NOT NULL, FK -> users.id
    # User submitting the application. Typically set from auth context, not client input.
    user_id: uuid.UUID

    # From spec: food_bank_id: INTEGER, NOT NULL, FK -> food_banks.id
    # Food bank location applying to. Validation: gt=0 (positive ID).
    food_bank_id: int = Field(gt=0)

    # From spec: redemption_code: VARCHAR(20), NOT NULL, UNIQUE
    # Local UX uses a 4-4 collection code such as ABCD-EFGH.
    # Older demo values are normalized into that format when possible.
    # Usually generated server-side; included here for full repr.
    redemption_code: str = Field(
        pattern=APPLICATION_REDEMPTION_CODE_PATTERN,
        max_length=20,
    )

    @field_validator("redemption_code", mode="before")
    @classmethod
    def normalize_redemption_code(cls, value: object) -> object:
        if isinstance(value, str):
            return normalize_redemption_code(value)
        return value

    # From spec: status: VARCHAR(20), NOT NULL, DEFAULT 'pending'
    # Lifecycle: pending -> collected | expired.
    status: ApplicationStatus = "pending"

    # From spec § 1.8: week_start: DATE, NOT NULL
    # Start date of the week when application was submitted.
    # Used to enforce weekly limit: max 3 packages per user per week.
    # Pydantic automatically validates date format (YYYY-MM-DD).
    week_start: date = Field(
        description="Week start date in YYYY-MM-DD format"
    )

    # From spec: total_quantity: INTEGER, NOT NULL
    # Total number of packages in application. Validation: ge=1 (at least 1).
    # Used for reporting and weekly limit enforcement.
    total_quantity: int = Field(ge=0)


# Schema for creating applications (clients submitting requests).
class ApplicationCreate(BaseModel):
    # Note: user_id NOT included here; taken from auth context server-side.
    # Redemption code generated server-side after validation.
    # total_quantity computed from items server-side.

    # From spec: food_bank_id: INTEGER, NOT NULL
    # Client specifies which food bank they're applying to.
    food_bank_id: int = Field(gt=0)

    # From spec § 1.8: week_start: DATE, NOT NULL
    # Client specifies the week start date (or server generates from current week).
    # If not provided, server will generate from current date (Monday of current week).
    week_start: date | None = Field(
        default=None,
        description="Week start date in YYYY-MM-DD format (e.g., 2026-03-17). If not provided, uses Monday of current week"
    )

    # From spec § 1.8: application_items — client submits which packages & quantities.
    # Service layer validates weekly limit, stock availability, and deducts atomically.
    items: list[ApplicationItemCreatePayload] = Field(
        min_length=1,
        description="List of packages (package_id + quantity) to apply for"
    )


# Schema for updating applications (admin status/code changes).
class ApplicationUpdate(BaseModel):
    # All fields optional; typically admins update status or regenerate code.

    # From spec: status: VARCHAR(20)
    # Admin updates application status within supported lifecycle states.
    status: ApplicationStatus | None = None

    # From spec: redemption_code: VARCHAR(20), UNIQUE
    # Admin can regenerate code if original lost/damaged.
    # Input is normalized to the canonical 4-4 display format when possible.
    redemption_code: str | None = Field(
        default=None,
        pattern=APPLICATION_REDEMPTION_CODE_PATTERN,
        max_length=20,
    )

    @field_validator("redemption_code", mode="before")
    @classmethod
    def normalize_redemption_code(cls, value: object) -> object:
        if isinstance(value, str):
            return normalize_redemption_code(value)
        return value

    # Admin approval/rejection comment.
    admin_comment: str | None = None


# Schema for API responses (reading application data).
class ApplicationOut(ApplicationBase):
    # ConfigDict(from_attributes=True) enables conversion from ORM Application model.
    model_config = ConfigDict(from_attributes=True)

    # From spec: id: UUID (PK)
    # Included in response so client knows the application's system ID.
    id: uuid.UUID

    # From spec: created_at: TIMESTAMP, NOT NULL, DEFAULT NOW()
    # Audit field: when application was submitted.
    created_at: datetime

    # Audit field: when application was last updated.
    updated_at: datetime

    redeemed_at: datetime | None = None

    # Soft-delete field: null if active, timestamp if soft-deleted.
    deleted_at: datetime | None = None


class ApplicationAdminItemOut(BaseModel):
    id: int
    package_id: int | None = None
    inventory_item_id: int | None = None
    name: str
    quantity: int


class ApplicationAdminRecordOut(ApplicationOut):
    items: list[ApplicationAdminItemOut] = Field(default_factory=list)
    package_name: str | None = None
    is_voided: bool = False
    voided_at: datetime | None = None


class ApplicationListResponse(BaseModel):
    # TODO: 实现真实分页
    items: list[ApplicationOut]
    total: int
    page: int
    size: int
    pages: int


class ApplicationAdminListResponse(BaseModel):
    items: list[ApplicationAdminRecordOut]
    total: int
    page: int
    size: int
    pages: int
