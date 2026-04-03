"""
Pydantic schemas for DonationCash entity validation and serialization.

These schemas handle:
- DonationCashCreate: Accepts donor email, amount (pence), payment reference.
  Status defaults to 'completed' (successful transaction).
- DonationCashUpdate: Allow status/payment_reference updates (e.g., tracking refunds).
- DonationCashOut: Response including donation ID and timestamp.

Amount stored in pence (integer) to avoid floating-point precision issues.
No user authentication required (anonymous donations allowed).
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


DONATION_DONOR_TYPE_PATTERN = "^(supermarket|individual|organization)$"


# Common fields for cash donation creation and responses.
class DonationCashBase(BaseModel):
    # Optional donor name captured from checkout/contact form.
    # Nullable to preserve support for anonymous/offline donations.
    donor_name: str | None = Field(default=None, min_length=1, max_length=100)

    donor_type: str | None = Field(default=None, pattern=DONATION_DONOR_TYPE_PATTERN)

    # From spec: donor_email: VARCHAR(255), NOT NULL
    # Donor email for receipt and contact. Validated as EmailStr per RFC 5332.
    donor_email: EmailStr

    # From spec: amount_pence: INTEGER, NOT NULL
    # Amount in pence (1/100 currency unit) to avoid float precision issues.
    # E.g., £10.50 = 1050 pence. Validation: ge=1 (at least 1 pence).
    amount_pence: int = Field(ge=1)

    # From spec: payment_reference: VARCHAR(100)
    # External payment processor ID (e.g., Stripe transaction).
    # Nullable for offline/manual donations. Validation: max 100 chars.
    payment_reference: str | None = Field(default=None, max_length=100)

    # From spec: status: VARCHAR(20), NOT NULL, DEFAULT 'completed'
    # Donation state: completed (success), failed (declined), refunded (later).
    # Regex enforces one of three allowed values.
    status: str = Field(default="completed", pattern="^(completed|failed|refunded)$")


# Schema for creating cash donations.
class DonationCashCreate(BaseModel):
    # Typically called from payment processor webhook or form submission.
    # Does NOT require user authentication (anonymous donations allowed).

    # Optional donor name captured from the payment/contact form.
    donor_name: str | None = Field(default=None, min_length=1, max_length=100)

    donor_type: str | None = Field(default=None, pattern=DONATION_DONOR_TYPE_PATTERN)

    # From spec: donor_email: VARCHAR(255), NOT NULL
    # Donor email for receipt.
    donor_email: EmailStr

    # From spec: amount_pence: INTEGER, NOT NULL
    # Amount in pence. Validation: ge=1.
    amount_pence: int = Field(ge=1)

    # From spec: payment_reference: VARCHAR(100)
    # External payment processor ID (optional for offline donations).
    payment_reference: str | None = Field(default=None, max_length=100)

    # Note: status intentionally omitted from Create; defaults to 'completed'
    # server-side. Allows separate update if transaction fails post-creation.


# Schema for updating cash donations.
class DonationCashUpdate(BaseModel):
    # Typically used for post-donation status changes (failed, refunded).
    # All fields optional for flexibility.

    donor_name: str | None = Field(default=None, min_length=1, max_length=100)

    donor_type: str | None = Field(default=None, pattern=DONATION_DONOR_TYPE_PATTERN)

    donor_email: EmailStr | None = None

    amount_pence: int | None = Field(default=None, ge=1)

    # From spec: payment_reference: VARCHAR(100)
    # Can update if linking to external processor later.
    payment_reference: str | None = Field(default=None, max_length=100)

    # From spec: status: VARCHAR(20)
    # Admin updates status if transaction failed or was refunded post-donation.
    status: str | None = Field(default=None, pattern="^(completed|failed|refunded)$")


# Schema for API responses (reading donation data).
class DonationCashOut(DonationCashBase):
    # ConfigDict(from_attributes=True) enables conversion from ORM DonationCash model.
    model_config = ConfigDict(from_attributes=True)

    # From spec: id: UUID (PK)
    # Included in response so donor/admin can reference this donation.
    id: uuid.UUID

    # From spec: created_at: TIMESTAMP, NOT NULL, DEFAULT NOW()
    # Audit field: when donation was recorded in system.
    created_at: datetime
