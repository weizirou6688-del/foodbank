"""
DonationGoodsItem model representing individual items in a goods donation.

From spec § 1 'donation_goods_items' (junction) table:
DonationGoodsItem records specify what physical items are included in a
donation and their quantities. Unlike package composition (which references
inventory items), donation items are recorded by free-form name since they
may be ad-hoc contributions not in the standard inventory.
"""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class DonationGoodsItem(Base):
    __tablename__ = "donation_goods_items"

    # From spec: id: SERIAL (PK)
    # Auto-incrementing integer primary key for the item record.
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # From spec: donation_id: UUID, NOT NULL, FK -> donations_goods.id
    # Foreign key to DonationGoods. ondelete='CASCADE' ensures items
    # deleted when donation deleted.
    # index=True enables quick lookup of items by donation.
    donation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("donations_goods.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # From spec: item_name: VARCHAR(200), NOT NULL
    # Free-form name of donated item (e.g., "Tinned Peas", "Rice Bags").
    # Not constrained to inventory_items table to allow flexible donations.
    item_name: Mapped[str] = mapped_column(String(200), nullable=False)

    # From spec: quantity: INTEGER, NOT NULL
    # Quantity of this item in the donation (e.g., 5 cans, 2 boxes).
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)

    # Relationship: DonationGoodsItem -> DonationGoods (many-to-one)
    # From spec § 2 "donations_goods → donation_goods_items: one-to-many"
    # back_populates="items" establishes bidirectional relationship.
    donation: Mapped["DonationGoods"] = relationship(back_populates="items")
