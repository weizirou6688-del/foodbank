"""Drop legacy-format redemption code applications.

Revision ID: 20260415_0026
Revises: 20260411_0025
Create Date: 2026-04-15 12:00:00.000000
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260415_0026"
down_revision = "20260411_0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DELETE FROM applications
        WHERE btrim(redemption_code) !~ '^[A-Z0-9]{4}-[A-Z0-9]{4}$'
        """
    )


def downgrade() -> None:
    pass
