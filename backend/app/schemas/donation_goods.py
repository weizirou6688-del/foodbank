import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.core.goods_donation_format import (
    format_goods_pickup_date,
    normalize_goods_donor_phone,
)


DONATION_DONOR_TYPE_PATTERN = "^(supermarket|individual|organization)$"


class GoodsDonationFieldValidationModel(BaseModel):
    @field_validator("donor_phone", mode="before", check_fields=False)
    @classmethod
    def validate_donor_phone(cls, value):
        field = cls.model_fields.get("donor_phone")
        required = bool(field and field.is_required())
        return normalize_goods_donor_phone(value, required=required)

    @field_validator("pickup_date", mode="before", check_fields=False)
    @classmethod
    def validate_pickup_date(cls, value):
        return format_goods_pickup_date(value)


class DonationGoodsItemCreatePayload(BaseModel):
    item_name: str = Field(
        min_length=1,
        max_length=200,
        description="Name of donated food item (e.g., 'Tinned Beans')",
    )
    quantity: int = Field(ge=1, description="Quantity of this item donated")
    expiry_date: date | None = None


class DonationGoodsItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    donation_id: uuid.UUID
    item_name: str = Field(min_length=1, max_length=200)
    quantity: int = Field(ge=1)
    expiry_date: date | None = None


class SupermarketDonationItemPayload(BaseModel):
    inventory_item_id: int | None = Field(default=None, gt=0)
    item_name: str | None = Field(default=None, min_length=1, max_length=200)
    quantity: int = Field(ge=1)
    expiry_date: date | None = None

    @model_validator(mode="after")
    def validate_inventory_target(self):
        if self.inventory_item_id is None and not self.item_name:
            raise ValueError("Either inventory_item_id or item_name is required")
        return self


class SupermarketDonationCreate(GoodsDonationFieldValidationModel):
    items: list[SupermarketDonationItemPayload] = Field(min_length=1)
    donor_phone: str | None = Field(default=None, min_length=11, max_length=11, pattern=r"^\d{11}$")
    pickup_date: str | None = Field(default=None, min_length=10, max_length=10, pattern=r"^\d{2}/\d{2}/\d{4}$")
    notes: str | None = None


class DonationGoodsStoredBase(GoodsDonationFieldValidationModel):
    donor_user_id: uuid.UUID | None = None
    food_bank_id: int | None = Field(default=None, gt=0)
    food_bank_name: str | None = Field(default=None, min_length=1, max_length=200)
    food_bank_address: str | None = Field(default=None, min_length=1)
    donor_name: str = Field(min_length=1, max_length=100)
    donor_type: str | None = Field(default=None, pattern=DONATION_DONOR_TYPE_PATTERN)
    donor_email: EmailStr
    donor_phone: str = Field(min_length=11, max_length=11, pattern=r"^\d{11}$")
    postcode: str | None = Field(default=None, min_length=2, max_length=16)
    pickup_date: str | None = Field(default=None, min_length=10, max_length=10, pattern=r"^\d{2}/\d{2}/\d{4}$")
    item_condition: str | None = Field(default=None, min_length=1, max_length=50)
    estimated_quantity: str | None = Field(default=None, min_length=1, max_length=100)
    notes: str | None = None
    status: str = Field(default="pending", pattern="^(pending|received|rejected)$")


class DonationGoodsCreate(DonationGoodsStoredBase):
    food_bank_email: str | None = Field(default=None, min_length=3, max_length=255)
    items: list[DonationGoodsItemCreatePayload] = Field(
        min_length=1,
        description="List of food items donated (item_name + quantity)",
    )
    status: str | None = Field(default=None, pattern="^(pending|received|rejected)$")


class DonationGoodsUpdate(GoodsDonationFieldValidationModel):
    donor_name: str | None = Field(default=None, min_length=1, max_length=100)
    donor_type: str | None = Field(default=None, pattern=DONATION_DONOR_TYPE_PATTERN)
    donor_email: EmailStr | None = None
    donor_phone: str | None = Field(default=None, min_length=11, max_length=11, pattern=r"^\d{11}$")
    food_bank_id: int | None = Field(default=None, gt=0)
    food_bank_name: str | None = Field(default=None, min_length=1, max_length=200)
    food_bank_address: str | None = Field(default=None, min_length=1)
    postcode: str | None = Field(default=None, min_length=2, max_length=16)
    pickup_date: str | None = Field(default=None, min_length=10, max_length=10, pattern=r"^\d{2}/\d{2}/\d{4}$")
    item_condition: str | None = Field(default=None, min_length=1, max_length=50)
    estimated_quantity: str | None = Field(default=None, min_length=1, max_length=100)
    notes: str | None = None
    status: str | None = Field(default=None, pattern="^(pending|received|rejected)$")
    items: list[DonationGoodsItemCreatePayload] | None = Field(default=None, min_length=1)


class DonationGoodsOut(DonationGoodsStoredBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    created_at: datetime
    items: list[DonationGoodsItemOut] = Field(default_factory=list)
