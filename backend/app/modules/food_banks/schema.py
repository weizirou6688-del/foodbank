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
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, condecimal


# Latitude/Longitude coordinate with precision DECIMAL(9,6)
# max_digits=9: total significant digits (e.g., 51.123456 = 2+6 = 8 digits)
# decimal_places=6: digits after decimal point (~0.111 meters precision)
Coordinate = Annotated[Decimal, condecimal(max_digits=9, decimal_places=6)]


# Common fields for food bank creation and responses.
class FoodBankBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    address: str = Field(min_length=1)
    lat: Coordinate
    lng: Coordinate


class FoodBankCreate(FoodBankBase):
    pass


class FoodBankUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    address: str | None = Field(default=None, min_length=1)
    lat: Decimal | None = None
    lng: Decimal | None = None


class FoodBankOut(FoodBankBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


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
