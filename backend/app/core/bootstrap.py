from datetime import date, timedelta

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash, verify_password
from app.models.food_bank import FoodBank
from app.models.food_package import FoodPackage
from app.models.inventory_item import InventoryItem
from app.models.inventory_lot import InventoryLot
from app.models.package_item import PackageItem
from app.models.user import User


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
]

DEMO_FOOD_BANKS = [
    {
        "name": "Downtown Community Food Bank",
        "address": "123 Main Street, London, SW1A 1AA",
        "lat": 51.507400,
        "lng": -0.127800,
    },
    {
        "name": "Westside Food Support Centre",
        "address": "88 King Street, London, W1K 1AA",
        "lat": 51.513000,
        "lng": -0.145000,
    },
    {
        "name": "Southbank Foodbank Hub",
        "address": "45 Borough Road, London, SE1 1JG",
        "lat": 51.501700,
        "lng": -0.104000,
    },
]

DEMO_INVENTORY_ITEMS = [
    {
        "name": "Rice",
        "category": "Grains & Pasta",
        "unit": "bags",
        "threshold": 20,
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
        "name": "UHT Milk",
        "category": "Dairy",
        "unit": "cartons",
        "threshold": 18,
        "quantity": 180,
    },
    {
        "name": "Breakfast Cereal",
        "category": "Grains & Pasta",
        "unit": "boxes",
        "threshold": 15,
        "quantity": 150,
    },
    {
        "name": "Canned Tomatoes",
        "category": "Canned Goods",
        "unit": "cans",
        "threshold": 18,
        "quantity": 220,
    },
    {
        "name": "Pasta",
        "category": "Grains & Pasta",
        "unit": "packs",
        "threshold": 18,
        "quantity": 240,
    },
]

DEMO_PACKAGES = [
    {
        "food_bank_name": "Downtown Community Food Bank",
        "name": "Emergency Pantry Pack",
        "category": "Emergency Pack",
        "description": "Core shelf-stable essentials for urgent support.",
        "stock": 18,
        "threshold": 5,
        "contents": [
            {"item_name": "Rice", "quantity": 1},
            {"item_name": "Canned Beans", "quantity": 2},
            {"item_name": "UHT Milk", "quantity": 1},
        ],
    },
    {
        "food_bank_name": "Westside Food Support Centre",
        "name": "Family Dinner Bundle",
        "category": "Family Bundle",
        "description": "A balanced bundle for households needing a few evening meals.",
        "stock": 14,
        "threshold": 4,
        "contents": [
            {"item_name": "Pasta", "quantity": 2},
            {"item_name": "Canned Tomatoes", "quantity": 2},
            {"item_name": "Canned Beans", "quantity": 2},
        ],
    },
    {
        "food_bank_name": "Southbank Foodbank Hub",
        "name": "Breakfast Starter Pack",
        "category": "Breakfast",
        "description": "Simple breakfast support for the week ahead.",
        "stock": 12,
        "threshold": 4,
        "contents": [
            {"item_name": "Breakfast Cereal", "quantity": 1},
            {"item_name": "UHT Milk", "quantity": 2},
            {"item_name": "Canned Beans", "quantity": 1},
        ],
    },
]


async def ensure_demo_users() -> None:
    """Create/update demo users so frontend demo credentials always work."""
    async with AsyncSessionLocal() as db:
        changed = False

        for demo_user in DEMO_USERS:
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
                    )
                )
                changed = True
                continue

            # Keep demo credentials stable on every startup.
            if (
                existing.name != demo_user["name"]
                or existing.role != demo_user["role"]
                or not verify_password(demo_user["password"], existing.password_hash)
            ):
                existing.name = demo_user["name"]
                existing.role = demo_user["role"]
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
                    )
                )
                changed = True
                continue

            if (
                existing.address != demo_bank["address"]
                or float(existing.lat) != demo_bank["lat"]
                or float(existing.lng) != demo_bank["lng"]
            ):
                existing.address = demo_bank["address"]
                existing.lat = demo_bank["lat"]
                existing.lng = demo_bank["lng"]
                changed = True

        if changed:
            await db.commit()


async def ensure_demo_inventory_and_packages() -> None:
    """Create demo inventory and packages so the search-to-application flow works on a fresh DB."""
    async with AsyncSessionLocal() as db:
        changed = False

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

            batch_reference = f"demo-seed-{item_data['name'].lower().replace(' ', '-')}"
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
                    or existing_package.food_bank_id != bank.id
                    or existing_package.is_active is not True
                ):
                    existing_package.category = package_data["category"]
                    existing_package.description = package_data["description"]
                    existing_package.stock = package_data["stock"]
                    existing_package.threshold = package_data["threshold"]
                    existing_package.food_bank_id = bank.id
                    existing_package.is_active = True
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

        if changed:
            await db.commit()
