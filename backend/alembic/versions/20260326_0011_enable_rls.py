"""Enable Row-Level Security (RLS) on sensitive tables.

Revision ID: 20260326_0011
Revises: 20260326_0010
Create Date: 2026-03-26 00:00:00.000000

OPTIONAL: RLS is optional and requires application layer support.
This migration is a placeholder for future RLS implementation.
"""
from alembic import op
import sqlalchemy as sa


revision = '20260326_0011'
down_revision = '20260326_0010'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """RLS configuration placeholder (no-op)."""
    # RLS requires application layer session variable configuration
    # This is deferred until explicitly enabled in production
    # To enable RLS in future:
    # op.execute("ALTER TABLE applications ENABLE ROW LEVEL SECURITY;")
    pass
    

def downgrade() -> None:
    """RLS deactivation (no-op)."""
    pass
