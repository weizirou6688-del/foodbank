"""Add donor_name to cash donations.

Revision ID: 20260401_0015
Revises: 20260331_0014
Create Date: 2026-04-01 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260401_0015"
down_revision = "20260331_0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "donations_cash",
        sa.Column("donor_name", sa.String(length=100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("donations_cash", "donor_name")
