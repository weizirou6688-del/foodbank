from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Numeric, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .application import Application
    from .donation_goods import DonationGoods
    from .food_package import FoodPackage
    from .inventory_item import InventoryItem
    from .user import User


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

    packages: Mapped[list["FoodPackage"]] = relationship(
        back_populates="food_bank",
    )

    inventory_items: Mapped[list["InventoryItem"]] = relationship(
        back_populates="food_bank",
    )

    applications: Mapped[list["Application"]] = relationship(back_populates="food_bank")

    goods_donations: Mapped[list["DonationGoods"]] = relationship(
        back_populates="food_bank",
    )

    admin_users: Mapped[list["User"]] = relationship(back_populates="food_bank")
