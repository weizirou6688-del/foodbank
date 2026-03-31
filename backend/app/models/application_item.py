"""
ApplicationItem model representing individual items within an application.

From spec § 1 'application_items' (junction) table:
ApplicationItem is a many-to-many junction entity that specifies which packages
are included in a given application and in what quantities. One application can
request multiple package types, each with its own quantity.
"""

from __future__ import annotations

import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class ApplicationItem(Base):
    __tablename__ = "application_items"
    __table_args__ = (
        CheckConstraint(
            "((package_id IS NOT NULL AND inventory_item_id IS NULL) OR (package_id IS NULL AND inventory_item_id IS NOT NULL))",
            name="ck_application_items_target",
        ),
    )

    # From spec: id: SERIAL (PK)
    # Auto-incrementing integer primary key for the junction record.
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # From spec: application_id: UUID, NOT NULL, FK -> applications.id
    # Foreign key to Application. ondelete='CASCADE' ensures items
    # deleted when application deleted.
    # index=True enables quick lookup of items by application.
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # From spec: package_id: INTEGER, NOT NULL, FK -> food_packages.id
    # Foreign key to FoodPackage. ondelete='RESTRICT' prevents deletion of
    # packages that have been applied for (maintains package history).
    # index=True enables quick lookup of applications requesting a package.
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

    # From spec: quantity: INTEGER, NOT NULL
    # Number of this package requested in the application.
    # For example, a user might request 2 units of "Basic Nutrition Pack".
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)

    # Relationship: ApplicationItem -> Application (many-to-one)
    # From spec § 2 "applications → application_items: one-to-many"
    # back_populates="items" establishes bidirectional relationship.
    application: Mapped["Application"] = relationship(back_populates="items")

    # Relationship: ApplicationItem -> FoodPackage (many-to-one)
    # From spec § 2 "food_packages → application_items: one-to-many"
    # back_populates="application_items" establishes bidirectional relationship.
    package: Mapped["FoodPackage | None"] = relationship(back_populates="application_items")

    inventory_item: Mapped["InventoryItem | None"] = relationship(back_populates="application_items")
