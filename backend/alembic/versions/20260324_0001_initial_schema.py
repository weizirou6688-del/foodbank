"""Create the initial application schema.

This is the base Alembic revision for the project.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260324_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("role IN ('public','supermarket','admin')", name="ck_users_role"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )

    op.create_table(
        "food_banks",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("address", sa.Text(), nullable=False),
        sa.Column("lat", sa.Numeric(9, 6), nullable=False),
        sa.Column("lng", sa.Numeric(9, 6), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "inventory_items",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("stock", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("unit", sa.String(length=50), nullable=False),
        sa.Column("threshold", sa.Integer(), server_default=sa.text("10"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_inventory_items_category"), "inventory_items", ["category"], unique=False)

    op.create_table(
        "donations_cash",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("donor_email", sa.String(length=255), nullable=False),
        sa.Column("amount_pence", sa.Integer(), nullable=False),
        sa.Column("payment_reference", sa.String(length=100), nullable=True),
        sa.Column("status", sa.String(length=20), server_default=sa.text("'completed'"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("status IN ('completed','failed','refunded')", name="ck_donations_cash_status"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_donations_cash_donor_email"), "donations_cash", ["donor_email"], unique=False)
    op.create_index(op.f("ix_donations_cash_payment_reference"), "donations_cash", ["payment_reference"], unique=False)
    op.create_index(op.f("ix_donations_cash_status"), "donations_cash", ["status"], unique=False)

    op.create_table(
        "food_bank_hours",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("food_bank_id", sa.Integer(), nullable=False),
        sa.Column("day_of_week", sa.String(length=20), nullable=False),
        sa.Column("open_time", sa.Time(), nullable=False),
        sa.Column("close_time", sa.Time(), nullable=False),
        sa.ForeignKeyConstraint(["food_bank_id"], ["food_banks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("food_bank_id", "day_of_week", name="uq_food_bank_hours_bank_day"),
    )
    op.create_index(op.f("ix_food_bank_hours_food_bank_id"), "food_bank_hours", ["food_bank_id"], unique=False)

    op.create_table(
        "food_packages",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("stock", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("threshold", sa.Integer(), server_default=sa.text("5"), nullable=False),
        sa.Column("applied_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("image_url", sa.Text(), nullable=True),
        sa.Column("food_bank_id", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["food_bank_id"], ["food_banks.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_food_packages_category"), "food_packages", ["category"], unique=False)
    op.create_index(op.f("ix_food_packages_food_bank_id"), "food_packages", ["food_bank_id"], unique=False)
    op.create_index(op.f("ix_food_packages_is_active"), "food_packages", ["is_active"], unique=False)

    op.create_table(
        "applications",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("food_bank_id", sa.Integer(), nullable=False),
        sa.Column("redemption_code", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), server_default=sa.text("'pending'"), nullable=False),
        sa.Column("weekly_period", sa.String(length=10), nullable=False),
        sa.Column("total_quantity", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("status IN ('pending','collected','expired')", name="ck_applications_status"),
        sa.ForeignKeyConstraint(["food_bank_id"], ["food_banks.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("redemption_code"),
    )
    op.create_index(op.f("ix_applications_food_bank_id"), "applications", ["food_bank_id"], unique=False)
    op.create_index(op.f("ix_applications_status"), "applications", ["status"], unique=False)
    op.create_index(op.f("ix_applications_user_id"), "applications", ["user_id"], unique=False)
    op.create_index(op.f("ix_applications_weekly_period"), "applications", ["weekly_period"], unique=False)
    op.create_index("ix_applications_user_weekly_period", "applications", ["user_id", "weekly_period"], unique=False)

    op.create_table(
        "donations_goods",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("donor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("donor_name", sa.String(length=100), nullable=False),
        sa.Column("donor_email", sa.String(length=255), nullable=False),
        sa.Column("donor_phone", sa.String(length=30), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), server_default=sa.text("'pending'"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("status IN ('pending','received','rejected')", name="ck_donations_goods_status"),
        sa.ForeignKeyConstraint(["donor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_donations_goods_donor_email"), "donations_goods", ["donor_email"], unique=False)
    op.create_index(op.f("ix_donations_goods_donor_user_id"), "donations_goods", ["donor_user_id"], unique=False)
    op.create_index(op.f("ix_donations_goods_status"), "donations_goods", ["status"], unique=False)

    op.create_table(
        "package_items",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("package_id", sa.Integer(), nullable=False),
        sa.Column("inventory_item_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.ForeignKeyConstraint(["inventory_item_id"], ["inventory_items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["package_id"], ["food_packages.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_package_items_inventory_item_id"), "package_items", ["inventory_item_id"], unique=False)
    op.create_index(op.f("ix_package_items_package_id"), "package_items", ["package_id"], unique=False)

    op.create_table(
        "application_items",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("application_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("package_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["package_id"], ["food_packages.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_application_items_application_id"), "application_items", ["application_id"], unique=False)
    op.create_index(op.f("ix_application_items_package_id"), "application_items", ["package_id"], unique=False)

    op.create_table(
        "donation_goods_items",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("donation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("item_name", sa.String(length=200), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["donation_id"], ["donations_goods.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_donation_goods_items_donation_id"), "donation_goods_items", ["donation_id"], unique=False)

    op.create_table(
        "restock_requests",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("inventory_item_id", sa.Integer(), nullable=False),
        sa.Column("current_stock", sa.Integer(), nullable=False),
        sa.Column("threshold", sa.Integer(), nullable=False),
        sa.Column("urgency", sa.String(length=20), nullable=False),
        sa.Column("assigned_to_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(length=20), server_default=sa.text("'open'"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("status IN ('open','fulfilled','cancelled')", name="ck_restock_requests_status"),
        sa.CheckConstraint("urgency IN ('Critical','Urgent','Low')", name="ck_restock_requests_urgency"),
        sa.ForeignKeyConstraint(["assigned_to_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["inventory_item_id"], ["inventory_items.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_restock_requests_assigned_to_user_id"), "restock_requests", ["assigned_to_user_id"], unique=False)
    op.create_index(op.f("ix_restock_requests_inventory_item_id"), "restock_requests", ["inventory_item_id"], unique=False)
    op.create_index(op.f("ix_restock_requests_status"), "restock_requests", ["status"], unique=False)


def downgrade() -> None:
    op.drop_table("restock_requests")
    op.drop_table("donation_goods_items")
    op.drop_table("application_items")
    op.drop_table("package_items")
    op.drop_table("donations_goods")
    op.drop_table("applications")
    op.drop_table("food_packages")
    op.drop_table("food_bank_hours")
    op.drop_table("donations_cash")
    op.drop_table("inventory_items")
    op.drop_table("food_banks")
    op.drop_table("users")
