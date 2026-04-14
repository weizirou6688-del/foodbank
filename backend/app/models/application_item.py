from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .application import Application
    from .food_package import FoodPackage
    from .inventory_item import InventoryItem


class ApplicationItem(Base):
    __tablename__ = "application_items"
    __table_args__ = (
        CheckConstraint(
            "((package_id IS NOT NULL AND inventory_item_id IS NULL) OR (package_id IS NULL AND inventory_item_id IS NOT NULL))",
            name="ck_application_items_target",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    package_id: Mapped[int | None] = mapped_column(
        ForeignKey("food_packages.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    inventory_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("inventory_items.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    quantity: Mapped[int] = mapped_column(Integer, nullable=False)

    application: Mapped["Application"] = relationship(back_populates="items")

    package: Mapped["FoodPackage | None"] = relationship(back_populates="application_items")

    inventory_item: Mapped["InventoryItem | None"] = relationship(back_populates="application_items")
