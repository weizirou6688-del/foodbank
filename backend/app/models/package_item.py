"""
PackageItem model representing the junction between packages and inventory items.

From spec § 1 'package_items' (junction) table:
PackageItem is a many-to-many junction entity that defines the composition
of food packages. Each record links an inventory item to a package with a
specified quantity. One inventory item can appear in multiple packages,
and one package may contain multiple inventory items.
"""

from __future__ import annotations

from sqlalchemy import ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class PackageItem(Base):
    __tablename__ = "package_items"

    # From spec: id: SERIAL (PK)
    # Auto-incrementing integer primary key for the junction record.
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # From spec: package_id: INTEGER, NOT NULL, FK -> food_packages.id
    # Foreign key to FoodPackage. ondelete='CASCADE' ensures junction
    # records deleted when package is deleted.
    # index=True enables quick lookup of items by package.
    package_id: Mapped[int] = mapped_column(
        ForeignKey("food_packages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # From spec: inventory_item_id: INTEGER, NOT NULL, FK -> inventory_items.id
    # Foreign key to InventoryItem. ondelete='CASCADE' ensures junction
    # records deleted when inventory item deleted (rare but maintains integrity).
    # index=True enables quick lookup of packages containing an item.
    inventory_item_id: Mapped[int] = mapped_column(
        ForeignKey("inventory_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # From spec: quantity: INTEGER, NOT NULL, DEFAULT 1
    # Number of units of this inventory item in the package.
    # For example, a package might contain 3 cans of soup.
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")

    # Relationship: PackageItem -> FoodPackage (many-to-one)
    # From spec § 2 "food_packages → package_items: one-to-many"
    # back_populates="package_items" establishes bidirectional relationship.
    package: Mapped["FoodPackage"] = relationship(back_populates="package_items")

    # Relationship: PackageItem -> InventoryItem (many-to-one)
    # From spec § 2 "inventory_items → package_items: one-to-many"
    # back_populates="package_items" establishes bidirectional relationship.
    inventory_item: Mapped["InventoryItem"] = relationship(back_populates="package_items")
