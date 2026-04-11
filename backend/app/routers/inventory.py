from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, literal, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.db_utils import fetch_one_or_none, fetch_rows, fetch_scalars, flush_refresh, sync_model_fields
from app.core.database_errors import run_guarded_action, run_guarded_transaction
from app.core.security import (
    enforce_admin_food_bank_scope,
    get_admin_food_bank_id,
    require_admin,
    require_admin_or_supermarket,
)
from app.routers._shared import (
    bank_scoped_clause,
    require_by_id,
    require_scoped_by_id,
    resolve_admin_target_food_bank_id,
    single_page_response,
)
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


def _active_inventory_lot_filters():
    return InventoryLot.deleted_at.is_(None), InventoryLot.expiry_date >= date.today()


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


async def _get_inventory_item_for_admin(
    db: AsyncSession,
    item_id: int,
    admin_user: dict,
    *,
    detail: str,
) -> InventoryItem:
    return await require_scoped_by_id(
        db,
        InventoryItem,
        item_id,
        admin_user,
        detail=detail,
        not_found_detail="Inventory item not found",
    )


async def _get_inventory_lot_for_admin(
    db: AsyncSession,
    lot_id: int,
    admin_user: dict,
    *,
    detail: str,
) -> tuple[InventoryLot, InventoryItem]:
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
        detail=detail,
    )
    return lot, inventory_item


async def _get_total_stock_for_item(db: AsyncSession, item_id: int) -> int:
    return int((await fetch_one_or_none(
        db,
        select(func.coalesce(func.sum(InventoryLot.quantity), 0)).where(
            InventoryLot.inventory_item_id == item_id,
            *_active_inventory_lot_filters(),
        )
    )) or 0)


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
        food_bank_id=item.food_bank_id,
        updated_at=updated_at,
    )


async def _flush_refresh_serialize_inventory_item(
    db: AsyncSession,
    item: InventoryItem,
) -> InventoryItemOut:
    return await _serialize_inventory_item(db, await flush_refresh(db, item))


async def _run_inventory_action(action, *, failure_detail: str):
    return await run_guarded_action(action, failure_detail=failure_detail)


async def _run_inventory_transaction(
    db: AsyncSession,
    action,
    *,
    failure_detail: str,
    conflict_detail: str | None = None,
):
    return await run_guarded_transaction(
        db,
        action,
        failure_detail=failure_detail,
        conflict_detail=conflict_detail,
    )


async def _change_inventory_item_stock(
    db: AsyncSession,
    item_id: int,
    adjustment_in: StockAdjustment,
    admin_user: dict,
    *,
    stock_in: bool,
) -> InventoryItemOut:
    item = await _get_inventory_item_for_admin(
        db,
        item_id,
        admin_user,
        detail="You can only manage inventory items for your assigned food bank",
    )

    if stock_in:
        db.add(
            InventoryLot(
                inventory_item_id=item.id,
                quantity=adjustment_in.quantity,
                received_date=date.today(),
                expiry_date=adjustment_in.expiry_date or _future_expiry_date(),
                batch_reference=adjustment_in.reason[:100],
            )
        )
    else:
        try:
            await consume_inventory_lots(item.id, adjustment_in.quantity, db)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

    return await _flush_refresh_serialize_inventory_item(db, item)


async def _run_stock_adjustment(
    db: AsyncSession,
    item_id: int,
    adjustment_in: StockAdjustment,
    admin_user: dict,
    *,
    stock_in: bool,
    failure_detail: str,
) -> InventoryItemOut:
    async def _action() -> InventoryItemOut:
        return await _change_inventory_item_stock(
            db,
            item_id,
            adjustment_in,
            admin_user,
            stock_in=stock_in,
        )

    return await _run_inventory_transaction(db, _action, failure_detail=failure_detail)


@router.get("", response_model=InventoryItemListResponse)
async def list_inventory(
    food_bank_id: int | None = None,
    category: str | None = Query(None, min_length=1, max_length=100),
    search: str | None = Query(None, min_length=1, max_length=200),
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    normalized_food_bank_id = food_bank_id if isinstance(food_bank_id, int) else None
    normalized_category = category.strip() if isinstance(category, str) and category.strip() else None
    normalized_search = search.strip() if isinstance(search, str) and search.strip() else ""

    query = select(InventoryItem).order_by(InventoryItem.updated_at.desc())

    admin_food_bank_id = get_admin_food_bank_id(admin_user)
    if normalized_food_bank_id is not None:
        if admin_food_bank_id is not None:
            enforce_admin_food_bank_scope(
                admin_user,
                normalized_food_bank_id,
                detail="You can only view inventory for your assigned food bank",
            )
        query = query.where(InventoryItem.food_bank_id == normalized_food_bank_id)
    else:
        query = query.where(bank_scoped_clause(InventoryItem, admin_user))

    if normalized_category is not None:
        query = query.where(InventoryItem.category == normalized_category)

    if normalized_search:
        search_pattern = f"%{normalized_search}%"
        query = query.where(
            or_(
                InventoryItem.name.ilike(search_pattern),
                InventoryItem.category.ilike(search_pattern),
                InventoryItem.unit.ilike(search_pattern),
            )
        )

    items = await fetch_scalars(db, query)
    return single_page_response([await _serialize_inventory_item(db, item) for item in items])


@router.post("", response_model=InventoryItemOut, status_code=status.HTTP_201_CREATED)
async def create_inventory_item(
    item_in: InventoryItemCreateRequest,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    async def _action() -> InventoryItemOut:
        target_food_bank_id = await resolve_admin_target_food_bank_id(
            db,
            item_in.food_bank_id,
            admin_user,
            scope_detail="You can only create inventory items for your assigned food bank",
            required_detail="food_bank_id is required for inventory item creation",
        )
        normalized_name = item_in.name.strip()
        duplicate_query = select(InventoryItem.id).where(
            func.lower(InventoryItem.name) == normalized_name.lower()
        )
        duplicate_query = duplicate_query.where(
            InventoryItem.food_bank_id == target_food_bank_id
        )

        existing_item_id = await fetch_one_or_none(db, duplicate_query)
        if existing_item_id is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Inventory item name already exists",
            )

        item = InventoryItem(
            name=normalized_name,
            category=item_in.category,
            unit=item_in.unit,
            threshold=item_in.threshold,
            food_bank_id=target_food_bank_id,
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

        return await _flush_refresh_serialize_inventory_item(db, item)

    return await _run_inventory_transaction(
        db,
        _action,
        conflict_detail="Inventory item conflict detected",
        failure_detail="Failed to create inventory item",
    )


@router.get("/lots", response_model=list[InventoryLotOut])
async def list_inventory_lots(
    include_inactive: bool = Query(True, description="Include inactive (wasted) lots"),
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    async def _action() -> list[InventoryLotOut]:
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

    return await _run_inventory_action(_action, failure_detail="Failed to retrieve inventory lots")


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

    async def _action() -> InventoryLotOut:
        lot, inventory_item = await _get_inventory_lot_for_admin(
            db,
            lot_id,
            admin_user,
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

    return await _run_inventory_transaction(db, _action, failure_detail="Failed to adjust inventory lot")


@router.patch("/{item_id}", response_model=InventoryItemOut)
async def update_inventory_item(
    item_id: int,
    item_in: InventoryItemUpdate,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    updates = item_in.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided to update",
        )

    async def _action() -> InventoryItemOut:
        item = await _get_inventory_item_for_admin(
            db,
            item_id,
            admin_user,
            detail="You can only manage inventory items for your assigned food bank",
        )
        sync_model_fields(item, updates)
        return await _flush_refresh_serialize_inventory_item(db, item)

    return await _run_inventory_transaction(
        db,
        _action,
        conflict_detail="Inventory update conflict detected",
        failure_detail="Failed to update inventory item",
    )


@router.post("/{item_id}/stock-in", response_model=InventoryItemOut)
async def stock_in(
    item_id: int,
    adjustment_in: StockAdjustment,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await _run_stock_adjustment(
        db,
        item_id,
        adjustment_in,
        admin_user,
        stock_in=True,
        failure_detail="Failed to increase inventory stock",
    )


@router.post("/{item_id}/stock-out", response_model=InventoryItemOut)
async def stock_out(
    item_id: int,
    adjustment_in: StockAdjustment,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await _run_stock_adjustment(
        db,
        item_id,
        adjustment_in,
        admin_user,
        stock_in=False,
        failure_detail="Failed to decrease inventory stock",
    )


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_inventory_item(
    item_id: int,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    async def _action() -> None:
        item = await _get_inventory_item_for_admin(
            db,
            item_id,
            admin_user,
            detail="You can only delete inventory items for your assigned food bank",
        )

        package_usage_count = await fetch_one_or_none(
            db,
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

    return await _run_inventory_transaction(db, _action, failure_detail="Failed to delete inventory item")


@router.delete("/lots/{lot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_inventory_lot(
    lot_id: int,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    async def _action() -> None:
        lot, inventory_item = await _get_inventory_lot_for_admin(
            db,
            lot_id,
            admin_user,
            detail="You can only delete inventory lots for your assigned food bank",
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

    return await _run_inventory_transaction(db, _action, failure_detail="Failed to delete inventory lot")


@router.get("/low-stock", response_model=list[LowStockItem])
async def get_low_stock_items(
    threshold: int | None = Query(None, ge=0, description="Override default threshold"),
    admin_user: dict = Depends(require_admin_or_supermarket),
    db: AsyncSession = Depends(get_db),
):
    async def _action() -> list[LowStockItem]:
        stock_subquery = (
            select(
                InventoryLot.inventory_item_id,
                func.coalesce(func.sum(InventoryLot.quantity), 0).label("total_stock"),
            )
            .where(and_(*_active_inventory_lot_filters()))
            .group_by(InventoryLot.inventory_item_id)
            .subquery()
        )

        effective_total_stock = func.coalesce(stock_subquery.c.total_stock, 0)
        effective_threshold = (
            literal(threshold) if threshold is not None else InventoryItem.threshold
        )
        stock_deficit_expr = effective_threshold - effective_total_stock

        query = select(
            InventoryItem.id,
            InventoryItem.name,
            InventoryItem.category,
            InventoryItem.unit,
            effective_total_stock.label("current_stock"),
            effective_threshold.label("threshold"),
            stock_deficit_expr.label("stock_deficit"),
        ).join(
            stock_subquery,
            InventoryItem.id == stock_subquery.c.inventory_item_id,
            isouter=True,
        )

        query = query.where(bank_scoped_clause(InventoryItem, admin_user))

        if threshold is not None:
            query = query.where(effective_total_stock < threshold)
        else:
            query = query.where(effective_total_stock < InventoryItem.threshold)

        query = query.order_by(stock_deficit_expr.desc())

        rows = await fetch_rows(db, query)
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

    return await _run_inventory_action(_action, failure_detail="Failed to retrieve low-stock items")
