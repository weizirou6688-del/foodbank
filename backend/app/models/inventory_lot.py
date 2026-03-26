"""
InventoryLot model representing individual batch lots of food inventory items.

From spec § 1.5 'inventory_lots' table:
InventoryLot records represent discrete batches of inventory items, each with:
- Quantity: the number of units in this lot
- Expiry date: when the lot expires (for FIFO rotation and waste prevention)
- Received date: when the lot was received/added to inventory
- Batch reference: optional tracking code (e.g., supplier batch number, donation ID)

This replaces the previous inventory_items.stock single-value model with a lot-based
tracked system. Each lot is independently tracked and can be marked as deleted (soft-delete).
Stock is now computed dynamically: total_stock = SUM(quantity) FROM inventory_lots
WHERE inventory_item_id = X AND deleted_at IS NULL
"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class InventoryLot(Base):
    __tablename__ = "inventory_lots"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_inventory_lots_quantity_positive"),
        CheckConstraint("received_date <= expiry_date", name="ck_inventory_lots_dates"),
    )

    # From spec: id: SERIAL (PK)
    # Auto-incrementing integer primary key uniquely identifying this lot.
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # From spec: inventory_item_id: INTEGER (FK)
    # Foreign key to inventory_items.id. Each lot belongs to exactly one item type.
    # index=True enables efficient queries for "all lots of item X".
    inventory_item_id: Mapped[int] = mapped_column(
        ForeignKey("inventory_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # From spec: quantity: INTEGER, NOT NULL
    # The number of units in this specific lot.
    # CHECK constraint ensures quantity > 0 (no zero/negative lots).
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)

    # From spec: expiry_date: DATE, NOT NULL
    # The date when this lot expires. Used for FIFO rotation and waste prevention.
    # index=True enables efficient queries for "expiring soon", notifications, etc.
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    # From spec: received_date: DATE, NOT NULL, DEFAULT CURRENT_DATE
    # The date this lot was received/added to inventory.
    # server_default=CURRENT_DATE ensures it defaults to today.
    received_date: Mapped[date] = mapped_column(
        Date, nullable=False, server_default=text("CURRENT_DATE")
    )

    # From spec: batch_reference: VARCHAR(100), NULL
    # Optional tracking code: supplier batch number, donation reference ID, etc.
    # Helps trace and link lots back to their source.
    batch_reference: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Audit field: created_at: TIMESTAMP, NOT NULL, DEFAULT NOW()
    # Tracks when this lot record was created (immutable).
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    # Audit field: updated_at: TIMESTAMP, NOT NULL, DEFAULT NOW()
    # Tracks last modification to this lot (e.g., quantity adjustment, expiry date change).
    # onupdate=text("now()") automatically updates on any UPDATE to this row.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
        onupdate=text("now()"),
    )

    # Soft-delete: deleted_at: TIMESTAMP, NULL
    # If set, this lot is considered logically deleted (but not physically removed).
    # Queries should filter: WHERE deleted_at IS NULL to get active lots.
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationship: InventoryLot -> InventoryItem (many-to-one)
    # Back-reference to the inventory item this lot belongs to.
    # Enables queries like: inventory_item.lots to get all lots of an item.
    inventory_item: Mapped["InventoryItem"] = relationship(
        back_populates="lots",
    )
