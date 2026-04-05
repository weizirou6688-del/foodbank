from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash, verify_password
from app.models.application import Application
from app.models.application_item import ApplicationItem
from app.models.donation_cash import DonationCash
from app.models.donation_goods import DonationGoods
from app.models.donation_goods_item import DonationGoodsItem
from app.models.food_bank import FoodBank
from app.models.food_package import FoodPackage
from app.models.inventory_item import InventoryItem
from app.models.inventory_lot import InventoryLot
from app.models.package_item import PackageItem
from app.models.user import User

DEMO_LOCAL_ADMIN_BANK_NAME = "Downtown Community Food Bank"


DEMO_USERS = [
    {
        "name": "Admin User",
        "email": "admin@foodbank.com",
        "password": "admin123",
        "role": "admin",
    },
    {
        "name": "Supermarket User",
        "email": "supermarket@foodbank.com",
        "password": "supermarket123",
        "role": "supermarket",
    },
    {
        "name": "Public User",
        "email": "user@example.com",
        "password": "user12345",
        "role": "public",
    },
    {
        "name": "Local Food Bank Admin",
        "email": "localadmin@foodbank.com",
        "password": "localadmin123",
        "role": "admin",
        "food_bank_name": DEMO_LOCAL_ADMIN_BANK_NAME,
    },
]

DEMO_FOOD_BANKS = [
    {
        "name": "Downtown Community Food Bank",
        "address": "123 Main Street, London, SW1A 1AA",
        "lat": 51.507400,
        "lng": -0.127800,
        "notification_email": "localadmin@foodbank.com",
    },
    {
        "name": "Westside Food Support Centre",
        "address": "88 King Street, London, W1K 1AA",
        "lat": 51.513000,
        "lng": -0.145000,
        "notification_email": "westside@foodbank.com",
    },
    {
        "name": "Southbank Foodbank Hub",
        "address": "45 Borough Road, London, SE1 1JG",
        "lat": 51.501700,
        "lng": -0.104000,
        "notification_email": "southbank@foodbank.com",
    },
]

DEMO_INVENTORY_ITEMS = [
    {
        "name": "Rice (2kg)",
        "category": "Grains & Pasta",
        "unit": "bags",
        "threshold": 20,
        "quantity": 240,
    },
    {
        "name": "Pasta (500g)",
        "category": "Grains & Pasta",
        "unit": "packs",
        "threshold": 18,
        "quantity": 240,
    },
    {
        "name": "Canned Beans",
        "category": "Canned Goods",
        "unit": "cans",
        "threshold": 24,
        "quantity": 360,
    },
    {
        "name": "UHT Milk (1L)",
        "category": "Dairy",
        "unit": "cartons",
        "threshold": 18,
        "quantity": 180,
    },
    {
        "name": "Wholemeal Bread",
        "category": "Grains & Pasta",
        "unit": "loaves",
        "threshold": 12,
        "quantity": 120,
    },
    {
        "name": "Mixed Vegetables (frozen)",
        "category": "Vegetables",
        "unit": "bags",
        "threshold": 12,
        "quantity": 120,
    },
    {
        "name": "Tomato Soup (400g)",
        "category": "Canned Goods",
        "unit": "cans",
        "threshold": 18,
        "quantity": 220,
    },
    {
        "name": "Cornflakes Cereal",
        "category": "Grains & Pasta",
        "unit": "boxes",
        "threshold": 15,
        "quantity": 150,
    },
    {
        "name": "Canned Tuna",
        "category": "Proteins & Meat",
        "unit": "cans",
        "threshold": 18,
        "quantity": 180,
    },
    {
        "name": "Chicken Breast (canned)",
        "category": "Proteins & Meat",
        "unit": "cans",
        "threshold": 16,
        "quantity": 160,
    },
    {
        "name": "Lentils (500g)",
        "category": "Grains & Pasta",
        "unit": "packs",
        "threshold": 18,
        "quantity": 180,
    },
    {
        "name": "Eggs (6-pack)",
        "category": "Dairy",
        "unit": "cartons",
        "threshold": 12,
        "quantity": 120,
    },
    {
        "name": "Potatoes (1kg)",
        "category": "Vegetables",
        "unit": "bags",
        "threshold": 16,
        "quantity": 180,
    },
    {
        "name": "Carrots (500g)",
        "category": "Vegetables",
        "unit": "bags",
        "threshold": 16,
        "quantity": 180,
    },
    {
        "name": "Onions (500g)",
        "category": "Vegetables",
        "unit": "bags",
        "threshold": 16,
        "quantity": 180,
    },
    {
        "name": "Canned Tomatoes",
        "category": "Canned Goods",
        "unit": "cans",
        "threshold": 18,
        "quantity": 220,
    },
]

DEMO_INVENTORY_ITEM_NAMES = {item["name"] for item in DEMO_INVENTORY_ITEMS}


def _demo_batch_reference(item_name: str) -> str:
    return f"demo-seed-{item_name.lower().replace(' ', '-')}"


def _demo_week_start(offset_weeks: int = 0) -> date:
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    return monday + timedelta(weeks=offset_weeks)

DEMO_PACKAGES = [
    {
        "food_bank_name": "Downtown Community Food Bank",
        "name": "Basic Essentials Package",
        "category": "Emergency Pack",
        "description": "Core staples for individuals or couples.",
        "stock": 18,
        "threshold": 5,
        "image_url": "https://images.unsplash.com/photo-1559837957-bab8edc53c85?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600&q=80",
        "contents": [
            {"item_name": "Rice (2kg)", "quantity": 1},
            {"item_name": "Pasta (500g)", "quantity": 2},
            {"item_name": "Canned Beans", "quantity": 2},
            {"item_name": "UHT Milk (1L)", "quantity": 1},
        ],
    },
    {
        "food_bank_name": "Downtown Community Food Bank",
        "name": "Family Support Package",
        "category": "Family Bundle",
        "description": "Balanced nutrition for families of 3-5.",
        "stock": 12,
        "threshold": 5,
        "image_url": "https://images.unsplash.com/photo-1714224247661-ee250f55a842?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600&q=80",
        "contents": [
            {"item_name": "Wholemeal Bread", "quantity": 2},
            {"item_name": "Mixed Vegetables (frozen)", "quantity": 1},
            {"item_name": "Tomato Soup (400g)", "quantity": 3},
            {"item_name": "Cornflakes Cereal", "quantity": 1},
        ],
    },
    {
        "food_bank_name": "Downtown Community Food Bank",
        "name": "Protein & Meat Package",
        "category": "Pantry & Spices",
        "description": "High-protein items including canned meats.",
        "stock": 4,
        "threshold": 5,
        "image_url": "https://images.unsplash.com/photo-1653174577821-9ab410d92d44?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600&q=80",
        "contents": [
            {"item_name": "Canned Tuna", "quantity": 3},
            {"item_name": "Chicken Breast (canned)", "quantity": 2},
            {"item_name": "Lentils (500g)", "quantity": 1},
            {"item_name": "Eggs (6-pack)", "quantity": 1},
        ],
    },
    {
        "food_bank_name": "Downtown Community Food Bank",
        "name": "Fresh Veg & Staples Package",
        "category": "Lunchbox",
        "description": "Fresh and dried produce for a healthy diet.",
        "stock": 9,
        "threshold": 5,
        "image_url": "https://images.unsplash.com/photo-1599297914860-1ccd36987a52?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600&q=80",
        "contents": [
            {"item_name": "Potatoes (1kg)", "quantity": 1},
            {"item_name": "Carrots (500g)", "quantity": 1},
            {"item_name": "Onions (500g)", "quantity": 1},
            {"item_name": "Canned Tomatoes", "quantity": 2},
        ],
    },
]

DEMO_LOCAL_SCOPE_CASH_DONATIONS = [
    {
        "payment_reference": "DEMO-LOCAL-CASH-001",
        "donor_name": "Mary Network Donor",
        "donor_email": "mary.network.donor@example.com",
        "amount_pence": 2500,
        "status": "completed",
    },
]

DEMO_LOCAL_SCOPE_GOODS_DONATIONS = [
    {
        "donor_name": "Ahmed Goods Donor",
        "donor_email": "ahmed.goods.donor@example.com",
        "donor_phone": "07123 456789",
        "postcode": "SW1A 1AA",
        "pickup_date_offset_days": 2,
        "item_condition": "New or unopened",
        "estimated_quantity": "3 boxes",
        "status": "pending",
        "notes": "Demo local admin goods donation",
        "items": [
            {"item_name": "Rice (2kg)", "quantity": 4},
            {"item_name": "Canned Beans", "quantity": 8},
        ],
    },
]

DEMO_LOCAL_SCOPE_APPLICATIONS = [
    {
        "redemption_code": "LFB1-0001",
        "package_name": "Basic Essentials Package",
        "status": "pending",
        "week_offset": 0,
        "quantity": 1,
    },
    {
        "redemption_code": "LFB1-0002",
        "package_name": "Family Support Package",
        "status": "collected",
        "week_offset": -1,
        "quantity": 1,
    },
]


async def ensure_demo_users() -> None:
    """Create/update demo users so frontend demo credentials always work."""
    async with AsyncSessionLocal() as db:
        changed = False

        for demo_user in DEMO_USERS:
            food_bank_id = None
            food_bank_name = demo_user.get("food_bank_name")
            if food_bank_name:
                food_bank = await db.scalar(
                    select(FoodBank).where(FoodBank.name == food_bank_name)
                )
                if food_bank is not None:
                    food_bank_id = food_bank.id

            result = await db.execute(
                select(User).where(User.email == demo_user["email"])
            )
            existing = result.scalar_one_or_none()

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

            # Keep demo credentials stable on every startup.
            if (
                existing.name != demo_user["name"]
                or existing.role != demo_user["role"]
                or existing.food_bank_id != food_bank_id
                or not verify_password(demo_user["password"], existing.password_hash)
            ):
                existing.name = demo_user["name"]
                existing.role = demo_user["role"]
                existing.food_bank_id = food_bank_id
                existing.password_hash = get_password_hash(demo_user["password"])
                changed = True

        if changed:
            await db.commit()


async def ensure_demo_food_banks() -> None:
    """Create demo food banks so postcode search always returns data."""
    async with AsyncSessionLocal() as db:
        changed = False

        for demo_bank in DEMO_FOOD_BANKS:
            result = await db.execute(
                select(FoodBank).where(FoodBank.name == demo_bank["name"])
            )
            existing = result.scalar_one_or_none()

            if existing is None:
                db.add(
                    FoodBank(
                        name=demo_bank["name"],
                        address=demo_bank["address"],
                        lat=demo_bank["lat"],
                        lng=demo_bank["lng"],
                        notification_email=demo_bank.get("notification_email"),
                    )
                )
                changed = True
                continue

            if (
                existing.address != demo_bank["address"]
                or float(existing.lat) != demo_bank["lat"]
                or float(existing.lng) != demo_bank["lng"]
                or existing.notification_email != demo_bank.get("notification_email")
            ):
                existing.address = demo_bank["address"]
                existing.lat = demo_bank["lat"]
                existing.lng = demo_bank["lng"]
                existing.notification_email = demo_bank.get("notification_email")
                changed = True

        if changed:
            await db.commit()


async def ensure_demo_inventory_and_packages() -> None:
    """Create demo inventory and packages so the search-to-application flow works on a fresh DB."""
    async with AsyncSessionLocal() as db:
        changed = False
        expected_package_names_by_bank: dict[str, set[str]] = {}

        inventory_items_by_name: dict[str, InventoryItem] = {}
        for item_data in DEMO_INVENTORY_ITEMS:
            result = await db.execute(
                select(InventoryItem).where(InventoryItem.name == item_data["name"])
            )
            existing_item = result.scalar_one_or_none()

            if existing_item is None:
                existing_item = InventoryItem(
                    name=item_data["name"],
                    category=item_data["category"],
                    unit=item_data["unit"],
                    threshold=item_data["threshold"],
                )
                db.add(existing_item)
                await db.flush()
                changed = True
            else:
                if (
                    existing_item.category != item_data["category"]
                    or existing_item.unit != item_data["unit"]
                    or existing_item.threshold != item_data["threshold"]
                ):
                    existing_item.category = item_data["category"]
                    existing_item.unit = item_data["unit"]
                    existing_item.threshold = item_data["threshold"]
                    changed = True

            inventory_items_by_name[item_data["name"]] = existing_item

            batch_reference = _demo_batch_reference(item_data["name"])
            lot_result = await db.execute(
                select(InventoryLot).where(
                    InventoryLot.inventory_item_id == existing_item.id,
                    InventoryLot.batch_reference == batch_reference,
                )
            )
            existing_lot = lot_result.scalar_one_or_none()
            expiry_date = date.today() + timedelta(days=365)

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
                if (
                    existing_lot.quantity != item_data["quantity"]
                    or existing_lot.received_date != date.today()
                    or existing_lot.expiry_date != expiry_date
                    or existing_lot.deleted_at is not None
                ):
                    existing_lot.quantity = item_data["quantity"]
                    existing_lot.received_date = date.today()
                    existing_lot.expiry_date = expiry_date
                    existing_lot.deleted_at = None
                    changed = True

        food_banks_by_name: dict[str, FoodBank] = {}
        for bank_name in {package["food_bank_name"] for package in DEMO_PACKAGES}:
            result = await db.execute(select(FoodBank).where(FoodBank.name == bank_name))
            bank = result.scalar_one_or_none()
            if bank is not None:
                food_banks_by_name[bank_name] = bank
                expected_package_names_by_bank[bank_name] = {
                    package["name"]
                    for package in DEMO_PACKAGES
                    if package["food_bank_name"] == bank_name
                }

        for package_data in DEMO_PACKAGES:
            bank = food_banks_by_name.get(package_data["food_bank_name"])
            if bank is None:
                continue

            result = await db.execute(
                select(FoodPackage).where(
                    FoodPackage.name == package_data["name"],
                    FoodPackage.food_bank_id == bank.id,
                )
            )
            existing_package = result.scalar_one_or_none()

            if existing_package is None:
                existing_package = FoodPackage(
                    name=package_data["name"],
                    category=package_data["category"],
                    description=package_data["description"],
                    stock=package_data["stock"],
                    threshold=package_data["threshold"],
                    applied_count=0,
                    image_url=None,
                    food_bank_id=bank.id,
                    is_active=True,
                )
                db.add(existing_package)
                await db.flush()
                changed = True
            else:
                if (
                    existing_package.category != package_data["category"]
                    or existing_package.description != package_data["description"]
                    or existing_package.stock != package_data["stock"]
                    or existing_package.threshold != package_data["threshold"]
                    or existing_package.image_url != package_data["image_url"]
                    or existing_package.food_bank_id != bank.id
                    or existing_package.is_active is not True
                ):
                    existing_package.category = package_data["category"]
                    existing_package.description = package_data["description"]
                    existing_package.stock = package_data["stock"]
                    existing_package.threshold = package_data["threshold"]
                    existing_package.image_url = package_data["image_url"]
                    existing_package.food_bank_id = bank.id
                    existing_package.is_active = True
                    changed = True

            if existing_package.image_url != package_data["image_url"]:
                existing_package.image_url = package_data["image_url"]
                changed = True

            existing_items_result = await db.execute(
                select(PackageItem).where(PackageItem.package_id == existing_package.id)
            )
            existing_items = list(existing_items_result.scalars().all())
            existing_items_by_inventory_id = {
                item.inventory_item_id: item for item in existing_items
            }
            target_inventory_ids: set[int] = set()

            for content in package_data["contents"]:
                inventory_item = inventory_items_by_name[content["item_name"]]
                target_inventory_ids.add(inventory_item.id)
                package_item = existing_items_by_inventory_id.get(inventory_item.id)

                if package_item is None:
                    db.add(
                        PackageItem(
                            package_id=existing_package.id,
                            inventory_item_id=inventory_item.id,
                            quantity=content["quantity"],
                        )
                    )
                    changed = True
                elif package_item.quantity != content["quantity"]:
                    package_item.quantity = content["quantity"]
                    changed = True

            for package_item in existing_items:
                if package_item.inventory_item_id not in target_inventory_ids:
                    await db.delete(package_item)
                    changed = True

        for bank_name, bank in food_banks_by_name.items():
            expected_names = expected_package_names_by_bank.get(bank_name, set())
            existing_packages_result = await db.execute(
                select(FoodPackage).where(FoodPackage.food_bank_id == bank.id)
            )
            for existing_package in existing_packages_result.scalars().all():
                if existing_package.name not in expected_names and existing_package.is_active:
                    existing_package.is_active = False
                    changed = True

        # Previous demo seeds used a few legacy item names that now have
        # renamed replacements (for example Rice -> Rice (2kg)). When those
        # old lots stay active, the public item list shows duplicate entries.
        legacy_demo_lots = (
            await db.execute(
                select(InventoryLot, InventoryItem.name)
                .join(InventoryItem, InventoryItem.id == InventoryLot.inventory_item_id)
                .where(
                    InventoryLot.batch_reference.like("demo-seed-%"),
                    InventoryLot.deleted_at.is_(None),
                )
            )
        ).all()
        now = datetime.now(timezone.utc)
        for lot, item_name in legacy_demo_lots:
            if item_name in DEMO_INVENTORY_ITEM_NAMES:
                continue
            lot.deleted_at = now
            changed = True

        if changed:
            await db.commit()


async def ensure_demo_admin_scope_records() -> None:
    """Seed bank-scoped demo records so the local admin account has visible data."""
    async with AsyncSessionLocal() as db:
        changed = False

        bank = await db.scalar(
            select(FoodBank).where(FoodBank.name == DEMO_LOCAL_ADMIN_BANK_NAME)
        )
        if bank is None:
            return

        local_admin = await db.scalar(
            select(User).where(User.email == "localadmin@foodbank.com")
        )
        if local_admin is not None and local_admin.food_bank_id != bank.id:
            local_admin.food_bank_id = bank.id
            changed = True

        public_user = await db.scalar(
            select(User).where(User.email == "user@example.com")
        )
        if public_user is None:
            if changed:
                await db.commit()
            return

        packages_result = await db.execute(
            select(FoodPackage).where(FoodPackage.food_bank_id == bank.id)
        )
        packages_by_name = {
            package.name: package for package in packages_result.scalars().all()
        }

        for cash_seed in DEMO_LOCAL_SCOPE_CASH_DONATIONS:
            donation = await db.scalar(
                select(DonationCash).where(
                    DonationCash.payment_reference == cash_seed["payment_reference"]
                )
            )
            if donation is None:
                db.add(
                    DonationCash(
                        donor_name=cash_seed["donor_name"],
                        donor_email=cash_seed["donor_email"],
                        amount_pence=cash_seed["amount_pence"],
                        payment_reference=cash_seed["payment_reference"],
                        status=cash_seed["status"],
                        food_bank_id=bank.id,
                    )
                )
                changed = True
            else:
                if (
                    donation.donor_name != cash_seed["donor_name"]
                    or donation.donor_email != cash_seed["donor_email"]
                    or donation.amount_pence != cash_seed["amount_pence"]
                    or donation.status != cash_seed["status"]
                    or donation.food_bank_id != bank.id
                ):
                    donation.donor_name = cash_seed["donor_name"]
                    donation.donor_email = cash_seed["donor_email"]
                    donation.amount_pence = cash_seed["amount_pence"]
                    donation.status = cash_seed["status"]
                    donation.food_bank_id = bank.id
                    changed = True

        for goods_seed in DEMO_LOCAL_SCOPE_GOODS_DONATIONS:
            donation = await db.scalar(
                select(DonationGoods).where(
                    DonationGoods.food_bank_id == bank.id,
                    DonationGoods.donor_email == goods_seed["donor_email"],
                    DonationGoods.donor_name == goods_seed["donor_name"],
                )
            )
            pickup_date = date.today() + timedelta(
                days=goods_seed["pickup_date_offset_days"]
            )
            if donation is None:
                donation = DonationGoods(
                    food_bank_id=bank.id,
                    food_bank_name=bank.name,
                    food_bank_address=bank.address,
                    donor_name=goods_seed["donor_name"],
                    donor_email=goods_seed["donor_email"],
                    donor_phone=goods_seed["donor_phone"],
                    postcode=goods_seed["postcode"],
                    pickup_date=pickup_date,
                    item_condition=goods_seed["item_condition"],
                    estimated_quantity=goods_seed["estimated_quantity"],
                    notes=goods_seed["notes"],
                    status=goods_seed["status"],
                )
                db.add(donation)
                await db.flush()
                changed = True
            else:
                if (
                    donation.food_bank_id != bank.id
                    or donation.food_bank_name != bank.name
                    or donation.food_bank_address != bank.address
                    or donation.donor_phone != goods_seed["donor_phone"]
                    or donation.postcode != goods_seed["postcode"]
                    or donation.pickup_date != pickup_date
                    or donation.item_condition != goods_seed["item_condition"]
                    or donation.estimated_quantity != goods_seed["estimated_quantity"]
                    or donation.notes != goods_seed["notes"]
                    or donation.status != goods_seed["status"]
                ):
                    donation.food_bank_id = bank.id
                    donation.food_bank_name = bank.name
                    donation.food_bank_address = bank.address
                    donation.donor_phone = goods_seed["donor_phone"]
                    donation.postcode = goods_seed["postcode"]
                    donation.pickup_date = pickup_date
                    donation.item_condition = goods_seed["item_condition"]
                    donation.estimated_quantity = goods_seed["estimated_quantity"]
                    donation.notes = goods_seed["notes"]
                    donation.status = goods_seed["status"]
                    changed = True

            existing_items_result = await db.execute(
                select(DonationGoodsItem).where(
                    DonationGoodsItem.donation_id == donation.id
                )
            )
            existing_items = list(existing_items_result.scalars().all())
            existing_items_by_name = {
                item.item_name: item for item in existing_items
            }
            target_item_names: set[str] = set()

            for item_seed in goods_seed["items"]:
                target_item_names.add(item_seed["item_name"])
                existing_item = existing_items_by_name.get(item_seed["item_name"])
                if existing_item is None:
                    db.add(
                        DonationGoodsItem(
                            donation_id=donation.id,
                            item_name=item_seed["item_name"],
                            quantity=item_seed["quantity"],
                        )
                    )
                    changed = True
                elif existing_item.quantity != item_seed["quantity"]:
                    existing_item.quantity = item_seed["quantity"]
                    changed = True

            for existing_item in existing_items:
                if existing_item.item_name not in target_item_names:
                    await db.delete(existing_item)
                    changed = True

        for application_seed in DEMO_LOCAL_SCOPE_APPLICATIONS:
            package = packages_by_name.get(application_seed["package_name"])
            if package is None:
                continue

            application = await db.scalar(
                select(Application).where(
                    Application.redemption_code == application_seed["redemption_code"]
                )
            )
            week_start = _demo_week_start(application_seed["week_offset"])
            redeemed_at = (
                datetime(
                    week_start.year,
                    week_start.month,
                    week_start.day,
                    12,
                    tzinfo=timezone.utc,
                )
                + timedelta(days=2)
                if application_seed["status"] == "collected"
                else None
            )
            if application is None:
                application = Application(
                    user_id=public_user.id,
                    food_bank_id=bank.id,
                    redemption_code=application_seed["redemption_code"],
                    status=application_seed["status"],
                    week_start=week_start,
                    total_quantity=application_seed["quantity"],
                    redeemed_at=redeemed_at,
                )
                db.add(application)
                await db.flush()
                changed = True
            else:
                if (
                    application.user_id != public_user.id
                    or application.food_bank_id != bank.id
                    or application.status != application_seed["status"]
                    or application.week_start != week_start
                    or application.total_quantity != application_seed["quantity"]
                    or application.redeemed_at != redeemed_at
                    or application.deleted_at is not None
                ):
                    application.user_id = public_user.id
                    application.food_bank_id = bank.id
                    application.status = application_seed["status"]
                    application.week_start = week_start
                    application.total_quantity = application_seed["quantity"]
                    application.redeemed_at = redeemed_at
                    application.deleted_at = None
                    changed = True

            existing_app_items_result = await db.execute(
                select(ApplicationItem).where(
                    ApplicationItem.application_id == application.id
                )
            )
            existing_app_items = list(existing_app_items_result.scalars().all())

            matching_package_item = next(
                (
                    item
                    for item in existing_app_items
                    if item.package_id == package.id
                    and item.quantity == application_seed["quantity"]
                    and item.inventory_item_id is None
                ),
                None,
            )
            if matching_package_item is None:
                for existing_item in existing_app_items:
                    await db.delete(existing_item)
                db.add(
                    ApplicationItem(
                        application_id=application.id,
                        package_id=package.id,
                        quantity=application_seed["quantity"],
                    )
                )
                changed = True

        if changed:
            await db.commit()
