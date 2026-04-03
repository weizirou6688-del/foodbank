"""
Preview or remove synthetic analytics data created by generate_analytics_data.py.

By default this script runs in preview mode and reports what would be removed.
Pass --apply to execute the cleanup transaction.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from dataclasses import dataclass
from pathlib import Path
from uuid import UUID

from sqlalchemy import delete, func, or_, select

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.bootstrap import DEMO_PACKAGES  # noqa: E402
from app.core.database import AsyncSessionLocal  # noqa: E402
from app.models.application import Application  # noqa: E402
from app.models.application_item import ApplicationItem  # noqa: E402
from app.models.donation_cash import DonationCash  # noqa: E402
from app.models.donation_goods import DonationGoods  # noqa: E402
from app.models.food_bank import FoodBank  # noqa: E402
from app.models.food_package import FoodPackage  # noqa: E402
from app.models.user import User  # noqa: E402


ANALYTICS_USER_PATTERN = "analytics.user.%@example.com"
ANALYTICS_CASH_REFERENCE_PATTERN = "AN-CASH-%"
ANALYTICS_GOODS_EMAIL_PATTERN = "%.goods%@example.com"


@dataclass(slots=True)
class CleanupSummary:
    analytics_user_ids: list[UUID]
    analytics_user_emails: list[str]
    analytics_user_count: int
    cash_donation_count: int
    goods_donation_count: int
    application_count: int
    demo_package_stock_resets: list[str]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Preview or remove locally generated synthetic analytics data.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Execute the cleanup. Without this flag the script only prints a preview.",
    )
    parser.add_argument(
        "--preserve-demo-package-stock",
        action="store_true",
        help="Keep current demo package stock values instead of restoring seeded stock.",
    )
    return parser.parse_args()


def print_summary(summary: CleanupSummary, apply: bool) -> None:
    mode = "APPLY" if apply else "PREVIEW"
    print(f"[{mode}] Synthetic analytics cleanup summary")
    print(f"- Analytics public users: {summary.analytics_user_count}")
    if summary.analytics_user_emails:
        preview_emails = ", ".join(summary.analytics_user_emails[:5])
        if len(summary.analytics_user_emails) > 5:
            preview_emails = f"{preview_emails}, ..."
        print(f"  Sample users: {preview_emails}")
    print(f"- Cash donations to remove: {summary.cash_donation_count}")
    print(f"- Goods donations to remove: {summary.goods_donation_count}")
    print(f"- Applications to remove: {summary.application_count}")
    print(f"- Demo package stock resets: {len(summary.demo_package_stock_resets)}")
    if summary.demo_package_stock_resets:
        print(f"  Packages: {', '.join(summary.demo_package_stock_resets)}")
    if not apply:
        print("Run again with --apply to execute this cleanup.")


async def collect_summary(preserve_demo_package_stock: bool) -> CleanupSummary:
    async with AsyncSessionLocal() as db:
        analytics_users = (
            await db.execute(
                select(User.id, User.email)
                .where(User.email.like(ANALYTICS_USER_PATTERN))
                .order_by(User.email)
            )
        ).all()
        analytics_user_ids = [row[0] for row in analytics_users]
        analytics_user_emails = [row[1] for row in analytics_users]

        cash_donation_count = int(
            (await db.scalar(
                select(func.count()).select_from(DonationCash).where(
                    DonationCash.payment_reference.like(ANALYTICS_CASH_REFERENCE_PATTERN)
                )
            )) or 0
        )

        goods_filters = [DonationGoods.donor_email.like(ANALYTICS_GOODS_EMAIL_PATTERN)]
        if analytics_user_ids:
            goods_filters.append(DonationGoods.donor_user_id.in_(analytics_user_ids))
        goods_donation_count = int(
            (await db.scalar(
                select(func.count()).select_from(DonationGoods).where(or_(*goods_filters))
            )) or 0
        )

        application_count = 0
        if analytics_user_ids:
            application_count = int(
                (await db.scalar(
                    select(func.count()).select_from(Application).where(
                        Application.user_id.in_(analytics_user_ids)
                    )
                )) or 0
            )

        demo_package_stock_resets: list[str] = []
        if not preserve_demo_package_stock:
            banks = (
                await db.execute(select(FoodBank.id, FoodBank.name))
            ).all()
            bank_ids_by_name = {row[1]: int(row[0]) for row in banks}
            for package_data in DEMO_PACKAGES:
                bank_id = bank_ids_by_name.get(package_data["food_bank_name"])
                if bank_id is None:
                    continue
                package = await db.scalar(
                    select(FoodPackage).where(
                        FoodPackage.name == package_data["name"],
                        FoodPackage.food_bank_id == bank_id,
                    )
                )
                if package is not None and int(package.stock or 0) != int(package_data["stock"]):
                    demo_package_stock_resets.append(package_data["name"])

        return CleanupSummary(
            analytics_user_ids=analytics_user_ids,
            analytics_user_emails=analytics_user_emails,
            analytics_user_count=len(analytics_user_ids),
            cash_donation_count=cash_donation_count,
            goods_donation_count=goods_donation_count,
            application_count=application_count,
            demo_package_stock_resets=demo_package_stock_resets,
        )


async def recompute_package_applied_counts() -> None:
    async with AsyncSessionLocal() as db:
        package_totals = {
            int(package_id): int(total_quantity or 0)
            for package_id, total_quantity in (
                await db.execute(
                    select(
                        ApplicationItem.package_id,
                        func.coalesce(func.sum(ApplicationItem.quantity), 0),
                    )
                    .where(ApplicationItem.package_id.is_not(None))
                    .group_by(ApplicationItem.package_id)
                )
            ).all()
            if package_id is not None
        }

        packages = (await db.execute(select(FoodPackage))).scalars().all()
        for package in packages:
            package.applied_count = package_totals.get(int(package.id), 0)

        await db.commit()


async def restore_demo_package_stock() -> None:
    async with AsyncSessionLocal() as db:
        banks = (await db.execute(select(FoodBank.id, FoodBank.name))).all()
        bank_ids_by_name = {row[1]: int(row[0]) for row in banks}

        for package_data in DEMO_PACKAGES:
            bank_id = bank_ids_by_name.get(package_data["food_bank_name"])
            if bank_id is None:
                continue

            package = await db.scalar(
                select(FoodPackage).where(
                    FoodPackage.name == package_data["name"],
                    FoodPackage.food_bank_id == bank_id,
                )
            )
            if package is None:
                continue

            package.stock = int(package_data["stock"])

        await db.commit()


async def apply_cleanup(summary: CleanupSummary, preserve_demo_package_stock: bool) -> None:
    async with AsyncSessionLocal() as db:
        if summary.application_count > 0:
            await db.execute(
                delete(Application).where(Application.user_id.in_(summary.analytics_user_ids))
            )

        if summary.cash_donation_count > 0:
            await db.execute(
                delete(DonationCash).where(
                    DonationCash.payment_reference.like(ANALYTICS_CASH_REFERENCE_PATTERN)
                )
            )

        goods_filters = [DonationGoods.donor_email.like(ANALYTICS_GOODS_EMAIL_PATTERN)]
        if summary.analytics_user_ids:
            goods_filters.append(DonationGoods.donor_user_id.in_(summary.analytics_user_ids))
        if summary.goods_donation_count > 0:
            await db.execute(delete(DonationGoods).where(or_(*goods_filters)))

        if summary.analytics_user_count > 0:
            await db.execute(
                delete(User).where(User.email.like(ANALYTICS_USER_PATTERN))
            )

        await db.commit()

    await recompute_package_applied_counts()
    if not preserve_demo_package_stock:
        await restore_demo_package_stock()


async def main() -> None:
    options = parse_args()
    summary = await collect_summary(options.preserve_demo_package_stock)
    print_summary(summary, options.apply)

    if not options.apply:
        return

    await apply_cleanup(summary, options.preserve_demo_package_stock)
    after = await collect_summary(options.preserve_demo_package_stock)
    print()
    print("Cleanup complete.")
    print_summary(after, apply=True)


if __name__ == "__main__":
    asyncio.run(main())
