from fastapi import Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.db_utils import fetch_scalars
from app.core.security import enforce_admin_food_bank_scope, get_admin_food_bank_id, require_admin
from app.models.inventory_item import InventoryItem
from app.routers._shared import bank_scoped_clause, single_page_response
from app.routers.inventory_shared import serialize_inventory_item


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
    return single_page_response([await serialize_inventory_item(db, item) for item in items])
