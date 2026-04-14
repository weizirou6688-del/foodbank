"""Drop obsolete food_bank_hours table.

Revision ID: 20260411_0023
Revises: 20260409_0022
Create Date: 2026-04-11 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260411_0023"
down_revision = "20260409_0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table("food_bank_hours")


def downgrade() -> None:
    op.create_table(
        "food_bank_hours",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("food_bank_id", sa.Integer(), nullable=False),
        sa.Column("day_of_week", sa.String(length=20), nullable=False),
        sa.Column("open_time", sa.Time(), nullable=False),
        sa.Column("close_time", sa.Time(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=True,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=True,
            server_default=sa.text("now()"),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "valid_from",
            sa.Date(),
            nullable=False,
            server_default=sa.text("CURRENT_DATE"),
        ),
        sa.Column("valid_to", sa.Date(), nullable=True),
        sa.CheckConstraint(
            "valid_from <= COALESCE(valid_to, '9999-12-31'::DATE)",
            name="ck_fh_valid_date_range",
        ),
        sa.ForeignKeyConstraint(
            ["food_bank_id"],
            ["food_banks.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "food_bank_id",
            "day_of_week",
            name="uq_food_bank_hours_bank_day",
        ),
    )
    op.create_index(
        "idx_fh_food_bank_valid",
        "food_bank_hours",
        ["food_bank_id", "valid_from", "valid_to"],
        unique=False,
    )
    op.create_index(
        "idx_fh_valid_temporal",
        "food_bank_hours",
        ["food_bank_id", "valid_from", "valid_to"],
        unique=False,
    )
    op.create_index(
        "idx_food_bank_hours_active",
        "food_bank_hours",
        ["id"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "idx_food_bank_hours_deleted_at",
        "food_bank_hours",
        ["deleted_at"],
        unique=False,
    )
    op.create_index(
        "ix_food_bank_hours_food_bank_id",
        "food_bank_hours",
        ["food_bank_id"],
        unique=False,
    )
