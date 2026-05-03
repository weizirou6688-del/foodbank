"""为仍然没有范围的库存物品生成一份面向迁移的报告。"""

from __future__ import annotations

import argparse
import asyncio
import json
import uuid
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import case, func, select

from _bootstrap_legacy import ensure_legacy_script_imports

ensure_legacy_script_imports()

from app.core.database import AsyncSessionLocal  # noqa: E402
from app.core.legacy_inventory_disposition import (  # noqa: E402
    candidate_name_match_kind,
    classify_legacy_inventory_bucket,
    recommend_legacy_inventory_action,
    recommended_next_step,
)
from app.models.application import Application  # noqa: E402
from app.models.application_distribution_snapshot import (  # noqa: E402
    ApplicationDistributionSnapshot,
)
from app.models.application_item import ApplicationItem  # noqa: E402
from app.models.donation_goods import DonationGoods  # noqa: E402
from app.models.food_bank import FoodBank  # noqa: E402
from app.models.food_package import FoodPackage  # noqa: E402
from app.models.inventory_item import InventoryItem  # noqa: E402
from app.models.inventory_lot import InventoryLot  # noqa: E402
from app.models.inventory_waste_event import InventoryWasteEvent  # noqa: E402
from app.models.package_item import PackageItem  # noqa: E402
from app.models.restock_request import RestockRequest  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Report on inventory_items rows where food_bank_id is NULL.",
    )
    parser.add_argument(
        "--format",
        choices=("markdown", "json"),
        default="markdown",
        help="Output format.",
    )
    parser.add_argument(
        "--output",
        help="Write to a file instead of stdout.",
    )
    return parser.parse_args()


def _candidate_suggestions(
    item_name: str | None,
    scoped_items: list[tuple[object, object, object, object]],
) -> list[dict[str, object]]:
    # 这些匹配只是给人工清理参考,所以报告里同时保留精确匹配
    # 和规范化名字匹配,不会装作映射一定对
    suggestions: list[dict[str, object]] = []
    for scoped_item_id, scoped_name, food_bank_id, food_bank_name in scoped_items:
        match_kind = candidate_name_match_kind(item_name, scoped_name)
        if match_kind is None:
            continue
        suggestions.append(
            {
                "item_id": int(scoped_item_id),
                "name": scoped_name,
                "food_bank_id": int(food_bank_id),
                "food_bank_name": food_bank_name,
                "match_kind": match_kind,
            }
        )

    suggestions.sort(
        key=lambda suggestion: (
            0 if suggestion["match_kind"] == "exact_name" else 1,
            str(suggestion["food_bank_name"]),
            int(suggestion["item_id"]),
        )
    )
    return suggestions


def _lot_route(batch_reference: str | None) -> str:
    # batch reference 的前缀是判断孤立运行时批次怎么进系统的最稳定线索,
    # 报告就按这个命名约定来分类来源
    if not batch_reference:
        return "none"
    if batch_reference.startswith("supermarket-donation-"):
        return "supermarket_donation"
    if batch_reference.startswith("donation-"):
        return "goods_donation"
    if batch_reference.startswith("restock-request-"):
        return "restock_request"
    if batch_reference.startswith(("seed-stock-", "demo-seed-")):
        return "demo_seed"
    return "other"


def _lot_donation_id(
    route: str,
    batch_reference: str | None,
) -> uuid.UUID | None:
    if route == "supermarket_donation":
        prefix = "supermarket-donation-"
    elif route == "goods_donation":
        prefix = "donation-"
    else:
        return None

    try:
        return uuid.UUID(str(batch_reference)[len(prefix) :])
    except (TypeError, ValueError):
        return None


async def _active_lot_details(
    db,
    *,
    item_id: int,
) -> dict[str, object]:
    # 运行时批次是最危险的旧版状态,报告在给出清理建议之前
    # 会尽量回溯到捐赠元数据
    lot_rows = (
        await db.execute(
            select(InventoryLot.quantity, InventoryLot.batch_reference)
            .where(
                InventoryLot.inventory_item_id == item_id,
                InventoryLot.deleted_at.is_(None),
            )
            .order_by(InventoryLot.id.asc())
        )
    ).all()

    route_quantities: dict[str, int] = {}
    resolved_quantities: dict[tuple[int | None, str | None], int] = {}
    unresolved_batch_count = 0
    donations_by_id: dict[uuid.UUID, DonationGoods | None] = {}
    food_bank_names_by_id: dict[int, str | None] = {}

    for quantity, batch_reference in lot_rows:
        route = _lot_route(batch_reference)
        route_quantities[route] = route_quantities.get(route, 0) + int(quantity or 0)

        donation_id = _lot_donation_id(route, batch_reference)
        if donation_id is None:
            if route in {"goods_donation", "supermarket_donation"}:
                unresolved_batch_count += 1
            continue

        if donation_id not in donations_by_id:
            donations_by_id[donation_id] = await db.scalar(
                select(DonationGoods).where(DonationGoods.id == donation_id)
            )
        donation = donations_by_id[donation_id]
        if donation is None:
            unresolved_batch_count += 1
            continue

        if donation.food_bank_id is not None:
            food_bank_id = int(donation.food_bank_id)
            if food_bank_id not in food_bank_names_by_id:
                food_bank_names_by_id[food_bank_id] = await db.scalar(
                    select(FoodBank.name).where(FoodBank.id == donation.food_bank_id)
                )
            key = (food_bank_id, food_bank_names_by_id[food_bank_id])
            resolved_quantities[key] = resolved_quantities.get(key, 0) + int(quantity or 0)
            continue

        if donation.food_bank_name:
            key = (None, donation.food_bank_name)
            resolved_quantities[key] = resolved_quantities.get(key, 0) + int(quantity or 0)
            continue

        unresolved_batch_count += 1

    return {
        "active_lot_routes": [
            {"route": route, "quantity": quantity}
            for route, quantity in sorted(route_quantities.items())
        ],
        "resolved_active_lot_food_banks": [
            {
                "food_bank_id": food_bank_id,
                "food_bank_name": food_bank_name,
                "quantity": quantity,
            }
            for (food_bank_id, food_bank_name), quantity in sorted(
                resolved_quantities.items(),
                key=lambda row: ((row[0][1] or ""), row[0][0] or 0),
            )
        ],
        "unresolved_active_lot_batch_count": unresolved_batch_count,
    }


async def _package_references(
    db,
    *,
    item_id: int,
) -> list[dict[str, object]]:
    rows = (
        await db.execute(
            select(FoodPackage.id, FoodPackage.name, FoodPackage.is_active, FoodBank.name)
            .select_from(PackageItem)
            .join(FoodPackage, FoodPackage.id == PackageItem.package_id)
            .outerjoin(FoodBank, FoodBank.id == FoodPackage.food_bank_id)
            .where(PackageItem.inventory_item_id == item_id)
            .order_by(FoodPackage.id.asc())
        )
    ).all()
    return [
        {
            "package_id": int(package_id),
            "package_name": package_name,
            "is_active": bool(is_active),
            "food_bank_name": food_bank_name,
        }
        for package_id, package_name, is_active, food_bank_name in rows
    ]


async def _application_references(
    db,
    *,
    item_id: int,
) -> list[dict[str, object]]:
    rows = (
        await db.execute(
            select(Application.status, FoodBank.name, func.count(func.distinct(Application.id)))
            .select_from(ApplicationItem)
            .join(Application, Application.id == ApplicationItem.application_id)
            .join(FoodBank, FoodBank.id == Application.food_bank_id)
            .where(ApplicationItem.inventory_item_id == item_id)
            .group_by(Application.status, FoodBank.name)
            .order_by(FoodBank.name.asc(), Application.status.asc())
        )
    ).all()
    return [
        {
            "status": status,
            "food_bank_name": food_bank_name,
            "count": int(count or 0),
        }
        for status, food_bank_name, count in rows
    ]


async def _snapshot_references(
    db,
    *,
    item_id: int,
) -> list[dict[str, object]]:
    rows = (
        await db.execute(
            select(
                ApplicationDistributionSnapshot.snapshot_type,
                FoodBank.name,
                func.count(func.distinct(ApplicationDistributionSnapshot.id)),
            )
            .select_from(ApplicationDistributionSnapshot)
            .join(Application, Application.id == ApplicationDistributionSnapshot.application_id)
            .join(FoodBank, FoodBank.id == Application.food_bank_id)
            .where(ApplicationDistributionSnapshot.inventory_item_id == item_id)
            .group_by(ApplicationDistributionSnapshot.snapshot_type, FoodBank.name)
            .order_by(FoodBank.name.asc(), ApplicationDistributionSnapshot.snapshot_type.asc())
        )
    ).all()
    return [
        {
            "snapshot_type": snapshot_type,
            "food_bank_name": food_bank_name,
            "count": int(count or 0),
        }
        for snapshot_type, food_bank_name, count in rows
    ]


async def collect_report_rows() -> list[dict[str, object]]:
    async with AsyncSessionLocal() as db:
        # 带范围的物品只加载一次,所有无 bank 的记录都跟同一组候选比对,
        # 不用每条物品都重复查一次
        scoped_items = list(
            (
                await db.execute(
                    select(InventoryItem.id, InventoryItem.name, FoodBank.id, FoodBank.name)
                    .join(FoodBank, FoodBank.id == InventoryItem.food_bank_id)
                    .where(InventoryItem.food_bank_id.is_not(None))
                    .order_by(
                        FoodBank.name.asc(),
                        InventoryItem.name.asc(),
                        InventoryItem.id.asc(),
                    )
                )
            ).all()
        )

        rows = (
            await db.execute(
                select(
                    InventoryItem.id,
                    InventoryItem.name,
                    InventoryItem.category,
                    InventoryItem.unit,
                    InventoryItem.threshold,
                    func.count(
                        func.distinct(
                            case((InventoryLot.deleted_at.is_(None), InventoryLot.id))
                        )
                    ).label("active_lot_count"),
                    func.coalesce(
                        func.sum(
                            case((InventoryLot.deleted_at.is_(None), InventoryLot.quantity), else_=0)
                        ),
                        0,
                    ).label("active_lot_quantity"),
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
                .group_by(
                    InventoryItem.id,
                    InventoryItem.name,
                    InventoryItem.category,
                    InventoryItem.unit,
                    InventoryItem.threshold,
                )
                .order_by(InventoryItem.id.asc())
            )
        ).all()

        report_rows: list[dict[str, object]] = []
        for row in rows:
            (
                item_id,
                name,
                category,
                unit,
                threshold,
                active_lot_count,
                active_lot_quantity,
                deleted_lot_count,
                active_package_ref_count,
                package_ref_count,
                application_ref_count,
                restock_ref_count,
                waste_event_count,
                snapshot_ref_count,
            ) = row

            item_id = int(item_id)
            threshold = int(threshold or 0)
            active_lot_count = int(active_lot_count or 0)
            active_lot_quantity = int(active_lot_quantity or 0)
            deleted_lot_count = int(deleted_lot_count or 0)
            active_package_ref_count = int(active_package_ref_count or 0)
            package_ref_count = int(package_ref_count or 0)
            application_ref_count = int(application_ref_count or 0)
            restock_ref_count = int(restock_ref_count or 0)
            waste_event_count = int(waste_event_count or 0)
            snapshot_ref_count = int(snapshot_ref_count or 0)

            candidate_suggestions = _candidate_suggestions(name, scoped_items)

            bucket = classify_legacy_inventory_bucket(
                active_lot_count=active_lot_count,
                active_package_ref_count=active_package_ref_count,
                package_ref_count=package_ref_count,
                application_ref_count=application_ref_count,
                restock_ref_count=restock_ref_count,
            )
            recommendation = recommend_legacy_inventory_action(
                active_lot_count=active_lot_count,
                active_package_ref_count=active_package_ref_count,
                package_ref_count=package_ref_count,
                application_ref_count=application_ref_count,
                restock_ref_count=restock_ref_count,
                snapshot_ref_count=snapshot_ref_count,
                candidate_count=len(candidate_suggestions),
            )

            # 详情按物品逐条查,因为这份报告是审计材料,
            # 这里更看重信息丰富,而不是合成一个大 join 省点查询
            lot_details = await _active_lot_details(db, item_id=item_id)
            package_references = await _package_references(db, item_id=item_id)
            application_references = await _application_references(db, item_id=item_id)
            snapshot_references = await _snapshot_references(db, item_id=item_id)

            report_rows.append(
                {
                    "item_id": item_id,
                    "name": name,
                    "category": category,
                    "unit": unit,
                    "threshold": threshold,
                    "bucket": bucket,
                    "recommendation": recommendation,
                    "next_step": recommended_next_step(
                        action=recommendation,
                        unresolved_active_lot_batch_count=lot_details[
                            "unresolved_active_lot_batch_count"
                        ],
                    ),
                    "active_lot_count": active_lot_count,
                    "active_lot_quantity": active_lot_quantity,
                    "deleted_lot_count": deleted_lot_count,
                    "active_package_ref_count": active_package_ref_count,
                    "package_ref_count": package_ref_count,
                    "application_ref_count": application_ref_count,
                    "restock_ref_count": restock_ref_count,
                    "waste_event_count": waste_event_count,
                    "snapshot_ref_count": snapshot_ref_count,
                    "candidate_suggestions": candidate_suggestions,
                    "package_references": package_references,
                    "application_references": application_references,
                    "snapshot_references": snapshot_references,
                    "active_lot_routes": lot_details["active_lot_routes"],
                    "resolved_active_lot_food_banks": lot_details[
                        "resolved_active_lot_food_banks"
                    ],
                    "unresolved_active_lot_batch_count": lot_details[
                        "unresolved_active_lot_batch_count"
                    ],
                }
            )

    return report_rows


def _report_summary(rows: list[dict[str, object]]) -> dict[str, int]:
    summary = {
        "total_rows": len(rows),
        "historical_compatibility": 0,
        "migrate_before_archive": 0,
        "safe_cleanup_candidate": 0,
    }
    for row in rows:
        bucket = str(row["bucket"])
        if bucket in summary:
            summary[bucket] += 1
    return summary


def _append_markdown_section(
    lines: list[str],
    title: str,
    entries,
) -> None:
    lines.append(f"**{title}**")
    section_lines = list(entries)
    if section_lines:
        lines.extend(section_lines)
    else:
        lines.append("- none")
    lines.append("")


def _report_rows_as_json(rows: list[dict[str, object]]) -> str:
    summary = _report_summary(rows)
    payload = {
        "generated_at_utc": datetime.now(UTC).isoformat(),
        "summary": summary,
        "items": rows,
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)


def _report_rows_as_markdown(rows: list[dict[str, object]]) -> str:
    summary = _report_summary(rows)
    lines = [
        "# Legacy bankless inventory report",
        "",
        f"Generated: {datetime.now(UTC).strftime('%Y-%m-%d %H:%M:%S')} UTC",
        "",
        "## Summary",
        "",
        f"- total rows: {summary.get('total_rows', 0)}",
        f"- keep for live refs: {summary.get('historical_compatibility', 0)}",
        f"- map before archive: {summary.get('migrate_before_archive', 0)}",
        f"- safe to delete: {summary.get('safe_cleanup_candidate', 0)}",
        "",
        "## Items",
        "",
    ]

    # Markdown 偏向密集的审阅备注,而不是宽表格,因为这些报告
    # 通常是在编辑器、聊天或 commit 附件里看的
    for row in rows:
        counts = (
            f"active_lots={row['active_lot_count']} ({row['active_lot_quantity']} units), "
            f"deleted_lots={row['deleted_lot_count']}, "
            f"active_package_refs={row['active_package_ref_count']}, "
            f"package_refs={row['package_ref_count']}, "
            f"application_refs={row['application_ref_count']}, "
            f"restock_refs={row['restock_ref_count']}, "
            f"snapshots={row['snapshot_ref_count']}, "
            f"waste={row['waste_event_count']}"
        )
        lines.extend(
            [
                f"### #{row['item_id']} {row['name']}",
                "",
                f"- category / unit / threshold: `{row['category']}` / `{row['unit']}` / `{row['threshold']}`",
                f"- bucket: `{row['bucket']}`",
                f"- action: `{row['recommendation']}`",
                f"- counts: {counts}",
                f"- next: {row['next_step']}",
                "",
            ]
        )

        _append_markdown_section(
            lines,
            "Possible scoped matches",
            (
                f"- {suggestion['match_kind']}: "
                f"#{suggestion['item_id']} {suggestion['name']} "
                f"({suggestion['food_bank_name']})"
                for suggestion in row["candidate_suggestions"]
            ),
        )
        _append_markdown_section(
            lines,
            "Package refs",
            (
                f"- #{reference['package_id']} {reference['package_name']} | "
                f"{reference['food_bank_name']} | active={reference['is_active']}"
                for reference in row["package_references"]
            ),
        )
        _append_markdown_section(
            lines,
            "Application refs",
            (
                f"- {reference['food_bank_name']} | "
                f"status={reference['status']} | count={reference['count']}"
                for reference in row["application_references"]
            ),
        )
        _append_markdown_section(
            lines,
            "Snapshot refs",
            (
                f"- {reference['food_bank_name']} | "
                f"type={reference['snapshot_type']} | count={reference['count']}"
                for reference in row["snapshot_references"]
            ),
        )
        _append_markdown_section(
            lines,
            "Active lot routes",
            (
                f"- {route['route']} | quantity={route['quantity']}"
                for route in row["active_lot_routes"]
            ),
        )
        _append_markdown_section(
            lines,
            "Resolved lot banks",
            (
                f"- {entry['food_bank_name'] or 'unknown'} | quantity={entry['quantity']}"
                for entry in row["resolved_active_lot_food_banks"]
            ),
        )

        lines.append(f"- unresolved batch refs: `{row['unresolved_active_lot_batch_count']}`")
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


async def main() -> None:
    args = parse_args()
    rows = await collect_report_rows()
    if args.format == "json":
        report = _report_rows_as_json(rows)
    else:
        report = _report_rows_as_markdown(rows)

    if args.output:
        Path(args.output).write_text(report, encoding="utf-8")
        print(f"Wrote {args.format} report to {args.output}")
        return

    print(report)


if __name__ == "__main__":
    asyncio.run(main())
