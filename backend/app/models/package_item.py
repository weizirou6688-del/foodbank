"""
PackageItem model representing the junction between packages and inventory items.

From spec section 1 for the `package_items` junction table:
PackageItem is a many-to-many junction entity that defines the composition of
food packages. Each record links an inventory item to a package with a
specified quantity. One inventory item can appear in multiple packages, and
one package may contain multiple inventory items.
"""

from __future__ import annotations

from sqlalchemy import ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class PackageItem(Base):
    __tablename__ = "package_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    package_id: Mapped[int] = mapped_column(
        ForeignKey("food_packages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    inventory_item_id: Mapped[int] = mapped_column(
        ForeignKey("inventory_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")

    # food_packages -> package_items is one-to-many.
    package: Mapped["FoodPackage"] = relationship(back_populates="package_items")

    # inventory_items -> package_items is one-to-many.
    inventory_item: Mapped["InventoryItem"] = relationship(back_populates="package_items")

    @property
    def inventory_item_name(self) -> str:
        if self.inventory_item is None:
            return ""
        return self.inventory_item.name

    @property
    def inventory_item_unit(self) -> str:
        if self.inventory_item is None:
            return ""
        return self.inventory_item.unit
