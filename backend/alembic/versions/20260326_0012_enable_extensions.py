"""Enable PostgreSQL extensions for monitoring and analytics.

Revision ID: 20260326_0012
Revises: 20260326_0011
Create Date: 2026-03-26 00:00:00.000000

OPTIONAL: Enable for production monitoring. Requires superuser privileges.
"""
from alembic import op
import sqlalchemy as sa


revision = '20260326_0012'
down_revision = '20260326_0011'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Enable PostgreSQL extensions (no-op if no superuser privilege)."""
    
    # pg_stat_statements requires superuser privilege and is optional
    # This migration is a placeholder; actual enablement requires manual setup:
    # 1. Connect as superuser
    # 2. Run: CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
    # 3. Add to postgresql.conf: shared_preload_libraries = 'pg_stat_statements'
    # 4. Restart PostgreSQL
    pass


def downgrade() -> None:
    """Drop PostgreSQL extensions (no-op)."""
    pass
