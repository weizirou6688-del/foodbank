"""Restore missing revision placeholder.

Revision ID: 20260405_0021
Revises: 20260405_0020
Create Date: 2026-04-05 23:59:00.000000
"""


revision = "20260405_0021"
down_revision = "20260405_0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # This revision was missing from the repository while already stamped in the
    # local database. Keep it as a no-op placeholder so Alembic can continue
    # from the recorded state safely.
    return None


def downgrade() -> None:
    return None
