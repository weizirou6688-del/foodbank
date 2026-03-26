from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.food_bank import FoodBank
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
            expected_hash = get_password_hash(demo_user["password"])
            if (
                existing.name != demo_user["name"]
                or existing.role != demo_user["role"]
                or existing.password_hash != expected_hash
            ):
                existing.name = demo_user["name"]
                existing.role = demo_user["role"]
                existing.password_hash = expected_hash
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
