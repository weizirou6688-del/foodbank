from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .inventory_item import InventoryItem


class InventoryLot(Base):
    __tablename__ = "inventory_lots"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_inventory_lots_quantity_positive"),
        CheckConstraint("received_date <= expiry_date", name="ck_inventory_lots_dates"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    inventory_item_id: Mapped[int] = mapped_column(
        ForeignKey("inventory_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    quantity: Mapped[int] = mapped_column(Integer, nullable=False)

    expiry_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

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
