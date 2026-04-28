"""根据捐赠、库存、application 历史拼出 admin dashboard 的 view model。"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.analytics_utils import (
    donor_identity as _donor_identity,
    event_date as _event_date,
    in_period as _in_period,
    is_bank_scoped_record as _is_bank_scoped_record,
    normalize_donor_type as _normalize_donor_type,
)
from app.core.db_utils import fetch_rows as _fetch_rows
from app.core.db_utils import fetch_scalars as _fetch_scalars
from app.core.security import get_admin_food_bank_id
from app.models.application import Application
from app.models.application_distribution_snapshot import ApplicationDistributionSnapshot
from app.models.application_item import ApplicationItem
from app.models.donation_cash import DonationCash
from app.models.donation_goods import DonationGoods
from app.models.food_package import FoodPackage
from app.models.inventory_item import InventoryItem
from app.models.inventory_lot import InventoryLot
from app.models.inventory_waste_event import InventoryWasteEvent
from app.models.package_item import PackageItem
from app.schemas.stats import (
    DashboardAnalyticsOut,
    DashboardChartOut,
    DashboardDisplayCardOut,
    DashboardExpiryChartOut,
    DashboardExpiringLotOut,
    DashboardLowStockAlertOut,
)
from app.services.stats_distribution_service import (
    VerificationRecordEntry,
    _application_distribution_summary,
    _build_verification_record,
    _group_distribution_snapshots,
    _package_recipe_units,
    _resolved_redemption_counts,
)


DashboardRange = Literal["month", "quarter", "year"]

COMPARISON_LABELS = {
    "month": "last month",
    "quarter": "last quarter",
    "year": "last year",
}

_DONATION_SOURCE_LABELS = ["Supermarket", "Individual", "Organization", "Unspecified"]
_DONOR_TYPE_LABELS = ["Regular Donors", "One-Time Donors", "Corporate Partners"]
_INVENTORY_HEALTH_LABELS = ["In Stock", "Low Stock", "Out of Stock"]
_PACKAGE_REDEMPTION_LABELS = ["Redeemed", "Pending", "Expired / Void"]
_EXPIRY_DISTRIBUTION_LABELS = ["Expiring in 30 Days", "30-90 Days", "90+ Days"]
_REDEMPTION_BREAKDOWN_LABELS = ["Success", "Invalid", "Expired"]
_RECENT_VERIFICATION_LIMIT = 8
_LOW_STOCK_ALERT_LIMIT = 8
_EXPIRING_LOT_LIMIT = 8

_GOODS_DONATION_ITEM_OPTIONS = (selectinload(DonationGoods.items),)
_PACKAGE_ITEM_OPTIONS = (
    selectinload(FoodPackage.package_items).selectinload(PackageItem.inventory_item),
)
_APPLICATION_ITEM_OPTIONS = (
    selectinload(Application.items).selectinload(ApplicationItem.package),
    selectinload(Application.items).selectinload(ApplicationItem.inventory_item),
)


@dataclass(slots=True)
class DashboardWindow:
    range_key: DashboardRange
    today: date
    current_start: date
    current_period_end: date
    previous_start: date
    previous_period_end: date
    trend_period_end: date
    comparison_label: str
    bucket_starts: list[date]
    bucket_indexes: dict[date, int]
    bucket_labels: list[str]


def _today() -> date:
    return date.today()


def _as_int(value: object) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _month_start(day: date) -> date:
    return day.replace(day=1)


def _shift_month(day: date, offset: int) -> date:
    month_index = (day.year * 12 + (day.month - 1)) + offset
    year = month_index // 12
    month = month_index % 12 + 1
    return date(year, month, 1)


def _trend_bucket_key(target: date | None, range_key: DashboardRange) -> date | None:
    if target is None:
        return None
    return target if range_key == "month" else _month_start(target)


def _trend_buckets(
    range_key: DashboardRange,
    today: date,
    current_start: date,
    next_start: date,
) -> tuple[list[date], dict[date, int], list[str]]:
    if range_key == "month":
        period_end = min(today + timedelta(days=1), next_start)
        buckets: list[date] = []
        cursor = current_start
        while cursor < period_end:
            buckets.append(cursor)
            cursor += timedelta(days=1)
        if not buckets:
            buckets = [current_start]
        labels = [f"{bucket.strftime('%b')} {bucket.day}" for bucket in buckets]
        return buckets, {bucket: index for index, bucket in enumerate(buckets)}, labels

    period_end = min(next_start, _shift_month(_month_start(today), 1))
    buckets = []
    cursor = current_start
    while cursor < period_end:
        buckets.append(cursor)
        cursor = _shift_month(cursor, 1)
    if not buckets:
        buckets = [current_start]
    labels = [bucket.strftime("%b") for bucket in buckets]
    return buckets, {bucket: index for index, bucket in enumerate(buckets)}, labels


def _period_bounds(range_key: DashboardRange, today: date) -> tuple[date, date, date]:
    if range_key == "year":
        current_start = date(today.year, 1, 1)
        next_start = date(today.year + 1, 1, 1)
        previous_start = date(today.year - 1, 1, 1)
        return current_start, next_start, previous_start

    if range_key == "quarter":
        quarter_month = ((today.month - 1) // 3) * 3 + 1
        current_start = date(today.year, quarter_month, 1)
        next_start = _shift_month(current_start, 3)
        previous_start = _shift_month(current_start, -3)
        return current_start, next_start, previous_start

    current_start = date(today.year, today.month, 1)
    next_start = _shift_month(current_start, 1)
    previous_start = _shift_month(current_start, -1)
    return current_start, next_start, previous_start


def _format_change(current: float, previous: float, comparison_label: str) -> str:
    if previous == 0:
        return (
            f"New vs {comparison_label}" if current != 0 else f"+0.0% vs {comparison_label}"
        )

    change = ((current - previous) / previous) * 100
    sign = "+" if change >= 0 else ""
    return f"{sign}{change:.1f}% vs {comparison_label}"


def _format_currency_from_pence(value: float) -> str:
    return f"\u00A3{value / 100:,.2f}"


def _format_decimal(value: float, decimals: int = 1) -> str:
    return f"{value:.{decimals}f}"


def _format_table_quantity(value: int, unit: str) -> str:
    return f"{value} {(unit or 'units').strip()}"


def _chart(
    labels: list[str],
    data: list[float],
    empty_label: str = "No data",
) -> DashboardChartOut:
    return DashboardChartOut(
        labels=labels or [empty_label],
        data=[float(value) for value in data] if labels else [0.0],
    )


def _record_donor_activity(
    donor_frequency: dict[str, dict[str, int | bool]],
    donor_key: str | None,
    donor_label: str,
) -> None:
    if donor_key is None:
        return

    donor_summary = donor_frequency[donor_key]
    donor_summary["count"] = int(donor_summary["count"]) + 1
    donor_summary["corporate"] = bool(donor_summary["corporate"]) or donor_label in {
        "Supermarket",
        "Organization",
    }


def _success_rate(success: int, total: int) -> float:
    return round((success / total) * 100, 1) if total else 0.0


def _top_pairs(counts: dict[str, int], limit: int = 6) -> list[tuple[str, int]]:
    return sorted(counts.items(), key=lambda pair: pair[1], reverse=True)[:limit]


async def _load_dashboard_inputs(db: AsyncSession):
    # dashboard 一次要读好几份跨领域的数据,集中在这里加载,
    # 下面拼装的逻辑就不用混杂数据库调用。
    return (
        await _fetch_scalars(
            db,
            select(DonationCash).order_by(DonationCash.created_at.asc()),
        ),
        await _fetch_scalars(
            db,
            select(DonationGoods)
            .options(*_GOODS_DONATION_ITEM_OPTIONS)
            .order_by(DonationGoods.created_at.asc()),
        ),
        await _fetch_scalars(
            db,
            select(InventoryItem).order_by(InventoryItem.name.asc()),
        ),
        await _fetch_rows(
            db,
            select(InventoryLot, InventoryItem)
            .join(InventoryItem, InventoryItem.id == InventoryLot.inventory_item_id)
            .order_by(InventoryLot.expiry_date.asc(), InventoryLot.id.asc()),
        ),
        await _fetch_scalars(
            db,
            select(FoodPackage)
            .options(*_PACKAGE_ITEM_OPTIONS)
            .order_by(FoodPackage.name.asc()),
        ),
        await _fetch_scalars(
            db,
            select(Application)
            .options(*_APPLICATION_ITEM_OPTIONS)
            .order_by(Application.created_at.asc()),
        ),
        await _fetch_scalars(
            db,
            select(ApplicationDistributionSnapshot).order_by(
                ApplicationDistributionSnapshot.created_at.asc(),
                ApplicationDistributionSnapshot.id.asc(),
            ),
        ),
        await _fetch_scalars(
            db,
            select(InventoryWasteEvent).order_by(
                InventoryWasteEvent.occurred_at.asc(),
                InventoryWasteEvent.id.asc(),
            ),
        ),
    )


def _collect_scoped_inventory_item_ids(
    packages: list[FoodPackage],
    applications: list[Application],
) -> set[int]:
    return {
        int(item_id)
        for records in (
            (
                package_item.inventory_item_id
                for package in packages
                for package_item in package.package_items
            ),
            (
                application_item.inventory_item_id
                for application in applications
                for application_item in application.items
            ),
        )
        for item_id in records
        if item_id is not None
    }


def _scope_dashboard_inputs(
    inputs,
    admin_user: dict,
):
    (
        cash_donations,
        goods_donations,
        inventory_items,
        inventory_lot_rows,
        packages,
        applications,
        distribution_snapshots,
        waste_events,
    ) = inputs

    cash_donations = [
        donation for donation in cash_donations if _is_bank_scoped_record(donation)
    ]
    goods_donations = [
        donation for donation in goods_donations if _is_bank_scoped_record(donation)
    ]
    inventory_items = [
        inventory_item
        for inventory_item in inventory_items
        if _is_bank_scoped_record(inventory_item)
    ]
    inventory_lot_rows = [
        (lot, inventory_item)
        for lot, inventory_item in inventory_lot_rows
        if _is_bank_scoped_record(inventory_item)
    ]
    packages = [package for package in packages if _is_bank_scoped_record(package)]
    applications = [
        application for application in applications if _is_bank_scoped_record(application)
    ]
    distribution_snapshots = list(distribution_snapshots)
    waste_events = list(waste_events)

    # 故意先加载再 scope,因为 analytics 用到的一些派生关系
    # 在内存里统一裁剪比拆成多个 query 更容易保持一致。
    admin_food_bank_id = get_admin_food_bank_id(admin_user)
    if admin_food_bank_id is None:
        return (
            cash_donations,
            goods_donations,
            inventory_items,
            inventory_lot_rows,
            packages,
            applications,
            distribution_snapshots,
            waste_events,
        )

    cash_donations = [
        donation
        for donation in cash_donations
        if getattr(donation, "food_bank_id", admin_food_bank_id) == admin_food_bank_id
    ]
    goods_donations = [
        donation
        for donation in goods_donations
        if getattr(donation, "food_bank_id", admin_food_bank_id) == admin_food_bank_id
    ]
    inventory_items = [
        inventory_item
        for inventory_item in inventory_items
        if getattr(inventory_item, "food_bank_id", admin_food_bank_id)
        == admin_food_bank_id
    ]
    packages = [
        package
        for package in packages
        if getattr(package, "food_bank_id", admin_food_bank_id) == admin_food_bank_id
    ]
    applications = [
        application
        for application in applications
        if getattr(application, "food_bank_id", admin_food_bank_id) == admin_food_bank_id
    ]
    inventory_lot_rows = [
        (lot, inventory_item)
        for lot, inventory_item in inventory_lot_rows
        if getattr(inventory_item, "food_bank_id", admin_food_bank_id)
        == admin_food_bank_id
    ]

    scoped_application_ids = {application.id for application in applications}
    distribution_snapshots = [
        snapshot
        for snapshot in distribution_snapshots
        if snapshot.application_id in scoped_application_ids
    ]

    allowed_inventory_item_ids = {inventory_item.id for inventory_item in inventory_items}
    scoped_inventory_item_ids = (
        _collect_scoped_inventory_item_ids(packages, applications)
        & allowed_inventory_item_ids
    )
    inventory_items = [
        inventory_item
        for inventory_item in inventory_items
        if inventory_item.id in scoped_inventory_item_ids
    ]
    inventory_lot_rows = [
        (lot, inventory_item)
        for lot, inventory_item in inventory_lot_rows
        if lot.inventory_item_id in scoped_inventory_item_ids
    ]
    scoped_lot_ids = {lot.id for lot, _ in inventory_lot_rows}
    waste_events = [
        waste_event
        for waste_event in waste_events
        if (
            waste_event.inventory_item_id in scoped_inventory_item_ids
            or waste_event.inventory_lot_id in scoped_lot_ids
        )
    ]

    return (
        cash_donations,
        goods_donations,
        inventory_items,
        inventory_lot_rows,
        packages,
        applications,
        distribution_snapshots,
        waste_events,
    )


def _build_dashboard_window(range_key: DashboardRange) -> DashboardWindow:
    today = _today()
    current_start, next_start, previous_start = _period_bounds(range_key, today)
    bucket_starts, bucket_indexes, bucket_labels = _trend_buckets(
        range_key,
        today,
        current_start,
        next_start,
    )
    return DashboardWindow(
        range_key=range_key,
        today=today,
        current_start=current_start,
        current_period_end=next_start,
        previous_start=previous_start,
        previous_period_end=current_start,
        trend_period_end=min(today + timedelta(days=1), next_start),
        comparison_label=COMPARISON_LABELS[range_key],
        bucket_starts=bucket_starts,
        bucket_indexes=bucket_indexes,
        bucket_labels=bucket_labels,
    )


def _bucket_index_for(target: date | None, window: DashboardWindow) -> int | None:
    bucket_key = _trend_bucket_key(target, window.range_key)
    if bucket_key is None:
        return None
    return window.bucket_indexes.get(bucket_key)


def _sum_goods_donation_units(donation: object) -> int:
    return sum(
        _as_int(getattr(item, "quantity", 0))
        for item in getattr(donation, "items", [])
    )


def _application_package_units(
    application: object,
    package_recipe_units: dict[int, int],
) -> int:
    return sum(
        package_recipe_units.get(int(item.package_id), 0) * _as_int(item.quantity)
        for item in getattr(application, "items", [])
        if getattr(item, "package_id", None) is not None
    )


def _inventory_name_category_map(inventory_items: list[object]) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for inventory_item in inventory_items:
        normalized_name = str(getattr(inventory_item, "name", "")).strip().lower()
        if normalized_name:
            mapping[normalized_name] = (
                getattr(inventory_item, "category", None) or "Uncategorized"
            )
    return mapping


def _resolve_item_category(
    item_name: str | None,
    inventory_categories_by_name: dict[str, str],
) -> str:
    normalized_name = str(item_name or "").strip().lower()
    if not normalized_name:
        return "Uncategorized"
    if normalized_name in inventory_categories_by_name:
        return inventory_categories_by_name[normalized_name]

    for known_name, category in inventory_categories_by_name.items():
        if (
            normalized_name.startswith(known_name)
            or known_name.startswith(normalized_name)
            or normalized_name in known_name
            or known_name in normalized_name
        ):
            return category

    return "Uncategorized"


def _active_inventory_lot_rows(
    inventory_lot_rows: list[tuple[object, object]],
    *,
    today: date,
) -> list[tuple[object, object]]:
    return [
        (lot, inventory_item)
        for lot, inventory_item in inventory_lot_rows
        if getattr(lot, "deleted_at", None) is None
        and _as_int(getattr(lot, "quantity", 0)) > 0
        and getattr(lot, "expiry_date", today) >= today
    ]


def _lot_is_active_on(reference_date: date, lot: object) -> bool:
    if _as_int(getattr(lot, "quantity", 0)) <= 0:
        return False

    expiry_date = getattr(lot, "expiry_date", None)
    if expiry_date is None or expiry_date < reference_date:
        return False

    deleted_at = _event_date(getattr(lot, "deleted_at", None))
    if deleted_at is not None and deleted_at <= reference_date:
        return False

    available_date = _event_date(getattr(lot, "received_date", None)) or _event_date(
        getattr(lot, "created_at", None)
    )
    if available_date is not None and available_date > reference_date:
        return False

    return True


def _expiring_lot_count_on(
    inventory_lot_rows: list[tuple[object, object]],
    *,
    reference_date: date,
) -> int:
    return sum(
        1
        for lot, _inventory_item in inventory_lot_rows
        if _lot_is_active_on(reference_date, lot)
        and (getattr(lot, "expiry_date") - reference_date).days <= 30
    )


def _verification_status(
    application: object,
) -> tuple[datetime | None, str, str] | None:
    deleted_at = getattr(application, "deleted_at", None)
    if deleted_at is not None:
        return deleted_at, "Invalid", "error"

    status = getattr(application, "status", None)
    if status == "collected":
        return getattr(application, "redeemed_at", None), "Success", "success"
    if status == "expired":
        return getattr(application, "updated_at", None), "Expired", "warning"

    return None


def _build_donation_analytics(
    window: DashboardWindow,
    cash_donations: list[object],
    goods_donations: list[object],
    inventory_categories_by_name: dict[str, str],
) -> dict[str, object]:
    # goods 和 cash 处理方式不同,但最终都要落到同一个 dashboard 区块,
    # 配上可比的趋势卡和图表。
    valid_goods_donations = [
        donation
        for donation in goods_donations
        if getattr(donation, "status", None) == "received"
    ]
    current_goods_donations = [
        donation
        for donation in valid_goods_donations
        if _in_period(
            _event_date(getattr(donation, "created_at", None)),
            window.current_start,
            window.current_period_end,
        )
    ]
    previous_goods_donations = [
        donation
        for donation in valid_goods_donations
        if _in_period(
            _event_date(getattr(donation, "created_at", None)),
            window.previous_start,
            window.previous_period_end,
        )
    ]

    donation_source_counts = {label: 0 for label in _DONATION_SOURCE_LABELS}
    donation_category_totals: dict[str, int] = defaultdict(int)
    donor_frequency: dict[str, dict[str, int | bool]] = defaultdict(
        lambda: {"count": 0, "corporate": False}
    )
    donation_trend_totals = [0] * len(window.bucket_starts)

    for donation in current_goods_donations:
        donor_label = _normalize_donor_type(getattr(donation, "donor_type", None))
        donation_source_counts[donor_label] += 1
        _record_donor_activity(
            donor_frequency,
            _donor_identity(
                getattr(donation, "donor_email", None),
                getattr(donation, "donor_name", None),
            ),
            donor_label,
        )

        bucket_index = _bucket_index_for(
            _event_date(getattr(donation, "created_at", None)),
            window,
        )
        if bucket_index is not None:
            donation_trend_totals[bucket_index] += 1

        for item in getattr(donation, "items", []):
            donation_category_totals[
                _resolve_item_category(
                    getattr(item, "item_name", None),
                    inventory_categories_by_name,
                )
            ] += _as_int(getattr(item, "quantity", 0))

    current_goods_units = sum(
        _sum_goods_donation_units(donation) for donation in current_goods_donations
    )
    previous_goods_units = sum(
        _sum_goods_donation_units(donation) for donation in previous_goods_donations
    )

    donor_type_counts = {
        "Regular Donors": sum(
            1
            for summary in donor_frequency.values()
            if not bool(summary["corporate"]) and _as_int(summary["count"]) > 1
        ),
        "One-Time Donors": sum(
            1
            for summary in donor_frequency.values()
            if not bool(summary["corporate"]) and _as_int(summary["count"]) <= 1
        ),
        "Corporate Partners": sum(
            1 for summary in donor_frequency.values() if bool(summary["corporate"])
        ),
    }

    valid_cash_donations = [
        donation
        for donation in cash_donations
        if getattr(donation, "status", None) == "completed"
    ]
    current_cash_amounts = [
        _as_int(getattr(donation, "amount_pence", 0))
        for donation in valid_cash_donations
        if _in_period(
            _event_date(getattr(donation, "created_at", None)),
            window.current_start,
            window.current_period_end,
        )
    ]
    previous_cash_amounts = [
        _as_int(getattr(donation, "amount_pence", 0))
        for donation in valid_cash_donations
        if _in_period(
            _event_date(getattr(donation, "created_at", None)),
            window.previous_start,
            window.previous_period_end,
        )
    ]
    current_average_cash_amount = (
        sum(current_cash_amounts) / len(current_cash_amounts)
        if current_cash_amounts
        else 0.0
    )
    previous_average_cash_amount = (
        sum(previous_cash_amounts) / len(previous_cash_amounts)
        if previous_cash_amounts
        else 0.0
    )
    donation_category_pairs = _top_pairs(donation_category_totals)

    return {
        "analytics": {
            "source": _chart(
                _DONATION_SOURCE_LABELS,
                [donation_source_counts[label] for label in _DONATION_SOURCE_LABELS],
            ),
            "trend": _chart(window.bucket_labels, donation_trend_totals),
            "category": _chart(
                [label for label, _ in donation_category_pairs],
                [value for _, value in donation_category_pairs],
            ),
            "donorType": _chart(
                _DONOR_TYPE_LABELS,
                [donor_type_counts[label] for label in _DONOR_TYPE_LABELS],
            ),
            "averageValue": DashboardDisplayCardOut(
                title="Average Donation Value",
                value=_format_currency_from_pence(current_average_cash_amount),
                subtitle="Per completed cash donation",
                trend=_format_change(
                    current_average_cash_amount,
                    previous_average_cash_amount,
                    window.comparison_label,
                ),
            ),
        },
        "current_goods_units": current_goods_units,
        "previous_goods_units": previous_goods_units,
    }


def _build_inventory_analytics(
    window: DashboardWindow,
    inventory_items: list[object],
    inventory_lot_rows: list[tuple[object, object]],
    waste_events: list[object],
) -> dict[str, object]:
    # inventory health 看的是 active lot,不是 item 行——
    # 过期和手动报废会改变实际可用量,但 item 本身不会被删。
    active_inventory_lot_rows = _active_inventory_lot_rows(
        inventory_lot_rows,
        today=window.today,
    )
    current_stock_by_item_id: dict[int, int] = defaultdict(int)
    for lot, _inventory_item in active_inventory_lot_rows:
        current_stock_by_item_id[_as_int(getattr(lot, "inventory_item_id", 0))] += _as_int(
            getattr(lot, "quantity", 0)
        )

    inventory_health_counts = {label: 0 for label in _INVENTORY_HEALTH_LABELS}
    stock_by_category: dict[str, int] = defaultdict(int)
    low_stock_alerts: list[DashboardLowStockAlertOut] = []

    for inventory_item in inventory_items:
        inventory_item_id = _as_int(getattr(inventory_item, "id", 0))
        current_stock = current_stock_by_item_id.get(inventory_item_id, 0)
        threshold = _as_int(getattr(inventory_item, "threshold", 0))
        category = getattr(inventory_item, "category", None) or "Uncategorized"
        if current_stock <= 0:
            inventory_health_counts["Out of Stock"] += 1
        elif threshold > 0 and current_stock < threshold:
            inventory_health_counts["Low Stock"] += 1
        else:
            inventory_health_counts["In Stock"] += 1

        if current_stock > 0:
            stock_by_category[category] += current_stock

        if threshold > 0 and current_stock < threshold:
            status = "Out of Stock" if current_stock <= 0 else "Low Stock"
            unit = getattr(inventory_item, "unit", None) or "units"
            low_stock_alerts.append(
                DashboardLowStockAlertOut(
                    item_name=getattr(inventory_item, "name", "Unknown Item"),
                    category=category,
                    current_stock=current_stock,
                    current_stock_label=_format_table_quantity(current_stock, unit),
                    threshold=threshold,
                    threshold_label=_format_table_quantity(threshold, unit),
                    deficit=max(threshold - current_stock, 0),
                    status=status,
                    status_tone="error" if current_stock <= 0 else "warning",
                )
            )

    low_stock_alerts.sort(
        key=lambda row: (-row.deficit, row.current_stock, row.item_name.lower())
    )

    expiry_distribution_counts = {label: 0 for label in _EXPIRY_DISTRIBUTION_LABELS}
    expiring_lot_rows: list[DashboardExpiringLotOut] = []
    for lot, inventory_item in active_inventory_lot_rows:
        days_until_expiry = (getattr(lot, "expiry_date") - window.today).days
        if days_until_expiry < 0:
            continue
        if days_until_expiry <= 30:
            expiry_distribution_counts["Expiring in 30 Days"] += 1
            expiring_lot_rows.append(
                DashboardExpiringLotOut(
                    item_name=getattr(inventory_item, "name", "Unknown Item"),
                    lot_number=(
                        getattr(lot, "batch_reference", None)
                        or f"LOT-{getattr(lot, 'id', 'unknown')}"
                    ),
                    expiry_date=getattr(lot, "expiry_date").isoformat(),
                    remaining_stock=_as_int(getattr(lot, "quantity", 0)),
                    remaining_stock_label=_format_table_quantity(
                        _as_int(getattr(lot, "quantity", 0)),
                        getattr(inventory_item, "unit", None) or "units",
                    ),
                    days_until_expiry=days_until_expiry,
                    status_tone="error" if days_until_expiry <= 7 else "warning",
                )
            )
        elif days_until_expiry <= 90:
            expiry_distribution_counts["30-90 Days"] += 1
        else:
            expiry_distribution_counts["90+ Days"] += 1

    expiring_lot_rows.sort(
        key=lambda row: (row.days_until_expiry, row.remaining_stock, row.item_name.lower())
    )
    previous_snapshot_date = window.previous_period_end - timedelta(days=1)
    previous_expiring_lot_count = _expiring_lot_count_on(
        inventory_lot_rows,
        reference_date=previous_snapshot_date,
    )

    wastage_trend_totals = [0] * len(window.bucket_starts)
    current_wastage_units = 0
    previous_wastage_units = 0
    for waste_event in waste_events:
        waste_date = _event_date(getattr(waste_event, "occurred_at", None))
        waste_quantity = _as_int(getattr(waste_event, "quantity", 0))
        if _in_period(waste_date, window.current_start, window.current_period_end):
            current_wastage_units += waste_quantity
            bucket_index = _bucket_index_for(waste_date, window)
            if bucket_index is not None:
                wastage_trend_totals[bucket_index] += waste_quantity
        if _in_period(waste_date, window.previous_start, window.previous_period_end):
            previous_wastage_units += waste_quantity
    stock_category_pairs = _top_pairs(stock_by_category)

    return {
        "analytics": {
            "health": _chart(
                _INVENTORY_HEALTH_LABELS,
                [inventory_health_counts[label] for label in _INVENTORY_HEALTH_LABELS],
            ),
            "category": _chart(
                [label for label, _ in stock_category_pairs],
                [value for _, value in stock_category_pairs],
            ),
            "lowStockAlerts": low_stock_alerts[:_LOW_STOCK_ALERT_LIMIT],
        },
        "expiry_analytics": {
            "distribution": _chart(
                _EXPIRY_DISTRIBUTION_LABELS,
                [
                    expiry_distribution_counts[label]
                    for label in _EXPIRY_DISTRIBUTION_LABELS
                ],
            ),
            "wastage": DashboardExpiryChartOut(
                labels=window.bucket_labels or ["No data"],
                data=(
                    [float(value) for value in wastage_trend_totals]
                    if window.bucket_labels
                    else [0.0]
                ),
                label="Wasted Units",
            ),
            "expiringLots": expiring_lot_rows[:_EXPIRING_LOT_LIMIT],
        },
        "low_stock_count": len(low_stock_alerts),
        "expiring_lot_count": len(expiring_lot_rows),
        "previous_expiring_lot_count": previous_expiring_lot_count,
        "current_wastage_units": current_wastage_units,
        "previous_wastage_units": previous_wastage_units,
    }


def _build_package_analytics(
    window: DashboardWindow,
    applications: list[object],
    distribution_snapshots_by_application_id: dict[object, list[object]],
    package_recipe_units: dict[int, int],
) -> dict[str, object]:
    # 这一段把需求、履约、核销结果混在一起,
    # admin 不只看到申请了多少 package,还能看到家庭是否真的来领。
    package_trend_totals = [0] * len(window.bucket_starts)
    package_type_totals: dict[str, int] = defaultdict(int)
    package_redemption_counts = {label: 0 for label in _PACKAGE_REDEMPTION_LABELS}
    redemption_breakdown_counts = {label: 0 for label in _REDEMPTION_BREAKDOWN_LABELS}
    verification_records: list[VerificationRecordEntry] = []
    support_weeks_by_user: dict[str, set[date]] = defaultdict(set)
    distributed_package_units_total = 0
    distributed_package_quantity_total = 0
    current_package_quantity = 0
    previous_package_quantity = 0

    for application in applications:
        deleted_at = getattr(application, "deleted_at", None)
        application_created = _event_date(getattr(application, "created_at", None))
        application_snapshots = distribution_snapshots_by_application_id.get(
            getattr(application, "id", None),
            [],
        )
        distribution_summary = _application_distribution_summary(
            application,
            application_snapshots,
            package_recipe_units,
            use_snapshot_packages=True,
        )
        package_quantity = distribution_summary.package_quantity

        if deleted_at is None:
            if _in_period(
                application_created,
                window.current_start,
                window.current_period_end,
            ):
                current_package_quantity += package_quantity
                bucket_index = _bucket_index_for(application_created, window)
                if bucket_index is not None:
                    package_trend_totals[bucket_index] += package_quantity

            if _in_period(
                application_created,
                window.previous_start,
                window.previous_period_end,
            ):
                previous_package_quantity += package_quantity

            if package_quantity > 0:
                for category, quantity in distribution_summary.package_categories:
                    package_type_totals[category or "Uncategorized"] += quantity

                if distribution_summary.snapshot_package_quantity_total > 0:
                    distributed_package_units_total += (
                        distribution_summary.snapshot_package_units_total
                        or _application_package_units(
                            application,
                            package_recipe_units,
                        )
                    )
                    distributed_package_quantity_total += (
                        distribution_summary.snapshot_package_quantity_total
                    )
                else:
                    distributed_package_units_total += _application_package_units(
                        application,
                        package_recipe_units,
                    )
                    distributed_package_quantity_total += package_quantity

            user_id = getattr(application, "user_id", None)
            week_start = getattr(application, "week_start", None)
            if user_id is not None and week_start is not None:
                support_weeks_by_user[str(user_id)].add(week_start)

        verification_status = _verification_status(application)
        if verification_status is None:
            package_redemption_counts["Pending"] += 1
            continue

        primary_timestamp, status, status_tone = verification_status
        if status == "Success":
            package_redemption_counts["Redeemed"] += 1
            redemption_breakdown_counts["Success"] += 1
        elif status == "Invalid":
            package_redemption_counts["Expired / Void"] += 1
            redemption_breakdown_counts["Invalid"] += 1
        else:
            package_redemption_counts["Expired / Void"] += 1
            redemption_breakdown_counts["Expired"] += 1

        verification_records.append(
            _build_verification_record(
                application,
                primary_timestamp=primary_timestamp,
                status=status,
                status_tone=status_tone,
            )
        )

    redemption_counts = _resolved_redemption_counts(
        applications,
        window.current_start,
        window.current_period_end,
    )
    redemption_rate_value = _success_rate(
        redemption_counts.success_count,
        redemption_counts.resolved_count,
    )

    resolved_by_bucket = [0] * len(window.bucket_starts)
    success_by_bucket = [0] * len(window.bucket_starts)
    for application in applications:
        application_created = _event_date(getattr(application, "created_at", None))
        if not _in_period(application_created, window.current_start, window.trend_period_end):
            continue

        bucket_index = _bucket_index_for(application_created, window)
        if bucket_index is None:
            continue

        deleted_at = getattr(application, "deleted_at", None)
        status = getattr(application, "status", None)
        if deleted_at is not None or status in {"expired", "collected"}:
            resolved_by_bucket[bucket_index] += 1
            if deleted_at is None and status == "collected":
                success_by_bucket[bucket_index] += 1

    average_support_duration = (
        sum(len(weeks) for weeks in support_weeks_by_user.values())
        / len(support_weeks_by_user)
        if support_weeks_by_user
        else 0.0
    )
    items_per_package_average = (
        distributed_package_units_total / distributed_package_quantity_total
        if distributed_package_quantity_total
        else 0.0
    )

    verification_records.sort(key=lambda row: row.sort_key, reverse=True)
    package_type_pairs = _top_pairs(package_type_totals, limit=5)

    return {
        "analytics": {
            "trend": _chart(window.bucket_labels, package_trend_totals),
            "redemption": _chart(
                _PACKAGE_REDEMPTION_LABELS,
                [package_redemption_counts[label] for label in _PACKAGE_REDEMPTION_LABELS],
            ),
            "packageType": _chart(
                [label for label, _ in package_type_pairs],
                [value for _, value in package_type_pairs],
            ),
            "averageSupportDuration": DashboardDisplayCardOut(
                title="Average Family Support Duration",
                value=_format_decimal(average_support_duration),
                subtitle="Distinct support weeks per household",
            ),
            "itemsPerPackage": DashboardDisplayCardOut(
                title="Items Per Package",
                value=_format_decimal(items_per_package_average),
                subtitle="Average ingredient units per distributed package",
            ),
        },
        "redemption_analytics": {
            "rateTrend": _chart(
                window.bucket_labels,
                [
                    _success_rate(success, resolved)
                    for success, resolved in zip(success_by_bucket, resolved_by_bucket)
                ],
            ),
            "breakdown": _chart(
                _REDEMPTION_BREAKDOWN_LABELS,
                [
                    redemption_breakdown_counts[label]
                    for label in _REDEMPTION_BREAKDOWN_LABELS
                ],
            ),
            "recentVerificationRecords": [
                entry.record
                for entry in verification_records[:_RECENT_VERIFICATION_LIMIT]
            ],
        },
        "current_package_quantity": current_package_quantity,
        "previous_package_quantity": previous_package_quantity,
        "redemption_rate": redemption_rate_value,
    }


async def build_dashboard_analytics(
    *,
    range_key: DashboardRange,
    admin_user: dict,
    db: AsyncSession,
) -> DashboardAnalyticsOut:
    window = _build_dashboard_window(range_key)
    (
        cash_donations,
        goods_donations,
        inventory_items,
        inventory_lot_rows,
        packages,
        applications,
        distribution_snapshots,
        waste_events,
    ) = _scope_dashboard_inputs(await _load_dashboard_inputs(db), admin_user)
    distribution_snapshots_by_application_id = _group_distribution_snapshots(
        distribution_snapshots
    )
    package_recipe_units = _package_recipe_units(packages)
    inventory_categories_by_name = _inventory_name_category_map(inventory_items)
    donation_section = _build_donation_analytics(
        window,
        cash_donations,
        goods_donations,
        inventory_categories_by_name,
    )
    inventory_section = _build_inventory_analytics(
        window,
        inventory_items,
        inventory_lot_rows,
        waste_events,
    )
    package_section = _build_package_analytics(
        window,
        applications,
        distribution_snapshots_by_application_id,
        package_recipe_units,
    )

    return DashboardAnalyticsOut(
        kpi={
            "totalDonation": donation_section["current_goods_units"],
            "totalSku": len(inventory_items),
            "totalPackageDistributed": package_section["current_package_quantity"],
            "lowStockCount": inventory_section["low_stock_count"],
            "expiringLotCount": inventory_section["expiring_lot_count"],
            "redemptionRate": package_section["redemption_rate"],
            "trends": {
                "donation": _format_change(
                    donation_section["current_goods_units"],
                    donation_section["previous_goods_units"],
                    window.comparison_label,
                ),
                "package": _format_change(
                    package_section["current_package_quantity"],
                    package_section["previous_package_quantity"],
                    window.comparison_label,
                ),
                "lowStock": (
                    f"{inventory_section['low_stock_count']} live inventory alert(s)"
                ),
                "expiringLots": _format_change(
                    inventory_section["expiring_lot_count"],
                    inventory_section["previous_expiring_lot_count"],
                    window.comparison_label,
                ),
                "wastage": _format_change(
                    inventory_section["current_wastage_units"],
                    inventory_section["previous_wastage_units"],
                    window.comparison_label,
                ),
            },
        },
        donation=donation_section["analytics"],
        inventory=inventory_section["analytics"],
        package=package_section["analytics"],
        expiry=inventory_section["expiry_analytics"],
        redemption=package_section["redemption_analytics"],
    )
