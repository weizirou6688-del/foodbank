"""
FoodBank model representing physical food bank locations.

From spec section 1 for the `food_banks` table:
FoodBank entities represent separate physical locations in the ABC Community
Food Bank network. Each location has an address, coordinates for mapping, and
operating hours. Food packages are associated with specific food banks.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Numeric, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class FoodBank(Base):
    __tablename__ = "food_banks"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    notification_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    lat: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)
    lng: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=text("now()"),
    )

    # food_banks -> food_bank_hours is one-to-many.
    hours: Mapped[list["FoodBankHour"]] = relationship(
        back_populates="food_bank",
        cascade="all, delete-orphan",
    )

    # food_banks -> food_packages is one-to-many.
    packages: Mapped[list["FoodPackage"]] = relationship(
        back_populates="food_bank",
    )

    inventory_items: Mapped[list["InventoryItem"]] = relationship(
        back_populates="food_bank",
    )

    # food_banks -> applications is one-to-many.
    applications: Mapped[list["Application"]] = relationship(back_populates="food_bank")

    # food_banks -> donations_goods is one-to-many.
    goods_donations: Mapped[list["DonationGoods"]] = relationship(
        back_populates="food_bank",
    )

    admin_users: Mapped[list["User"]] = relationship(back_populates="food_bank")
