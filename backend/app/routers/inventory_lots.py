"""lot 操作"""

from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.database_errors import run_guarded_action, run_guarded_transaction
from app.core.db_utils import fetch_rows, sync_model_fields
from app.core.security import enforce_admin_food_bank_scope, require_admin
from app.models.inventory_item import InventoryItem
from app.models.inventory_lot import InventoryLot
from app.routers._shared import bank_scoped_clause, require_by_id
from app.schemas.inventory_lot import InventoryLotAdjustRequest, InventoryLotOut
from app.services.dashboard_distribution_snapshot_service import (
    lot_has_waste_event,
    record_inventory_waste_event,
)


router = APIRouter()


def _serialize_inventory_lot_row(lot: InventoryLot, item_name: str) -> InventoryLotOut:
    status_value = (
        "wasted"
        if lot.deleted_at is not None
        else "expired" if lot.expiry_date < date.today() else "active"
    )
    return InventoryLotOut(
        id=lot.id,
        inventory_item_id=lot.inventory_item_id,
        item_name=item_name,
        quantity=lot.quantity,
        expiry_date=lot.expiry_date,
        received_date=lot.received_date,
        batch_reference=lot.batch_reference,
        status=status_value,
        deleted_at=lot.deleted_at,
    )


@router.get("/lots", response_model=list[InventoryLotOut])
async def list_inventory_lots(
    include_inactive: bool = Query(True, description="Include inactive (wasted) lots"),
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    async def action() -> list[InventoryLotOut]:
        query = (
            select(InventoryLot, InventoryItem.name)
            .join(InventoryItem, InventoryItem.id == InventoryLot.inventory_item_id)
            .order_by(InventoryLot.updated_at.desc(), InventoryLot.id.desc())
        )

        if not include_inactive:
            query = query.where(InventoryLot.deleted_at.is_(None))

        query = query.where(bank_scoped_clause(InventoryItem, admin_user))

        rows = await fetch_rows(db, query)
        return [_serialize_inventory_lot_row(lot, item_name) for lot, item_name in rows]

    return await run_guarded_action(action, failure_detail="Failed to retrieve inventory lots")


@router.patch("/lots/{lot_id}", response_model=InventoryLotOut)
async def adjust_inventory_lot(
    lot_id: int,
    adjustment_in: InventoryLotAdjustRequest,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if adjustment_in.model_dump(exclude_unset=True) == {}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided to adjust",
    )

    async def action() -> InventoryLotOut:
        lot = await require_by_id(
            db,
            InventoryLot,
            lot_id,
            detail="Inventory lot not found",
        )
        inventory_item = await require_by_id(
            db,
            InventoryItem,
            lot.inventory_item_id,
            detail="Inventory item not found for lot",
        )
        enforce_admin_food_bank_scope(
            admin_user,
            inventory_item.food_bank_id,
            detail="You can only manage inventory lots for your assigned food bank",
        )
        sync_model_fields(
            lot,
            adjustment_in.model_dump(
                exclude_unset=True,
                exclude={"damage_quantity", "status"},
            ),
        )

        if adjustment_in.damage_quantity is not None:
            if lot.quantity < adjustment_in.damage_quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Damage quantity exceeds lot quantity",
                )

            record_inventory_waste_event(
                db,
                lot,
                inventory_item,
                adjustment_in.damage_quantity,
                "damaged",
            )
            remaining = lot.quantity - adjustment_in.damage_quantity
            lot.quantity = remaining
            if remaining == 0:
                lot.deleted_at = datetime.now(timezone.utc)

        if adjustment_in.status == "wasted":
            # 把 lot 标成 wasted 之前,先留一条 waste-event 记录,
            # 不然这个 lot 就从有效库存报表里消失了
            if lot.deleted_at is None:
                record_inventory_waste_event(
                    db,
                    lot,
                    inventory_item,
                    lot.quantity,
                    "manual_waste",
                )
            lot.deleted_at = datetime.now(timezone.utc)
        elif adjustment_in.status == "active":
            lot.deleted_at = None

        await db.flush()
        return _serialize_inventory_lot_row(lot, inventory_item.name)

    return await run_guarded_transaction(
        db,
        action,
        failure_detail="Failed to adjust inventory lot",
    )


@router.delete("/lots/{lot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_inventory_lot(
    lot_id: int,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    async def action() -> None:
        lot = await require_by_id(
            db,
            InventoryLot,
            lot_id,
            detail="Inventory lot not found",
        )
        inventory_item = await require_by_id(
            db,
            InventoryItem,
            lot.inventory_item_id,
            detail="Inventory item not found for lot",
        )
        enforce_admin_food_bank_scope(
            admin_user,
            inventory_item.food_bank_id,
            detail="You can only delete inventory lots for your assigned food bank",
        )

        if not await lot_has_waste_event(db, lot.id):
            # 删 lot 在运营上仍然是有意义的事件,没有显式 waste event 时
            # 就回填一个最接近的 waste reason
            reason = "deleted"
            occurred_at = datetime.now(timezone.utc)
            if lot.deleted_at is not None:
                reason = "manual_waste"
                occurred_at = lot.deleted_at
            elif lot.expiry_date < date.today():
                reason = "expired"

            record_inventory_waste_event(
                db,
                lot,
                inventory_item,
                lot.quantity,
                reason,
                occurred_at=occurred_at,
            )

        await db.delete(lot)
        await db.flush()

    return await run_guarded_transaction(
        db,
        action,
        failure_detail="Failed to delete inventory lot",
    )
