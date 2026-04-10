"""Enable PostgreSQL extensions for monitoring and analytics.

Revision ID: 20260326_0012
Revises: 20260326_0011
Create Date: 2026-03-26 00:00:00.000000

This revision is intentionally a placeholder. The desired PostgreSQL
extensions require superuser privileges and environment-specific database
configuration, so they were left for explicit manual enablement.
"""


revision = '20260326_0012'
down_revision = '20260326_0011'
branch_labels = None
depends_on = None

PLACEHOLDER_REASON = (
    "Extension enablement is environment-specific and may require superuser "
    "privileges plus shared_preload_libraries changes outside Alembic."
)


def upgrade() -> None:
    """Preserve the deferred extension checkpoint without schema changes."""
    _ = PLACEHOLDER_REASON


def downgrade() -> None:
    """Preserve downgrade traversal for the deferred extension checkpoint."""
    _ = PLACEHOLDER_REASON
