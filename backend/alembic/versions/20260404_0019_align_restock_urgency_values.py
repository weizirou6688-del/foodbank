"""Align restock request urgency values with application code.

Revision ID: 20260404_0019
Revises: 20260402_0018
Create Date: 2026-04-04 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260404_0019"
down_revision = "20260402_0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE restock_requests
        SET urgency = CASE LOWER(urgency)
            WHEN 'critical' THEN 'high'
            WHEN 'urgent' THEN 'medium'
            WHEN 'low' THEN 'low'
            WHEN 'high' THEN 'high'
            WHEN 'medium' THEN 'medium'
            ELSE urgency
        END
        """
    )
    op.drop_constraint("ck_restock_requests_urgency", "restock_requests", type_="check")
    op.create_check_constraint(
        "ck_restock_requests_urgency",
        "restock_requests",
        "urgency IN ('high','medium','low')",
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE restock_requests
        SET urgency = CASE LOWER(urgency)
            WHEN 'high' THEN 'Critical'
            WHEN 'medium' THEN 'Urgent'
            WHEN 'low' THEN 'Low'
            ELSE urgency
        END
        """
    )
    op.drop_constraint("ck_restock_requests_urgency", "restock_requests", type_="check")
    op.create_check_constraint(
        "ck_restock_requests_urgency",
        "restock_requests",
        "urgency IN ('Critical','Urgent','Low')",
    )
