from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Sequence

from app.core.goods_donation_format import parse_goods_pickup_date


@dataclass(frozen=True)
class SharedGoodsImpactSnapshot:
    current_goods_units: int
    previous_goods_units: int
    current_year_goods_units: int
    all_time_families_supported_count: int
    current_families_supported_count: int
    previous_families_supported_count: int
    partner_organizations_count: int


def _as_utc_naive(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def _event_date(value: date | datetime | None) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        normalized = _as_utc_naive(value)
        return normalized.date() if normalized is not None else None
    return value


def _in_period(target: date | None, start: date, end: date) -> bool:
    return target is not None and start <= target < end


def _normalize_donor_type(raw_value: str | None) -> str:
    normalized = (raw_value or '').strip().lower()
    if normalized == 'supermarket':
        return 'Supermarket'
    if normalized == 'organization':
        return 'Organization'
    if normalized == 'individual':
        return 'Individual'
    return 'Unspecified'


def _donor_identity(email: str | None, name: str | None) -> str | None:
    if email and email.strip():
        return email.strip().lower()
    if name and name.strip():
        return f"name:{name.strip().lower()}"
    return None


def calculate_shared_goods_impact_snapshot(
    *,
    cash_donations: Sequence[object],
    goods_donations: Sequence[object],
    applications: Sequence[object],
    today: date,
    current_start: date,
    next_start: date,
    previous_start: date,
) -> SharedGoodsImpactSnapshot:
    valid_cash_donations = [row for row in cash_donations if getattr(row, 'status', None) == 'completed']
    valid_goods_donations = [row for row in goods_donations if getattr(row, 'status', None) == 'received']

    current_goods_units = 0
    previous_goods_units = 0
    current_year_goods_units = 0
    partner_organization_keys: set[str] = set()

    for donation in valid_cash_donations:
        donor_label = _normalize_donor_type(getattr(donation, 'donor_type', None))
        donor_key = _donor_identity(
            getattr(donation, 'donor_email', None),
            getattr(donation, 'donor_name', None),
        )
        if donor_key is not None and donor_label in {'Supermarket', 'Organization'}:
            partner_organization_keys.add(donor_key)

    for donation in valid_goods_donations:
        donation_date = parse_goods_pickup_date(getattr(donation, 'pickup_date', None)) or _event_date(
            getattr(donation, 'created_at', None)
        )
        donation_quantity = sum(getattr(item, 'quantity', 0) for item in getattr(donation, 'items', []))
        if _in_period(donation_date, current_start, next_start):
            current_goods_units += donation_quantity
        if _in_period(donation_date, previous_start, current_start):
            previous_goods_units += donation_quantity
        if donation_date is not None and donation_date.year == today.year:
            current_year_goods_units += donation_quantity

        donor_label = _normalize_donor_type(getattr(donation, 'donor_type', None))
        donor_key = _donor_identity(
            getattr(donation, 'donor_email', None),
            getattr(donation, 'donor_name', None),
        )
        if donor_key is not None and donor_label in {'Supermarket', 'Organization'}:
            partner_organization_keys.add(donor_key)

    all_time_families_supported: set[str] = set()
    current_families_supported: set[str] = set()
    previous_families_supported: set[str] = set()
    for application in applications:
        if getattr(application, 'deleted_at', None) is not None:
            continue

        application_created = _event_date(getattr(application, 'created_at', None))
        user_id = str(getattr(application, 'user_id'))
        all_time_families_supported.add(user_id)
        if _in_period(application_created, current_start, next_start):
            current_families_supported.add(user_id)
        if _in_period(application_created, previous_start, current_start):
            previous_families_supported.add(user_id)

    return SharedGoodsImpactSnapshot(
        current_goods_units=current_goods_units,
        previous_goods_units=previous_goods_units,
        current_year_goods_units=current_year_goods_units,
        all_time_families_supported_count=len(all_time_families_supported),
        current_families_supported_count=len(current_families_supported),
        previous_families_supported_count=len(previous_families_supported),
        partner_organizations_count=len(partner_organization_keys),
    )
