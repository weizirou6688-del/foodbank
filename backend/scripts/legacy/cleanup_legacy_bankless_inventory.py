from __future__ import annotations

import argparse
import asyncio
import sys
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import case, delete, func, select

SCRIPTS_DIR = Path(__file__).resolve().parent.parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from _bootstrap import ensure_backend_on_path

ensure_backend_on_path()

from app.core.database import AsyncSessionLocal  # noqa: E402
from app.core.db_utils import fetch_rows  # noqa: E402
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


@dataclass(slots=True)
class LegacyInventoryRow:
    item_id: int
    name: str
    active_lot_count: int
    deleted_lot_count: int
    active_package_ref_count: int
    package_ref_count: int
    application_ref_count: int
    restock_ref_count: int
    waste_event_count: int
    snapshot_ref_count: int


@dataclass(slots=True)
class CleanupSummary:
    compatibility_items: list[LegacyInventoryRow]
    migrate_before_archive_items: list[LegacyInventoryRow]
    safe_cleanup_items: list[LegacyInventoryRow]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Preview or clean legacy bankless inventory shell items that are no longer "
            "reachable from active package/application flows."
        ),
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help=(
            "Delete only the safe legacy shell items that have no package, application, "
            "or restock references."
        ),
    )
    return parser.parse_args()


def _preview_item(row: LegacyInventoryRow) -> str:
    return (
        f"#{row.item_id} {row.name} "
        f"(deleted_lots={row.deleted_lot_count}, waste={row.waste_event_count}, "
        f"snapshots={row.snapshot_ref_count})"
    )


def _print_bucket(title: str, rows: list[LegacyInventoryRow]) -> None:
    print(f"- {title}: {len(rows)}")
    for row in rows:
        print(f"  {_preview_item(row)}")


def print_summary(summary: CleanupSummary, *, apply: bool) -> None:
    mode = "APPLY" if apply else "PREVIEW"
    print(f"[{mode}] Legacy bankless inventory summary")
    _print_bucket("Historical compatibility layer", summary.compatibility_items)
    _print_bucket("Migrate before archive", summary.migrate_before_archive_items)
    _print_bucket("Safe cleanup candidates", summary.safe_cleanup_items)
    if not apply:
        print("Run again with --apply to delete the safe cleanup candidates only.")


def classify_rows(rows: list[LegacyInventoryRow]) -> CleanupSummary:
    compatibility_items: list[LegacyInventoryRow] = []
    migrate_before_archive_items: list[LegacyInventoryRow] = []
    safe_cleanup_items: list[LegacyInventoryRow] = []

    for row in rows:
        if (
            row.active_lot_count > 0
            or row.active_package_ref_count > 0
            or row.restock_ref_count > 0
        ):
            compatibility_items.append(row)
            continue
        if row.package_ref_count > 0 or row.application_ref_count > 0:
            migrate_before_archive_items.append(row)
            continue
        safe_cleanup_items.append(row)

    return CleanupSummary(
        compatibility_items=compatibility_items,
        migrate_before_archive_items=migrate_before_archive_items,
        safe_cleanup_items=safe_cleanup_items,
    )


async def collect_summary() -> CleanupSummary:
    async with AsyncSessionLocal() as db:
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

    classified_rows = [
        LegacyInventoryRow(
            item_id=int(item_id),
            name=str(name),
            active_lot_count=int(active_lot_count or 0),
            deleted_lot_count=int(deleted_lot_count or 0),
            active_package_ref_count=int(active_package_ref_count or 0),
            package_ref_count=int(package_ref_count or 0),
            application_ref_count=int(application_ref_count or 0),
            restock_ref_count=int(restock_ref_count or 0),
            waste_event_count=int(waste_event_count or 0),
            snapshot_ref_count=int(snapshot_ref_count or 0),
        )
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
        ) in rows
    ]
    return classify_rows(classified_rows)


async def apply_cleanup(summary: CleanupSummary) -> None:
    safe_item_ids = [row.item_id for row in summary.safe_cleanup_items]
    if not safe_item_ids:
        return

    async with AsyncSessionLocal() as db:
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
    print("Cleanup complete.")
    print_summary(after, apply=True)


if __name__ == "__main__":
    asyncio.run(main())
