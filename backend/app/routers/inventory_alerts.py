from __future__ import annotations

from fastapi import Depends, Query
from sqlalchemy import and_, func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.db_utils import fetch_rows
from app.core.security import require_admin_or_supermarket
from app.models.inventory_item import InventoryItem
from app.models.inventory_lot import InventoryLot
from app.routers._shared import bank_scoped_clause
from app.routers.inventory_shared import active_inventory_lot_filters, run_inventory_action
from app.schemas.inventory_item import LowStockItem


async def get_low_stock_items(
    threshold: int | None = Query(None, ge=0, description="Override default threshold"),
    admin_user: dict = Depends(require_admin_or_supermarket),
    db: AsyncSession = Depends(get_db),
):
    async def action() -> list[LowStockItem]:
        stock_subquery = (
            select(
                InventoryLot.inventory_item_id,
                func.coalesce(func.sum(InventoryLot.quantity), 0).label("total_stock"),
            )
            .where(and_(*active_inventory_lot_filters()))
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

    return await run_inventory_action(action, failure_detail="Failed to retrieve low-stock items")
