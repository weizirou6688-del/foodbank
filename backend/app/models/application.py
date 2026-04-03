"""
Application model representing user applications for food packages.

From spec section 1 for the `applications` table:
Application records track requests from public users to receive food packages
from a specific food bank during a given weekly period. Each application is
assigned a unique redemption code for in-person pickup verification. Status
tracks lifecycle from pending through collection to expiry. Weekly period
enforces the business rule limiting three packages per user per week.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Application(Base):
    __tablename__ = "applications"

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','collected','expired')",
            name="ck_applications_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    food_bank_id: Mapped[int] = mapped_column(
        ForeignKey("food_banks.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    redemption_code: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default=text("'pending'"),
        index=True,
    )
    week_start: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    total_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=text("now()"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
    redeemed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    # users -> applications is one-to-many.
    user: Mapped["User"] = relationship(back_populates="applications")

    # applications reference a specific food bank.
    food_bank: Mapped["FoodBank"] = relationship(back_populates="applications")

    # applications -> application_items is one-to-many.
    items: Mapped[list["ApplicationItem"]] = relationship(
        back_populates="application",
        cascade="all, delete-orphan",
    )
