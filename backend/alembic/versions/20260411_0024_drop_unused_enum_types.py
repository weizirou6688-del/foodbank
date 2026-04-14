"""Drop unused PostgreSQL enum types.

Revision ID: 20260411_0024
Revises: 20260411_0023
Create Date: 2026-04-11 00:30:00.000000
"""

from alembic import op


revision = "20260411_0024"
down_revision = "20260411_0023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP TYPE IF EXISTS pkg_category")
    op.execute("DROP TYPE IF EXISTS inv_category")
    op.execute("DROP TYPE IF EXISTS app_status")
    op.execute("DROP TYPE IF EXISTS user_role")


def downgrade() -> None:
    op.execute("CREATE TYPE user_role AS ENUM ('public', 'supermarket', 'admin')")
    op.execute("CREATE TYPE app_status AS ENUM ('pending', 'collected', 'expired')")
    op.execute(
        "CREATE TYPE inv_category AS ENUM ("
        "'Proteins & Meat', 'Vegetables', 'Fruits', 'Dairy', 'Canned Goods', "
        "'Grains & Pasta', 'Snacks', 'Beverages', 'Baby Food'"
        ")"
    )
    op.execute(
        "CREATE TYPE pkg_category AS ENUM ("
        "'Pantry & Spices', 'Breakfast', 'Lunchbox', 'Family Bundle', 'Emergency Pack'"
        ")"
    )
