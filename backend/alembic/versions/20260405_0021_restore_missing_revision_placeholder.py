"""Restore missing revision placeholder.

Revision ID: 20260405_0021
Revises: 20260405_0020
Create Date: 2026-04-05 23:59:00.000000
"""

PLACEHOLDER_REASON = (
    "This revision was stamped in local databases before the file was restored. "
    "Keep it as a no-op so Alembic can traverse history safely."
)

revision = "20260405_0021"
down_revision = "20260405_0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Preserve the recorded revision without altering schema state."""
    # This migration intentionally performs no schema changes.
    _ = PLACEHOLDER_REASON


def downgrade() -> None:
    """Preserve downgrade traversal for the restored placeholder."""
    _ = PLACEHOLDER_REASON
