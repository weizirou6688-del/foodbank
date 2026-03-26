"""
Pydantic schemas for DonationGoodsItem junction validation and serialization.

These schemas handle:
- DonationGoodsItemCreate: Specifies item names and quantities in donation.
- DonationGoodsItemUpdate: Adjust item quantity or name if needed.
- DonationGoodsItemOut: Response with junction record ID.

DonationGoodsItem details individual items in a goods donation (many-to-many).
Unlike inventory items, donation items use free-form names for ad-hoc contributions.
"""

import uuid

from pydantic import BaseModel, ConfigDict, Field


# Common fields for donation item creation and responses.
class DonationGoodsItemBase(BaseModel):
    # From spec: donation_id: UUID, NOT NULL, FK -> donations_goods.id
    # Which donation contains this item.
    donation_id: uuid.UUID

    # From spec: item_name: VARCHAR(200), NOT NULL
    # Free-form name of donated item (e.g., "Tinned Beans", "Rice Bags").
    # Not constrained to inventory_items table (allows flexible donations).
    # Validation: 1-200 characters.
    item_name: str = Field(min_length=1, max_length=200)

    # From spec: quantity: INTEGER, NOT NULL
    # Quantity of the item donated. Validation: ge=1 (at least 1).
    quantity: int = Field(ge=1)


# Schema for adding items to donations.
class DonationGoodsItemCreate(DonationGoodsItemBase):
    # Inherits all fields from DonationGoodsItemBase.
    # ID auto-generated server-side.
    pass


# Schema for updating donation items.
class DonationGoodsItemUpdate(BaseModel):
    # All fields optional to allow correcting item details before processing.

    item_name: str | None = Field(default=None, min_length=1, max_length=200)
    quantity: int | None = Field(default=None, ge=1)


# Schema for API responses (reading donation item data).
class DonationGoodsItemOut(DonationGoodsItemBase):
    # ConfigDict(from_attributes=True) enables conversion from ORM DonationGoodsItem model.
    model_config = ConfigDict(from_attributes=True)

    # From spec: id: SERIAL (PK)
    # Included in response so references can target this item uniquely.
    id: int
