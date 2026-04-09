"""Add inventory item food bank scope.

Revision ID: 20260409_0022
Revises: 20260407_0021
Create Date: 2026-04-09 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260409_0022"
down_revision = "20260407_0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "inventory_items",
        sa.Column("food_bank_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_inventory_items_food_bank_id",
        "inventory_items",
        ["food_bank_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_inventory_items_food_bank_id_food_banks",
        "inventory_items",
        "food_banks",
        ["food_bank_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_inventory_items_food_bank_id_food_banks",
        "inventory_items",
        type_="foreignkey",
    )
    op.drop_index("ix_inventory_items_food_bank_id", table_name="inventory_items")
    op.drop_column("inventory_items", "food_bank_id")
