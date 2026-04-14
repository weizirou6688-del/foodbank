from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.analytics_utils import (
    donor_identity as _donor_identity,
    event_date as _event_date,
    in_period as _in_period,
    normalize_donor_type as _normalize_donor_type,
)
from app.routers.stats_formatters import (
    COMPARISON_LABELS,
    _chart,
    _chart_from_counts,
    _chart_from_pairs,
    _display_card,
    _format_change,
    _format_currency_from_pence,
    _format_decimal,
    _format_table_quantity,
    _period_bounds,
    _record_donor_activity,
    _success_rate,
    _top_pairs,
    _trend_bucket_key,
    _trend_buckets,
)
from app.schemas.stats import (
    DashboardAnalyticsOut,
    DashboardExpiryChartOut,
    DashboardExpiringLotOut,
    DashboardLowStockAlertOut,
)
from app.services.stats_distribution_service import (
    _application_distribution_summary,
    _build_verification_record,
    _group_distribution_snapshots,
    _package_recipe_units,
    _resolved_redemption_counts,
)
from app.services.stats_input_loading_service import _load_dashboard_inputs
from app.services.stats_input_scope_service import _scope_dashboard_inputs


DashboardRange = Literal["month", "quarter", "year"]

_DONATION_SOURCE_LABELS = ["Supermarket", "Individual", "Organization", "Unspecified"]
_DONOR_TYPE_LABELS = ["Regular Donors", "One-Time Donors", "Corporate Partners"]
_INVENTORY_HEALTH_LABELS = ["In Stock", "Low Stock", "Out of Stock"]
_PACKAGE_REDEMPTION_LABELS = ["Redeemed", "Pending", "Expired / Void"]
_EXPIRY_DISTRIBUTION_LABELS = ["Expiring in 30 Days", "30-90 Days", "90+ Days"]
_REDEMPTION_BREAKDOWN_LABELS = ["Success", "Invalid", "Expired"]
_RECENT_VERIFICATION_LIMIT = 8
_LOW_STOCK_ALERT_LIMIT = 8
_EXPIRING_LOT_LIMIT = 8


def _today() -> date:
    return date.today()


def _as_int(value: object) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _bucket_index_for(
    target: date | None,
    bucket_indexes: dict[date, int],
    range_key: DashboardRange,
) -> int | None:
    bucket_key = _trend_bucket_key(target, range_key)
    if bucket_key is None:
        return None
    return bucket_indexes.get(bucket_key)


def _goods_donation_date(donation: object) -> date | None:
    return _event_date(getattr(donation, "created_at", None))


def _cash_donation_date(donation: object) -> date | None:
    return _event_date(getattr(donation, "created_at", None))


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


async def build_dashboard_analytics(
    *,
    range_key: DashboardRange,
    admin_user: dict,
    db: AsyncSession,
) -> DashboardAnalyticsOut:
    today = _today()
    current_start, next_start, previous_start = _period_bounds(range_key, today)
    current_period_end = next_start
    previous_period_end = current_start
    trend_period_end = min(today + timedelta(days=1), next_start)
    comparison_label = COMPARISON_LABELS[range_key]

    bucket_starts, bucket_indexes, bucket_labels = _trend_buckets(
        range_key,
        today,
        current_start,
        next_start,
    )

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

    valid_goods_donations = [
        donation
        for donation in goods_donations
        if getattr(donation, "status", None) == "received"
    ]
    current_goods_donations = [
        donation
        for donation in valid_goods_donations
        if _in_period(_goods_donation_date(donation), current_start, current_period_end)
    ]
    previous_goods_donations = [
        donation
        for donation in valid_goods_donations
        if _in_period(_goods_donation_date(donation), previous_start, previous_period_end)
    ]

    donation_source_counts = {label: 0 for label in _DONATION_SOURCE_LABELS}
    donation_category_totals: dict[str, int] = defaultdict(int)
    donor_frequency: dict[str, dict[str, int | bool]] = defaultdict(
        lambda: {"count": 0, "corporate": False}
    )
    donation_trend_totals = [0] * len(bucket_starts)

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
            _goods_donation_date(donation),
            bucket_indexes,
            range_key,
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
        if _in_period(_cash_donation_date(donation), current_start, current_period_end)
    ]
    previous_cash_amounts = [
        _as_int(getattr(donation, "amount_pence", 0))
        for donation in valid_cash_donations
        if _in_period(_cash_donation_date(donation), previous_start, previous_period_end)
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

    active_inventory_lot_rows = _active_inventory_lot_rows(
        inventory_lot_rows,
        today=today,
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
        current_stock = current_stock_by_item_id.get(_as_int(getattr(inventory_item, "id", 0)), 0)
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
        days_until_expiry = (getattr(lot, "expiry_date") - today).days
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

    wastage_trend_totals = [0] * len(bucket_starts)
    current_wastage_units = 0
    previous_wastage_units = 0
    for waste_event in waste_events:
        waste_date = _event_date(getattr(waste_event, "occurred_at", None))
        waste_quantity = _as_int(getattr(waste_event, "quantity", 0))
        if _in_period(waste_date, current_start, current_period_end):
            current_wastage_units += waste_quantity
            bucket_index = _bucket_index_for(waste_date, bucket_indexes, range_key)
            if bucket_index is not None:
                wastage_trend_totals[bucket_index] += waste_quantity
        if _in_period(waste_date, previous_start, previous_period_end):
            previous_wastage_units += waste_quantity

    package_trend_totals = [0] * len(bucket_starts)
    package_type_totals: dict[str, int] = defaultdict(int)
    package_redemption_counts = {label: 0 for label in _PACKAGE_REDEMPTION_LABELS}
    redemption_breakdown_counts = {label: 0 for label in _REDEMPTION_BREAKDOWN_LABELS}
    verification_records: list[tuple[datetime, object]] = []
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
        (
            package_quantity,
            _food_units,
            snapshot_package_units_total,
            snapshot_package_quantity_total,
            package_categories,
        ) = _application_distribution_summary(
            application,
            application_snapshots,
            package_recipe_units,
            use_snapshot_packages=True,
        )

        if deleted_at is None:
            if _in_period(application_created, current_start, current_period_end):
                current_package_quantity += package_quantity
                bucket_index = _bucket_index_for(
                    application_created,
                    bucket_indexes,
                    range_key,
                )
                if bucket_index is not None:
                    package_trend_totals[bucket_index] += package_quantity

            if _in_period(application_created, previous_start, previous_period_end):
                previous_package_quantity += package_quantity

            if package_quantity > 0:
                for category, quantity in package_categories:
                    package_type_totals[category or "Uncategorized"] += quantity

                if snapshot_package_quantity_total > 0:
                    distributed_package_units_total += (
                        snapshot_package_units_total
                        or _application_package_units(application, package_recipe_units)
                    )
                    distributed_package_quantity_total += snapshot_package_quantity_total
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

    current_resolved_count, current_success_count = _resolved_redemption_counts(
        applications,
        current_start,
        current_period_end,
    )
    redemption_rate_value = _success_rate(current_success_count, current_resolved_count)

    resolved_by_bucket = [0] * len(bucket_starts)
    success_by_bucket = [0] * len(bucket_starts)
    for application in applications:
        application_created = _event_date(getattr(application, "created_at", None))
        if not _in_period(application_created, current_start, trend_period_end):
            continue

        bucket_index = _bucket_index_for(application_created, bucket_indexes, range_key)
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

    verification_records.sort(key=lambda row: row[0], reverse=True)

    return DashboardAnalyticsOut(
        kpi={
            "totalDonation": current_goods_units,
            "totalSku": len(inventory_items),
            "totalPackageDistributed": current_package_quantity,
            "lowStockCount": len(low_stock_alerts),
            "expiringLotCount": len(expiring_lot_rows),
            "redemptionRate": redemption_rate_value,
            "trends": {
                "donation": _format_change(
                    current_goods_units,
                    previous_goods_units,
                    comparison_label,
                ),
                "package": _format_change(
                    current_package_quantity,
                    previous_package_quantity,
                    comparison_label,
                ),
                "lowStock": f"{len(low_stock_alerts)} live inventory alert(s)",
                "wastage": _format_change(
                    current_wastage_units,
                    previous_wastage_units,
                    comparison_label,
                ),
            },
        },
        donation={
            "source": _chart_from_counts(_DONATION_SOURCE_LABELS, donation_source_counts),
            "trend": _chart(bucket_labels, donation_trend_totals),
            "category": _chart_from_pairs(_top_pairs(donation_category_totals)),
            "donorType": _chart_from_counts(_DONOR_TYPE_LABELS, donor_type_counts),
            "averageValue": _display_card(
                "Average Donation Value",
                _format_currency_from_pence(current_average_cash_amount),
                "Per completed cash donation",
                _format_change(
                    current_average_cash_amount,
                    previous_average_cash_amount,
                    comparison_label,
                ),
            ),
        },
        inventory={
            "health": _chart_from_counts(
                _INVENTORY_HEALTH_LABELS,
                inventory_health_counts,
            ),
            "category": _chart_from_pairs(_top_pairs(stock_by_category)),
            "lowStockAlerts": low_stock_alerts[:_LOW_STOCK_ALERT_LIMIT],
        },
        package={
            "trend": _chart(bucket_labels, package_trend_totals),
            "redemption": _chart_from_counts(
                _PACKAGE_REDEMPTION_LABELS,
                package_redemption_counts,
            ),
            "packageType": _chart_from_pairs(_top_pairs(package_type_totals, limit=5)),
            "averageSupportDuration": _display_card(
                "Average Family Support Duration",
                _format_decimal(average_support_duration),
                "Distinct support weeks per household",
            ),
            "itemsPerPackage": _display_card(
                "Items Per Package",
                _format_decimal(items_per_package_average),
                "Average ingredient units per distributed package",
            ),
        },
        expiry={
            "distribution": _chart_from_counts(
                _EXPIRY_DISTRIBUTION_LABELS,
                expiry_distribution_counts,
            ),
            "wastage": DashboardExpiryChartOut(
                labels=bucket_labels or ["No data"],
                data=(
                    [float(value) for value in wastage_trend_totals]
                    if bucket_labels
                    else [0.0]
                ),
                label="Wasted Units",
            ),
            "expiringLots": expiring_lot_rows[:_EXPIRING_LOT_LIMIT],
        },
        redemption={
            "rateTrend": _chart(
                bucket_labels,
                [
                    _success_rate(success, resolved)
                    for success, resolved in zip(success_by_bucket, resolved_by_bucket)
                ],
            ),
            "breakdown": _chart_from_counts(
                _REDEMPTION_BREAKDOWN_LABELS,
                redemption_breakdown_counts,
            ),
            "recentVerificationRecords": [
                record
                for _, record in verification_records[:_RECENT_VERIFICATION_LIMIT]
            ],
        },
    )
