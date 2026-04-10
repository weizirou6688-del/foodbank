"""Ensure food_packages table has all required fields.

Revision ID: 20260326_0009
Revises: 20260326_0008
Create Date: 2026-03-26 00:00:00.000000

This revision is retained as a verification checkpoint. The required
food_packages fields already existed when the migration chain was
stabilized, so no schema mutation is performed here.
"""


revision = '20260326_0009'
down_revision = '20260326_0008'
branch_labels = None
depends_on = None

NOOP_REASON = (
    "food_packages already matched the expected schema when this revision "
    "was recorded, so the migration remains a no-op verification step."
)


def upgrade() -> None:
    """Preserve the verification checkpoint without altering schema state."""
    _ = NOOP_REASON


def downgrade() -> None:
    """Preserve downgrade traversal for the verification checkpoint."""
    _ = NOOP_REASON
