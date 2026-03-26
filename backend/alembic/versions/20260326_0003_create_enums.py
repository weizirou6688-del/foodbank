"""Create PostgreSQL enum types for domain values.

Revision ID: 20260326_0003
Revises: 20260325_0002
Create Date: 2026-03-26 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260326_0003'
down_revision = '20260325_0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create enum types for domain values."""
    
    # user_role enum: public, supermarket, admin
    op.execute("""
        CREATE TYPE user_role AS ENUM (
            'public',
            'supermarket',
            'admin'
        );
    """)
    
    # app_status enum: pending, collected, expired
    op.execute("""
        CREATE TYPE app_status AS ENUM (
            'pending',
            'collected',
            'expired'
        );
    """)
    
    # inv_category enum: various food inventory categories
    op.execute("""
        CREATE TYPE inv_category AS ENUM (
            'Proteins & Meat',
            'Vegetables',
            'Fruits',
            'Dairy',
            'Canned Goods',
            'Grains & Pasta',
            'Snacks',
            'Beverages',
            'Baby Food'
        );
    """)
    
    # pkg_category enum: food package categories
    op.execute("""
        CREATE TYPE pkg_category AS ENUM (
            'Pantry & Spices',
            'Breakfast',
            'Lunchbox',
            'Family Bundle',
            'Emergency Pack'
        );
    """)


def downgrade() -> None:
    """Drop enum types."""
    
    # Drop enums in reverse order of creation
    op.execute("DROP TYPE IF EXISTS pkg_category;")
    op.execute("DROP TYPE IF EXISTS inv_category;")
    op.execute("DROP TYPE IF EXISTS app_status;")
    op.execute("DROP TYPE IF EXISTS user_role;")
