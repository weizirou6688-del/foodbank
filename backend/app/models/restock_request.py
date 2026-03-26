"""
RestockRequest model representing requests to replenish inventory.

From spec § 1 'restock_requests' table:
Restock request records are generated (automatically or manually) when an
inventory item's stock falls below its threshold. Admins review requests,
prioritize by urgency, and assign them to staff. Status tracks lifecycle:
open (pending action), fulfilled (stock replenished), or cancelled (obsolete).
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class RestockRequest(Base):
    __tablename__ = "restock_requests"

    # Check constraints enforce enums from spec § 1 and § 3 Business Rules.
    # urgency: one of Critical, Urgent, Low (priority for admin action).
    # status: one of open, fulfilled, cancelled (lifecycle tracking).
    __table_args__ = (
        CheckConstraint(
            "urgency IN ('Critical','Urgent','Low')",
            name="ck_restock_requests_urgency",
        ),
        CheckConstraint(
            "status IN ('open','fulfilled','cancelled')",
            name="ck_restock_requests_status",
        ),
    )

    # From spec: id: SERIAL (PK)
    # Auto-incrementing integer primary key.
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # From spec: inventory_item_id: INTEGER, NOT NULL, FK -> inventory_items.id
    # Foreign key to InventoryItem. ondelete='CASCADE' ensures requests
    # deleted if inventory item deleted (rare but maintains integrity).
    # index=True enables quick lookup of requests by item.
    inventory_item_id: Mapped[int] = mapped_column(
        ForeignKey("inventory_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # From spec: current_stock: INTEGER, NOT NULL
    # Stock level AT TIME OF REQUEST CREATION (snapshot for reference).
    # Differs from current inventory_items.stock (which may have changed).
    # Helps admins understand original urgency context.
    current_stock: Mapped[int] = mapped_column(Integer, nullable=False)

    # From spec: threshold: INTEGER, NOT NULL
    # Threshold value AT TIME OF REQUEST (item's trigger point when created).
    # Stored with request for historical context (threshold may change later).
    threshold: Mapped[int] = mapped_column(Integer, nullable=False)

    # From spec: urgency: VARCHAR(20), NOT NULL
    # Business priority level. Constraint enforces: Critical, Urgent, or Low.
    # Used for admin task prioritization and notifications.
    urgency: Mapped[str] = mapped_column(String(20), nullable=False)

    # From spec: assigned_to_user_id: UUID, FK -> users.id, NULLABLE
    # If set, assigns responsibility for fulfilling this request to a user.
    # Nullable allows unassigned requests in queue.
    # ondelete='SET NULL' allows user deletion without orphaning request.
    # index=True enables quick lookup of assignments per user (task list).
    assigned_to_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # From spec: status: VARCHAR(20), NOT NULL, DEFAULT 'open'
    # Tracks restock request lifecycle.
    # server_default='open': new requests start as open/pending.
    # index=True enables filtering by status (e.g., find open requests).
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'open'"), index=True)

    # From spec: created_at: TIMESTAMP, NOT NULL, DEFAULT NOW()
    # Audit field: records when restock request was created.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=text("now()"),
    )

    # Relationship: RestockRequest -> InventoryItem (many-to-one)
    # From spec § 2 "inventory_items → restock_requests: one-to-many"
    # FK: inventory_item_id -> inventory_items.id
    # back_populates="restock_requests" establishes bidirectional relationship.
    inventory_item: Mapped["InventoryItem"] = relationship(back_populates="restock_requests")

    # Relationship: RestockRequest -> User (many-to-one, nullable)
    # From spec § 2 "users → restock_requests: one-to-many (nullable)"
    # FK: assigned_to_user_id -> users.id (nullable)
    # back_populates="assigned_restock_requests" establishes bidirectional relationship.
    assigned_to_user: Mapped["User | None"] = relationship(back_populates="assigned_restock_requests")
