from __future__ import annotations

import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Date, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .donation_goods import DonationGoods


class DonationGoodsItem(Base):
    __tablename__ = "donation_goods_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    donation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("donations_goods.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    item_name: Mapped[str] = mapped_column(String(200), nullable=False)

    quantity: Mapped[int] = mapped_column(Integer, nullable=False)

    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    donation: Mapped["DonationGoods"] = relationship(back_populates="items")
