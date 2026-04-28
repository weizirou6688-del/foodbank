"""inventory listing for admin"""

from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.db_utils import fetch_scalars
from app.core.security import enforce_admin_food_bank_scope, get_admin_food_bank_id, require_admin
from app.models.inventory_item import InventoryItem
from app.models.inventory_lot import InventoryLot
from app.routers._shared import bank_scoped_clause, single_page_response
from app.schemas.inventory_item import InventoryItemListResponse, InventoryItemOut


router = APIRouter()


def _normalized_optional_text(value: str | None) -> str | None:
    if isinstance(value, str):
        value = value.strip()
        if value:
            return value
    return None


def _inventory_total_stock_query(item_id: int):
    # stock 从活着的 lot 算出来,删掉或过期的 inventory 自动不再计数,
    # 不用再去维护一个单独的反规范化计数器
    return select(func.coalesce(func.sum(InventoryLot.quantity), 0)).where(
        InventoryLot.inventory_item_id == item_id,
        InventoryLot.deleted_at.is_(None),
        InventoryLot.expiry_date >= date.today(),
    )


async def _serialize_inventory_item(
    db: AsyncSession,
    item: InventoryItem,
) -> InventoryItemOut:
    total_stock = int(
        (
            await db.scalar(_inventory_total_stock_query(item.id))
        )
        or 0
    )
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


@router.get("", response_model=InventoryItemListResponse)
async def list_inventory(
    food_bank_id: int | None = None,
    category: str | None = Query(None, min_length=1, max_length=100),
    search: str | None = Query(None, min_length=1, max_length=200),
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    normalized_food_bank_id = food_bank_id if isinstance(food_bank_id, int) else None
    normalized_category = _normalized_optional_text(category)
    normalized_search = _normalized_optional_text(search) or ""

    query = select(InventoryItem).order_by(InventoryItem.updated_at.desc())

    admin_food_bank_id = get_admin_food_bank_id(admin_user)
    if normalized_food_bank_id is not None:
        # local admin 只能请求自己 bank 的;平台 admin 可以通过显式传 food_bank_id
        # 看任意 scope 下的 inventory
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

    # 响应保持简单,admin UI 把这个列表当一整页渲染,
    # 不是 cursor 分页的资源
    items = await fetch_scalars(db, query)
    return single_page_response([await _serialize_inventory_item(db, item) for item in items])
