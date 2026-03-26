"""Create inventory_lots table for inventory lot tracking.

Revision ID: 20260326_0004
Revises: 20260326_0003
Create Date: 2026-03-26 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import func


# revision identifiers, used by Alembic.
revision = '20260326_0004'
down_revision = '20260326_0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create inventory_lots table."""
    
    op.create_table(
        'inventory_lots',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('inventory_item_id', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('expiry_date', sa.Date(), nullable=False),
        sa.Column('received_date', sa.Date(), nullable=False, server_default=sa.func.current_date()),
        sa.Column('batch_reference', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=func.now()),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        
        # Primary key
        sa.PrimaryKeyConstraint('id'),
        
        # Foreign key to inventory_items
        sa.ForeignKeyConstraint(['inventory_item_id'], ['inventory_items.id'], ondelete='CASCADE'),
        
        # Check constraint for quantity
        sa.CheckConstraint('quantity > 0', name='ck_inventory_lots_quantity_positive'),
        
        # Check constraint for date order
        sa.CheckConstraint('received_date <= expiry_date', name='ck_inventory_lots_dates'),
    )
    
    # Create indexes
    op.create_index(
        'idx_lots_item',
        'inventory_lots',
        ['inventory_item_id'],
        unique=False
    )
    
    op.create_index(
        'idx_lots_expiry',
        'inventory_lots',
        ['expiry_date'],
        unique=False
    )
    
    # Partial index: active lots (not deleted)
    op.create_index(
        'idx_lots_active',
        'inventory_lots',
        ['id'],
        postgresql_where=sa.text('deleted_at IS NULL'),
        unique=False
    )
    
    # Partial index: not deleted lots
    op.create_index(
        'idx_lots_deleted',
        'inventory_lots',
        ['deleted_at'],
        unique=False
    )


def downgrade() -> None:
    """Drop inventory_lots table."""
    
    # Drop indexes
    op.drop_index('idx_lots_deleted', table_name='inventory_lots')
    op.drop_index('idx_lots_active', table_name='inventory_lots')
    op.drop_index('idx_lots_expiry', table_name='inventory_lots')
    op.drop_index('idx_lots_item', table_name='inventory_lots')
    
    # Drop table
    op.drop_table('inventory_lots')
