from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import TypeVar

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db_utils import fetch_one_or_none
from app.core.security import enforce_admin_food_bank_scope, get_admin_food_bank_id
from app.models.food_bank import FoodBank


T = TypeVar("T")


def single_page_response(items: Sequence[T]) -> dict[str, object]:
    total = len(items)
    return {"items": items, "total": total, "page": 1, "size": total, "pages": 1}


def bank_scoped_clause(model, admin_user: dict):
    admin_food_bank_id = get_admin_food_bank_id(admin_user)
    if admin_food_bank_id is None:
        return model.food_bank_id.is_not(None)
    return model.food_bank_id == admin_food_bank_id


async def require_one_or_404(db: AsyncSession, query, *, detail: str) -> T:
    record = await fetch_one_or_none(db, query)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)
    return record


async def require_by_id(db: AsyncSession, model, entity_id, *, detail: str, options: Sequence[object] = ()) -> T:
    query = select(model).where(model.id == entity_id)
    for option in options:
        query = query.options(option)
    return await require_one_or_404(db, query, detail=detail)


async def require_scoped_by_id(
    db: AsyncSession, model, entity_id, admin_user: dict,
    *,
    detail: str,
    not_found_detail: str,
    options: Sequence[object] = (),
    food_bank_id_getter: Callable[[T], int | None] | None = None,
) -> T:
    record = await require_by_id(db, model, entity_id, detail=not_found_detail, options=options)
    food_bank_id = food_bank_id_getter(record) if food_bank_id_getter is not None else getattr(record, "food_bank_id")
    enforce_admin_food_bank_scope(admin_user, food_bank_id, detail=detail)
    return record


async def resolve_admin_target_food_bank_id(
    db: AsyncSession, requested_food_bank_id: int | None, admin_user: dict,
    *,
    scope_detail: str,
    required_detail: str,
) -> int:
    admin_food_bank_id = get_admin_food_bank_id(admin_user)
    if admin_food_bank_id is not None:
        if requested_food_bank_id is not None:
            enforce_admin_food_bank_scope(admin_user, requested_food_bank_id, detail=scope_detail)
        target_food_bank_id = admin_food_bank_id
    else:
        if requested_food_bank_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=required_detail)
        target_food_bank_id = requested_food_bank_id

    await require_one_or_404(db, select(FoodBank.id).where(FoodBank.id == target_food_bank_id), detail="Food bank not found")
    return target_food_bank_id
