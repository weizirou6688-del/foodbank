from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .inventory_item import InventoryItem


class InventoryLot(Base):
    __tablename__ = "inventory_lots"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_inventory_lots_quantity_positive"),
        CheckConstraint("received_date <= expiry_date", name="ck_inventory_lots_dates"),
        Index("idx_lots_item", "inventory_item_id"),
        Index("idx_lots_expiry", "expiry_date"),
        Index(
            "idx_lots_active",
            "id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index("idx_lots_deleted", "deleted_at"),
        Index(
            "idx_inventory_lots_active_expiry",
            "inventory_item_id",
            "expiry_date",
            "received_date",
            postgresql_where=text("quantity > 0 AND deleted_at IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    inventory_item_id: Mapped[int] = mapped_column(
        ForeignKey("inventory_items.id", ondelete="CASCADE"),
        nullable=False,
    )

    quantity: Mapped[int] = mapped_column(Integer, nullable=False)

    expiry_date: Mapped[date] = mapped_column(Date, nullable=False)

    received_date: Mapped[date] = mapped_column(
        Date, nullable=False, server_default=text("CURRENT_DATE")
    )

    batch_reference: Mapped[str | None] = mapped_column(String(100), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
        onupdate=text("now()"),
    )

    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    inventory_item: Mapped["InventoryItem"] = relationship(
        back_populates="lots",
    )
