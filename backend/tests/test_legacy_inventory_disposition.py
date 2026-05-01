from __future__ import annotations

from app.core.legacy_inventory_disposition import (
    candidate_name_match_kind,
    classify_legacy_inventory_bucket,
    normalize_inventory_item_name,
    recommend_legacy_inventory_action,
)


def test_normalize_inventory_item_name_removes_measure_noise() -> None:
    assert normalize_inventory_item_name("Rice (2kg)") == "rice"
    assert normalize_inventory_item_name("Pasta (500g)") == "pasta"
    assert normalize_inventory_item_name("UHT Milk (1L)") == "uht milk"


def test_candidate_name_match_kind_supports_normalized_matches() -> None:
    assert candidate_name_match_kind("Rice", "Rice (2kg)") == "normalized_name"
    assert candidate_name_match_kind("Canned Beans", "Canned Beans") == "exact_name"
    assert candidate_name_match_kind("Breakfast Cereal", "Cornflakes Cereal") is None


def test_classify_and_recommend_live_stock_row() -> None:
    disposition = {
        "active_lot_count": 12,
        "active_package_ref_count": 0,
        "package_ref_count": 1,
        "application_ref_count": 0,
        "restock_ref_count": 0,
        "snapshot_ref_count": 0,
        "candidate_count": 2,
    }
    assert classify_legacy_inventory_bucket(
        active_lot_count=disposition["active_lot_count"],
        active_package_ref_count=disposition["active_package_ref_count"],
        package_ref_count=disposition["package_ref_count"],
        application_ref_count=disposition["application_ref_count"],
        restock_ref_count=disposition["restock_ref_count"],
    ) == "historical_compatibility"
    assert recommend_legacy_inventory_action(**disposition) == "keep_and_migrate_live_stock"


# Historical-anchor cases must stay covered because old package/application rows still
# need these legacy items to explain past distribution history after stock moves elsewhere.
def test_classify_and_recommend_historical_anchor_with_mapping() -> None:
    disposition = {
        "active_lot_count": 0,
        "active_package_ref_count": 0,
        "package_ref_count": 2,
        "application_ref_count": 1,
        "restock_ref_count": 0,
        "snapshot_ref_count": 4,
        "candidate_count": 2,
    }
    assert classify_legacy_inventory_bucket(
        active_lot_count=disposition["active_lot_count"],
        active_package_ref_count=disposition["active_package_ref_count"],
        package_ref_count=disposition["package_ref_count"],
        application_ref_count=disposition["application_ref_count"],
        restock_ref_count=disposition["restock_ref_count"],
    ) == "migrate_before_archive"
    assert recommend_legacy_inventory_action(**disposition) == "keep_history_add_mapping"


def test_classify_and_recommend_historical_anchor_without_target() -> None:
    disposition = {
        "active_lot_count": 0,
        "active_package_ref_count": 0,
        "package_ref_count": 1,
        "application_ref_count": 0,
        "restock_ref_count": 0,
        "snapshot_ref_count": 0,
        "candidate_count": 0,
    }
    assert classify_legacy_inventory_bucket(
        active_lot_count=disposition["active_lot_count"],
        active_package_ref_count=disposition["active_package_ref_count"],
        package_ref_count=disposition["package_ref_count"],
        application_ref_count=disposition["application_ref_count"],
        restock_ref_count=disposition["restock_ref_count"],
    ) == "migrate_before_archive"
    assert recommend_legacy_inventory_action(**disposition) == "keep_history_define_target_first"
