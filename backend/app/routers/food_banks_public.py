from __future__ import annotations

from fastapi import Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.database_errors import raise_database_unavailable_http_exception
from app.core.db_utils import fetch_scalars
from app.models.food_bank import FoodBank
from app.routers._shared import single_page_response
from app.routers.food_banks_shared import (
    NEAREST_FOOD_BANK_LIMIT,
    USER_AGENT_HEADERS,
    build_food_bank_inventory_rows,
    fetch_json,
    geocode_postcode_coordinates,
    get_food_bank_or_404,
    haversine_distance_km,
    serialize_inventory_item,
)


async def list_food_bank_inventory_items(
    food_bank_id: int,
    db: AsyncSession = Depends(get_db),
):
    await get_food_bank_or_404(db, food_bank_id)
    rows = await build_food_bank_inventory_rows(db, food_bank_id)
    return single_page_response(
        [serialize_inventory_item(item, total_stock) for item, total_stock in rows]
    )


async def geocode_postcode(
    postcode: str = Query(..., min_length=2, max_length=32),
):
    return await geocode_postcode_coordinates(postcode.strip())


async def get_external_food_banks_feed():
    try:
        status_code, payload, _ = await fetch_json(
            "https://www.givefood.org.uk/api/1/foodbanks/",
            headers=USER_AGENT_HEADERS,
            timeout=20.0,
        )
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch external food bank feed: {exc}",
        ) from exc

    if status_code != status.HTTP_200_OK:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"External food bank feed returned status {status_code}",
        )
    if not isinstance(payload, list):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Invalid upstream payload format",
        )
    return payload


async def list_food_banks(
    postcode: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    try:
        items = await fetch_scalars(db, select(FoodBank))
    except Exception:
        raise_database_unavailable_http_exception()

    if postcode and postcode.strip():
        coords = await geocode_postcode_coordinates(postcode.strip())
        items.sort(
            key=lambda bank: haversine_distance_km(
                float(coords["lat"]),
                float(coords["lng"]),
                float(bank.lat),
                float(bank.lng),
            )
        )
        items = items[:NEAREST_FOOD_BANK_LIMIT]

    return single_page_response(items)


async def get_food_bank(
    food_bank_id: int,
    db: AsyncSession = Depends(get_db),
):
    return await get_food_bank_or_404(db, food_bank_id, database_safe=True)
