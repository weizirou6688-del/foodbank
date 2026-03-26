"""
Inventory management routes.

Spec § 2.6: GET (list items), POST, PATCH, POST /:id/in, POST /:id/out, DELETE
"""

from datetime import date
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_admin
from app.models.inventory_item import InventoryItem
from app.models.inventory_lot import InventoryLot
from app.models.package_item import PackageItem
from app.schemas.inventory_item import (
    InventoryItemCreateRequest,
    InventoryItemOut,
    InventoryItemUpdate,
    LowStockItem,
    StockAdjustment,
)


router = APIRouter(tags=["Inventory"])


@router.get("", response_model=List[InventoryItemOut])
async def list_inventory(
    food_bank_id: int | None = None,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    List all inventory items for a food bank (admin only).
    
    Spec § 2.6: GET /inventory?food_bank_id= (requires admin).
    
    TODO: Query all InventoryItem records for food_bank_id
    """
    _ = admin_user
    _ = food_bank_id
    result = await db.execute(
        select(InventoryItem).order_by(InventoryItem.updated_at.desc())
    )
    return list(result.scalars().all())


@router.post("", response_model=InventoryItemOut, status_code=status.HTTP_201_CREATED)
async def create_inventory_item(
    item_in: InventoryItemCreateRequest,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Add new inventory item (admin only).
    
    Spec § 2.6: POST /inventory (requires admin).
    
    InventoryItemCreate includes:
    - food_bank_id, item_name, unit, quantity, threshold
    - storage_location (optional)
    
    TODO: Create InventoryItem record
    """
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
            stock=item_in.initial_stock,
            unit=item_in.unit,
            threshold=item_in.threshold,
        )
        db.add(item)
        await db.commit()
        await db.refresh(item)
        return item
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Inventory item conflict detected",
        ) from exc
    except HTTPException:
        await db.rollback()
        raise
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create inventory item",
        ) from exc


@router.patch("/{item_id}", response_model=InventoryItemOut)
async def update_inventory_item(
    item_id: int,
    item_in: InventoryItemUpdate,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Update inventory item details (admin only).
    
    Spec § 2.6: PATCH /inventory/:id (requires admin).
    
    TODO: Update item_name, unit, threshold, storage_location
    """
    _ = admin_user

    updates = item_in.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided to update",
        )

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
            return item
    except HTTPException:
        raise
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Inventory update conflict detected",
        ) from exc
    except Exception as exc:
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
    """
    Increase inventory quantity (admin only).
    
    Spec § 2.6: POST /inventory/:id/stock-in (requires admin).
    
    StockAdjustment includes:
    - quantity: int (amount to add)
    - reason: str (source/reason for donation)
    
    TODO: Increment quantity in DB
    """
    _ = admin_user
    _ = adjustment_in.reason
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

            item.stock += adjustment_in.quantity
            await db.flush()
            await db.refresh(item)
            return item
    except HTTPException:
        raise
    except Exception as exc:
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
    """
    Decrease inventory quantity (admin only).
    
    Spec § 2.6: POST /inventory/:id/stock-out (requires admin).
    
    StockAdjustment includes:
    - quantity: int (amount to remove)
    - reason: str (purpose: "package_prepared", "distribution", etc.)
    
    TODO: Decrement quantity in DB, prevent negative stock
    """
    _ = admin_user
    _ = adjustment_in.reason
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

            if item.stock < adjustment_in.quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Insufficient stock",
                )

            item.stock -= adjustment_in.quantity
            await db.flush()
            await db.refresh(item)
            return item
    except HTTPException:
        raise
    except Exception as exc:
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
    """
    Delete inventory item (admin only).
    
    Spec § 2.6: DELETE /inventory/:id (requires admin).
    
    Note: Cannot delete if used in food packages or active applications.
    
    TODO: Soft delete or hard delete with cascade checks
    """
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete inventory item",
        ) from exc


@router.get("/low-stock", response_model=List[LowStockItem])
async def get_low_stock_items(
    threshold: int | None = Query(None, ge=0, description="Override default threshold"),
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    List inventory items with stock below threshold (admin only).
    
    Spec § 2.6: GET /inventory/low-stock (requires admin).
    
    Returns items where total active stock (non-expired lots) is below threshold.
    Supports optional threshold parameter to override per-item thresholds.
    
    Query logic:
    - Calculate SUM(quantity) for each item where:
      * status='active' (deleted_at IS NULL)
      * expiry_date >= CURRENT_DATE (not expired)
    - Filter items with total_stock < item.threshold (or override threshold if provided)
    - Return sorted by stock_deficit DESC (most critical first)
    """
    _ = admin_user
    
    try:
        # Subquery: Calculate total stock for each inventory item
        # Sum quantities from active, non-expired lots
        stock_subquery = (
            select(
                InventoryLot.inventory_item_id,
                func.coalesce(func.sum(InventoryLot.quantity), 0).label("total_stock"),
            )
            .where(
                and_(
                    InventoryLot.deleted_at.is_(None),  # Active lots only
                    InventoryLot.expiry_date >= date.today(),  # Not expired
                )
            )
            .group_by(InventoryLot.inventory_item_id)
            .subquery()
        )

        # Main query: Get items with low stock
        query = select(
            InventoryItem.id,
            InventoryItem.name,
            InventoryItem.category,
            InventoryItem.unit,
            stock_subquery.c.total_stock.label("current_stock"),
            InventoryItem.threshold,
            (
                InventoryItem.threshold - stock_subquery.c.total_stock
            ).label("stock_deficit"),
        ).join(
            stock_subquery,
            InventoryItem.id == stock_subquery.c.inventory_item_id,
            isouter=True,
        )

        # Apply threshold filter
        effective_threshold = threshold if threshold is not None else None
        if effective_threshold is not None:
            # Use provided threshold for all items
            query = query.where(stock_subquery.c.total_stock < effective_threshold)
        else:
            # Use per-item threshold
            query = query.where(stock_subquery.c.total_stock < InventoryItem.threshold)

        # Sort by stock deficit (most critical first)
        query = query.order_by(
            (InventoryItem.threshold - stock_subquery.c.total_stock).desc()
        )

        result = await db.execute(query)
        rows = result.all()

        # Convert rows to LowStockItem objects
        low_stock_items = []
        for row in rows:
            low_stock_items.append(
                LowStockItem(
                    id=row[0],  # InventoryItem.id
                    name=row[1],  # InventoryItem.name
                    category=row[2],  # InventoryItem.category
                    unit=row[3],  # InventoryItem.unit
                    current_stock=int(row[4] or 0),  # stock_subquery.c.total_stock
                    threshold=row[5],  # InventoryItem.threshold
                    stock_deficit=int(row[6] or 0),  # stock_deficit
                )
            )

        return low_stock_items

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve low-stock items",
        ) from exc
