"""
FoodBank model representing physical food bank locations.

From spec § 1 'food_banks' table:
FoodBank entities represent separate physical locations in the ABC Community
Food Bank network. Each location has an address, coordinates for mapping,
and operating hours. Food packages are associated with specific food banks.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Numeric, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class FoodBank(Base):
    __tablename__ = "food_banks"

    # From spec: id: SERIAL (PK)
    # Auto-incrementing integer primary key.
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # From spec: name: VARCHAR(200), NOT NULL
    # Food bank location name (e.g., "Main Distribution Center").
    name: Mapped[str] = mapped_column(String(200), nullable=False)

    # From spec: address: TEXT, NOT NULL
    # Full address of the food bank location for user reference.
    address: Mapped[str] = mapped_column(Text, nullable=False)

    # From spec: lat: DECIMAL(9,6), NOT NULL
    # Latitude coordinate for map display. DECIMAL(9,6) provides precision
    # to ~0.1 meters (6 decimal places in degrees ≈ 0.111 meters).
    lat: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)

    # From spec: lng: DECIMAL(9,6), NOT NULL
    # Longitude coordinate for map display. Same precision as lat.
    lng: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)

    # From spec: created_at: TIMESTAMP, NOT NULL, DEFAULT NOW()
    # Audit field: records when food bank record was created in system.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=text("now()"),
    )

    # Relationship: FoodBank -> FoodBankHours (one-to-many)
    # From spec § 2 "food_banks → food_bank_hours: one-to-many"
    # FK: food_bank_hours.food_bank_id -> food_banks.id
    # cascade='all, delete-orphan' ensures hours deleted when food bank deleted.
    hours: Mapped[list["FoodBankHour"]] = relationship(
        back_populates="food_bank",
        cascade="all, delete-orphan",
    )

    # Relationship: FoodBank -> FoodPackages (one-to-many)
    # From spec § 2 "food_banks → food_packages: one-to-many"
    # FK: food_packages.food_bank_id -> food_banks.id (nullable)
    # Packages can exist system-wide or be specific to a food bank.
    packages: Mapped[list["FoodPackage"]] = relationship(
        back_populates="food_bank",
    )

    # Relationship: FoodBank -> Applications (one-to-many)
    # Implicit from spec § 2: applications reference food_bank_id
    # Users apply to specific food bank locations.
    applications: Mapped[list["Application"]] = relationship(back_populates="food_bank")
