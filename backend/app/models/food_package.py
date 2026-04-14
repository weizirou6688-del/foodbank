from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .application_item import ApplicationItem
    from .food_bank import FoodBank
    from .package_item import PackageItem


class FoodPackage(Base):
    __tablename__ = "food_packages"
    __table_args__ = (
        CheckConstraint(
            "category IN ('Pantry & Spices','Breakfast','Lunchbox','Family Bundle','Emergency Pack')",
            name="ck_food_packages_category",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    stock: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    threshold: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("5"))
    applied_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    food_bank_id: Mapped[int | None] = mapped_column(
        ForeignKey("food_banks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("true"),
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=text("now()"),
    )

    food_bank: Mapped["FoodBank | None"] = relationship(back_populates="packages")

    package_items: Mapped[list["PackageItem"]] = relationship(
        back_populates="package",
        cascade="all, delete-orphan",
    )

    application_items: Mapped[list["ApplicationItem"]] = relationship(
        back_populates="package",
        cascade="all, delete-orphan",
    )
