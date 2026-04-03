"""Add admin food management sync fields.

Revision ID: 20260402_0018
Revises: 20260402_0017
Create Date: 2026-04-02 19:20:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260402_0018"
down_revision = "20260402_0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "donations_cash",
        sa.Column("donor_type", sa.String(length=30), nullable=True),
    )
    op.add_column(
        "donations_goods",
        sa.Column("donor_type", sa.String(length=30), nullable=True),
    )
    op.add_column(
        "donation_goods_items",
        sa.Column("expiry_date", sa.Date(), nullable=True),
    )
    op.add_column(
        "applications",
        sa.Column("redeemed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("applications", "redeemed_at")
    op.drop_column("donation_goods_items", "expiry_date")
    op.drop_column("donations_goods", "donor_type")
    op.drop_column("donations_cash", "donor_type")
