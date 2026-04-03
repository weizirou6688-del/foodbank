from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class ApplicationDistributionSnapshot(Base):
    __tablename__ = "application_distribution_snapshots"
    __table_args__ = (
        CheckConstraint(
            "snapshot_type IN ('package','package_component','direct_item')",
            name="ck_app_dist_snapshots_type",
        ),
        CheckConstraint(
            "requested_quantity > 0",
            name="ck_app_dist_snapshots_req_qty_pos",
        ),
        CheckConstraint(
            "distributed_quantity >= 0",
            name="ck_app_dist_snapshots_dist_qty_nn",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    snapshot_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    package_id: Mapped[int | None] = mapped_column(
        ForeignKey("food_packages.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    package_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    package_category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    inventory_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("inventory_items.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    inventory_item_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    inventory_item_category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    inventory_item_unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    requested_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_per_package: Mapped[int | None] = mapped_column(Integer, nullable=True)
    distributed_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    recipe_unit_total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
        index=True,
    )
