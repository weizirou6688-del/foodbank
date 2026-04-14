from __future__ import annotations

import argparse
import asyncio
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import and_, delete, func, or_, select

from _bootstrap import ensure_backend_on_path

ensure_backend_on_path()

from app.core.bootstrap import DEMO_PACKAGES  # noqa: E402
from app.core.bootstrap_seed import DEMO_SCOPED_GOODS_DONOR_EMAILS  # noqa: E402
from app.core.database import AsyncSessionLocal  # noqa: E402
from app.core.db_utils import fetch_rows, fetch_scalars  # noqa: E402
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


def _goods_filters(analytics_user_ids: list[UUID]) -> list:
    filters = [
        and_(
            DonationGoods.donor_email.like(ANALYTICS_GOODS_EMAIL_PATTERN),
            DonationGoods.donor_email.not_in(DEMO_SCOPED_GOODS_DONOR_EMAILS),
        )
    ]
    if analytics_user_ids:
        filters.append(DonationGoods.donor_user_id.in_(analytics_user_ids))
    return filters


async def _bank_ids_by_name(db) -> dict[str, int]:
    return {
        name: int(bank_id)
        for bank_id, name in await fetch_rows(db, select(FoodBank.id, FoodBank.name))
    }


def _packages_by_key(packages: list[FoodPackage]) -> dict[tuple[int, str], FoodPackage]:
    return {
        (int(package.food_bank_id), package.name): package
        for package in packages
        if package.food_bank_id is not None
    }


def print_summary(summary: CleanupSummary, apply: bool) -> None:
    mode = "APPLY" if apply else "PREVIEW"
    print(f"[{mode}] Synthetic analytics cleanup summary")
    print(f"- Analytics public users: {len(summary.analytics_user_ids)}")
    if summary.analytics_user_emails:
        preview_emails = ", ".join(summary.analytics_user_emails[:5])
        if len(summary.analytics_user_emails) > 5:
            preview_emails = f"{preview_emails}, ..."
        print(f"  Sample users: {preview_emails}")
    for label, value in [
        ("Cash donations to remove", summary.cash_donation_count),
        ("Goods donations to remove", summary.goods_donation_count),
        ("Applications to remove", summary.application_count),
        ("Demo package stock resets", len(summary.demo_package_stock_resets)),
    ]:
        print(f"- {label}: {value}")
    if summary.demo_package_stock_resets:
        print(f"  Packages: {', '.join(summary.demo_package_stock_resets)}")
    if not apply:
        print("Run again with --apply to execute this cleanup.")


async def collect_summary(preserve_demo_package_stock: bool) -> CleanupSummary:
    async with AsyncSessionLocal() as db:
        analytics_users = await fetch_rows(
            db,
            select(User.id, User.email)
            .where(User.email.like(ANALYTICS_USER_PATTERN))
            .order_by(User.email),
        )
        analytics_user_ids = [row[0] for row in analytics_users]
        analytics_user_emails = [row[1] for row in analytics_users]

        cash_donation_count = int(
            (await db.scalar(
                select(func.count()).select_from(DonationCash).where(
                    DonationCash.payment_reference.like(ANALYTICS_CASH_REFERENCE_PATTERN)
                )
            )) or 0
        )

        goods_donation_count = int(
            (await db.scalar(
                select(func.count()).select_from(DonationGoods).where(or_(*_goods_filters(analytics_user_ids)))
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
            bank_ids_by_name = await _bank_ids_by_name(db)
            packages_by_key = _packages_by_key(await fetch_scalars(db, select(FoodPackage)))
            for package_data in DEMO_PACKAGES:
                bank_id = bank_ids_by_name.get(package_data["food_bank_name"])
                if bank_id is None:
                    continue
                package = packages_by_key.get((bank_id, package_data["name"]))
                if package is not None and int(package.stock or 0) != int(package_data["stock"]):
                    demo_package_stock_resets.append(package_data["name"])

        return CleanupSummary(
            analytics_user_ids=analytics_user_ids,
            analytics_user_emails=analytics_user_emails,
            cash_donation_count=cash_donation_count,
            goods_donation_count=goods_donation_count,
            application_count=application_count,
            demo_package_stock_resets=demo_package_stock_resets,
        )


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

        if summary.goods_donation_count > 0:
            await db.execute(
                delete(DonationGoods).where(or_(*_goods_filters(summary.analytics_user_ids)))
            )

        if summary.analytics_user_ids:
            await db.execute(
                delete(User).where(User.email.like(ANALYTICS_USER_PATTERN))
            )

        package_totals = {
            int(package_id): int(total_quantity or 0)
            for package_id, total_quantity in (
                await fetch_rows(
                    db,
                    select(
                        ApplicationItem.package_id,
                        func.coalesce(func.sum(ApplicationItem.quantity), 0),
                    )
                    .where(ApplicationItem.package_id.is_not(None))
                    .group_by(ApplicationItem.package_id)
                )
            )
            if package_id is not None
        }
        packages = await fetch_scalars(db, select(FoodPackage))
        for package in packages:
            package.applied_count = package_totals.get(int(package.id), 0)

        if not preserve_demo_package_stock:
            bank_ids_by_name = await _bank_ids_by_name(db)
            packages_by_key = _packages_by_key(packages)
            for package_data in DEMO_PACKAGES:
                bank_id = bank_ids_by_name.get(package_data["food_bank_name"])
                package = packages_by_key.get((bank_id, package_data["name"])) if bank_id is not None else None
                if package is not None:
                    package.stock = int(package_data["stock"])

        await db.commit()


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
