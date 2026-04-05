"""
DonationCash model representing monetary/cash donations.

From spec § 1 'donations_cash' table:
Cash donation records track monetary contributions to the food bank,
potentially via payment processor integration. Amount is stored in pence
(integer) to avoid floating-point precision issues. Status tracks whether
the donation was successfully completed, failed, or later refunded.
No user association needed; anonymous donations allowed.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class DonationCash(Base):
    __tablename__ = "donations_cash"

    # Check constraint enforces status enum from spec § 1 and § 3.
    # Allowed statuses: completed (successful), failed (payment decline),
    # refunded (post-donation refund).
    __table_args__ = (
        CheckConstraint(
            "status IN ('completed','failed','refunded')",
            name="ck_donations_cash_status",
        ),
    )

    # From spec: id: UUID (PK, default gen_random_uuid())
    # UUID primary key for global uniqueness.
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    # From spec: donor_email: VARCHAR(255), NOT NULL
    # Email of the donor for receipt and contact purposes.
    # index=True enables quick lookup by donor or for sending receipts.
    donor_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # Optional donor name captured from the checkout/contact form.
    # Kept nullable to preserve support for anonymous/manual cash donations.
    donor_name: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Optional donor type captured by staff recording/admin flows.
    donor_type: Mapped[str | None] = mapped_column(String(30), nullable=True)

    food_bank_id: Mapped[int | None] = mapped_column(
        ForeignKey("food_banks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # From spec: amount_pence: INTEGER, NOT NULL
    # Amount in pence (1/100 of currency unit) to avoid floating-point
    # precision issues common in financial systems.
    # E.g., £10.50 = 1050 pence.
    # Pydantic schema validates amount >= 1 pence.
    amount_pence: Mapped[int] = mapped_column(Integer, nullable=False)

    # From spec: payment_reference: VARCHAR(100)
    # External payment processor reference (e.g., Stripe transaction ID).
    # Nullable for offline or manual donations.
    # index=True enables quick tracking/matching with payment processor.
    payment_reference: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)

    # From spec: status: VARCHAR(20), NOT NULL, DEFAULT 'completed'
    # Tracks donation state throughout its lifecycle.
    # server_default='completed' optimistically assumes success;
    # failures/refunds require explicit update.
    # index=True enables querying by status (e.g., find failed donations).
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'completed'"), index=True)

    # From spec: created_at: TIMESTAMP, NOT NULL, DEFAULT NOW()
    # Audit field: records when donation was recorded in system.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=text("now()"),
    )
