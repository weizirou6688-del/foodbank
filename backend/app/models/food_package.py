"""
FoodPackage model representing pre-configured food packages.

From spec § 1 'food_packages' table:
FoodPackage entities represent curated collections of inventory items
ready for distribution. Each package has a stock level, threshold for restock,
and tracks how many times it has been applied for. Packages may be food-bank
specific (food_bank_id set) or system-wide (food_bank_id NULL).
is_active flag allows soft-deletion for historical tracking.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class FoodPackage(Base):
    __tablename__ = "food_packages"
    __table_args__ = (
        CheckConstraint(
            "category IN ('Pantry & Spices','Breakfast','Lunchbox','Family Bundle','Emergency Pack')",
            name="ck_food_packages_category",
        ),
    )

    # From spec: id: SERIAL (PK)
    # Auto-incrementing integer primary key.
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # From spec: name: VARCHAR(200), NOT NULL
    # Human-readable package name (e.g., "Basic Nutrition Pack").
    name: Mapped[str] = mapped_column(String(200), nullable=False)

    # From spec: category: VARCHAR(100), NOT NULL
    # Package category (e.g., "Basic", "Premium", "Children"). 
    # index=True enables quick category-based filtering.
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    # From spec: description: TEXT
    # Optional detailed description of package contents and eligibility.
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # From spec: stock: INTEGER, NOT NULL, DEFAULT 0
    # Current stock of pre-assembled packages available for distribution.
    # server_default=0: new packages start with zero stock.
    stock: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))

    # From spec: threshold: INTEGER, NOT NULL, DEFAULT 5
    # Stock level triggering restock alert. Default 5 is lower than
    # inventory_items default (10) to proactively prepare popular packages.
    threshold: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("5"))

    # From spec: applied_count: INTEGER, NOT NULL, DEFAULT 0
    # Cumulative count of successful applications (deployments) of this package.
    # Used for popularity metrics and analytics.
    applied_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))

    # From spec: image_url: TEXT
    # Optional URL to package image for display in UI.
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # From spec: food_bank_id: INTEGER, FK -> food_banks.id (nullable)
    # If set, package is specific to that food bank.
    # If NULL, package is available system-wide.
    # ondelete='SET NULL' ensures packages remain even if food bank deleted.
    # index=True enables quick lookup of packages by food bank.
    food_bank_id: Mapped[int | None] = mapped_column(
        ForeignKey("food_banks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # From spec: is_active: BOOLEAN, NOT NULL, DEFAULT TRUE
    # Soft-deletion flag. Enables archiving packages without data loss.
    # index=True allows quick filtering for "active only" queries.
    # server_default=true ensures new packages are active by default.
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"), index=True)

    # From spec: created_at: TIMESTAMP, NOT NULL, DEFAULT NOW()
    # Audit field: records when package was created in system.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=text("now()"),
    )

    # Relationship: FoodPackage -> FoodBank (many-to-one)
    # From spec § 2 "food_banks → food_packages: one-to-many"
    # FK: food_bank_id -> food_banks.id (nullable)
    # back_populates="packages" establishes bidirectional relationship.
    food_bank: Mapped["FoodBank | None"] = relationship(back_populates="packages")

    # Relationship: FoodPackage -> PackageItems (one-to-many)
    # From spec § 2 "food_packages → package_items: one-to-many"
    # FK: package_items.package_id -> food_packages.id
    # Defines what inventory items compose this package and their quantities.
    # cascade='all, delete-orphan' ensures items cleaned up if package deleted.
    package_items: Mapped[list["PackageItem"]] = relationship(
        back_populates="package",
        cascade="all, delete-orphan",
    )

    # Relationship: FoodPackage -> ApplicationItems (one-to-many)
    # From spec § 2 "food_packages → application_items: one-to-many"
    # FK: application_items.package_id -> food_packages.id
    # Tracks instances of this package being included in applications.
    # cascade='all, delete-orphan' prevents orphaned application items.
    application_items: Mapped[list["ApplicationItem"]] = relationship(
        back_populates="package",
        cascade="all, delete-orphan",
    )
