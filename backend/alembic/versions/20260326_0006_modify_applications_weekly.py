"""Modify applications table: replace weekly_period with week_start and total_quantity.

Revision ID: 20260326_0006
Revises: 20260326_0005
Create Date: 2026-03-26 00:00:00.000000

This migration handles a complex data transformation:
1. Add new columns (week_start, total_quantity) as nullable
2. Migrate data from weekly_period → week_start (parse ISO week format)
3. Calculate total_quantity from application_items
4. Make columns NOT NULL
5. Drop weekly_period column
6. Add composite index on (user_id, week_start)
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision = '20260326_0006'
down_revision = '20260326_0005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Migrate applications weekly tracking from weekly_period to week_start+total_quantity."""
    
    # Step 1: Add week_start column as nullable (temporary)
    op.add_column('applications', sa.Column('week_start', sa.Date(), nullable=True))
    
    # Step 2: Migrate data from weekly_period to week_start
    # weekly_period format is typically ISO week like "2026-W12"
    # Convert it to Monday of that week
    op.execute("""
        UPDATE applications
        SET week_start = (
            -- Parse ISO week to get Monday of that week
            -- Format: YYYY-Www (e.g., "2026-W12" means year 2026, week 12)
            CASE 
                WHEN weekly_period IS NOT NULL AND weekly_period ~ '^\\d{4}-W\\d{2}$' THEN
                    -- ISO week format: extract year and week number
                    TO_DATE(
                        SUBSTRING(weekly_period FROM 1 FOR 4) || '-' || 
                        SUBSTRING(weekly_period FROM 7 FOR 2) || '-1', 
                        'YYYY-W-D'
                    )
                ELSE CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER + 1
            END
        )
        WHERE week_start IS NULL
    """)
    
    # Step 3: Recap total_quantity from application_items if needed
    # (total_quantity column already exists, ensure it's set correctly)
    op.execute("""
        UPDATE applications a
        SET total_quantity = COALESCE(
            (SELECT SUM(quantity) FROM application_items ai 
             WHERE ai.application_id = a.id),
            COALESCE(total_quantity, 0)
        )
    """)
    
    # Step 4: Make week_start NOT NULL
    op.alter_column('applications', 'week_start', nullable=False, existing_type=sa.Date())
    
    # Step 5: Make total_quantity NOT NULL
    op.alter_column('applications', 'total_quantity', nullable=False, existing_type=sa.Integer())
    
    # Step 6: Drop weekly_period column as it's now replaced by week_start
    op.drop_column('applications', 'weekly_period')
    
    # Step 7: Add composite index for common queries
    op.create_index(
        'idx_applications_user_week',
        'applications',
        ['user_id', 'week_start'],
        unique=False
    )


def downgrade() -> None:
    """Revert applications table changes."""
    
    # Drop index
    try:
        op.drop_index('idx_applications_user_week', table_name='applications')
    except:
        pass
    
    # Re-add weekly_period column
    op.add_column('applications', sa.Column('weekly_period', sa.String(10), nullable=True))
    
    # Reverse-populate weekly_period from week_start
    op.execute("""
        UPDATE applications
        SET weekly_period = TO_CHAR(week_start, 'YYYY-"W"IW')
        WHERE week_start IS NOT NULL
    """)
    
    # Make weekly_period NOT NULL if needed
    op.alter_column('applications', 'weekly_period', nullable=False, existing_type=sa.String(10))
    
    # Drop new columns
    op.drop_column('applications', 'total_quantity')
    op.drop_column('applications', 'week_start')
