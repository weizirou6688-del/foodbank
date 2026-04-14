from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .application_item import ApplicationItem
    from .food_bank import FoodBank
    from .inventory_lot import InventoryLot
    from .package_item import PackageItem
    from .restock_request import RestockRequest


class InventoryItem(Base):
    __tablename__ = "inventory_items"
    __table_args__ = (
        CheckConstraint(
            "category IN ('Proteins & Meat','Vegetables','Fruits','Dairy','Canned Goods','Grains & Pasta','Snacks','Beverages','Baby Food')",
            name="ck_inventory_items_category",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    unit: Mapped[str] = mapped_column(String(50), nullable=False)
    threshold: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default=text("10"),
    )
    food_bank_id: Mapped[int | None] = mapped_column(
        ForeignKey("food_banks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=text("now()"),
        onupdate=text("now()"),
    )

    food_bank: Mapped["FoodBank | None"] = relationship(back_populates="inventory_items")

    package_items: Mapped[list["PackageItem"]] = relationship(
        back_populates="inventory_item",
        cascade="all, delete-orphan",
    )

    application_items: Mapped[list["ApplicationItem"]] = relationship(
        back_populates="inventory_item",
    )

    lots: Mapped[list["InventoryLot"]] = relationship(
        back_populates="inventory_item",
        cascade="all, delete-orphan",
    )

    restock_requests: Mapped[list["RestockRequest"]] = relationship(
        back_populates="inventory_item",
        cascade="all, delete-orphan",
    )
