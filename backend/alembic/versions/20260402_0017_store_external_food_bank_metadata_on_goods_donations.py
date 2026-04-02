"""Store external food bank metadata on goods donations.

Revision ID: 20260402_0017
Revises: 20260402_0016
Create Date: 2026-04-02 00:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260402_0017"
down_revision = "20260402_0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "donations_goods",
        sa.Column("food_bank_name", sa.String(length=200), nullable=True),
    )
    op.add_column(
        "donations_goods",
        sa.Column("food_bank_address", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("donations_goods", "food_bank_address")
    op.drop_column("donations_goods", "food_bank_name")
