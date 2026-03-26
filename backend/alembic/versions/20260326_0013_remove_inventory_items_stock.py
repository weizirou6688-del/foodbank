"""Remove deprecated inventory_items.stock column.

Revision ID: 20260326_0013
Revises: 20260326_0012
Create Date: 2026-03-26 00:00:00.000000

Strategy: After migration 0007 moved all stock data to inventory_lots and set all stock to 0,
this migration removes the deprecated column entirely since:
1. All inventory is now tracked via inventory_lots table
2. inventory_items.stock is marked as deprecated and no longer used in application code
3. ORM models have been updated to remove the stock field
"""
from alembic import op
import sqlalchemy as sa


revision = '20260326_0013'
down_revision = '20260326_0012'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Remove the deprecated stock column from inventory_items."""
    
    # Drop the stock column from inventory_items
    # This column has been deprecated in favor of lot-based tracking via inventory_lots
    op.drop_column('inventory_items', 'stock')


def downgrade() -> None:
    """Restore the stock column to inventory_items."""
    
    # Restore the stock column with its original constraints and defaults
    op.add_column(
        'inventory_items',
        sa.Column(
            'stock',
            sa.Integer(),
            nullable=False,
            server_default=sa.text('0')
        )
    )
