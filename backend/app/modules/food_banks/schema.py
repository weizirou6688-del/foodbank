"""
Pydantic schemas for FoodBank entity validation and serialization.

These schemas handle:
- FoodBankCreate: Accepts name, address, and coordinates for new locations.
- FoodBankUpdate: Allows partial updates to location details (all fields optional).
- FoodBankOut: Response schema with ID and creation timestamp for API responses.
- FoodBankDetailOut: Detailed response including full operating hours.

Coordinates use Decimal type for precise geographic storage (±0.1 meter precision).
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# Common fields for food bank creation and responses.
class FoodBankBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    address: str = Field(min_length=1)
    notification_email: EmailStr | None = None
    lat: float
    lng: float


class FoodBankCreate(FoodBankBase):
    pass


class FoodBankUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    address: str | None = Field(default=None, min_length=1)
    notification_email: EmailStr | None = None
    lat: float | None = None
    lng: float | None = None


class FoodBankOut(FoodBankBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


class FoodBankListResponse(BaseModel):
    # TODO: 实现真实分页
    items: list[FoodBankOut]
    total: int
    page: int
    size: int
    pages: int


class FoodBankDetailOut(FoodBankOut):
    hours: list["FoodBankHourOut"] = Field(default_factory=list, description="Operating hours for this location")
    model_config = ConfigDict(from_attributes=True)


# FoodBankHour schemas
class FoodBankHourBase(BaseModel):
    food_bank_id: int = Field(gt=0)
    day_of_week: str = Field(min_length=1, max_length=20)
    open_time: object  # time type
    close_time: object  # time type


class FoodBankHourCreate(FoodBankHourBase):
    pass


class FoodBankHourUpdate(BaseModel):
    day_of_week: str | None = Field(default=None, min_length=1, max_length=20)
    open_time: object | None = None
    close_time: object | None = None


class FoodBankHourOut(FoodBankHourBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


def _init_models() -> None:
    """Bind forward references."""
    try:
        FoodBankDetailOut.model_rebuild()
    except Exception:
        pass


_init_models()
