from __future__ import annotations

from datetime import date, timedelta
from typing import Literal

from app.schemas.stats import (
    DashboardChartOut,
    DashboardDisplayCardOut,
    DashboardImpactMetricOut,
    PublicImpactMetricOut,
)


COMPARISON_LABELS = {
    "month": "last month",
    "quarter": "last quarter",
    "year": "last year",
}

RANGE_NOTES = {
    "month": "This Month",
    "quarter": "This Quarter",
    "year": "This Year",
}


def _month_start(day: date) -> date:
    return day.replace(day=1)


def _shift_month(day: date, offset: int) -> date:
    month_index = (day.year * 12 + (day.month - 1)) + offset
    year = month_index // 12
    month = month_index % 12 + 1
    return date(year, month, 1)


def _trend_bucket_key(target: date | None, range_key: Literal["month", "quarter", "year"]) -> date | None:
    return None if target is None else target if range_key == "month" else _month_start(target)


def _trend_buckets(
    range_key: Literal["month", "quarter", "year"],
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


def _period_bounds(
    range_key: Literal["month", "quarter", "year"],
    today: date,
) -> tuple[date, date, date]:
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


def _percent_change(current: float, previous: float) -> float | None:
    if previous == 0:
        return 0.0 if current == 0 else None
    return ((current - previous) / previous) * 100


def _format_change(current: float, previous: float, comparison_label: str) -> str:
    change = _percent_change(current, previous)
    if change is None:
        return f"New vs {comparison_label}"
    sign = "+" if change >= 0 else ""
    return f"{sign}{change:.1f}% vs {comparison_label}"


def _format_int(value: int) -> str:
    return f"{value:,}"


def _format_currency_from_pence(value: float) -> str:
    return f"\u00A3{value / 100:,.2f}"


def _format_decimal(value: float, decimals: int = 1) -> str:
    return f"{value:.{decimals}f}"


def _format_short_change(current: float, previous: float) -> tuple[str, bool]:
    change = _percent_change(current, previous)
    return ("New", True) if change is None else (f"{'+' if change >= 0 else ''}{change:.1f}%", change >= 0)


def _format_short_absolute_change(
    current: int,
    previous: int,
    singular_unit: str,
    plural_unit: str | None = None,
) -> tuple[str, bool]:
    delta = current - previous
    unit = singular_unit if abs(delta) == 1 else (plural_unit or f"{singular_unit}s")
    sign = "+" if delta >= 0 else "-"
    return (f"{sign}{abs(delta):,} {unit}", delta >= 0)


def _format_table_quantity(value: int, unit: str) -> str:
    return f"{value} {(unit or 'units').strip()}"


def _chart(labels: list[str], data: list[float], empty_label: str = "No data") -> DashboardChartOut:
    return DashboardChartOut(
        labels=labels or [empty_label],
        data=[float(value) for value in data] if labels else [0.0],
    )


def _chart_from_pairs(pairs: list[tuple[str, int | float]]) -> DashboardChartOut:
    return _chart([label for label, _ in pairs], [value for _, value in pairs])


def _chart_from_counts(labels: list[str], counts: dict[str, int | float]) -> DashboardChartOut:
    return _chart(labels, [counts[label] for label in labels])


def _display_card(title: str, value: str, subtitle: str, trend: str | None = None) -> DashboardDisplayCardOut:
    return DashboardDisplayCardOut(title=title, value=value, subtitle=subtitle, trend=trend)


def _public_metric(key: str, value: str, label: str, note: str, *, change: str = "", positive: bool = True) -> PublicImpactMetricOut:
    return PublicImpactMetricOut(key=key, change=change, positive=positive, value=value, label=label, note=note)


def _changed_public_metric(key: str, current: int | float, previous: int | float, value: str, label: str, note: str) -> PublicImpactMetricOut:
    change, positive = _format_short_change(float(current), float(previous))
    return _public_metric(key, value, label, note, change=change, positive=positive)


def _absolute_changed_public_metric(
    key: str,
    current: int,
    previous: int,
    value: str,
    label: str,
    note: str,
    *,
    singular_unit: str,
    plural_unit: str | None = None,
) -> PublicImpactMetricOut:
    change, positive = _format_short_absolute_change(
        current,
        previous,
        singular_unit,
        plural_unit,
    )
    return _public_metric(key, value, label, note, change=change, positive=positive)


def _impact_metric(key: str, value: str, label: str) -> DashboardImpactMetricOut:
    return DashboardImpactMetricOut(key=key, value=value, label=label)


def _record_donor_activity(
    donor_frequency: dict[str, dict[str, int | bool]],
    donor_key: str | None,
    donor_label: str,
) -> None:
    if donor_key is None:
        return

    donor_summary = donor_frequency[donor_key]
    donor_summary["count"] = int(donor_summary["count"]) + 1
    donor_summary["corporate"] = bool(donor_summary["corporate"]) or donor_label in {"Supermarket", "Organization"}


def _success_rate(success: int, total: int) -> float:
    return round((success / total) * 100, 1) if total else 0.0


def _top_pairs(counts: dict[str, int], limit: int = 6) -> list[tuple[str, int]]:
    return sorted(counts.items(), key=lambda pair: pair[1], reverse=True)[:limit]


def _public_range_context(range_key: Literal["month", "quarter", "year"]) -> tuple[date, date, date, date, str]:
    today = date.today()
    return today, *_period_bounds(range_key, today), RANGE_NOTES[range_key]
