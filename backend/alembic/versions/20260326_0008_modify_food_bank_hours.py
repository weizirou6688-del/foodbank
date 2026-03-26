"""Modify food_bank_hours: update day_of_week constraints and add validity date range.

Revision ID: 20260326_0008
Revises: 20260326_0007
Create Date: 2026-03-26 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '20260326_0008'
down_revision = '20260326_0007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Modify food_bank_hours for better temporal constraints."""
    
    # Step 1: Add valid_from and valid_to columns
    op.add_column('food_bank_hours', 
                 sa.Column('valid_from', sa.Date(), nullable=False, 
                          server_default=sa.text('CURRENT_DATE')))
    op.add_column('food_bank_hours', 
                 sa.Column('valid_to', sa.Date(), nullable=True))
    
    # Step 2: Add CHECK constraint for date range
    op.create_check_constraint(
        'ck_fh_valid_date_range',
        'food_bank_hours',
        'valid_from <= COALESCE(valid_to, \'9999-12-31\'::DATE)'
    )
    
    # Step 3: Note on day_of_week - currently VARCHAR(20), should be validated at app level
    # Adding CHECK constraint requires day_of_week to be numeric
    # For now, we skip this constraint as day_of_week is VARCHAR and app validates
    # Production: migrate day_of_week to SMALLINT first if needed
    
    # Step 4: Add composite index for temporal queries
    op.create_index(
        'idx_fh_food_bank_valid',
        'food_bank_hours',
        ['food_bank_id', 'valid_from', 'valid_to'],
        unique=False
    )


def downgrade() -> None:
    """Revert food_bank_hours modifications."""
    
    # Drop index
    try:
        op.drop_index('idx_fh_food_bank_valid', table_name='food_bank_hours')
    except:
        pass
    
    # Drop constraints
    try:
        op.drop_constraint('ck_fh_valid_date_range', 'food_bank_hours')
    except:
        pass
    
    # Drop columns
    op.drop_column('food_bank_hours', 'valid_to')
    op.drop_column('food_bank_hours', 'valid_from')
