"""Add admin scope and food bank notification fields.

Revision ID: 20260405_0020
Revises: 20260404_0019
Create Date: 2026-04-05 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260405_0020"
down_revision = "20260404_0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("food_bank_id", sa.Integer(), nullable=True),
    )
    op.create_index("ix_users_food_bank_id", "users", ["food_bank_id"], unique=False)
    op.create_foreign_key(
        "fk_users_food_bank_id_food_banks",
        "users",
        "food_banks",
        ["food_bank_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.add_column(
        "donations_cash",
        sa.Column("food_bank_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_donations_cash_food_bank_id",
        "donations_cash",
        ["food_bank_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_donations_cash_food_bank_id_food_banks",
        "donations_cash",
        "food_banks",
        ["food_bank_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.add_column(
        "food_banks",
        sa.Column("notification_email", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("food_banks", "notification_email")

    op.drop_constraint(
        "fk_donations_cash_food_bank_id_food_banks",
        "donations_cash",
        type_="foreignkey",
    )
    op.drop_index("ix_donations_cash_food_bank_id", table_name="donations_cash")
    op.drop_column("donations_cash", "food_bank_id")

    op.drop_constraint(
        "fk_users_food_bank_id_food_banks",
        "users",
        type_="foreignkey",
    )
    op.drop_index("ix_users_food_bank_id", table_name="users")
    op.drop_column("users", "food_bank_id")
