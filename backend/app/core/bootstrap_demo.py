from datetime import date, datetime, timedelta, timezone

from sqlalchemy import or_, select

from app.core.config import settings
from app.core.bootstrap_seed import (
    DEMO_FOOD_BANKS,
    DEMO_INVENTORY_ITEMS,
    DEMO_INVENTORY_ITEM_NAMES,
    DEMO_PACKAGES,
    DEMO_SCOPED_CASH_DONOR_EMAILS,
    DEMO_SCOPED_CASH_PAYMENT_REFERENCES,
    DEMO_SCOPED_GOODS_DONOR_EMAILS,
    DEMO_SCOPED_INVENTORY_ITEMS,
    DEMO_USERS,
)
from app.core.database import AsyncSessionLocal
from app.core.db_utils import (
    fetch_one_or_none as _fetch_one_or_none,
    fetch_scalars as _fetch_scalars,
    sync_keyed_quantity_children as _sync_keyed_quantity_children,
    sync_model_fields as _sync_model_fields,
)
from app.core.security import get_password_hash, verify_password
from app.models.donation_cash import DonationCash
from app.models.donation_goods import DonationGoods
from app.models.food_bank import FoodBank
from app.models.food_package import FoodPackage
from app.models.inventory_item import InventoryItem
from app.models.inventory_lot import InventoryLot
from app.models.package_item import PackageItem
from app.models.user import User


def _resolve_demo_notification_email(default_email: str | None) -> str | None:
    configured_operations_email = settings.operations_fallback_email
    normalized_default = (default_email or "").strip()
    normalized_lower = normalized_default.lower()

    if normalized_default and not normalized_lower.endswith(("@foodbank.com", "@example.com")):
        return normalized_default

    return configured_operations_email or default_email


async def ensure_demo_users() -> None:
    async with AsyncSessionLocal() as db:
        changed = False

        for demo_user in DEMO_USERS:
            food_bank_id = None
            food_bank_name = demo_user.get("food_bank_name")
            if food_bank_name:
                food_bank = await _fetch_one_or_none(
                    db,
                    select(FoodBank).where(FoodBank.name == food_bank_name),
                )
                if food_bank is not None:
                    food_bank_id = food_bank.id

            existing = await _fetch_one_or_none(
                db,
                select(User).where(User.email == demo_user["email"]),
            )

            if existing is None:
                db.add(
                    User(
                        name=demo_user["name"],
                        email=demo_user["email"],
                        password_hash=get_password_hash(demo_user["password"]),
                        role=demo_user["role"],
                        food_bank_id=food_bank_id,
                    )
                )
                changed = True
                continue

            profile_changed = _sync_model_fields(
                existing,
                {
                    "name": demo_user["name"],
                    "role": demo_user["role"],
                    "food_bank_id": food_bank_id,
                },
            )
            password_changed = not verify_password(
                demo_user["password"],
                existing.password_hash,
            )
            if profile_changed or password_changed:
                if password_changed:
                    existing.password_hash = get_password_hash(demo_user["password"])
                changed = True

        if changed:
            await db.commit()


async def ensure_demo_food_banks() -> None:
    async with AsyncSessionLocal() as db:
        changed = False

        for demo_bank in DEMO_FOOD_BANKS:
            notification_email = _resolve_demo_notification_email(
                demo_bank.get("notification_email")
            )
            existing = await _fetch_one_or_none(
                db,
                select(FoodBank).where(FoodBank.name == demo_bank["name"]),
            )

            if existing is None:
                db.add(
                    FoodBank(
                        name=demo_bank["name"],
                        address=demo_bank["address"],
                        lat=demo_bank["lat"],
                        lng=demo_bank["lng"],
                        notification_email=notification_email,
                    )
                )
                changed = True
                continue

            if _sync_model_fields(
                existing,
                {
                    "address": demo_bank["address"],
                    "lat": demo_bank["lat"],
                    "lng": demo_bank["lng"],
                    "notification_email": notification_email,
                },
                current_normalizers={"lat": float, "lng": float},
            ):
                changed = True

        if changed:
            await db.commit()


async def _cleanup_legacy_demo_shared_records(db) -> bool:
    changed = False

    legacy_cash_rows = await _fetch_scalars(
        db,
        select(DonationCash).where(
            DonationCash.food_bank_id.is_(None),
            or_(
                DonationCash.payment_reference.in_(
                    DEMO_SCOPED_CASH_PAYMENT_REFERENCES
                ),
                DonationCash.donor_email.in_(DEMO_SCOPED_CASH_DONOR_EMAILS),
            ),
        ),
    )
    for donation in legacy_cash_rows:
        await db.delete(donation)
        changed = True

    legacy_goods_rows = await _fetch_scalars(
        db,
        select(DonationGoods).where(
            DonationGoods.food_bank_id.is_(None),
            DonationGoods.donor_email.in_(DEMO_SCOPED_GOODS_DONOR_EMAILS),
        ),
    )
    for donation in legacy_goods_rows:
        await db.delete(donation)
        changed = True

    legacy_demo_lots = (
        await db.execute(
            select(InventoryLot, InventoryItem.name, InventoryItem.food_bank_id)
            .join(InventoryItem, InventoryItem.id == InventoryLot.inventory_item_id)
            .where(
                InventoryLot.batch_reference.like("demo-seed-%"),
                InventoryLot.deleted_at.is_(None),
            )
        )
    ).all()
    now = datetime.now(timezone.utc)
    for lot, item_name, item_food_bank_id in legacy_demo_lots:
        if item_food_bank_id is None or item_name not in DEMO_INVENTORY_ITEM_NAMES:
            lot.deleted_at = now
            changed = True
            continue

        batch_reference = lot.batch_reference or ""
        expected_suffix = f"-bank-{item_food_bank_id}"
        if not batch_reference.endswith(expected_suffix):
            lot.deleted_at = now
            changed = True

    return changed


async def ensure_demo_inventory_and_packages() -> None:
    async with AsyncSessionLocal() as db:
        changed = False
        food_banks_by_name: dict[str, FoodBank] = {}
        inventory_items_by_scope: dict[tuple[str, str], InventoryItem] = {}

        for bank_name in (
            {bank["name"] for bank in DEMO_FOOD_BANKS}
            | {package["food_bank_name"] for package in DEMO_PACKAGES}
            | {item["food_bank_name"] for item in DEMO_INVENTORY_ITEMS}
            | {item["food_bank_name"] for item in DEMO_SCOPED_INVENTORY_ITEMS}
        ):
            bank = await _fetch_one_or_none(
                db,
                select(FoodBank).where(FoodBank.name == bank_name),
            )
            if bank is not None:
                food_banks_by_name[bank_name] = bank

        for item_data in [*DEMO_INVENTORY_ITEMS, *DEMO_SCOPED_INVENTORY_ITEMS]:
            bank = food_banks_by_name.get(item_data["food_bank_name"])
            if bank is None:
                continue

            existing_item = await _fetch_one_or_none(
                db,
                select(InventoryItem).where(
                    InventoryItem.name == item_data["name"],
                    InventoryItem.food_bank_id == bank.id,
                ),
            )

            if existing_item is None:
                existing_item = InventoryItem(
                    name=item_data["name"],
                    category=item_data["category"],
                    unit=item_data["unit"],
                    threshold=item_data["threshold"],
                    food_bank_id=bank.id,
                )
                db.add(existing_item)
                await db.flush()
                changed = True
            else:
                if _sync_model_fields(
                    existing_item,
                    {
                        "category": item_data["category"],
                        "unit": item_data["unit"],
                        "threshold": item_data["threshold"],
                        "food_bank_id": bank.id,
                    },
                ):
                    changed = True

            inventory_items_by_scope[
                (item_data["food_bank_name"], item_data["name"])
            ] = existing_item

            batch_reference = (
                f"demo-seed-{item_data['name'].lower().replace(' ', '-')}-bank-{bank.id}"
            )
            existing_lot = await _fetch_one_or_none(
                db,
                select(InventoryLot).where(
                    InventoryLot.inventory_item_id == existing_item.id,
                    InventoryLot.batch_reference == batch_reference,
                ),
            )
            expiry_date = date.today() + timedelta(
                days=int(item_data.get("expiry_days", 365))
            )

            if existing_lot is None:
                db.add(
                    InventoryLot(
                        inventory_item_id=existing_item.id,
                        quantity=item_data["quantity"],
                        received_date=date.today(),
                        expiry_date=expiry_date,
                        batch_reference=batch_reference,
                    )
                )
                changed = True
            else:
                if _sync_model_fields(
                    existing_lot,
                    {
                        "quantity": item_data["quantity"],
                        "received_date": date.today(),
                        "expiry_date": expiry_date,
                        "deleted_at": None,
                    },
                ):
                    changed = True

        expected_package_names_by_bank = {
            bank_name: {
                package["name"]
                for package in DEMO_PACKAGES
                if package["food_bank_name"] == bank_name
            }
            for bank_name in {package["food_bank_name"] for package in DEMO_PACKAGES}
            if bank_name in food_banks_by_name
        }

        for package_data in DEMO_PACKAGES:
            bank = food_banks_by_name.get(package_data["food_bank_name"])
            if bank is None:
                continue

            existing_package = await _fetch_one_or_none(
                db,
                select(FoodPackage).where(
                    FoodPackage.name == package_data["name"],
                    FoodPackage.food_bank_id == bank.id,
                ),
            )

            if existing_package is None:
                existing_package = FoodPackage(
                    name=package_data["name"],
                    category=package_data["category"],
                    description=package_data["description"],
                    stock=package_data["stock"],
                    threshold=package_data["threshold"],
                    applied_count=0,
                    image_url=package_data["image_url"],
                    food_bank_id=bank.id,
                    is_active=True,
                )
                db.add(existing_package)
                await db.flush()
                changed = True
            else:
                if _sync_model_fields(
                    existing_package,
                    {
                        "category": package_data["category"],
                        "description": package_data["description"],
                        "stock": package_data["stock"],
                        "threshold": package_data["threshold"],
                        "image_url": package_data["image_url"],
                        "food_bank_id": bank.id,
                        "is_active": True,
                    },
                ):
                    changed = True

            existing_items = await _fetch_scalars(
                db,
                select(PackageItem).where(PackageItem.package_id == existing_package.id),
            )
            desired_quantities = {
                inventory_items_by_scope[
                    (package_data["food_bank_name"], content["item_name"])
                ].id: content["quantity"]
                for content in package_data["contents"]
            }
            if await _sync_keyed_quantity_children(
                db,
                existing_items=existing_items,
                desired_quantities=desired_quantities,
                key_getter=lambda item: item.inventory_item_id,
                build_child=lambda inventory_item_id, quantity: PackageItem(
                    package_id=existing_package.id,
                    inventory_item_id=inventory_item_id,
                    quantity=quantity,
                ),
            ):
                changed = True

        for bank_name, bank in food_banks_by_name.items():
            expected_names = expected_package_names_by_bank.get(bank_name, set())
            for existing_package in await _fetch_scalars(
                db,
                select(FoodPackage).where(FoodPackage.food_bank_id == bank.id),
            ):
                if (
                    existing_package.name not in expected_names
                    and existing_package.is_active
                ):
                    existing_package.is_active = False
                    changed = True

        changed = await _cleanup_legacy_demo_shared_records(db) or changed

        if changed:
            await db.commit()
