from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .donation_goods_item import DonationGoodsItem
    from .food_bank import FoodBank
    from .user import User


class DonationGoods(Base):
    __tablename__ = "donations_goods"

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','received','rejected')",
            name="ck_donations_goods_status",
        ),
        CheckConstraint(
            r"donor_phone ~ '^[0-9]{11}$'",
            name="ck_donations_goods_donor_phone",
        ),
        CheckConstraint(
            r"""
            pickup_date IS NULL OR (
                pickup_date ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
                AND to_char(to_date(pickup_date, 'DD/MM/YYYY'), 'DD/MM/YYYY') = pickup_date
            )
            """,
            name="ck_donations_goods_pickup_date_format",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    donor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    food_bank_id: Mapped[int | None] = mapped_column(
        ForeignKey("food_banks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    food_bank_name: Mapped[str | None] = mapped_column(String(200), nullable=True)

    food_bank_address: Mapped[str | None] = mapped_column(Text, nullable=True)

    donor_name: Mapped[str] = mapped_column(String(100), nullable=False)

    donor_type: Mapped[str | None] = mapped_column(String(30), nullable=True)

    donor_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    donor_phone: Mapped[str] = mapped_column(String(11), nullable=False)

    postcode: Mapped[str | None] = mapped_column(String(16), nullable=True)

    pickup_date: Mapped[str | None] = mapped_column(String(10), nullable=True)

    item_condition: Mapped[str | None] = mapped_column(String(50), nullable=True)

    estimated_quantity: Mapped[str | None] = mapped_column(String(100), nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'pending'"), index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=text("now()"),
    )

    donor_user: Mapped["User | None"] = relationship(back_populates="goods_donations")

    food_bank: Mapped["FoodBank | None"] = relationship(back_populates="goods_donations")

    items: Mapped[list["DonationGoodsItem"]] = relationship(
        back_populates="donation",
        cascade="all, delete-orphan",
    )
