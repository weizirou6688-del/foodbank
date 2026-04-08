from __future__ import annotations

import re
from datetime import date, datetime


GOODS_DONATION_DATE_FORMAT = "%d/%m/%Y"
GOODS_DONATION_PHONE_PATTERN = re.compile(r"^\d{11}$")
GOODS_DONATION_DATE_PATTERN = re.compile(r"^\d{2}/\d{2}/\d{4}$")
GOODS_DONATION_DATE_DASH_PATTERN = re.compile(r"^\d{2}-\d{2}-\d{4}$")
GOODS_DONATION_ISO_DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def format_goods_pickup_date(value: date | datetime | str | None) -> str | None:
    if value is None:
        return None

    if isinstance(value, datetime):
        return value.date().strftime(GOODS_DONATION_DATE_FORMAT)

    if isinstance(value, date):
        return value.strftime(GOODS_DONATION_DATE_FORMAT)

    trimmed_value = str(value).strip()
    if not trimmed_value:
        return None

    if GOODS_DONATION_DATE_PATTERN.fullmatch(trimmed_value):
        parsed_date = datetime.strptime(trimmed_value, GOODS_DONATION_DATE_FORMAT)
        return parsed_date.strftime(GOODS_DONATION_DATE_FORMAT)

    if GOODS_DONATION_DATE_DASH_PATTERN.fullmatch(trimmed_value):
        parsed_date = datetime.strptime(trimmed_value, "%d-%m-%Y")
        return parsed_date.strftime(GOODS_DONATION_DATE_FORMAT)

    if GOODS_DONATION_ISO_DATE_PATTERN.fullmatch(trimmed_value):
        parsed_date = datetime.strptime(trimmed_value, "%Y-%m-%d")
        return parsed_date.strftime(GOODS_DONATION_DATE_FORMAT)

    raise ValueError("Pickup date must use DD/MM/YYYY.")


def parse_goods_pickup_date(value: date | datetime | str | None) -> date | None:
    formatted_value = format_goods_pickup_date(value)
    if formatted_value is None:
        return None

    return datetime.strptime(formatted_value, GOODS_DONATION_DATE_FORMAT).date()


def normalize_goods_donor_phone(value: str | None, *, required: bool) -> str | None:
    if value is None:
        if required:
            raise ValueError("Donor phone must be exactly 11 digits.")
        return None

    digits_only = re.sub(r"\D", "", str(value))
    if not digits_only:
        if required:
            raise ValueError("Donor phone must be exactly 11 digits.")
        return None

    if not GOODS_DONATION_PHONE_PATTERN.fullmatch(digits_only):
        raise ValueError("Donor phone must be exactly 11 digits.")

    return digits_only
