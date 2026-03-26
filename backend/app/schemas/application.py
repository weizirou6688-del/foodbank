"""
Pydantic schemas for Application entity validation and serialization.

These schemas handle:
- ApplicationCreate: Client submits food_bank_id, week_start, total_quantity.
  Redemption code generated server-side; user_id from auth context.
- ApplicationUpdate: Admin updates status (pending->collected/expired) or regenerates code.
- ApplicationOut: Response includes all application details with timestamps.

Redemption code format enforced: 'FB-' + 6 alphanumeric characters (per spec).
Status lifecycle: pending -> collected (or expired).
Week start enforces business rule: max 3 packages per user per week.
"""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


# ==================== INNER PAYLOADS ====================
# Used only in ApplicationCreate to specify package items
class ApplicationItemCreatePayload(BaseModel):
    """Inner payload: specifies which package and quantity in an application."""
    # From spec § 1.8: package_id and quantity per selected package
    package_id: int = Field(gt=0, description="Package ID to apply for")
    quantity: int = Field(ge=1, description="Number of this package requested")


# Common fields for application responses and base data.
class ApplicationBase(BaseModel):
    # From spec: user_id: UUID, NOT NULL, FK -> users.id
    # User submitting the application. Typically set from auth context, not client input.
    user_id: uuid.UUID

    # From spec: food_bank_id: INTEGER, NOT NULL, FK -> food_banks.id
    # Food bank location applying to. Validation: gt=0 (positive ID).
    food_bank_id: int = Field(gt=0)

    # From spec: redemption_code: VARCHAR(20), NOT NULL, UNIQUE
    # Format: 'FB-' + 6 alphanumeric chars (per spec § 3 Business Rules).
    # Regex: r'^FB-[A-Za-z0-9]{6}$' enforces format.
    # Usually generated server-side; included here for full repr.
    redemption_code: str = Field(pattern=r"^FB-[A-Za-z0-9]{6}$", max_length=20)

    # From spec: status: VARCHAR(20), NOT NULL, DEFAULT 'pending'
    # Lifecycle: pending (submitted) -> collected (redeemed) or expired (stale).
    # Regex enforces one of three allowed values.
    status: str = Field(default="pending", pattern="^(pending|collected|expired)$")

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
    total_quantity: int = Field(ge=1)


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
    # Admin marks application as collected or expired.
    # Regex enforces one of three allowed values.
    status: str | None = Field(default=None, pattern="^(pending|collected|expired)$")

    # From spec: redemption_code: VARCHAR(20), UNIQUE
    # Admin can regenerate code if original lost/damaged.
    # Regex enforces format.
    redemption_code: str | None = Field(default=None, pattern=r"^FB-[A-Za-z0-9]{6}$", max_length=20)


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

    # Soft-delete field: null if active, timestamp if soft-deleted.
    deleted_at: datetime | None = None
