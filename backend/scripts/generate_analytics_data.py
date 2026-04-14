from __future__ import annotations

import argparse
import asyncio
import random
import re
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

from sqlalchemy import select

from _bootstrap import ensure_backend_on_path

ensure_backend_on_path()

from app.core.bootstrap import ensure_base_demo_data  # noqa: E402
from app.core.database import AsyncSessionLocal  # noqa: E402
from app.core.db_utils import fetch_scalars as _fetch_scalars  # noqa: E402
from app.core.redemption_codes import normalize_redemption_code  # noqa: E402
from app.core.security import get_password_hash  # noqa: E402
from app.models.application import Application  # noqa: E402
from app.models.application_item import ApplicationItem  # noqa: E402
from app.models.donation_cash import DonationCash  # noqa: E402
from app.models.donation_goods import DonationGoods  # noqa: E402
from app.models.donation_goods_item import DonationGoodsItem  # noqa: E402
from app.models.food_bank import FoodBank  # noqa: E402
from app.models.food_package import FoodPackage  # noqa: E402
from app.models.user import User  # noqa: E402


@dataclass(slots=True)
class GenerationConfig:
    days: int
    public_users: int
    cash_per_day: int
    goods_per_day: int
    applications_per_week: int
    seed: int


FIRST_NAMES = [
    "Alex", "Jamie", "Taylor", "Jordan", "Morgan", "Casey", "Riley", "Avery",
    "Quinn", "Harper", "Rowan", "Cameron", "Skyler", "Drew", "Parker",
]
LAST_NAMES = [
    "Smith", "Johnson", "Brown", "Wilson", "Evans", "Walker", "Clarke",
    "Taylor", "Roberts", "Hall", "Young", "King", "Wright", "Scott",
]
GOODS_NOTES = [
    "Drop-off at reception",
    "Items sorted before arrival",
    "Mixed pantry donation",
    "Community collection drive",
    "Office charity contribution",
    None,
]
GOODS_CONDITIONS = [
    "New or unopened",
    "Excellent",
    "Good",
]
GOODS_ITEMS = [
    "Rice",
    "Pasta",
    "Canned Beans",
    "UHT Milk",
    "Breakfast Cereal",
    "Canned Tomatoes",
    "Soup",
    "Tea Bags",
    "Peanut Butter",
    "Tinned Fruit",
]
QUANTITY_UNITS = [
    "bags",
    "boxes",
    "crates",
    "packs",
]
UK_POSTCODE_PATTERN = re.compile(r"([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})$", re.IGNORECASE)


def parse_args() -> GenerationConfig:
    parser = argparse.ArgumentParser(
        description="Generate synthetic local analytics data for the foodbank project.",
    )
    for flag, default, help_text in [
        ("--days", 180, "How many past days to generate."),
        ("--public-users", 24, "How many additional synthetic public users to create."),
        ("--cash-per-day", 3, "Average number of cash donations per day."),
        ("--goods-per-day", 2, "Average number of goods donations per day."),
        ("--applications-per-week", 14, "Average number of applications per week."),
        ("--seed", 20260329, "Random seed."),
    ]:
        parser.add_argument(flag, type=int, default=default, help=help_text)
    args = parser.parse_args()
    return GenerationConfig(
        days=max(args.days, 1),
        public_users=max(args.public_users, 1),
        cash_per_day=max(args.cash_per_day, 0),
        goods_per_day=max(args.goods_per_day, 0),
        applications_per_week=max(args.applications_per_week, 0),
        seed=args.seed,
    )


def random_created_at(rng: random.Random, base_date: date) -> datetime:
    return datetime.combine(
        base_date,
        time(
            hour=rng.randint(8, 19),
            minute=rng.randint(0, 59),
            second=rng.randint(0, 59),
        ),
    )


def monday_of_week(input_date: date) -> date:
    return input_date - timedelta(days=input_date.weekday())


def make_name(rng: random.Random) -> str:
    return f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}"


def make_email(name: str, unique_value: str) -> str:
    local = name.lower().replace(" ", ".")
    return f"{local}.{unique_value}@example.com"


def extract_postcode_from_address(address: str) -> str | None:
    match = UK_POSTCODE_PATTERN.search(address.strip())
    if not match:
        return None
    return match.group(1).upper()

async def ensure_public_users(
    db,
    count: int,
    rng: random.Random,
) -> list[User]:
    users: list[User] = []
    existing = await _fetch_scalars(
        db,
        select(User).where(User.email.like("analytics.user.%@example.com")),
    )
    existing_by_email = {user.email: user for user in existing}

    for index in range(1, count + 1):
        email = f"analytics.user.{index:03d}@example.com"
        user = existing_by_email.get(email)
        if user is None:
            user = User(
                name=make_name(rng),
                email=email,
                password_hash=get_password_hash("analytics123"),
                role="public",
            )
            db.add(user)
            await db.flush()
        users.append(user)

    return users


async def generate_cash_donations(db, rng: random.Random, config: GenerationConfig) -> int:
    created = 0
    today = date.today()

    if config.cash_per_day <= 0:
        return 0

    for offset in range(config.days):
        target_day = today - timedelta(days=offset)
        count = max(0, int(round(config.cash_per_day + rng.choice([-1, 0, 0, 1]))))
        for donation_index in range(count):
            donor_name = make_name(rng)
            donation = DonationCash(
                donor_email=make_email(donor_name, f"cash{offset:03d}{donation_index:02d}"),
                amount_pence=rng.randint(300, 15000),
                payment_reference=f"AN-CASH-{offset:03d}-{donation_index:02d}",
                status=rng.choices(
                    ["completed", "completed", "completed", "failed", "refunded"],
                    weights=[75, 75, 75, 8, 4],
                    k=1,
                )[0],
            )
            donation.created_at = random_created_at(rng, target_day)
            db.add(donation)
            created += 1

    return created


async def generate_goods_donations(
    db,
    rng: random.Random,
    config: GenerationConfig,
    public_users: list[User],
    food_banks: list[FoodBank],
) -> int:
    created = 0
    today = date.today()

    if config.goods_per_day <= 0:
        return 0

    for offset in range(config.days):
        target_day = today - timedelta(days=offset)
        count = max(0, int(round(config.goods_per_day + rng.choice([-1, 0, 1]))))
        for donation_index in range(count):
            donor_name = make_name(rng)
            selected_bank = rng.choice(food_banks) if food_banks else None
            goods = DonationGoods(
                donor_user_id=rng.choice(public_users).id if rng.random() < 0.35 else None,
                food_bank_id=selected_bank.id if selected_bank is not None else None,
                food_bank_name=selected_bank.name if selected_bank is not None else None,
                food_bank_address=selected_bank.address if selected_bank is not None else None,
                donor_name=donor_name,
                donor_email=make_email(donor_name, f"goods{offset:03d}{donation_index:02d}"),
                donor_phone=f"07{rng.randint(100000000, 999999999)}",
                postcode=extract_postcode_from_address(selected_bank.address) if selected_bank is not None else None,
                pickup_date=target_day + timedelta(days=rng.randint(1, 14)),
                item_condition=rng.choice(GOODS_CONDITIONS),
                estimated_quantity=f"{rng.randint(1, 6)} {rng.choice(QUANTITY_UNITS)}",
                notes=rng.choice(GOODS_NOTES),
                status=rng.choices(
                    ["pending", "received", "received", "received", "rejected"],
                    weights=[10, 40, 40, 40, 8],
                    k=1,
                )[0],
            )
            goods.created_at = random_created_at(rng, target_day)
            db.add(goods)
            await db.flush()

            item_count = rng.randint(2, 5)
            for _ in range(item_count):
                db.add(
                    DonationGoodsItem(
                        donation_id=goods.id,
                        item_name=rng.choice(GOODS_ITEMS),
                        quantity=rng.randint(1, 12),
                    )
                )

            created += 1

    return created


async def generate_applications(
    db,
    rng: random.Random,
    config: GenerationConfig,
    public_users: list[User],
    food_banks: list[FoodBank],
    packages: list[FoodPackage],
) -> int:
    created = 0
    if config.applications_per_week <= 0:
        return 0
    packages_by_bank: dict[int, list[FoodPackage]] = {}
    for package in packages:
        if package.food_bank_id is None:
            continue
        packages_by_bank.setdefault(package.food_bank_id, []).append(package)

    available_food_banks = [bank for bank in food_banks if bank.id in packages_by_bank]
    if not available_food_banks:
        return 0

    total_weeks = max(1, (config.days + 6) // 7)
    for week_offset in range(total_weeks):
        week_start = monday_of_week(date.today() - timedelta(days=week_offset * 7))
        count = max(0, int(round(config.applications_per_week + rng.choice([-2, -1, 0, 1, 2]))))
        for _ in range(count):
            bank = rng.choice(available_food_banks)
            bank_packages = packages_by_bank.get(bank.id, [])
            if not bank_packages:
                continue

            selected_user = rng.choice(public_users)
            chosen_packages = rng.sample(bank_packages, k=min(len(bank_packages), rng.randint(1, 2)))
            quantities: list[tuple[FoodPackage, int]] = []
            remaining_total = 3
            for package in chosen_packages:
                if remaining_total <= 0:
                    break
                quantity = rng.randint(1, remaining_total)
                quantities.append((package, quantity))
                remaining_total -= quantity

            total_quantity = sum(quantity for _, quantity in quantities)
            if total_quantity <= 0:
                continue

            compact_redemption_code = "".join(
                rng.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(8)
            )
            application = Application(
                user_id=selected_user.id,
                food_bank_id=bank.id,
                redemption_code=normalize_redemption_code(compact_redemption_code),
                status=rng.choices(
                    ["pending", "collected", "expired"],
                    weights=[55, 30, 15],
                    k=1,
                )[0],
                week_start=week_start,
                total_quantity=total_quantity,
            )
            created_at = random_created_at(rng, week_start + timedelta(days=rng.randint(0, 6)))
            application.created_at = created_at
            application.updated_at = created_at
            db.add(application)
            await db.flush()

            for package, quantity in quantities:
                db.add(
                    ApplicationItem(
                        application_id=application.id,
                        package_id=package.id,
                        quantity=quantity,
                    )
                )
                package.applied_count += quantity

            created += 1

    return created


def rebalance_package_stock(packages: list[FoodPackage], rng: random.Random) -> int:
    if not packages:
        return 0

    ranked_packages = sorted(
        packages,
        key=lambda package: (int(package.applied_count or 0), int(package.id or 0)),
        reverse=True,
    )
    below_threshold_count = max(1, len(ranked_packages) // 2)

    for index, package in enumerate(ranked_packages):
        threshold = max(int(package.threshold or 0), 1)
        if index < below_threshold_count:
            deficit = rng.randint(1, max(2, threshold))
            package.stock = max(0, threshold - deficit)
            continue

        buffer = rng.randint(1, max(3, threshold))
        package.stock = threshold + buffer

    return below_threshold_count


async def main() -> None:
    config = parse_args()
    rng = random.Random(config.seed)

    await ensure_base_demo_data()

    async with AsyncSessionLocal() as db:
        public_users = await ensure_public_users(db, config.public_users, rng)
        food_banks = await _fetch_scalars(db, select(FoodBank).order_by(FoodBank.id))
        packages = await _fetch_scalars(
            db,
            select(FoodPackage).where(FoodPackage.is_active.is_(True)).order_by(FoodPackage.id),
        )

        cash_count = await generate_cash_donations(db, rng, config)
        goods_count = await generate_goods_donations(db, rng, config, public_users, food_banks)
        application_count = await generate_applications(
            db,
            rng,
            config,
            public_users,
            food_banks,
            packages,
        )
        low_stock_packages = rebalance_package_stock(packages, rng)

        await db.commit()

    print("Synthetic analytics data generation complete.")
    for label, value in [
        ("Days covered", config.days),
        ("Synthetic public users ensured", config.public_users),
        ("Cash donations created", cash_count),
        ("Goods donations created", goods_count),
        ("Applications created", application_count),
        ("Packages forced below threshold for stock-gap analysis", low_stock_packages),
    ]:
        print(f"{label}: {value}")


if __name__ == "__main__":
    asyncio.run(main())
