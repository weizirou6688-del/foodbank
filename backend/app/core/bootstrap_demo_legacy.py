"""清理在 food bank 范围概念出现之前创建的 demo 记录。"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.bootstrap_seed import (
    DEMO_INVENTORY_ITEM_NAMES,
    DEMO_SCOPED_CASH_DONOR_EMAILS,
    DEMO_SCOPED_CASH_PAYMENT_REFERENCE_LOOKUP_SET,
    DEMO_SCOPED_GOODS_DONOR_EMAILS,
)
from app.core.db_utils import fetch_scalars
from app.models.donation_cash import DonationCash
from app.models.donation_goods import DonationGoods
from app.models.inventory_item import InventoryItem
from app.models.inventory_lot import InventoryLot


CURRENT_SEED_BATCH_PREFIX = "seed-stock-"
LEGACY_DEMO_SEED_BATCH_PREFIX = "demo-seed-"
DEMO_SEED_BATCH_PREFIXES = (
    CURRENT_SEED_BATCH_PREFIX,
    LEGACY_DEMO_SEED_BATCH_PREFIX,
)


def demo_seed_batch_reference(item_name: str, food_bank_id: int) -> str:
    return (
        f"{CURRENT_SEED_BATCH_PREFIX}{item_name.lower().replace(' ', '-')}-bank-{food_bank_id}"
    )


def demo_seed_batch_reference_candidates(
    item_name: str,
    food_bank_id: int,
) -> tuple[str, ...]:
    suffix = f"{item_name.lower().replace(' ', '-')}-bank-{food_bank_id}"
    return tuple(
        f"{prefix}{suffix}"
        for prefix in DEMO_SEED_BATCH_PREFIXES
    )


def is_expected_demo_seed_lot(
    *,
    item_name: str,
    item_food_bank_id: int | None,
    batch_reference: str | None,
) -> bool:
    # 当前种子库存批次结尾总是带所属 bank id,这样就能和
    # 用了相同物品名的旧版共享 demo 批次区分开
    if item_food_bank_id is None or item_name not in DEMO_INVENTORY_ITEM_NAMES:
        return False
    return (batch_reference or "").endswith(f"-bank-{item_food_bank_id}")


async def cleanup_legacy_demo_shared_records(db: AsyncSession) -> bool:
    changed = False

    # 带范围的 demo 种子取代了旧的无 bank demo 捐赠,先把这些记录删掉,
    # 免得漏到 admin 历史和分析汇总里
    legacy_cash_rows = await fetch_scalars(
        db,
        select(DonationCash).where(
            DonationCash.food_bank_id.is_(None),
            or_(
                DonationCash.payment_reference.in_(
                    DEMO_SCOPED_CASH_PAYMENT_REFERENCE_LOOKUP_SET
                ),
                DonationCash.donor_email.in_(DEMO_SCOPED_CASH_DONOR_EMAILS),
            ),
        ),
    )
    for donation in legacy_cash_rows:
        await db.delete(donation)
        changed = True

    legacy_goods_rows = await fetch_scalars(
        db,
        select(DonationGoods).where(
            DonationGoods.food_bank_id.is_(None),
            DonationGoods.donor_email.in_(DEMO_SCOPED_GOODS_DONOR_EMAILS),
        ),
    )
    for donation in legacy_goods_rows:
        await db.delete(donation)
        changed = True

    # 旧的 demo 批次走软删除而不是硬删除,这样历史痕迹还能查,
    # 同时现货计算就不会再把它们算进去
    legacy_demo_lots = (
        await db.execute(
            select(InventoryLot, InventoryItem.name, InventoryItem.food_bank_id)
            .join(InventoryItem, InventoryItem.id == InventoryLot.inventory_item_id)
            .where(
                or_(
                    *(
                        InventoryLot.batch_reference.like(f"{prefix}%")
                        for prefix in DEMO_SEED_BATCH_PREFIXES
                    )
                ),
                InventoryLot.deleted_at.is_(None),
            )
        )
    ).all()
    now = datetime.now(timezone.utc)

    for lot, item_name, item_food_bank_id in legacy_demo_lots:
        if is_expected_demo_seed_lot(
            item_name=item_name,
            item_food_bank_id=item_food_bank_id,
            batch_reference=lot.batch_reference,
        ):
            continue
        lot.deleted_at = now
        changed = True

    return changed
