"""Add monthly cash donation fields.

Revision ID: 20260411_0025
Revises: 20260411_0024
Create Date: 2026-04-11 01:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260411_0025"
down_revision = "20260411_0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "donations_cash",
        sa.Column(
            "donation_frequency",
            sa.String(length=20),
            nullable=False,
            server_default="one_time",
        ),
    )
    op.add_column(
        "donations_cash",
        sa.Column("subscription_reference", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "donations_cash",
        sa.Column("card_last4", sa.String(length=4), nullable=True),
    )
    op.add_column(
        "donations_cash",
        sa.Column("next_charge_date", sa.Date(), nullable=True),
    )
    op.create_index(
        "ix_donations_cash_donation_frequency",
        "donations_cash",
        ["donation_frequency"],
        unique=False,
    )
    op.create_index(
        "ix_donations_cash_subscription_reference",
        "donations_cash",
        ["subscription_reference"],
        unique=False,
    )
    op.create_check_constraint(
        "ck_donations_cash_frequency",
        "donations_cash",
        "donation_frequency IN ('one_time','monthly')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_donations_cash_frequency", "donations_cash", type_="check")
    op.drop_index("ix_donations_cash_subscription_reference", table_name="donations_cash")
    op.drop_index("ix_donations_cash_donation_frequency", table_name="donations_cash")
    op.drop_column("donations_cash", "next_charge_date")
    op.drop_column("donations_cash", "card_last4")
    op.drop_column("donations_cash", "subscription_reference")
    op.drop_column("donations_cash", "donation_frequency")
