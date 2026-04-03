"""
Inventory management routes.

The current frontend still expects item-level stock fields and stock-in/out
endpoints. Internally inventory is lot-based, so these routes provide a
compatibility layer by aggregating active lots into stock values.
"""

from datetime import date, datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.database_errors import (
    is_database_unavailable_exception,
    raise_database_unavailable_http_exception,
)
from app.core.security import require_admin, require_admin_or_supermarket
from app.models.inventory_item import InventoryItem
from app.models.inventory_lot import InventoryLot
from app.models.package_item import PackageItem
from app.schemas.inventory_item import (
    InventoryItemCreateRequest,
    InventoryItemListResponse,
    InventoryItemOut,
    InventoryItemUpdate,
    LowStockItem,
    StockAdjustment,
)
from app.services.inventory_service import consume_inventory_lots
from app.services.dashboard_history_service import (
    lot_has_waste_event,
    record_inventory_waste_event,
)
from app.schemas.inventory_lot import InventoryLotAdjustRequest, InventoryLotOut


router = APIRouter(tags=["Inventory"])


def _future_expiry_date() -> date:
    return date.today() + timedelta(days=365)


async def _get_total_stock_for_item(db: AsyncSession, item_id: int) -> int:
    total_stock = await db.scalar(
        select(func.coalesce(func.sum(InventoryLot.quantity), 0)).where(
            and_(
                InventoryLot.inventory_item_id == item_id,
                InventoryLot.deleted_at.is_(None),
                InventoryLot.expiry_date >= date.today(),
            )
        )
    )
    return int(total_stock or 0)


async def _serialize_inventory_item(db: AsyncSession, item: InventoryItem) -> InventoryItemOut:
    total_stock = await _get_total_stock_for_item(db, item.id)
    updated_at = item.updated_at or datetime.now(timezone.utc)
    return InventoryItemOut(
        id=item.id,
        name=item.name,
        category=item.category,
        stock=total_stock,
        total_stock=total_stock,
        unit=item.unit,
        threshold=item.threshold,
        food_bank_id=None,
        updated_at=updated_at,
    )


@router.get("", response_model=InventoryItemListResponse)
async def list_inventory(
    food_bank_id: int | None = None,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    _ = admin_user
    _ = food_bank_id

    result = await db.execute(
        select(InventoryItem).order_by(InventoryItem.updated_at.desc())
    )
    items = list(result.scalars().all())
    serialized_items = [await _serialize_inventory_item(db, item) for item in items]
    total = len(serialized_items)
    return {
        "items": serialized_items,
        "total": total,
        "page": 1,
        "size": total,
        "pages": 1,
    }


@router.post("", response_model=InventoryItemOut, status_code=status.HTTP_201_CREATED)
async def create_inventory_item(
    item_in: InventoryItemCreateRequest,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    _ = admin_user
    try:
        existing_item_id = await db.scalar(
            select(InventoryItem.id).where(
                func.lower(InventoryItem.name) == item_in.name.strip().lower()
            )
        )
        if existing_item_id is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Inventory item name already exists",
            )

        item = InventoryItem(
            name=item_in.name.strip(),
            category=item_in.category,
            unit=item_in.unit,
            threshold=item_in.threshold,
        )
        db.add(item)
        await db.flush()

        if item_in.initial_stock > 0:
            db.add(
                InventoryLot(
                    inventory_item_id=item.id,
                    quantity=item_in.initial_stock,
                    received_date=date.today(),
                    expiry_date=_future_expiry_date(),
                    batch_reference="initial-stock",
                )
            )

        await db.flush()
        await db.refresh(item)
        return await _serialize_inventory_item(db, item)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Inventory item conflict detected",
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        if is_database_unavailable_exception(exc):
            raise_database_unavailable_http_exception()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create inventory item",
        ) from exc


@router.get("/lots", response_model=List[InventoryLotOut])
async def list_inventory_lots(
    include_inactive: bool = Query(True, description="Include inactive (wasted) lots"),
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    _ = admin_user

    try:
        query = (
            select(InventoryLot, InventoryItem.name)
            .join(InventoryItem, InventoryItem.id == InventoryLot.inventory_item_id)
            .order_by(InventoryLot.updated_at.desc(), InventoryLot.id.desc())
        )

        if not include_inactive:
            query = query.where(InventoryLot.deleted_at.is_(None))

        result = await db.execute(query)
        rows = result.all()

        today = date.today()
        lots: List[InventoryLotOut] = []
        for lot, item_name in rows:
            if lot.deleted_at is not None:
                lot_status = "wasted"
            elif lot.expiry_date < today:
                lot_status = "expired"
            else:
                lot_status = "active"

            lots.append(
                InventoryLotOut(
                    id=lot.id,
                    inventory_item_id=lot.inventory_item_id,
                    item_name=item_name,
                    quantity=lot.quantity,
                    expiry_date=lot.expiry_date,
                    received_date=lot.received_date,
                    batch_reference=lot.batch_reference,
                    status=lot_status,
                    deleted_at=lot.deleted_at,
                )
            )

        return lots
    except Exception as exc:
        if is_database_unavailable_exception(exc):
            raise_database_unavailable_http_exception()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve inventory lots",
        ) from exc


@router.patch("/lots/{lot_id}", response_model=InventoryLotOut)
async def adjust_inventory_lot(
    lot_id: int,
    adjustment_in: InventoryLotAdjustRequest,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    _ = admin_user

    if adjustment_in.model_dump(exclude_unset=True) == {}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided to adjust",
        )

    try:
        async with db.begin():
            lot = await db.scalar(select(InventoryLot).where(InventoryLot.id == lot_id))
            if lot is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Inventory lot not found",
                )
            inventory_item = await db.scalar(
                select(InventoryItem).where(InventoryItem.id == lot.inventory_item_id)
            )
            if inventory_item is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Inventory item not found for lot",
                )

            if adjustment_in.expiry_date is not None:
                lot.expiry_date = adjustment_in.expiry_date

            if adjustment_in.batch_reference is not None:
                lot.batch_reference = adjustment_in.batch_reference

            if adjustment_in.quantity is not None:
                lot.quantity = adjustment_in.quantity

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
                if remaining == 0:
                    lot.deleted_at = datetime.now(timezone.utc)
                else:
                    lot.quantity = remaining

            if adjustment_in.status == "wasted":
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

            today = date.today()
            if lot.deleted_at is not None:
                lot_status = "wasted"
            elif lot.expiry_date < today:
                lot_status = "expired"
            else:
                lot_status = "active"

            return InventoryLotOut(
                id=lot.id,
                inventory_item_id=lot.inventory_item_id,
                item_name=inventory_item.name,
                quantity=lot.quantity,
                expiry_date=lot.expiry_date,
                received_date=lot.received_date,
                batch_reference=lot.batch_reference,
                status=lot_status,
                deleted_at=lot.deleted_at,
            )
    except HTTPException:
        raise
    except Exception as exc:
        if is_database_unavailable_exception(exc):
            raise_database_unavailable_http_exception()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to adjust inventory lot",
        ) from exc


@router.patch("/{item_id}", response_model=InventoryItemOut)
async def update_inventory_item(
    item_id: int,
    item_in: InventoryItemUpdate,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    _ = admin_user

    updates = item_in.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided to update",
        )

    # Stock is handled through lot endpoints, but older callers may still send it.
    updates.pop("stock", None)

    try:
        async with db.begin():
            item = await db.scalar(
                select(InventoryItem).where(InventoryItem.id == item_id)
            )
            if item is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Inventory item not found",
                )

            for field, value in updates.items():
                setattr(item, field, value)

            await db.flush()
            await db.refresh(item)
            return await _serialize_inventory_item(db, item)
    except HTTPException:
        raise
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Inventory update conflict detected",
        ) from exc
    except Exception as exc:
        if is_database_unavailable_exception(exc):
            raise_database_unavailable_http_exception()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update inventory item",
        ) from exc


@router.post("/{item_id}/stock-in", response_model=InventoryItemOut)
async def stock_in(
    item_id: int,
    adjustment_in: StockAdjustment,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    _ = admin_user

    try:
        async with db.begin():
            item = await db.scalar(
                select(InventoryItem).where(InventoryItem.id == item_id)
            )
            if item is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Inventory item not found",
                )

            db.add(
                InventoryLot(
                    inventory_item_id=item.id,
                    quantity=adjustment_in.quantity,
                    received_date=date.today(),
                    expiry_date=adjustment_in.expiry_date or _future_expiry_date(),
                    batch_reference=adjustment_in.reason[:100],
                )
            )

            await db.flush()
            await db.refresh(item)
            return await _serialize_inventory_item(db, item)
    except HTTPException:
        raise
    except Exception as exc:
        if is_database_unavailable_exception(exc):
            raise_database_unavailable_http_exception()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to increase inventory stock",
        ) from exc


@router.post("/{item_id}/stock-out", response_model=InventoryItemOut)
async def stock_out(
    item_id: int,
    adjustment_in: StockAdjustment,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    _ = admin_user

    try:
        async with db.begin():
            item = await db.scalar(
                select(InventoryItem).where(InventoryItem.id == item_id)
            )
            if item is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Inventory item not found",
                )

            try:
                await consume_inventory_lots(item.id, adjustment_in.quantity, db)
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(exc),
                )

            await db.flush()
            await db.refresh(item)
            return await _serialize_inventory_item(db, item)
    except HTTPException:
        raise
    except Exception as exc:
        if is_database_unavailable_exception(exc):
            raise_database_unavailable_http_exception()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to decrease inventory stock",
        ) from exc


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_inventory_item(
    item_id: int,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    _ = admin_user
    try:
        async with db.begin():
            item = await db.scalar(
                select(InventoryItem).where(InventoryItem.id == item_id)
            )
            if item is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Inventory item not found",
                )

            package_usage_count = await db.scalar(
                select(func.count(PackageItem.id)).where(
                    PackageItem.inventory_item_id == item_id
                )
            )
            if int(package_usage_count or 0) > 0:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Cannot delete inventory item used in packages",
                )

            await db.delete(item)
            await db.flush()
            return None
    except HTTPException:
        raise
    except Exception as exc:
        if is_database_unavailable_exception(exc):
            raise_database_unavailable_http_exception()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete inventory item",
        ) from exc


@router.delete("/lots/{lot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_inventory_lot(
    lot_id: int,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    _ = admin_user

    try:
        async with db.begin():
            lot = await db.scalar(
                select(InventoryLot).where(InventoryLot.id == lot_id)
            )
            if lot is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Inventory lot not found",
                )

            inventory_item = await db.scalar(
                select(InventoryItem).where(InventoryItem.id == lot.inventory_item_id)
            )
            if inventory_item is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Inventory item not found for lot",
                )

            if not await lot_has_waste_event(db, lot.id):
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
            return None
    except HTTPException:
        raise
    except Exception as exc:
        if is_database_unavailable_exception(exc):
            raise_database_unavailable_http_exception()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete inventory lot",
        ) from exc


@router.get("/low-stock", response_model=List[LowStockItem])
async def get_low_stock_items(
    threshold: int | None = Query(None, ge=0, description="Override default threshold"),
    admin_user: dict = Depends(require_admin_or_supermarket),
    db: AsyncSession = Depends(get_db),
):
    _ = admin_user

    try:
        stock_subquery = (
            select(
                InventoryLot.inventory_item_id,
                func.coalesce(func.sum(InventoryLot.quantity), 0).label("total_stock"),
            )
            .where(
                and_(
                    InventoryLot.deleted_at.is_(None),
                    InventoryLot.expiry_date >= date.today(),
                )
            )
            .group_by(InventoryLot.inventory_item_id)
            .subquery()
        )

        effective_total_stock = func.coalesce(stock_subquery.c.total_stock, 0)
        stock_deficit_expr = (
            (threshold if threshold is not None else InventoryItem.threshold) - effective_total_stock
        )

        query = select(
            InventoryItem.id,
            InventoryItem.name,
            InventoryItem.category,
            InventoryItem.unit,
            effective_total_stock.label("current_stock"),
            (threshold if threshold is not None else InventoryItem.threshold).label("threshold"),
            stock_deficit_expr.label("stock_deficit"),
        ).join(
            stock_subquery,
            InventoryItem.id == stock_subquery.c.inventory_item_id,
            isouter=True,
        )

        if threshold is not None:
            query = query.where(effective_total_stock < threshold)
        else:
            query = query.where(effective_total_stock < InventoryItem.threshold)

        query = query.order_by(stock_deficit_expr.desc())

        rows = (await db.execute(query)).all()
        return [
            LowStockItem(
                id=row[0],
                name=row[1],
                category=row[2],
                unit=row[3],
                current_stock=int(row[4] or 0),
                threshold=int(row[5] or 0),
                stock_deficit=int(row[6] or 0),
            )
            for row in rows
        ]
    except Exception as exc:
        if is_database_unavailable_exception(exc):
            raise_database_unavailable_http_exception()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve low-stock items",
        ) from exc
