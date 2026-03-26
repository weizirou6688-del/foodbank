"""Add audit and soft-delete fields to key tables.

Revision ID: 20260326_0005
Revises: 20260326_0004
Create Date: 2026-03-26 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260326_0005'
down_revision = '20260326_0004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add missing audit and soft-delete fields to tables."""
    
    # 1. applications: add updated_at and deleted_at
    op.add_column('applications', sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')))
    op.add_column('applications', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index('idx_applications_deleted_at', 'applications', ['deleted_at'])
    op.create_index('idx_applications_active', 'applications', ['id'], postgresql_where=sa.text('deleted_at IS NULL'))
    
    # 2. food_packages: add updated_at and deleted_at
    op.add_column('food_packages', sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')))
    op.add_column('food_packages', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index('idx_food_packages_deleted_at', 'food_packages', ['deleted_at'])
    op.create_index('idx_food_packages_active', 'food_packages', ['id'], postgresql_where=sa.text('(is_active = true) AND (deleted_at IS NULL)'))
    
    # 3. inventory_items: add created_at and deleted_at
    op.add_column('inventory_items', sa.Column('created_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')))
    op.add_column('inventory_items', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index('idx_inventory_items_deleted_at', 'inventory_items', ['deleted_at'])
    op.create_index('idx_inventory_items_active', 'inventory_items', ['id'], postgresql_where=sa.text('deleted_at IS NULL'))
    
    # 4. food_bank_hours: add created_at, updated_at, and deleted_at
    op.add_column('food_bank_hours', sa.Column('created_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')))
    op.add_column('food_bank_hours', sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')))
    op.add_column('food_bank_hours', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index('idx_food_bank_hours_deleted_at', 'food_bank_hours', ['deleted_at'])
    op.create_index('idx_food_bank_hours_active', 'food_bank_hours', ['id'], postgresql_where=sa.text('deleted_at IS NULL'))
    
    # 5. restock_requests: add updated_at and deleted_at
    op.add_column('restock_requests', sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')))
    op.add_column('restock_requests', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index('idx_restock_requests_deleted_at', 'restock_requests', ['deleted_at'])
    op.create_index('idx_restock_requests_active', 'restock_requests', ['id'], postgresql_where=sa.text('deleted_at IS NULL'))
    
    # 6. donations_cash: add updated_at and deleted_at
    op.add_column('donations_cash', sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')))
    op.add_column('donations_cash', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index('idx_donations_cash_deleted_at', 'donations_cash', ['deleted_at'])
    op.create_index('idx_donations_cash_active', 'donations_cash', ['id'], postgresql_where=sa.text('deleted_at IS NULL'))
    
    # 7. donations_goods: add updated_at and deleted_at
    op.add_column('donations_goods', sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')))
    op.add_column('donations_goods', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index('idx_donations_goods_deleted_at', 'donations_goods', ['deleted_at'])
    op.create_index('idx_donations_goods_active', 'donations_goods', ['id'], postgresql_where=sa.text('deleted_at IS NULL'))


def downgrade() -> None:
    """Remove audit and soft-delete fields from tables."""
    
    # Drop indexes - use correct naming pattern
    tables_active = [
        'donations_goods', 'donations_cash', 'restock_requests', 'food_bank_hours',
        'inventory_items', 'food_packages', 'applications'
    ]
    
    for table in tables_active:
        try:
            op.drop_index(f'idx_{table}_active', table_name=table)
        except:
            pass
        
        try:
            op.drop_index(f'idx_{table}_deleted_at', table_name=table)
        except:
            pass
    
    # Drop columns safely (only drop what was potentially added)
    tables_and_columns = [
        ('donations_goods', ['updated_at', 'deleted_at']),
        ('donations_cash', ['updated_at', 'deleted_at']),
        ('restock_requests', ['updated_at', 'deleted_at']),
        ('food_bank_hours', ['created_at', 'updated_at', 'deleted_at']),
        ('inventory_items', ['created_at', 'deleted_at']),
        ('food_packages', ['updated_at', 'deleted_at']),
        ('applications', ['updated_at', 'deleted_at']),
    ]
    
    for table, cols in tables_and_columns:
        for col in cols:
            try:
                op.drop_column(table, col)
            except:
                pass

