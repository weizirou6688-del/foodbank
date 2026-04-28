"""对没有范围的旧版库存记录做分类和清理的判断逻辑。"""

from __future__ import annotations

import re


_NAME_NOISE_TOKENS = {
    "bag",
    "bags",
    "bottle",
    "bottles",
    "box",
    "boxes",
    "can",
    "cans",
    "carton",
    "cartons",
    "g",
    "kg",
    "l",
    "ml",
    "pack",
    "packs",
    "tray",
    "trays",
    "unit",
    "units",
}


def normalize_inventory_item_name(name: str) -> str:
    # 旧名字里常带包装和单位的杂词,这些从来没进过 bank 范围下
    # 标准化的物品名,所以匹配前先把这类词剥掉
    lowered = re.sub(r"\([^)]*\)", " ", name.lower())
    lowered = lowered.replace("&", " and ")
    lowered = re.sub(r"[^a-z0-9]+", " ", lowered)
    tokens = [
        token
        for token in lowered.split()
        if token not in _NAME_NOISE_TOKENS and not token.isdigit()
    ]
    return " ".join(tokens)


def candidate_name_match_kind(
    legacy_name: str,
    candidate_name: str,
) -> str | None:
    if legacy_name.strip().lower() == candidate_name.strip().lower():
        return "exact_name"
    if normalize_inventory_item_name(legacy_name) == normalize_inventory_item_name(
        candidate_name
    ):
        return "normalized_name"
    return None


def classify_legacy_inventory_bucket(
    *,
    active_lot_count: int,
    active_package_ref_count: int,
    package_ref_count: int,
    application_ref_count: int,
    restock_ref_count: int,
) -> str:
    # 运行时引用比纯历史引用优先,因为太早归档还是会把现货、套餐组合
    # 或补货流程搞坏
    has_live_refs = (
        active_lot_count > 0
        or active_package_ref_count > 0
        or restock_ref_count > 0
    )
    if has_live_refs:
        return "historical_compatibility"

    has_history_refs = package_ref_count > 0 or application_ref_count > 0
    if has_history_refs:
        return "migrate_before_archive"

    return "safe_cleanup_candidate"


def recommend_legacy_inventory_action(
    *,
    active_lot_count: int,
    active_package_ref_count: int,
    package_ref_count: int,
    application_ref_count: int,
    restock_ref_count: int,
    snapshot_ref_count: int,
    candidate_count: int,
) -> str:
    bucket = classify_legacy_inventory_bucket(
        active_lot_count=active_lot_count,
        active_package_ref_count=active_package_ref_count,
        package_ref_count=package_ref_count,
        application_ref_count=application_ref_count,
        restock_ref_count=restock_ref_count,
    )

    if bucket == "historical_compatibility":
        return (
            "keep_and_migrate_live_stock"
            if active_lot_count > 0
            else "keep_until_live_refs_are_removed"
        )

    if bucket == "migrate_before_archive":
        return (
            "keep_history_add_mapping"
            if candidate_count > 0
            else "keep_history_define_target_first"
        )

    # 只剩快照引用的记录仍然支撑着报表历史,即使没有运行时模型再指向它们
    if snapshot_ref_count > 0:
        return "keep_history_add_mapping"
    return "safe_cleanup_candidate"


def recommended_next_step(
    *,
    action: str,
    unresolved_active_lot_batch_count: int = 0,
) -> str:
    if action == "keep_and_migrate_live_stock":
        if unresolved_active_lot_batch_count > 0:
            return (
                "Keep the row, create the bank-scoped target item first, "
                f"and trace {unresolved_active_lot_batch_count} active batch ref(s) "
                "before moving stock."
            )
        return "Keep the row and move live stock into bank-scoped inventory items."

    if action == "keep_until_live_refs_are_removed":
        return "Keep the row until live package or restock refs are gone."

    if action == "keep_history_add_mapping":
        return "Keep the row for history and record the replacement mapping."

    if action == "keep_history_define_target_first":
        return "Keep the row for history and decide the replacement item first."

    return "Delete only after checking that nothing live or historical still points at it."
