from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class InventoryWasteEvent(Base):
    __tablename__ = "inventory_waste_events"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_inventory_waste_events_quantity_positive"),
        CheckConstraint(
            "reason IN ('manual_waste','damaged','expired','deleted')",
            name="ck_inventory_waste_events_reason",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    inventory_lot_id: Mapped[int | None] = mapped_column(
        ForeignKey("inventory_lots.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    inventory_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("inventory_items.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    item_name: Mapped[str] = mapped_column(String(200), nullable=False)
    item_category: Mapped[str] = mapped_column(String(100), nullable=False)
    item_unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    batch_reference: Mapped[str | None] = mapped_column(String(100), nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
        index=True,
    )
