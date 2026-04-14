from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class DonationCash(Base):
    __tablename__ = "donations_cash"

    __table_args__ = (
        CheckConstraint(
            "status IN ('completed','failed','refunded')",
            name="ck_donations_cash_status",
        ),
        CheckConstraint(
            "donation_frequency IN ('one_time','monthly')",
            name="ck_donations_cash_frequency",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    donor_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    donor_name: Mapped[str | None] = mapped_column(String(100), nullable=True)

    donor_type: Mapped[str | None] = mapped_column(String(30), nullable=True)

    food_bank_id: Mapped[int | None] = mapped_column(
        ForeignKey("food_banks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    amount_pence: Mapped[int] = mapped_column(Integer, nullable=False)

    donation_frequency: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="one_time",
        server_default=text("'one_time'"),
        index=True,
    )

    payment_reference: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)

    subscription_reference: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)

    card_last4: Mapped[str | None] = mapped_column(String(4), nullable=True)

    next_charge_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'completed'"), index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=text("now()"),
    )
