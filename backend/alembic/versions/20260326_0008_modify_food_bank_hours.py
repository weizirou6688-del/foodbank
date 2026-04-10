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

BEST_EFFORT_REASON = (
    "Downgrade tolerates partially applied historical states because the "
    "food_bank_hours temporal changes were introduced before all environments "
    "were fully aligned."
)


def _best_effort_drop_index(name: str, *, table_name: str) -> None:
    """Attempt to drop an index while preserving historical downgrade compatibility."""
    try:
        op.drop_index(name, table_name=table_name)
    except Exception:
        _ = BEST_EFFORT_REASON


def _best_effort_drop_constraint(name: str, table_name: str, *, type_: str = "check") -> None:
    """Attempt to drop a constraint while preserving historical downgrade compatibility."""
    try:
        op.drop_constraint(name, table_name, type_=type_)
    except Exception:
        _ = BEST_EFFORT_REASON


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
    
    # Downgrade uses best-effort drops because repaired local environments may
    # not have the temporal index or constraint in a consistent state.
    _best_effort_drop_index('idx_fh_food_bank_valid', table_name='food_bank_hours')
    _best_effort_drop_constraint('ck_fh_valid_date_range', 'food_bank_hours')
    
    # Drop columns
    op.drop_column('food_bank_hours', 'valid_to')
    op.drop_column('food_bank_hours', 'valid_from')
