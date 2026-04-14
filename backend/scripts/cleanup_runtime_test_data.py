from __future__ import annotations

import argparse
import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import delete, func, or_, select

from _bootstrap import ensure_backend_on_path

ensure_backend_on_path()

from app.core.bootstrap_seed import DEMO_SCOPED_GOODS_DONOR_EMAILS  # noqa: E402
from app.core.database import AsyncSessionLocal  # noqa: E402
from app.core.db_utils import fetch_rows, fetch_scalars  # noqa: E402
from app.models.application import Application  # noqa: E402
from app.models.application_item import ApplicationItem  # noqa: E402
from app.models.donation_cash import DonationCash  # noqa: E402
from app.models.donation_goods import DonationGoods  # noqa: E402
from app.models.food_package import FoodPackage  # noqa: E402
from app.models.inventory_item import InventoryItem  # noqa: E402
from app.models.inventory_lot import InventoryLot  # noqa: E402
from app.models.inventory_waste_event import InventoryWasteEvent  # noqa: E402
from app.models.package_item import PackageItem  # noqa: E402
from app.models.password_reset_token import PasswordResetToken  # noqa: E402
from app.models.restock_request import RestockRequest  # noqa: E402
from app.models.user import User  # noqa: E402


RUNTIME_TEST_EMAIL_PATTERNS = (
    "acceptance-%@example.com",
    "admin_%@example.com",
    "cash.monthly.%@example.com",
    "cash.one.%@example.com",
    "donor.%@example.com",
    "e2e-%@example.com",
    "goods.%@example.com",
    "member.%@example.com",
    "probe-%@example.com",
    "qa.%@example.com",
    "regular_%@example.com",
    "runtime.%@example.com",
    "testuser%@example.com",
)
RUNTIME_TEST_EXACT_EMAILS = {
    "smoke-test@example.com",
}
ANALYTICS_USER_PATTERN = "analytics.user.%@example.com"
ANALYTICS_CASH_REFERENCE_PATTERN = "AN-CASH-%"
ANALYTICS_GOODS_EMAIL_PATTERN = "%.goods%@example.com"
SUMMARY_SAMPLE_LIMIT = 5


@dataclass(slots=True)
class CleanupSummary:
    runtime_user_ids: list[UUID]
    runtime_user_emails: list[str]
    runtime_application_count: int
    runtime_cash_count: int
    runtime_cash_samples: list[str]
    runtime_goods_count: int
    runtime_goods_samples: list[str]
    reset_token_count: int
    review_bankless_cash_count: int
    review_bankless_goods_count: int
    review_deleted_application_count: int
    review_deleted_lot_count: int
    review_null_scoped_inventory_item_count: int
    review_demo_seed_lot_count: int
    qa_inventory_item_ids: list[int]
    qa_inventory_item_names: list[str]
    qa_inventory_lot_count: int
    analytics_user_count: int
    analytics_cash_count: int
    analytics_goods_count: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Preview or remove local runtime/test data artifacts "
            "without touching canonical demo seed records."
        ),
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Execute the cleanup. Without this flag the script only prints a preview.",
    )
    parser.add_argument(
        "--keep-reset-tokens",
        action="store_true",
        help="Preserve expired/used password reset tokens instead of deleting them.",
    )
    return parser.parse_args()


def _email_filter(column):
    clauses = [column.like(pattern) for pattern in RUNTIME_TEST_EMAIL_PATTERNS]
    if RUNTIME_TEST_EXACT_EMAILS:
        clauses.append(column.in_(sorted(RUNTIME_TEST_EXACT_EMAILS)))
    return or_(*clauses)


def _naive_utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _looks_like_qa_inventory_name(name: str | None) -> bool:
    normalized = str(name or "").strip().lower()
    return normalized.isdigit() or "qa" in normalized


async def _count(db, stmt) -> int:
    return int((await db.scalar(stmt)) or 0)


def _preview_list(values: list[str]) -> str:
    if not values:
        return ""
    preview = ", ".join(values[:SUMMARY_SAMPLE_LIMIT])
    if len(values) > SUMMARY_SAMPLE_LIMIT:
        preview = f"{preview}, ..."
    return preview


def print_summary(
    summary: CleanupSummary,
    *,
    apply: bool,
    keep_reset_tokens: bool,
) -> None:
    mode = "APPLY" if apply else "PREVIEW"
    print(f"[{mode}] Runtime/test cleanup summary")
    print(f"- Runtime/test users: {len(summary.runtime_user_ids)}")
    if summary.runtime_user_emails:
        print(f"  Sample users: {_preview_list(summary.runtime_user_emails)}")
    print(f"- Applications tied to runtime/test users: {summary.runtime_application_count}")
    print(f"- Cash donations to remove: {summary.runtime_cash_count}")
    if summary.runtime_cash_samples:
        print(f"  Sample cash donors: {_preview_list(summary.runtime_cash_samples)}")
    print(f"- Goods donations to remove: {summary.runtime_goods_count}")
    if summary.runtime_goods_samples:
        print(f"  Sample goods donors: {_preview_list(summary.runtime_goods_samples)}")
    print(
        "- Password reset tokens to remove: "
        f"{0 if keep_reset_tokens else summary.reset_token_count}"
    )
    print("- Review-only findings:")
    print(f"  Remaining bankless cash donations: {summary.review_bankless_cash_count}")
    print(f"  Remaining bankless goods donations: {summary.review_bankless_goods_count}")
    print(f"  Soft-deleted applications: {summary.review_deleted_application_count}")
    print(f"  Soft-deleted inventory lots: {summary.review_deleted_lot_count}")
    print(
        "  Inventory items with null food_bank_id: "
        f"{summary.review_null_scoped_inventory_item_count}"
    )
    print(f"  Demo-seed lots present: {summary.review_demo_seed_lot_count}")
    print(
        "- Safe QA inventory cleanup candidates: "
        f"{len(summary.qa_inventory_item_ids)} item(s), {summary.qa_inventory_lot_count} lot(s)"
    )
    if summary.qa_inventory_item_names:
        print(f"  Items: {_preview_list(summary.qa_inventory_item_names)}")
    print("- Separate analytics cleanup candidates:")
    print(f"  Analytics users: {summary.analytics_user_count}")
    print(f"  Analytics cash donations: {summary.analytics_cash_count}")
    print(f"  Analytics goods donations: {summary.analytics_goods_count}")
    if not apply:
        print("Run again with --apply to execute this cleanup.")
        print(
            "If analytics synthetic data is still present, run "
            "`python scripts/cleanup_analytics_data.py --apply` separately."
        )


async def collect_summary(keep_reset_tokens: bool) -> CleanupSummary:
    async with AsyncSessionLocal() as db:
        runtime_users = await fetch_rows(
            db,
            select(User.id, User.email)
            .where(_email_filter(User.email))
            .order_by(User.created_at.desc(), User.email.asc()),
        )
        runtime_user_ids = [row[0] for row in runtime_users]
        runtime_user_emails = [row[1] for row in runtime_users]

        runtime_application_count = 0
        if runtime_user_ids:
            runtime_application_count = await _count(
                db,
                select(func.count())
                .select_from(Application)
                .where(Application.user_id.in_(runtime_user_ids)),
            )

        runtime_cash_rows = await fetch_rows(
            db,
            select(DonationCash.donor_email, DonationCash.payment_reference)
            .where(_email_filter(DonationCash.donor_email))
            .order_by(DonationCash.created_at.desc(), DonationCash.payment_reference.asc()),
        )
        runtime_goods_rows = await fetch_rows(
            db,
            select(DonationGoods.donor_email, DonationGoods.food_bank_name)
            .where(_email_filter(DonationGoods.donor_email))
            .order_by(DonationGoods.created_at.desc(), DonationGoods.donor_email.asc()),
        )

        reset_token_count = 0
        if not keep_reset_tokens:
            reset_token_count = await _count(
                db,
                select(func.count())
                .select_from(PasswordResetToken)
                .where(
                    or_(
                        PasswordResetToken.expires_at < _naive_utc_now(),
                        PasswordResetToken.used_at.is_not(None),
                    )
                ),
            )

        review_bankless_cash_count = await _count(
            db,
            select(func.count())
            .select_from(DonationCash)
            .where(
                DonationCash.food_bank_id.is_(None),
                ~_email_filter(DonationCash.donor_email),
            ),
        )
        review_bankless_goods_count = await _count(
            db,
            select(func.count())
            .select_from(DonationGoods)
            .where(
                DonationGoods.food_bank_id.is_(None),
                ~_email_filter(DonationGoods.donor_email),
            ),
        )
        review_deleted_application_count = await _count(
            db,
            select(func.count())
            .select_from(Application)
            .where(Application.deleted_at.is_not(None)),
        )
        review_deleted_lot_count = await _count(
            db,
            select(func.count())
            .select_from(InventoryLot)
            .where(InventoryLot.deleted_at.is_not(None)),
        )
        review_null_scoped_inventory_item_count = await _count(
            db,
            select(func.count())
            .select_from(InventoryItem)
            .where(InventoryItem.food_bank_id.is_(None)),
        )
        review_demo_seed_lot_count = await _count(
            db,
            select(func.count())
            .select_from(InventoryLot)
            .where(InventoryLot.batch_reference.like("demo-seed-%")),
        )

        qa_inventory_rows = await fetch_rows(
            db,
            select(InventoryItem.id, InventoryItem.name)
            .where(InventoryItem.food_bank_id.is_(None))
            .order_by(InventoryItem.id.asc()),
        )
        qa_inventory_item_ids: list[int] = []
        qa_inventory_item_names: list[str] = []
        qa_inventory_lot_count = 0
        for item_id, item_name in qa_inventory_rows:
            if not _looks_like_qa_inventory_name(item_name):
                continue

            active_package_refs = await _count(
                db,
                select(func.count())
                .select_from(PackageItem)
                .join(FoodPackage, FoodPackage.id == PackageItem.package_id)
                .where(
                    PackageItem.inventory_item_id == item_id,
                    FoodPackage.is_active.is_(True),
                ),
            )
            application_refs = await _count(
                db,
                select(func.count())
                .select_from(ApplicationItem)
                .where(ApplicationItem.inventory_item_id == item_id),
            )
            waste_refs = await _count(
                db,
                select(func.count())
                .select_from(InventoryWasteEvent)
                .where(InventoryWasteEvent.inventory_item_id == item_id),
            )
            restock_refs = await _count(
                db,
                select(func.count())
                .select_from(RestockRequest)
                .where(RestockRequest.inventory_item_id == item_id),
            )
            if any((active_package_refs, application_refs, waste_refs, restock_refs)):
                continue

            qa_inventory_item_ids.append(int(item_id))
            qa_inventory_item_names.append(str(item_name))
            qa_inventory_lot_count += await _count(
                db,
                select(func.count())
                .select_from(InventoryLot)
                .where(InventoryLot.inventory_item_id == item_id),
            )

        analytics_user_count = await _count(
            db,
            select(func.count())
            .select_from(User)
            .where(User.email.like(ANALYTICS_USER_PATTERN)),
        )
        analytics_cash_count = await _count(
            db,
            select(func.count())
            .select_from(DonationCash)
            .where(DonationCash.payment_reference.like(ANALYTICS_CASH_REFERENCE_PATTERN)),
        )
        analytics_goods_count = await _count(
            db,
            select(func.count())
            .select_from(DonationGoods)
            .where(
                DonationGoods.donor_email.like(ANALYTICS_GOODS_EMAIL_PATTERN),
                DonationGoods.donor_email.not_in(DEMO_SCOPED_GOODS_DONOR_EMAILS),
            ),
        )

        return CleanupSummary(
            runtime_user_ids=runtime_user_ids,
            runtime_user_emails=runtime_user_emails,
            runtime_application_count=runtime_application_count,
            runtime_cash_count=len(runtime_cash_rows),
            runtime_cash_samples=[
                f"{donor_email or '(missing email)'} [{payment_reference or 'no-ref'}]"
                for donor_email, payment_reference in runtime_cash_rows[:SUMMARY_SAMPLE_LIMIT]
            ],
            runtime_goods_count=len(runtime_goods_rows),
            runtime_goods_samples=[
                f"{donor_email or '(missing email)'} [{food_bank_name or 'no-bank'}]"
                for donor_email, food_bank_name in runtime_goods_rows[:SUMMARY_SAMPLE_LIMIT]
            ],
            reset_token_count=reset_token_count,
            review_bankless_cash_count=review_bankless_cash_count,
            review_bankless_goods_count=review_bankless_goods_count,
            review_deleted_application_count=review_deleted_application_count,
            review_deleted_lot_count=review_deleted_lot_count,
            review_null_scoped_inventory_item_count=review_null_scoped_inventory_item_count,
            review_demo_seed_lot_count=review_demo_seed_lot_count,
            qa_inventory_item_ids=qa_inventory_item_ids,
            qa_inventory_item_names=qa_inventory_item_names,
            qa_inventory_lot_count=qa_inventory_lot_count,
            analytics_user_count=analytics_user_count,
            analytics_cash_count=analytics_cash_count,
            analytics_goods_count=analytics_goods_count,
        )


async def apply_cleanup(summary: CleanupSummary, keep_reset_tokens: bool) -> None:
    async with AsyncSessionLocal() as db:
        if summary.runtime_application_count > 0:
            await db.execute(
                delete(Application).where(Application.user_id.in_(summary.runtime_user_ids))
            )

        if summary.runtime_cash_count > 0:
            await db.execute(
                delete(DonationCash).where(_email_filter(DonationCash.donor_email))
            )

        if summary.runtime_goods_count > 0:
            await db.execute(
                delete(DonationGoods).where(_email_filter(DonationGoods.donor_email))
            )

        if not keep_reset_tokens and summary.reset_token_count > 0:
            await db.execute(
                delete(PasswordResetToken).where(
                    or_(
                        PasswordResetToken.expires_at < _naive_utc_now(),
                        PasswordResetToken.used_at.is_not(None),
                    )
                )
            )

        if summary.runtime_user_ids:
            await db.execute(delete(User).where(User.id.in_(summary.runtime_user_ids)))

        if summary.qa_inventory_item_ids:
            await db.execute(
                delete(InventoryItem).where(
                    InventoryItem.id.in_(summary.qa_inventory_item_ids)
                )
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

        await db.commit()


async def main() -> None:
    options = parse_args()
    summary = await collect_summary(options.keep_reset_tokens)
    print_summary(
        summary,
        apply=options.apply,
        keep_reset_tokens=options.keep_reset_tokens,
    )

    if not options.apply:
        return

    await apply_cleanup(summary, options.keep_reset_tokens)
    after = await collect_summary(options.keep_reset_tokens)
    print()
    print("Cleanup complete.")
    print_summary(
        after,
        apply=True,
        keep_reset_tokens=options.keep_reset_tokens,
    )


if __name__ == "__main__":
    asyncio.run(main())
