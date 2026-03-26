"""Add strict category check constraints for inventory_items and food_packages.

Revision ID: 20260325_0002
Revises: 20260324_0001
Create Date: 2026-03-25 00:00:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "20260325_0002"
down_revision = "20260324_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_check_constraint(
        "ck_inventory_items_category",
        "inventory_items",
        "category IN ('Proteins & Meat','Vegetables','Fruits','Dairy','Canned Goods','Grains & Pasta','Snacks','Beverages','Baby Food')",
    )
    op.create_check_constraint(
        "ck_food_packages_category",
        "food_packages",
        "category IN ('Pantry & Spices','Breakfast','Lunchbox','Family Bundle','Emergency Pack')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_food_packages_category", "food_packages", type_="check")
    op.drop_constraint("ck_inventory_items_category", "inventory_items", type_="check")
