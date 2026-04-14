from __future__ import annotations

from datetime import date, datetime, timezone


def as_utc_naive(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def event_date(value: date | datetime | None) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        normalized = as_utc_naive(value)
        return normalized.date() if normalized is not None else None
    return value


def in_period(target: date | None, start: date, end: date) -> bool:
    return target is not None and start <= target < end


def normalize_donor_type(raw_value: str | None) -> str:
    normalized = (raw_value or "").strip().lower()
    if normalized == "supermarket":
        return "Supermarket"
    if normalized == "organization":
        return "Organization"
    if normalized == "individual":
        return "Individual"
    return "Unspecified"


def donor_identity(email: str | None, name: str | None) -> str | None:
    if email and email.strip():
        return email.strip().lower()
    if name and name.strip():
        return f"name:{name.strip().lower()}"
    return None


def is_bank_scoped_record(record: object) -> bool:
    if not hasattr(record, "food_bank_id"):
        return True
    return getattr(record, "food_bank_id", None) is not None
