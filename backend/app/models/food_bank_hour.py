"""
FoodBankHour model representing operating hours for food bank locations.

From spec § 1 'food_bank_hours' table:
FoodBankHour records define the weekly opening and closing times for each food
bank location. One record per day of the week per food bank.
"""

from __future__ import annotations

from datetime import time

from sqlalchemy import ForeignKey, String, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class FoodBankHour(Base):
    __tablename__ = "food_bank_hours"

    # From spec: id: SERIAL (PK)
    # Auto-incrementing integer primary key.
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # From spec: food_bank_id: INTEGER, NOT NULL, FK -> food_banks.id
    # Foreign key to FoodBank. ondelete='CASCADE' ensures hours deleted
    # when associated food bank is deleted.
    # index=True added for quick lookup of hours by food bank.
    food_bank_id: Mapped[int] = mapped_column(
        ForeignKey("food_banks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # From spec: day_of_week: VARCHAR(20), NOT NULL
    # Day name (e.g., "Monday", "Tuesday", etc.).
    # VARCHAR(20) accommodates full day names and localization variants.
    day_of_week: Mapped[str] = mapped_column(String(20), nullable=False)

    # From spec: open_time: TIME, NOT NULL
    # Opening time in 24-hour format (e.g., 09:00:00).
    # TIME type (no timezone) stores local time for the food bank.
    open_time: Mapped[time] = mapped_column(Time, nullable=False)

    # From spec: close_time: TIME, NOT NULL
    # Closing time in 24-hour format (e.g., 17:00:00).
    close_time: Mapped[time] = mapped_column(Time, nullable=False)

    # Relationship: FoodBankHour -> FoodBank (many-to-one)
    # From spec § 2 "food_banks → food_bank_hours: one-to-many"
    # back_populates="hours" establishes bidirectional relationship.
    food_bank: Mapped["FoodBank"] = relationship(back_populates="hours")
