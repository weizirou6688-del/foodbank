from __future__ import annotations

from app.models import Base


AUDIT_COLUMN_REQUIREMENTS = {
    "food_packages": {"updated_at", "deleted_at"},
    "inventory_items": {"created_at", "deleted_at"},
    "restock_requests": {"updated_at", "deleted_at"},
    "donations_cash": {"updated_at", "deleted_at"},
    "donations_goods": {"updated_at", "deleted_at"},
}

KEY_INDEX_REQUIREMENTS = {
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

UNEXPECTED_LEGACY_INDEXES = {
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


def _table_columns(table_name: str) -> set[str]:
    return set(Base.metadata.tables[table_name].columns.keys())


def _table_index_names(table_name: str) -> set[str]:
    return {index.name for index in Base.metadata.tables[table_name].indexes}


def test_soft_delete_audit_columns_are_present_on_migrated_tables() -> None:
    """These columns keep audit timestamps and soft-delete filtering aligned with live API behavior."""

    for table_name, columns in AUDIT_COLUMN_REQUIREMENTS.items():
        assert columns <= _table_columns(table_name)


def test_key_runtime_indexes_are_declared_for_migrated_tables() -> None:
    """These indexes protect the admin and public query paths that depend on active-row and scope lookups."""

    for table_name, indexes in KEY_INDEX_REQUIREMENTS.items():
        assert indexes <= _table_index_names(table_name)


def test_metadata_does_not_declare_indexes_missing_from_live_schema() -> None:
    """These removed indexes must stay absent so metadata drift does not hide migration mismatches."""

    for table_name, indexes in UNEXPECTED_LEGACY_INDEXES.items():
        assert indexes.isdisjoint(_table_index_names(table_name))
