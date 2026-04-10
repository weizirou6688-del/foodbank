"""Enable Row-Level Security (RLS) on sensitive tables.

Revision ID: 20260326_0011
Revises: 20260326_0010
Create Date: 2026-03-26 00:00:00.000000

This revision is intentionally a placeholder. Enabling RLS safely requires
coordinated application-layer session context and deployment controls that
were deferred when this migration chain was captured.
"""


revision = '20260326_0011'
down_revision = '20260326_0010'
branch_labels = None
depends_on = None

PLACEHOLDER_REASON = (
    "RLS enablement is deferred until the application sets the required "
    "database session context consistently in production."
)


def upgrade() -> None:
    """Preserve the deferred RLS checkpoint without schema changes."""
    _ = PLACEHOLDER_REASON


def downgrade() -> None:
    """Preserve downgrade traversal for the deferred RLS checkpoint."""
    _ = PLACEHOLDER_REASON
