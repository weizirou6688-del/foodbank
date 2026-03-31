"""Support direct inventory item applications.

Revision ID: 20260331_0014
Revises: 20260326_0013
Create Date: 2026-03-31 23:58:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260331_0014"
down_revision = "20260326_0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "application_items",
        sa.Column("inventory_item_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_application_items_inventory_item_id_inventory_items",
        "application_items",
        "inventory_items",
        ["inventory_item_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index(
        op.f("ix_application_items_inventory_item_id"),
        "application_items",
        ["inventory_item_id"],
        unique=False,
    )
    op.alter_column(
        "application_items",
        "package_id",
        existing_type=sa.Integer(),
        nullable=True,
    )
    op.create_check_constraint(
        "ck_application_items_target",
        "application_items",
        "((package_id IS NOT NULL AND inventory_item_id IS NULL) OR (package_id IS NULL AND inventory_item_id IS NOT NULL))",
    )


def downgrade() -> None:
    op.drop_constraint("ck_application_items_target", "application_items", type_="check")
    op.execute("DELETE FROM application_items WHERE package_id IS NULL")
    op.alter_column(
        "application_items",
        "package_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.drop_index(op.f("ix_application_items_inventory_item_id"), table_name="application_items")
    op.drop_constraint(
        "fk_application_items_inventory_item_id_inventory_items",
        "application_items",
        type_="foreignkey",
    )
    op.drop_column("application_items", "inventory_item_id")
