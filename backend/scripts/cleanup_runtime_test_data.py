"""预览或删除运行时的测试数据,保留共享的 demo 种子记录不动。"""

from __future__ import annotations

import argparse
import asyncio
from datetime import datetime, timezone

from sqlalchemy import case, delete, func, or_, select

from _bootstrap import ensure_backend_on_path

ensure_backend_on_path()

from _cleanup_shared import count_rows, preview_values, sync_food_package_applied_counts  # noqa: E402
from app.core.database import AsyncSessionLocal  # noqa: E402
from app.core.db_utils import fetch_rows  # noqa: E402
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
SUMMARY_SAMPLE_LIMIT = 5


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Preview or remove runtime/test data without touching demo seed data.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Delete the rows instead of printing a preview.",
    )
    parser.add_argument(
        "--keep-reset-tokens",
        action="store_true",
        help="Leave expired and used password reset tokens alone.",
    )
    return parser.parse_args()


def _email_filter(column):
    # 运行时测试记录靠邮箱命名约定来识别,因为这个信号在用户、
    # 捐赠和其他相关记录之间都是稳定的
    clauses = [column.like(pattern) for pattern in RUNTIME_TEST_EMAIL_PATTERNS]
    if RUNTIME_TEST_EXACT_EMAILS:
        clauses.append(column.in_(sorted(RUNTIME_TEST_EXACT_EMAILS)))
    return or_(*clauses)


def _naive_utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _looks_like_qa_inventory_name(name: str | None) -> bool:
    normalized = str(name or "").strip().lower()
    return normalized.isdigit() or "qa" in normalized


def print_summary(
    summary: dict[str, object],
    *,
    apply: bool,
    keep_reset_tokens: bool,
) -> None:
    runtime_users = summary["runtime_users"]
    runtime_user_emails = [email for _user_id, email in runtime_users if email]
    runtime_cash_samples = [
        f"{donor_email or '(missing email)'} [{payment_reference or 'no-ref'}]"
        for donor_email, payment_reference in summary["runtime_cash_rows"][:SUMMARY_SAMPLE_LIMIT]
    ]
    runtime_goods_samples = [
        f"{donor_email or '(missing email)'} [{food_bank_name or 'no-bank'}]"
        for donor_email, food_bank_name in summary["runtime_goods_rows"][:SUMMARY_SAMPLE_LIMIT]
    ]
    qa_inventory_items = summary["qa_inventory_items"]
    qa_inventory_item_names = [name for _item_id, name in qa_inventory_items]

    mode = "apply" if apply else "preview"
    print(f"[{mode}] runtime/test cleanup")

    print(f"- runtime users: {len(runtime_users)}")
    if runtime_user_emails:
        print(f"  sample: {preview_values(runtime_user_emails, limit=SUMMARY_SAMPLE_LIMIT)}")
    print(f"- applications tied to those users: {summary['runtime_application_count']}")
    print(f"- cash donations to remove: {summary['runtime_cash_count']}")
    if runtime_cash_samples:
        print(f"  sample: {preview_values(runtime_cash_samples, limit=SUMMARY_SAMPLE_LIMIT)}")
    print(f"- goods donations to remove: {summary['runtime_goods_count']}")
    if runtime_goods_samples:
        print(f"  sample: {preview_values(runtime_goods_samples, limit=SUMMARY_SAMPLE_LIMIT)}")
    print(
        "- password reset tokens to remove: "
        f"{0 if keep_reset_tokens else summary['reset_token_count']}"
    )
    print("- check by hand:")
    print(f"  bankless cash donations left: {summary['review_bankless_cash_count']}")
    print(f"  bankless goods donations left: {summary['review_bankless_goods_count']}")
    print(f"  soft-deleted applications: {summary['review_deleted_application_count']}")
    print(f"  soft-deleted inventory lots: {summary['review_deleted_lot_count']}")
    print(
        "  inventory items with null food_bank_id: "
        f"{summary['review_null_scoped_inventory_item_count']}"
    )
    print(f"  seeded stock lots present: {summary['review_seed_lot_count']}")
    print(
        "- qa inventory candidates: "
        f"{len(qa_inventory_items)} item(s), {summary['qa_inventory_lot_count']} lot(s)"
    )
    if qa_inventory_item_names:
        print(f"  items: {preview_values(qa_inventory_item_names, limit=SUMMARY_SAMPLE_LIMIT)}")
    if not apply:
        print("Use --apply to actually delete these rows.")


async def collect_summary(keep_reset_tokens: bool) -> dict[str, object]:
    async with AsyncSessionLocal() as db:
        runtime_users = [
            (int(user_id), email)
            for user_id, email in await fetch_rows(
                db,
                select(User.id, User.email)
                .where(_email_filter(User.email))
                .order_by(User.created_at.desc(), User.email.asc()),
            )
        ]
        runtime_user_ids = [user_id for user_id, _email in runtime_users]

        runtime_cash_rows = list(
            await fetch_rows(
                db,
                select(DonationCash.donor_email, DonationCash.payment_reference)
                .where(_email_filter(DonationCash.donor_email))
                .order_by(DonationCash.created_at.desc(), DonationCash.payment_reference.asc()),
            )
        )
        runtime_goods_rows = list(
            await fetch_rows(
                db,
                select(DonationGoods.donor_email, DonationGoods.food_bank_name)
                .where(_email_filter(DonationGoods.donor_email))
                .order_by(DonationGoods.created_at.desc(), DonationGoods.donor_email.asc()),
            )
        )

        runtime_application_count = 0
        if runtime_user_ids:
            runtime_application_count = await count_rows(
                db,
                select(func.count())
                .select_from(Application)
                .where(Application.user_id.in_(runtime_user_ids)),
            )

        reset_token_count = 0
        if not keep_reset_tokens:
            reset_token_count = await count_rows(
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

        # 这些计数有意只用来人工查看,操作者能看出可疑残留,
        # 但脚本不会自动去删它们
        review_bankless_cash_count = await count_rows(
            db,
            select(func.count())
            .select_from(DonationCash)
            .where(
                DonationCash.food_bank_id.is_(None),
                ~_email_filter(DonationCash.donor_email),
            ),
        )
        review_bankless_goods_count = await count_rows(
            db,
            select(func.count())
            .select_from(DonationGoods)
            .where(
                DonationGoods.food_bank_id.is_(None),
                ~_email_filter(DonationGoods.donor_email),
            ),
        )
        review_deleted_application_count = await count_rows(
            db,
            select(func.count())
            .select_from(Application)
            .where(Application.deleted_at.is_not(None)),
        )
        review_deleted_lot_count = await count_rows(
            db,
            select(func.count())
            .select_from(InventoryLot)
            .where(InventoryLot.deleted_at.is_not(None)),
        )
        review_null_scoped_inventory_item_count = await count_rows(
            db,
            select(func.count())
            .select_from(InventoryItem)
            .where(InventoryItem.food_bank_id.is_(None)),
        )
        review_seed_lot_count = await count_rows(
            db,
            select(func.count())
            .select_from(InventoryLot)
            .where(
                or_(
                    InventoryLot.batch_reference.like("seed-stock-%"),
                    InventoryLot.batch_reference.like("demo-seed-%"),
                )
            ),
        )

        # QA 库存清理走保守策略:物品名得看起来像伪造的,而且
        # 这条记录不能有任何值得保留的运行时或历史引用
        qa_inventory_rows = await fetch_rows(
            db,
            select(
                InventoryItem.id,
                InventoryItem.name,
                func.count(
                    func.distinct(
                        case((FoodPackage.is_active.is_(True), PackageItem.id))
                    )
                ).label("active_package_ref_count"),
                func.count(func.distinct(ApplicationItem.id)).label(
                    "application_ref_count"
                ),
                func.count(func.distinct(InventoryWasteEvent.id)).label(
                    "waste_event_count"
                ),
                func.count(func.distinct(RestockRequest.id)).label("restock_ref_count"),
                func.count(func.distinct(InventoryLot.id)).label("lot_count"),
            )
            .select_from(InventoryItem)
            .outerjoin(PackageItem, PackageItem.inventory_item_id == InventoryItem.id)
            .outerjoin(FoodPackage, FoodPackage.id == PackageItem.package_id)
            .outerjoin(
                ApplicationItem,
                ApplicationItem.inventory_item_id == InventoryItem.id,
            )
            .outerjoin(
                InventoryWasteEvent,
                InventoryWasteEvent.inventory_item_id == InventoryItem.id,
            )
            .outerjoin(
                RestockRequest,
                RestockRequest.inventory_item_id == InventoryItem.id,
            )
            .outerjoin(InventoryLot, InventoryLot.inventory_item_id == InventoryItem.id)
            .where(InventoryItem.food_bank_id.is_(None))
            .group_by(InventoryItem.id, InventoryItem.name)
            .order_by(InventoryItem.id.asc()),
        )
        qa_inventory_items: list[tuple[int, str]] = []
        qa_inventory_lot_count = 0
        for (
            item_id,
            item_name,
            active_package_ref_count,
            application_ref_count,
            waste_event_count,
            restock_ref_count,
            lot_count,
        ) in qa_inventory_rows:
            if not _looks_like_qa_inventory_name(item_name):
                continue
            if any(
                int(value or 0) > 0
                for value in (
                    active_package_ref_count,
                    application_ref_count,
                    waste_event_count,
                    restock_ref_count,
                )
            ):
                continue

            qa_inventory_items.append((int(item_id), str(item_name)))
            qa_inventory_lot_count += int(lot_count or 0)

        return {
            "runtime_users": runtime_users,
            "runtime_application_count": runtime_application_count,
            "runtime_cash_count": len(runtime_cash_rows),
            "runtime_cash_rows": runtime_cash_rows,
            "runtime_goods_count": len(runtime_goods_rows),
            "runtime_goods_rows": runtime_goods_rows,
            "reset_token_count": reset_token_count,
            "review_bankless_cash_count": review_bankless_cash_count,
            "review_bankless_goods_count": review_bankless_goods_count,
            "review_deleted_application_count": review_deleted_application_count,
            "review_deleted_lot_count": review_deleted_lot_count,
            "review_null_scoped_inventory_item_count": review_null_scoped_inventory_item_count,
            "review_seed_lot_count": review_seed_lot_count,
            "qa_inventory_items": qa_inventory_items,
            "qa_inventory_lot_count": qa_inventory_lot_count,
        }


async def apply_cleanup(summary: dict[str, object], keep_reset_tokens: bool) -> None:
    async with AsyncSessionLocal() as db:
        runtime_user_ids = [
            user_id for user_id, _email in summary["runtime_users"]
        ]
        qa_inventory_item_ids = [
            item_id for item_id, _name in summary["qa_inventory_items"]
        ]

        # 先删子记录再删父用户,这样清理就能走正常的外键顺序,
        # 不用后面给每张表单独写特殊处理
        if summary["runtime_application_count"] > 0:
            await db.execute(
                delete(Application).where(Application.user_id.in_(runtime_user_ids))
            )

        if summary["runtime_cash_count"] > 0:
            await db.execute(
                delete(DonationCash).where(_email_filter(DonationCash.donor_email))
            )

        if summary["runtime_goods_count"] > 0:
            await db.execute(
                delete(DonationGoods).where(_email_filter(DonationGoods.donor_email))
            )

        if not keep_reset_tokens and summary["reset_token_count"] > 0:
            await db.execute(
                delete(PasswordResetToken).where(
                    or_(
                        PasswordResetToken.expires_at < _naive_utc_now(),
                        PasswordResetToken.used_at.is_not(None),
                    )
                )
            )

        if runtime_user_ids:
            await db.execute(delete(User).where(User.id.in_(runtime_user_ids)))

        if qa_inventory_item_ids:
            await db.execute(
                delete(InventoryItem).where(
                    InventoryItem.id.in_(qa_inventory_item_ids)
                )
            )

        # applied_count 是派生数据,批量删除最后会从剩下的申请明细
        # 重新算一遍
        await sync_food_package_applied_counts(db)

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
    print("Cleanup done.")
    print_summary(
        after,
        apply=True,
        keep_reset_tokens=options.keep_reset_tokens,
    )


if __name__ == "__main__":
    asyncio.run(main())
