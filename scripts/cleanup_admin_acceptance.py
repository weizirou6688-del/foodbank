import json
import sys
from pathlib import Path

from sqlalchemy import delete, select

ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.database import AsyncSessionLocal  # noqa: E402
from app.models.application import Application  # noqa: E402
from app.models.donation_goods import DonationGoods  # noqa: E402
from app.models.food_package import FoodPackage  # noqa: E402
from app.models.user import User  # noqa: E402

import asyncio  # noqa: E402


async def cleanup(state_path: str) -> None:
    with open(state_path, "r", encoding="utf-8") as file:
        payload = json.load(file)

    public_users = list(payload.get("publicUsers", []))
    package_restores = payload.get("packageRestores", {})
    goods_donation_emails = list(payload.get("goodsDonationEmails", []))

    async with AsyncSessionLocal() as session:
        for package_id_raw, restore_quantity_raw in package_restores.items():
            package_id = int(package_id_raw)
            restore_quantity = int(restore_quantity_raw)
            package = await session.scalar(select(FoodPackage).where(FoodPackage.id == package_id))
            if package is None:
                continue

            package.stock = int(package.stock or 0) + restore_quantity
            package.applied_count = max(0, int(package.applied_count or 0) - restore_quantity)

        if public_users:
            users = (
                await session.execute(
                    select(User).where(User.email.in_(public_users))
                )
            ).scalars().all()
            for user in users:
                await session.delete(user)

        if goods_donation_emails:
            donations = (
                await session.execute(
                    select(DonationGoods).where(DonationGoods.donor_email.in_(goods_donation_emails))
                )
            ).scalars().all()
            for donation in donations:
                await session.delete(donation)

        await session.commit()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: cleanup_admin_acceptance.py <state-json-path>")
    asyncio.run(cleanup(sys.argv[1]))
