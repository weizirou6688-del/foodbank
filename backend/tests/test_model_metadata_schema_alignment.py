from __future__ import annotations

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.models import Base


def test_soft_delete_audit_columns_are_present_on_migrated_tables() -> None:
    expected_columns = {
        "food_packages": {"updated_at", "deleted_at"},
        "inventory_items": {"created_at", "deleted_at"},
        "restock_requests": {"updated_at", "deleted_at"},
        "donations_cash": {"updated_at", "deleted_at"},
        "donations_goods": {"updated_at", "deleted_at"},
    }

    for table_name, columns in expected_columns.items():
        table_columns = set(Base.metadata.tables[table_name].columns.keys())
        assert columns <= table_columns


def test_soft_delete_indexes_are_declared_for_migrated_tables() -> None:
    expected_indexes = {
        "applications": {
            "idx_applications_active",
            "idx_applications_deleted_at",
            "idx_applications_status",
            "idx_applications_user_week",
        },
        "inventory_lots": {
            "idx_inventory_lots_active_expiry",
            "idx_lots_active",
            "idx_lots_deleted",
            "idx_lots_expiry",
            "idx_lots_item",
        },
        "food_packages": {"idx_food_packages_active", "idx_food_packages_deleted_at"},
        "inventory_items": {"idx_inventory_items_active", "idx_inventory_items_deleted_at"},
        "restock_requests": {"idx_restock_requests_active", "idx_restock_requests_deleted_at"},
        "donations_cash": {"idx_donations_cash_active", "idx_donations_cash_deleted_at"},
        "donations_goods": {"idx_donations_goods_active", "idx_donations_goods_deleted_at"},
        "users": {"idx_users_role_email"},
    }

    for table_name, indexes in expected_indexes.items():
        table_index_names = {index.name for index in Base.metadata.tables[table_name].indexes}
        assert indexes <= table_index_names


def test_metadata_does_not_declare_indexes_missing_from_live_schema() -> None:
    unexpected_indexes = {
        "applications": {"ix_applications_deleted_at", "ix_applications_week_start"},
        "inventory_lots": {
            "ix_inventory_lots_expiry_date",
            "ix_inventory_lots_inventory_item_id",
        },
        "password_reset_tokens": {
            "ix_password_reset_tokens_expires_at",
            "ix_password_reset_tokens_used_at",
        },
    }

    for table_name, indexes in unexpected_indexes.items():
        table_index_names = {index.name for index in Base.metadata.tables[table_name].indexes}
        assert indexes.isdisjoint(table_index_names)
