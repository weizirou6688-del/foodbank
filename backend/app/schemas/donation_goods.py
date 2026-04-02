"""
Pydantic schemas for DonationGoods entity validation and serialization.

These schemas handle:
- DonationGoodsCreate: Accepts donor info and optional user association.
  Status defaults to 'pending' (awaiting review).
- DonationGoodsUpdate: Allows status changes (pending->received/rejected) and contact updates.
- DonationGoodsOut: Response including donation ID and timestamp.

Donor can be registered user (donor_user_id set) or anonymous (NULL).
Donor contact info always captured for follow-up communication.
"""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.donation_goods_item import DonationGoodsItemOut


# ==================== INNER PAYLOADS ====================
# Used only in DonationGoodsCreate to specify donation items
class DonationGoodsItemCreatePayload(BaseModel):
    """Inner payload: specifies each item type and quantity in goods donation."""
    # From spec § 1.11: item_name and quantity per donated item
    item_name: str = Field(
        min_length=1, max_length=200,
        description="Name of donated food item (e.g., 'Tinned Beans')"
    )
    quantity: int = Field(ge=1, description="Quantity of this item donated")


# Common fields for goods donation creation and responses.
class DonationGoodsBase(BaseModel):
    # From spec: donor_user_id: UUID, FK -> users.id, NULLABLE
    # If set, links donation to registered user (for reputation/gamification).
    # If NULL, donation is anonymous. Optional.
    donor_user_id: uuid.UUID | None = None

    food_bank_id: int | None = Field(default=None, gt=0)
    food_bank_name: str | None = Field(default=None, min_length=1, max_length=200)
    food_bank_address: str | None = Field(default=None, min_length=1)

    # From spec: donor_name: VARCHAR(100), NOT NULL
    # Donor name (required even if user NULL, for thank-you/follow-up).
    # Validation: 1-100 characters.
    donor_name: str = Field(min_length=1, max_length=100)

    # From spec: donor_email: VARCHAR(255), NOT NULL
    # Donor email for receipt and follow-up. Validated as EmailStr.
    donor_email: EmailStr

    # From spec: donor_phone: VARCHAR(30), NOT NULL
    # Donor phone for follow-up if donation rejected. Validation: 3-30 chars.
    donor_phone: str = Field(min_length=3, max_length=30)

    postcode: str | None = Field(default=None, min_length=2, max_length=16)

    pickup_date: date | None = None

    item_condition: str | None = Field(default=None, min_length=1, max_length=50)

    estimated_quantity: str | None = Field(default=None, min_length=1, max_length=100)

    # From spec: notes: TEXT
    # Optional donation notes (special handling, storage, dietary restrictions).
    notes: str | None = None

    # From spec: status: VARCHAR(20), NOT NULL, DEFAULT 'pending'
    # Processing state: pending (review), received (accepted), rejected (not usable).
    # Regex enforces one of three allowed values.
    status: str = Field(default="pending", pattern="^(pending|received|rejected)$")


# Schema for creating goods donations.
class DonationGoodsCreate(BaseModel):
    # Typically called from donation submission form (user or staff entering data).
    # Does NOT require authentication (anonymous donations allowed).

    # From spec: donor_user_id: UUID, FK -> users.id, NULLABLE
    # Optional: if logged in, user ID captured; else NULL for anonymous.
    donor_user_id: uuid.UUID | None = None

    food_bank_id: int | None = Field(default=None, gt=0)
    food_bank_name: str | None = Field(default=None, min_length=1, max_length=200)
    food_bank_address: str | None = Field(default=None, min_length=1)

    # From spec: donor_name: VARCHAR(100), NOT NULL
    # Donor name (required regardless of user authentication).
    donor_name: str = Field(min_length=1, max_length=100)

    # From spec: donor_email: VARCHAR(255), NOT NULL
    # Donor email for receipt.
    donor_email: EmailStr

    # From spec: donor_phone: VARCHAR(30), NOT NULL
    # Donor phone for follow-up.
    donor_phone: str = Field(min_length=3, max_length=30)

    postcode: str | None = Field(default=None, min_length=2, max_length=16)

    pickup_date: date | None = None

    item_condition: str | None = Field(default=None, min_length=1, max_length=50)

    estimated_quantity: str | None = Field(default=None, min_length=1, max_length=100)

    # From spec: notes: TEXT
    # Optional donation notes.
    notes: str | None = None

    # From spec § 1.11: donation_goods_items — client submits item list.
    # Service layer writes both donations_goods and donation_goods_items atomically.
    items: list[DonationGoodsItemCreatePayload] = Field(
        min_length=1,
        description="List of food items donated (item_name + quantity)"
    )

    # Note: status intentionally omitted; defaults to 'pending' server-side.


# Schema for updating goods donations.
class DonationGoodsUpdate(BaseModel):
    # Used primarily by admins: accepting/rejecting donations, updating contact info.
    # All fields optional for flexibility.

    # From spec: donor_name: VARCHAR(100)
    # Can update if incorrectly entered initially.
    donor_name: str | None = Field(default=None, min_length=1, max_length=100)

    # From spec: donor_email: VARCHAR(255)
    # Can update if contact info needs correction.
    donor_email: EmailStr | None = None

    # From spec: donor_phone: VARCHAR(30)
    # Can update if phone was incorrect.
    donor_phone: str | None = Field(default=None, min_length=3, max_length=30)

    food_bank_id: int | None = Field(default=None, gt=0)
    food_bank_name: str | None = Field(default=None, min_length=1, max_length=200)
    food_bank_address: str | None = Field(default=None, min_length=1)

    postcode: str | None = Field(default=None, min_length=2, max_length=16)

    pickup_date: date | None = None

    item_condition: str | None = Field(default=None, min_length=1, max_length=50)

    estimated_quantity: str | None = Field(default=None, min_length=1, max_length=100)

    # From spec: notes: TEXT
    # Can add/update storage or special handling notes.
    notes: str | None = None

    # From spec: status: VARCHAR(20)
    # Admin changes status: pending -> received (accepted) or rejected.
    status: str | None = Field(default=None, pattern="^(pending|received|rejected)$")


# Schema for API responses (reading donation data).
class DonationGoodsOut(DonationGoodsBase):
    # ConfigDict(from_attributes=True) enables conversion from ORM DonationGoods model.
    model_config = ConfigDict(from_attributes=True)

    # From spec: id: UUID (PK)
    # Included in response so donor/admin can reference this donation.
    id: uuid.UUID

    # From spec: created_at: TIMESTAMP, NOT NULL, DEFAULT NOW()
    # Audit field: when donation was submitted.
    created_at: datetime

    # Includes item rows stored in donation_goods_items so API responses reflect
    # the persisted donation contents end-to-end.
    items: list[DonationGoodsItemOut] = Field(default_factory=list)
