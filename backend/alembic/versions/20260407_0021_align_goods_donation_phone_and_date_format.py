"""Align goods donation phone and pickup date formats.

Revision ID: 20260407_0021
Revises: 20260405_0021
Create Date: 2026-04-07 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260407_0021"
down_revision = "20260405_0021"
branch_labels = None
depends_on = None


DONOR_PHONE_CONSTRAINT = r"donor_phone ~ '^[0-9]{11}$'"
PICKUP_DATE_CONSTRAINT = r"""
pickup_date IS NULL OR (
    pickup_date ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
    AND to_char(to_date(pickup_date, 'DD/MM/YYYY'), 'DD/MM/YYYY') = pickup_date
)
"""


def upgrade() -> None:
    op.execute(
        r"""
        UPDATE donations_goods
        SET donor_phone = CASE
            WHEN length(regexp_replace(coalesce(donor_phone, ''), '\D', '', 'g')) = 11
                THEN regexp_replace(donor_phone, '\D', '', 'g')
            ELSE '00000000000'
        END
        """
    )

    op.alter_column(
        "donations_goods",
        "donor_phone",
        existing_type=sa.String(length=30),
        type_=sa.String(length=11),
        existing_nullable=False,
    )

    op.alter_column(
        "donations_goods",
        "pickup_date",
        existing_type=sa.Date(),
        type_=sa.String(length=10),
        existing_nullable=True,
        postgresql_using="CASE WHEN pickup_date IS NULL THEN NULL ELSE to_char(pickup_date, 'DD/MM/YYYY') END",
    )

    op.create_check_constraint(
        "ck_donations_goods_donor_phone",
        "donations_goods",
        DONOR_PHONE_CONSTRAINT,
    )
    op.create_check_constraint(
        "ck_donations_goods_pickup_date_format",
        "donations_goods",
        PICKUP_DATE_CONSTRAINT,
    )


def downgrade() -> None:
    op.drop_constraint("ck_donations_goods_pickup_date_format", "donations_goods", type_="check")
    op.drop_constraint("ck_donations_goods_donor_phone", "donations_goods", type_="check")

    op.alter_column(
        "donations_goods",
        "pickup_date",
        existing_type=sa.String(length=10),
        type_=sa.Date(),
        existing_nullable=True,
        postgresql_using="CASE WHEN pickup_date IS NULL THEN NULL ELSE to_date(pickup_date, 'DD/MM/YYYY') END",
    )

    op.alter_column(
        "donations_goods",
        "donor_phone",
        existing_type=sa.String(length=11),
        type_=sa.String(length=30),
        existing_nullable=False,
    )
