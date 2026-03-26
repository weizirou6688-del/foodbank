"""
DonationGoods model representing in-kind (goods) donations.

From spec § 1 'donations_goods' table:
Goods donation records track physical item contributions. Donor may be a
registered user (donor_user_id set) or anonymous (donor_user_id NULL).
Donor contact info (name, email, phone) is always captured for follow-up.
Status tracks processing: pending donation received, then either accepted
or rejected. Items are recorded in junction table DonationGoodsItem.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class DonationGoods(Base):
    __tablename__ = "donations_goods"

    # Check constraint enforces status enum from spec § 1 and § 3.
    # Allowed statuses: pending (initial state), received (accepted into inventory),
    # rejected (not usable/insufficient).
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','received','rejected')",
            name="ck_donations_goods_status",
        ),
    )

    # From spec: id: UUID (PK, default gen_random_uuid())
    # UUID primary key for global uniqueness.
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    # From spec: donor_user_id: UUID, FK -> users.id, NULLABLE
    # If set, links donation to a registered user (for reputation/badges).
    # If NULL, donation is anonymous (spec § 3: "for anonymous donations").
    # ondelete='SET NULL' allows user deletion without losing donation record.
    # index=True enables quick lookup of donations by donor user.
    donor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # From spec: donor_name: VARCHAR(100), NOT NULL
    # Donor's name for receipt/thank-you communication.
    # Required even if user is NULL (anonymous donations still need contact info).
    donor_name: Mapped[str] = mapped_column(String(100), nullable=False)

    # From spec: donor_email: VARCHAR(255), NOT NULL
    # Donor's email for sending receipt and thank-you message.
    # index=True enables quick lookup by donor email.
    donor_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # From spec: donor_phone: VARCHAR(30), NOT NULL
    # Donor's phone for follow-up (if donation rejected or needs clarification).
    donor_phone: Mapped[str] = mapped_column(String(30), nullable=False)

    # From spec: notes: TEXT
    # Optional donation notes (e.g., dietary restrictions, storage requirements).
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # From spec: status: VARCHAR(20), NOT NULL, DEFAULT 'pending'
    # Tracks donation processing state.
    # server_default='pending': new donations start in pending review.
    # index=True enables filtering by status (e.g., find pending donations).
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'pending'"), index=True)

    # From spec: created_at: TIMESTAMP, NOT NULL, DEFAULT NOW()
    # Audit field: records when donation was registered in system.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=text("now()"),
    )

    # Relationship: DonationGoods -> User (many-to-one, nullable)
    # From spec § 2 "users → donations_goods: one-to-many (nullable)"
    # FK: donor_user_id -> users.id (nullable)
    # back_populates="goods_donations" establishes bidirectional relationship.
    donor_user: Mapped["User | None"] = relationship(back_populates="goods_donations")

    # Relationship: DonationGoods -> DonationGoodsItems (one-to-many)
    # From spec § 2 "donations_goods → donation_goods_items: one-to-many"
    # FK: donation_goods_items.donation_id -> donations_goods.id
    # Specifies what items are in this donation and their quantities.
    # cascade='all, delete-orphan' ensures items deleted when donation deleted.
    items: Mapped[list["DonationGoodsItem"]] = relationship(
        back_populates="donation",
        cascade="all, delete-orphan",
    )
