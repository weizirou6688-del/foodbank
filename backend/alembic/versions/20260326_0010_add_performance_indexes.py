"""Add performance indexes across key tables.

Revision ID: 20260326_0010
Revises: 20260326_0009
Create Date: 2026-03-26 00:00:00.000000

Adds strategically selected indexes for common query patterns.
"""
from alembic import op
import sqlalchemy as sa


revision = '20260326_0010'
down_revision = '20260326_0009'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add performance indexes."""
    
    # 1. applications: status filtering
    try:
        op.create_index(
            'idx_applications_status',
            'applications',
            ['status'],
            unique=False
        )
    except:
        pass
    
    # 2. inventory_lots: active lots with expiry
    try:
        op.create_index(
            'idx_inventory_lots_active_expiry',
            'inventory_lots',
            ['inventory_item_id', 'expiry_date', 'received_date'],
            postgresql_where=sa.text('quantity > 0 AND deleted_at IS NULL'),
            unique=False
        )
    except:
        pass
    
    # 3. food_bank_hours: temporal queries
    try:
        op.create_index(
            'idx_fh_valid_temporal',
            'food_bank_hours',
            ['food_bank_id', 'valid_from', 'valid_to'],
            unique=False
        )
    except:
        pass
    
    # 4. food_packages: active packages
    try:
        op.create_index(
            'idx_food_packages_active_stock',
            'food_packages',
            ['food_bank_id'],
            postgresql_where=sa.text('(is_active = true) AND (deleted_at IS NULL)'),
            unique=False
        )
    except:
        pass
    
    # 5. donations_goods: status tracking
    try:
        op.create_index(
            'idx_donations_goods_status',
            'donations_goods',
            ['status'],
            unique=False
        )
    except:
        pass
    
    # 6. restock_requests: assignment tracking
    try:
        op.create_index(
            'idx_restock_requests_assignment',
            'restock_requests',
            ['status', 'assigned_to_user_id'],
            unique=False
        )
    except:
        pass
    
    # 7. users: role-based queries
    try:
        op.create_index(
            'idx_users_role_email',
            'users',
            ['role', 'email'],
            unique=False
        )
    except:
        pass


def downgrade() -> None:
    """Drop performance indexes."""
    
    index_names = [
        'idx_users_role_email',
        'idx_restock_requests_assignment',
        'idx_donations_goods_status',
        'idx_food_packages_active_stock',
        'idx_fh_valid_temporal',
        'idx_inventory_lots_active_expiry',
        'idx_applications_status',
    ]
    
    for idx_name in index_names:
        try:
            op.drop_index(idx_name)
        except:
            pass
