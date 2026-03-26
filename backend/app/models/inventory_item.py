"""
InventoryItem model representing individual food inventory items.

From spec § 1 'inventory_items' table:
InventoryItem records are the atomic units of food inventory tracked by the
system. These represent individual food types (e.g., "Canned Beans", "Rice").
Items are combined into packages via PackageItem junction table. Stock levels
and thresholds are tracked per item for restock management.
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

    # From spec: id: SERIAL (PK)
    # Auto-incrementing integer primary key.
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # From spec: name: VARCHAR(200), NOT NULL
    # Human-readable name of the food item (e.g., "Canned Tomatoes").
    name: Mapped[str] = mapped_column(String(200), nullable=False)

    # From spec: category: VARCHAR(100), NOT NULL
    # Item category for filtering/searching (e.g., "Vegetables", "Grains").
    # index=True enables efficient category-based queries and filters.
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    # From spec: unit: VARCHAR(50), NOT NULL
    # Unit of measure (e.g., "cans", "kg", "boxes", "liters").
    # Different items may use different units.
    unit: Mapped[str] = mapped_column(String(50), nullable=False)

    # From spec: threshold: INTEGER, NOT NULL, DEFAULT 10
    # Stock level that triggers restock request. When stock drops below threshold,
    # admin receives alert. default=10 is application-wide baseline; can be
    # overridden per item.
    threshold: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("10"))

    # From spec: updated_at: TIMESTAMP, NOT NULL, DEFAULT NOW()
    # Audit field: tracks last modification (stock updates, threshold changes).
    # onupdate=text("now()") automatically updates on any UPDATE to this row.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=text("now()"),
        onupdate=text("now()"),
    )

    # Relationship: InventoryItem -> PackageItems (one-to-many)
    # From spec § 2 "inventory_items → package_items: one-to-many"
    # FK: package_items.inventory_item_id -> inventory_items.id
    # An inventory item can appear in multiple packages with different quantities.
    # cascade='all, delete-orphan' ensures package associations cleaned up
    # if inventory item deleted.
    package_items: Mapped[list["PackageItem"]] = relationship(
        back_populates="inventory_item",
        cascade="all, delete-orphan",
    )

    # Relationship: InventoryItem -> InventoryLots (one-to-many)
    # From spec § 1.5 "inventory_items → inventory_lots: one-to-many"
    # FK: inventory_lots.inventory_item_id -> inventory_items.id
    # Each inventory item can have multiple lots (batches) tracked independently.
    # This replaces the single stock field with lot-based inventory tracking.
    # cascade='all, delete-orphan' ensures all lots are removed if item is deleted.
    lots: Mapped[list["InventoryLot"]] = relationship(
        back_populates="inventory_item",
        cascade="all, delete-orphan",
    )

    # Relationship: InventoryItem -> RestockRequests (one-to-many)
    # From spec § 2 "inventory_items → restock_requests: one-to-many"
    # FK: restock_requests.inventory_item_id -> inventory_items.id
    # Multiple restock requests can reference same item over time.
    # cascade='all, delete-orphan' ensures historical requests cleaned up
    # if inventory item deleted (rare but maintains referential integrity).
    restock_requests: Mapped[list["RestockRequest"]] = relationship(
        back_populates="inventory_item",
        cascade="all, delete-orphan",
    )
