import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


DONATION_DONOR_TYPE_PATTERN = "^(supermarket|individual|organization)$"
DONATION_FREQUENCY_PATTERN = "^(one_time|monthly)$"
CARD_LAST4_PATTERN = "^\\d{4}$"


class DonationCashBase(BaseModel):
    donor_name: str | None = Field(default=None, min_length=1, max_length=100)
    donor_type: str | None = Field(default=None, pattern=DONATION_DONOR_TYPE_PATTERN)
    food_bank_id: int | None = Field(default=None, gt=0)
    donor_email: EmailStr
    amount_pence: int = Field(ge=1)
    donation_frequency: str = Field(default="one_time", pattern=DONATION_FREQUENCY_PATTERN)
    payment_reference: str | None = Field(default=None, max_length=100)
    subscription_reference: str | None = Field(default=None, max_length=100)
    card_last4: str | None = Field(default=None, pattern=CARD_LAST4_PATTERN)
    next_charge_date: date | None = None
    status: str = Field(default="completed", pattern="^(completed|failed|refunded)$")

    @field_validator("donation_frequency", mode="before")
    @classmethod
    def _default_donation_frequency(cls, value: str | None) -> str:
        return value or "one_time"


class DonationCashCreate(BaseModel):
    donor_name: str | None = Field(default=None, min_length=1, max_length=100)
    donor_type: str | None = Field(default=None, pattern=DONATION_DONOR_TYPE_PATTERN)
    food_bank_id: int | None = Field(default=None, gt=0)
    donor_email: EmailStr
    amount_pence: int = Field(ge=1)
    donation_frequency: str = Field(default="one_time", pattern=DONATION_FREQUENCY_PATTERN)
    payment_reference: str | None = Field(default=None, max_length=100)
    card_last4: str | None = Field(default=None, pattern=CARD_LAST4_PATTERN)

    # Note: status intentionally omitted from Create; defaults to 'completed'
    # server-side. Allows separate update if transaction fails post-creation.


class DonationCashOut(DonationCashBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    created_at: datetime
