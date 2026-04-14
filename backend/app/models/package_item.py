from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .food_package import FoodPackage
    from .inventory_item import InventoryItem


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

    package: Mapped["FoodPackage"] = relationship(back_populates="package_items")

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
