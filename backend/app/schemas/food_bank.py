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
    # From spec: name: VARCHAR(200), NOT NULL
    # Validation: 1-200 characters (non-empty, max 200).
    name: str = Field(min_length=1, max_length=200)

    # From spec: address: TEXT, NOT NULL
    # Validation: non-empty string (min_length=1).
    address: str = Field(min_length=1)

    # From spec: lat: DECIMAL(9,6), NOT NULL
    # Latitude coordinate for map display.  Coordinate type enforces precision.
    lat: Coordinate

    # From spec: lng: DECIMAL(9,6), NOT NULL
    # Longitude coordinate for map display. Coordinate type enforces precision.
    lng: Coordinate


# Schema for creating new food bank locations.
class FoodBankCreate(FoodBankBase):
    # Inherits all fields from FoodBankBase (name, address, lat, lng).
    # No additional fields for creation; id and created_at auto-generated.
    pass


# Schema for partial food bank updates.
class FoodBankUpdate(BaseModel):
    # All fields optional for granular updates.
    # E.g., can update address without re-submitting coordinates.

    name: str | None = Field(default=None, min_length=1, max_length=200)
    address: str | None = Field(default=None, min_length=1)
    lat: Decimal | None = None
    lng: Decimal | None = None


# Schema for API responses (reading food bank data).
class FoodBankOut(FoodBankBase):
    # ConfigDict(from_attributes=True) enables conversion from ORM FoodBank model.
    model_config = ConfigDict(from_attributes=True)

    # From spec: id: SERIAL (PK)
    # Included in response so client knows the location's system ID.
    id: int

    # From spec: created_at: TIMESTAMP, NOT NULL, DEFAULT NOW()
    # Audit field: returns when location was added to system.
    created_at: datetime


# Detailed food bank response with operating hours (for GET /food-banks/:id).
class FoodBankDetailOut(FoodBankOut):
    # Extends FoodBankOut with full opening hours list.
    # Imported locally to avoid circular dependency with food_bank_hour schema.
    
    # From spec § 2.2: opening hours belong to food bank detail endpoint.
    hours: list["FoodBankHourOut"] = Field(default_factory=list, description="Operating hours for this location")
    
    # Import FoodBankHourOut at module level after all classes defined
    model_config = ConfigDict(from_attributes=True)


# Resolve forward reference for FoodBankHourOut after both schemas imported
def _init_models() -> None:
    """Bind forward references after module loads."""
    try:
        from .food_bank_hour import FoodBankHourOut  # noqa: F401
        FoodBankDetailOut.model_rebuild()
    except ImportError:
        pass  # Optional: hours may be populated programmatically


_init_models()
