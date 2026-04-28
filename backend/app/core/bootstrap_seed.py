"""静态 demo 种子辅助函数,带重命名映射,用于幂等的重新植入。"""

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
DEMO_SCOPED_CASH_PAYMENT_REFERENCE_OVERRIDES = {
    "DEMO-LOCAL-CASH-001": "JUBILEE-CASH-001",
    "DEMO-WESTSIDE-CASH-001": "WESTSIDE-CASH-001",
    "DEMO-WESTSIDE-CASH-002": "WESTSIDE-CASH-002",
}
DEMO_SCOPED_CASH_PAYMENT_REFERENCE_LEGACY_VALUES: dict[str, tuple[str, ...]] = {}
for legacy_reference, canonical_reference in (
    DEMO_SCOPED_CASH_PAYMENT_REFERENCE_OVERRIDES.items()
):
    existing_aliases = DEMO_SCOPED_CASH_PAYMENT_REFERENCE_LEGACY_VALUES.get(
        canonical_reference,
        (),
    )
    DEMO_SCOPED_CASH_PAYMENT_REFERENCE_LEGACY_VALUES[canonical_reference] = (
        *existing_aliases,
        legacy_reference,
    )
DEMO_SCOPED_CASH_PAYMENT_REFERENCE_LOOKUP_SET = {
    lookup_reference
    for payment_reference in DEMO_SCOPED_CASH_PAYMENT_REFERENCES
    for lookup_reference in (
        payment_reference,
        *DEMO_SCOPED_CASH_PAYMENT_REFERENCE_LEGACY_VALUES.get(
            payment_reference,
            (),
        ),
    )
}
DEMO_SCOPED_CASH_DONOR_EMAILS = set(_DEMO_SEED_DATA["demo_scoped_cash_donor_emails"])
DEMO_SCOPED_GOODS_DONOR_EMAILS = set(_DEMO_SEED_DATA["demo_scoped_goods_donor_emails"])
DEMO_SCOPED_ADMIN_SEEDS = list(_DEMO_SEED_DATA["demo_scoped_admin_seeds"])

# 这些别名表让种子数据可以重命名 demo 实体,即使旧数据已经
# 插入过一次也不会留下重复记录
DEMO_FOOD_BANK_CANONICAL_NAME_OVERRIDES = {
    "Downtown Community Food Bank": "Jubilee Storehouse",
}
DEMO_FOOD_BANK_LEGACY_NAMES: dict[str, tuple[str, ...]] = {}
for legacy_name, canonical_name in DEMO_FOOD_BANK_CANONICAL_NAME_OVERRIDES.items():
    existing_aliases = DEMO_FOOD_BANK_LEGACY_NAMES.get(canonical_name, ())
    DEMO_FOOD_BANK_LEGACY_NAMES[canonical_name] = (
        *existing_aliases,
        legacy_name,
    )

DEMO_INVENTORY_ITEM_CANONICAL_NAME_OVERRIDES = {
    "Downtown Ready Meal Tray": "Jubilee Ready Meal Tray",
    "Downtown Kids Snack Box": "Jubilee Kids Snack Box",
    "Downtown Fruit Cup": "Jubilee Fruit Cup",
}
DEMO_INVENTORY_ITEM_LEGACY_NAMES: dict[str, tuple[str, ...]] = {}
for legacy_name, canonical_name in DEMO_INVENTORY_ITEM_CANONICAL_NAME_OVERRIDES.items():
    existing_aliases = DEMO_INVENTORY_ITEM_LEGACY_NAMES.get(canonical_name, ())
    DEMO_INVENTORY_ITEM_LEGACY_NAMES[canonical_name] = (
        *existing_aliases,
        legacy_name,
    )

DEMO_PACKAGE_CANONICAL_NAME_OVERRIDES = {
    "Downtown Quick Lunch Pack": "Jubilee Quick Lunch Pack",
    "Downtown Fresh Start Pack": "Jubilee Fresh Start Pack",
}
DEMO_PACKAGE_LEGACY_NAMES: dict[str, tuple[str, ...]] = {}
for legacy_name, canonical_name in DEMO_PACKAGE_CANONICAL_NAME_OVERRIDES.items():
    existing_aliases = DEMO_PACKAGE_LEGACY_NAMES.get(canonical_name, ())
    DEMO_PACKAGE_LEGACY_NAMES[canonical_name] = (
        *existing_aliases,
        legacy_name,
    )

DEMO_GOODS_DONOR_CANONICAL_NAME_OVERRIDES = {
    "Downtown School Pantry": "Jubilee School Pantry",
}
DEMO_GOODS_DONOR_LEGACY_NAMES: dict[str, tuple[str, ...]] = {}
for legacy_name, canonical_name in DEMO_GOODS_DONOR_CANONICAL_NAME_OVERRIDES.items():
    existing_aliases = DEMO_GOODS_DONOR_LEGACY_NAMES.get(canonical_name, ())
    DEMO_GOODS_DONOR_LEGACY_NAMES[canonical_name] = (
        *existing_aliases,
        legacy_name,
    )


def canonical_demo_food_bank_name(food_bank_name: str) -> str:
    normalized_name = food_bank_name.strip()
    return DEMO_FOOD_BANK_CANONICAL_NAME_OVERRIDES.get(
        normalized_name,
        normalized_name,
    )


def demo_food_bank_lookup_names(food_bank_name: str) -> tuple[str, ...]:
    canonical_name = canonical_demo_food_bank_name(food_bank_name)
    return (
        canonical_name,
        *DEMO_FOOD_BANK_LEGACY_NAMES.get(canonical_name, ()),
    )


def canonical_demo_inventory_item_name(item_name: str) -> str:
    normalized_name = item_name.strip()
    return DEMO_INVENTORY_ITEM_CANONICAL_NAME_OVERRIDES.get(
        normalized_name,
        normalized_name,
    )


def demo_inventory_item_lookup_names(item_name: str) -> tuple[str, ...]:
    canonical_name = canonical_demo_inventory_item_name(item_name)
    return (
        canonical_name,
        *DEMO_INVENTORY_ITEM_LEGACY_NAMES.get(canonical_name, ()),
    )


def canonical_demo_package_name(package_name: str) -> str:
    normalized_name = package_name.strip()
    return DEMO_PACKAGE_CANONICAL_NAME_OVERRIDES.get(
        normalized_name,
        normalized_name,
    )


def demo_package_lookup_names(package_name: str) -> tuple[str, ...]:
    canonical_name = canonical_demo_package_name(package_name)
    return (
        canonical_name,
        *DEMO_PACKAGE_LEGACY_NAMES.get(canonical_name, ()),
    )


def canonical_demo_cash_payment_reference(payment_reference: str) -> str:
    normalized_reference = payment_reference.strip()
    return DEMO_SCOPED_CASH_PAYMENT_REFERENCE_OVERRIDES.get(
        normalized_reference,
        normalized_reference,
    )


def demo_cash_payment_reference_lookup_values(
    payment_reference: str,
) -> tuple[str, ...]:
    canonical_reference = canonical_demo_cash_payment_reference(payment_reference)
    return (
        canonical_reference,
        *DEMO_SCOPED_CASH_PAYMENT_REFERENCE_LEGACY_VALUES.get(
            canonical_reference,
            (),
        ),
    )


def canonical_demo_goods_donor_name(donor_name: str) -> str:
    normalized_name = donor_name.strip()
    return DEMO_GOODS_DONOR_CANONICAL_NAME_OVERRIDES.get(
        normalized_name,
        normalized_name,
    )


def demo_goods_donor_lookup_names(donor_name: str) -> tuple[str, ...]:
    canonical_name = canonical_demo_goods_donor_name(donor_name)
    return (
        canonical_name,
        *DEMO_GOODS_DONOR_LEGACY_NAMES.get(canonical_name, ()),
    )


def demo_week_start(offset_weeks: int = 0) -> date:
    # 按周对齐的种子日期能让 dashboard 图表始终相对"现在"有数据,
    # 不用在 demo 数据集里写死日历日期
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    return monday + timedelta(weeks=offset_weeks)


def demo_application_created_at(
    week_start: date,
    day_offset: int = 0,
    hour: int = 10,
) -> datetime:
    # 把样例数据夹到正常工作时间窗口里,种子时间戳不会随着 fixture 演变
    # 漂到周末或夜里
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
    # demo 申请有意只表示成一个套餐明细行,
    # 重新植入时旧版本里混合明细的记录会整体被替换掉
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
