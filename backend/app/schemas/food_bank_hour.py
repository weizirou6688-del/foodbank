"""
Pydantic schemas for FoodBankHour entity validation and serialization.

These schemas handle:
- FoodBankHourCreate: Specifies food_bank_id, day, open_time, close_time.
- FoodBankHourUpdate: Allows updating day name or times (all fields optional).
- FoodBankHourOut: Response includes hour record ID for API responses.

Time fields use Python time type for 24-hour format (e.g., 09:30:00).
"""

from datetime import time

from pydantic import BaseModel, ConfigDict, Field


# Common fields for operating hours creation and responses.
class FoodBankHourBase(BaseModel):
    # From spec: food_bank_id: INTEGER, NOT NULL
    # Reference to which food bank this hour record belongs to.
    # Validation: gt=0 ensures positive ID (auto-increment never 0).
    food_bank_id: int = Field(gt=0)

    # From spec: day_of_week: VARCHAR(20), NOT NULL
    # Day name (e.g., "Monday", "Tuesday").
    # Validation: 1-20 characters (accommodates localized day names).
    day_of_week: str = Field(min_length=1, max_length=20)

    # From spec: open_time: TIME, NOT NULL
    # Opening time in 24-hour format (e.g., datetime.time(9, 0)).
    open_time: time

    # From spec: close_time: TIME, NOT NULL
    # Closing time in 24-hour format (e.g., datetime.time(17, 0)).
    close_time: time


# Schema for creating food bank hours.
class FoodBankHourCreate(FoodBankHourBase):
    # Inherits all fields from FoodBankHourBase.
    # ID auto-generated; created hours always reference an existing food bank.
    pass


# Schema for updating food bank hours.
class FoodBankHourUpdate(BaseModel):
    # All fields optional for granular updates.
    # E.g., can update hours without changing the day name.

    day_of_week: str | None = Field(default=None, min_length=1, max_length=20)
    open_time: time | None = None
    close_time: time | None = None


# Schema for API responses (reading hours data).
class FoodBankHourOut(FoodBankHourBase):
    # ConfigDict(from_attributes=True) enables conversion from ORM FoodBankHour model.
    model_config = ConfigDict(from_attributes=True)

    # From spec: id: SERIAL (PK)
    # Included in response so client can reference this specific hour record.
    id: int
