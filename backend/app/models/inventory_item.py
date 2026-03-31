"""
InventoryItem model representing individual food inventory items.

From spec section 1 for the `inventory_items` table:
InventoryItem records are the atomic units of food inventory tracked by the
system. These represent individual food types such as "Canned Beans" or
"Rice". Items are combined into packages via the PackageItem junction table.
Thresholds are tracked per item for restock management.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


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
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=text("now()"),
        onupdate=text("now()"),
    )

    # inventory_items -> package_items is one-to-many.
    package_items: Mapped[list["PackageItem"]] = relationship(
        back_populates="inventory_item",
        cascade="all, delete-orphan",
    )

    # inventory_items -> application_items is one-to-many.
    application_items: Mapped[list["ApplicationItem"]] = relationship(
        back_populates="inventory_item",
    )

    # inventory_items -> inventory_lots is one-to-many.
    lots: Mapped[list["InventoryLot"]] = relationship(
        back_populates="inventory_item",
        cascade="all, delete-orphan",
    )

    # inventory_items -> restock_requests is one-to-many.
    restock_requests: Mapped[list["RestockRequest"]] = relationship(
        back_populates="inventory_item",
        cascade="all, delete-orphan",
    )
