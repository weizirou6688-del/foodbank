from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .inventory_item import InventoryItem
    from .user import User


class RestockRequest(Base):
    __tablename__ = "restock_requests"

    __table_args__ = (
        CheckConstraint(
            "urgency IN ('high','medium','low')",
            name="ck_restock_requests_urgency",
        ),
        CheckConstraint(
            "status IN ('open','fulfilled','cancelled')",
            name="ck_restock_requests_status",
        ),
        Index(
            "idx_restock_requests_active",
            "id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index("idx_restock_requests_assignment", "status", "assigned_to_user_id"),
        Index("idx_restock_requests_deleted_at", "deleted_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    inventory_item_id: Mapped[int] = mapped_column(
        ForeignKey("inventory_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    current_stock: Mapped[int] = mapped_column(Integer, nullable=False)
    threshold: Mapped[int] = mapped_column(Integer, nullable=False)
    urgency: Mapped[str] = mapped_column(String(20), nullable=False)

    assigned_to_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default=text("'open'"),
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=text("now()"),
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        server_default=text("now()"),
        onupdate=text("now()"),
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    inventory_item: Mapped["InventoryItem"] = relationship(
        back_populates="restock_requests"
    )
    assigned_to_user: Mapped["User | None"] = relationship(
        back_populates="assigned_restock_requests"
    )
