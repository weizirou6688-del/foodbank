"""Align goods donations with Donate Goods page fields.

Revision ID: 20260402_0016
Revises: 20260401_0015
Create Date: 2026-04-02 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260402_0016"
down_revision = "20260401_0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "donations_goods",
        sa.Column("food_bank_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "donations_goods",
        sa.Column("postcode", sa.String(length=16), nullable=True),
    )
    op.add_column(
        "donations_goods",
        sa.Column("pickup_date", sa.Date(), nullable=True),
    )
    op.add_column(
        "donations_goods",
        sa.Column("item_condition", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "donations_goods",
        sa.Column("estimated_quantity", sa.String(length=100), nullable=True),
    )
    op.create_index(
        op.f("ix_donations_goods_food_bank_id"),
        "donations_goods",
        ["food_bank_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_donations_goods_food_bank_id_food_banks",
        "donations_goods",
        "food_banks",
        ["food_bank_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_donations_goods_food_bank_id_food_banks",
        "donations_goods",
        type_="foreignkey",
    )
    op.drop_index(op.f("ix_donations_goods_food_bank_id"), table_name="donations_goods")
    op.drop_column("donations_goods", "estimated_quantity")
    op.drop_column("donations_goods", "item_condition")
    op.drop_column("donations_goods", "pickup_date")
    op.drop_column("donations_goods", "postcode")
    op.drop_column("donations_goods", "food_bank_id")
