from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory_lot import InventoryLot


async def consume_inventory_lots(
    item_id: int,
    quantity: int,
    db: AsyncSession,
) -> list[dict[str, int | str | None]]:
    """Deduct stock from active lots using FEFO and return a consumption trace."""
    if quantity <= 0:
        return []

    lots = (
        await db.execute(
            select(InventoryLot)
            .where(
                and_(
                    InventoryLot.inventory_item_id == item_id,
                    InventoryLot.deleted_at.is_(None),
                    InventoryLot.expiry_date >= date.today(),
                )
            )
            .order_by(InventoryLot.expiry_date.asc(), InventoryLot.id.asc())
            .with_for_update()
        )
    ).scalars().all()

    remaining = quantity
    consumed_lots: list[dict[str, int | str | None]] = []

    for lot in lots:
        if remaining <= 0:
            break

        available = lot.quantity
        deducted = min(available, remaining)
        remaining_in_lot = available - deducted
        remaining -= deducted

        if remaining_in_lot == 0:
            lot.deleted_at = datetime.now(timezone.utc)
        else:
            lot.quantity = remaining_in_lot

        consumed_lots.append({
            "item_id": item_id,
            "lot_id": lot.id,
            "quantity_used": deducted,
            "remaining_in_lot": remaining_in_lot,
            "expiry_date": str(lot.expiry_date),
            "batch_reference": lot.batch_reference,
        })

    if remaining > 0:
        raise ValueError("Insufficient stock")

    return consumed_lots
