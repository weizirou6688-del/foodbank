import json
from datetime import date, datetime, timedelta
from pathlib import Path

from app.models.application_item import ApplicationItem


def _load_demo_seed_data() -> dict[str, object]:
    return json.loads(
        Path(__file__).with_name("bootstrap_seed_data.json").read_text(
            encoding="utf-8"
        )
    )


_DEMO_SEED_DATA = _load_demo_seed_data()

DEMO_USERS = list(_DEMO_SEED_DATA["demo_users"])
DEMO_FOOD_BANKS = list(_DEMO_SEED_DATA["demo_food_banks"])
DEMO_INVENTORY_ITEMS = list(_DEMO_SEED_DATA["demo_inventory_items"])
DEMO_SCOPED_INVENTORY_ITEMS = list(_DEMO_SEED_DATA["demo_scoped_inventory_items"])
DEMO_INVENTORY_ITEM_NAMES = set(_DEMO_SEED_DATA["demo_inventory_item_names"])
DEMO_PACKAGES = list(_DEMO_SEED_DATA["demo_packages"])
DEMO_SCOPED_CASH_PAYMENT_REFERENCES = set(
    _DEMO_SEED_DATA["demo_scoped_cash_payment_references"]
)
DEMO_SCOPED_CASH_DONOR_EMAILS = set(_DEMO_SEED_DATA["demo_scoped_cash_donor_emails"])
DEMO_SCOPED_GOODS_DONOR_EMAILS = set(_DEMO_SEED_DATA["demo_scoped_goods_donor_emails"])
DEMO_SCOPED_ADMIN_SEEDS = list(_DEMO_SEED_DATA["demo_scoped_admin_seeds"])


def demo_week_start(offset_weeks: int = 0) -> date:
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    return monday + timedelta(weeks=offset_weeks)


def demo_application_created_at(
    week_start: date,
    day_offset: int = 0,
    hour: int = 10,
) -> datetime:
    created_day = week_start + timedelta(days=max(0, min(day_offset, 6)))
    created_hour = max(8, min(hour, 18))
    return datetime(
        created_day.year,
        created_day.month,
        created_day.day,
        created_hour,
        0,
    )


async def ensure_single_package_application_item(
    db,
    *,
    application_id: int,
    existing_items: list[ApplicationItem],
    package_id: int,
    quantity: int,
) -> bool:
    matching_package_item = next(
        (
            item
            for item in existing_items
            if item.package_id == package_id
            and item.quantity == quantity
            and item.inventory_item_id is None
        ),
        None,
    )
    if matching_package_item is not None:
        return False

    for existing_item in existing_items:
        await db.delete(existing_item)

    db.add(
        ApplicationItem(
            application_id=application_id,
            package_id=package_id,
            quantity=quantity,
        )
    )
    return True