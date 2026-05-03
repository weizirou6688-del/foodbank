"""清理仍然没有 food bank 范围的旧版库存记录。"""

from __future__ import annotations

import argparse
import asyncio

from sqlalchemy import case, delete, func, select

from _bootstrap_legacy import ensure_legacy_script_imports

ensure_legacy_script_imports()

from app.core.database import AsyncSessionLocal  # noqa: E402
from app.core.db_utils import fetch_rows  # noqa: E402
from app.core.legacy_inventory_disposition import (  # noqa: E402
    classify_legacy_inventory_bucket,
)
from app.models.application_distribution_snapshot import (  # noqa: E402
    ApplicationDistributionSnapshot,
)
from app.models.application_item import ApplicationItem  # noqa: E402
from app.models.food_package import FoodPackage  # noqa: E402
from app.models.inventory_item import InventoryItem  # noqa: E402
from app.models.inventory_lot import InventoryLot  # noqa: E402
from app.models.inventory_waste_event import InventoryWasteEvent  # noqa: E402
from app.models.package_item import PackageItem  # noqa: E402
from app.models.restock_request import RestockRequest  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Preview or delete old inventory rows with no food_bank_id.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Delete only rows that are safe to remove.",
    )
    return parser.parse_args()


def print_summary(summary: dict[str, list[dict[str, object]]], *, apply: bool) -> None:
    mode = "apply" if apply else "preview"
    print(f"[{mode}] legacy bankless inventory")

    for title, rows in (
        ("keep: live refs", summary["compatibility_items"]),
        ("keep: map history first", summary["migrate_before_archive_items"]),
        ("safe to delete", summary["safe_cleanup_items"]),
    ):
        print(f"- {title}: {len(rows)}")
        for row in rows:
            print(
                "  "
                f"#{row['item_id']} {row['name']} | "
                f"deleted_lots={row['deleted_lot_count']} "
                f"waste={row['waste_event_count']} "
                f"snapshots={row['snapshot_ref_count']}"
            )

    if not apply:
        print("Use --apply to delete only the safe rows.")


async def collect_summary() -> dict[str, list[dict[str, object]]]:
    async with AsyncSessionLocal() as db:
        # 预览和实际执行都用同一份数据库推导出来的处置结果,
        # 操作者看到的桶分类就是后面删除步骤会依据的
        rows = await fetch_rows(
            db,
            select(
                InventoryItem.id,
                InventoryItem.name,
                func.count(
                    func.distinct(
                        case((InventoryLot.deleted_at.is_(None), InventoryLot.id))
                    )
                ).label("active_lot_count"),
                func.count(
                    func.distinct(
                        case((InventoryLot.deleted_at.is_not(None), InventoryLot.id))
                    )
                ).label("deleted_lot_count"),
                func.count(
                    func.distinct(
                        case((FoodPackage.is_active.is_(True), PackageItem.id))
                    )
                ).label("active_package_ref_count"),
                func.count(func.distinct(PackageItem.id)).label("package_ref_count"),
                func.count(func.distinct(ApplicationItem.id)).label(
                    "application_ref_count"
                ),
                func.count(func.distinct(RestockRequest.id)).label("restock_ref_count"),
                func.count(func.distinct(InventoryWasteEvent.id)).label(
                    "waste_event_count"
                ),
                func.count(func.distinct(ApplicationDistributionSnapshot.id)).label(
                    "snapshot_ref_count"
                ),
            )
            .select_from(InventoryItem)
            .outerjoin(InventoryLot, InventoryLot.inventory_item_id == InventoryItem.id)
            .outerjoin(PackageItem, PackageItem.inventory_item_id == InventoryItem.id)
            .outerjoin(FoodPackage, FoodPackage.id == PackageItem.package_id)
            .outerjoin(
                ApplicationItem, ApplicationItem.inventory_item_id == InventoryItem.id
            )
            .outerjoin(
                RestockRequest, RestockRequest.inventory_item_id == InventoryItem.id
            )
            .outerjoin(
                InventoryWasteEvent,
                InventoryWasteEvent.inventory_item_id == InventoryItem.id,
            )
            .outerjoin(
                ApplicationDistributionSnapshot,
                ApplicationDistributionSnapshot.inventory_item_id == InventoryItem.id,
            )
            .where(InventoryItem.food_bank_id.is_(None))
            .group_by(InventoryItem.id, InventoryItem.name)
            .order_by(InventoryItem.id.asc()),
        )

    compatibility_items: list[dict[str, object]] = []
    migrate_before_archive_items: list[dict[str, object]] = []
    safe_cleanup_items: list[dict[str, object]] = []

    for (
        item_id,
        name,
        active_lot_count,
        deleted_lot_count,
        active_package_ref_count,
        package_ref_count,
        application_ref_count,
        restock_ref_count,
        waste_event_count,
        snapshot_ref_count,
    ) in rows:
        row = {
            "item_id": int(item_id),
            "name": str(name),
            "active_lot_count": int(active_lot_count or 0),
            "deleted_lot_count": int(deleted_lot_count or 0),
            "active_package_ref_count": int(active_package_ref_count or 0),
            "package_ref_count": int(package_ref_count or 0),
            "application_ref_count": int(application_ref_count or 0),
            "restock_ref_count": int(restock_ref_count or 0),
            "waste_event_count": int(waste_event_count or 0),
            "snapshot_ref_count": int(snapshot_ref_count or 0),
        }
        bucket = classify_legacy_inventory_bucket(
            active_lot_count=row["active_lot_count"],
            active_package_ref_count=row["active_package_ref_count"],
            package_ref_count=row["package_ref_count"],
            application_ref_count=row["application_ref_count"],
            restock_ref_count=row["restock_ref_count"],
        )
        if bucket == "historical_compatibility":
            compatibility_items.append(row)
        elif bucket == "migrate_before_archive":
            migrate_before_archive_items.append(row)
        else:
            safe_cleanup_items.append(row)

    return {
        "compatibility_items": compatibility_items,
        "migrate_before_archive_items": migrate_before_archive_items,
        "safe_cleanup_items": safe_cleanup_items,
    }


async def apply_cleanup(summary: dict[str, list[dict[str, object]]]) -> None:
    safe_item_ids = [int(row["item_id"]) for row in summary["safe_cleanup_items"]]
    if not safe_item_ids:
        return

    async with AsyncSessionLocal() as db:
        # 实际执行模式在写入 session 里再查一遍运行时引用,
        # 这样过时的预览不会把同时新增了关联的记录删掉
        live_refs = await fetch_rows(
            db,
            select(
                InventoryItem.id,
                func.count(func.distinct(PackageItem.id)).label("package_ref_count"),
                func.count(func.distinct(ApplicationItem.id)).label(
                    "application_ref_count"
                ),
                func.count(func.distinct(RestockRequest.id)).label("restock_ref_count"),
                func.count(
                    func.distinct(
                        case((InventoryLot.deleted_at.is_(None), InventoryLot.id))
                    )
                ).label("active_lot_count"),
            )
            .select_from(InventoryItem)
            .outerjoin(PackageItem, PackageItem.inventory_item_id == InventoryItem.id)
            .outerjoin(
                ApplicationItem, ApplicationItem.inventory_item_id == InventoryItem.id
            )
            .outerjoin(
                RestockRequest, RestockRequest.inventory_item_id == InventoryItem.id
            )
            .outerjoin(InventoryLot, InventoryLot.inventory_item_id == InventoryItem.id)
            .where(InventoryItem.id.in_(safe_item_ids))
            .group_by(InventoryItem.id)
            .order_by(InventoryItem.id.asc()),
        )

        blocked_ids = [
            int(item_id)
            for (
                item_id,
                package_ref_count,
                application_ref_count,
                restock_ref_count,
                active_lot_count,
            ) in live_refs
            if any(
                int(value or 0) > 0
                for value in (
                    package_ref_count,
                    application_ref_count,
                    restock_ref_count,
                    active_lot_count,
                )
            )
        ]
        if blocked_ids:
            raise RuntimeError(
                "Refusing to delete legacy inventory items with live references: "
                f"{blocked_ids}"
            )

        await db.execute(delete(InventoryItem).where(InventoryItem.id.in_(safe_item_ids)))
        await db.commit()


async def main() -> None:
    options = parse_args()
    summary = await collect_summary()
    print_summary(summary, apply=options.apply)

    if not options.apply:
        return

    await apply_cleanup(summary)
    after = await collect_summary()
    print()
    print("Cleanup done.")
    print_summary(after, apply=True)


if __name__ == "__main__":
    asyncio.run(main())
