from __future__ import annotations

import asyncio
import json
from datetime import date
from math import atan2, cos, radians, sin, sqrt
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from fastapi import HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database_errors import raise_database_unavailable_http_exception
from app.models.food_bank import FoodBank
from app.models.inventory_item import InventoryItem
from app.models.inventory_lot import InventoryLot
from app.schemas.inventory_item import InventoryItemOut


NEAREST_FOOD_BANK_LIMIT = 25
USER_AGENT_HEADERS = {"User-Agent": "foodbank-app/1.0"}


def serialize_inventory_item(item: InventoryItem, total_stock: int | None) -> InventoryItemOut:
    stock = int(total_stock or 0)
    return InventoryItemOut(
        id=item.id,
        name=item.name,
        category=item.category,
        stock=stock,
        total_stock=stock,
        unit=item.unit,
        threshold=item.threshold,
        food_bank_id=item.food_bank_id,
        updated_at=item.updated_at,
    )


async def build_food_bank_inventory_rows(
    db: AsyncSession,
    food_bank_id: int,
) -> list[tuple[InventoryItem, int]]:
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

    query = (
        select(
            InventoryItem,
            func.coalesce(stock_subquery.c.total_stock, 0).label("total_stock"),
        )
        .join(
            stock_subquery,
            InventoryItem.id == stock_subquery.c.inventory_item_id,
            isouter=True,
        )
        .where(
            InventoryItem.food_bank_id == food_bank_id,
            func.coalesce(stock_subquery.c.total_stock, 0) > 0,
        )
        .order_by(InventoryItem.category.asc(), InventoryItem.name.asc())
    )
    result = await db.execute(query)
    return [(item, int(total_stock or 0)) for item, total_stock in result.all()]


def haversine_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    earth_radius_km = 6371
    d_lat = radians(lat2 - lat1)
    d_lng = radians(lng2 - lng1)
    a = (
        sin(d_lat / 2) ** 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lng / 2) ** 2
    )
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return earth_radius_km * c


def _blocking_fetch_text(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    timeout: float = 20.0,
) -> tuple[int, str, str]:
    request = Request(url, headers=headers or {})

    try:
        with urlopen(request, timeout=timeout) as response:
            body = response.read().decode("utf-8", errors="replace")
            return int(getattr(response, "status", 200)), body, response.geturl()
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        return exc.code, body, exc.geturl()


async def fetch_text(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    timeout: float = 20.0,
) -> tuple[int, str, str]:
    try:
        return await asyncio.to_thread(
            _blocking_fetch_text,
            url,
            headers=headers,
            timeout=timeout,
        )
    except (OSError, TimeoutError, URLError) as exc:
        raise RuntimeError(str(exc)) from exc


async def fetch_json(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    timeout: float = 20.0,
) -> tuple[int, object, str]:
    status_code, body, final_url = await fetch_text(
        url,
        headers=headers,
        timeout=timeout,
    )
    try:
        payload = json.loads(body)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON payload from {final_url}: {exc}") from exc
    return status_code, payload, final_url


def coerce_coordinates(
    payload: object,
    *,
    lat_key: str,
    lng_key: str,
    source: str,
) -> dict[str, float | str] | None:
    if not isinstance(payload, dict):
        return None
    try:
        return {
            "lat": float(payload.get(lat_key)),
            "lng": float(payload.get(lng_key)),
            "source": source,
        }
    except (TypeError, ValueError):
        return None


async def get_food_bank_or_404(
    db: AsyncSession,
    food_bank_id: int,
    *,
    database_safe: bool = False,
) -> FoodBank:
    try:
        bank = (
            await db.execute(select(FoodBank).where(FoodBank.id == food_bank_id))
        ).scalar_one_or_none()
    except Exception:
        if database_safe:
            raise_database_unavailable_http_exception()
        raise

    if bank is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Food bank not found",
        )
    return bank


async def geocode_postcode_coordinates(
    normalized_postcode: str,
) -> dict[str, float | str]:
    if not normalized_postcode:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Postcode cannot be empty",
        )

    try:
        status_code, payload, _ = await fetch_json(
            f"https://api.postcodes.io/postcodes/{quote(normalized_postcode, safe='')}",
            headers=USER_AGENT_HEADERS,
            timeout=15.0,
        )
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to geocode postcode: {exc}",
        ) from exc

    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Invalid postcode geocode payload",
        )

    if status_code == status.HTTP_200_OK:
        coords = coerce_coordinates(
            payload.get("result"),
            lat_key="latitude",
            lng_key="longitude",
            source="postcodes.io",
        )
        if coords:
            return coords
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Invalid postcode geocode payload",
        )

    error_detail = payload.get("error")
    if status_code in {status.HTTP_400_BAD_REQUEST, status.HTTP_404_NOT_FOUND}:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                error_detail
                if isinstance(error_detail, str) and error_detail
                else f"Unable to resolve postcode: {normalized_postcode}"
            ),
        )

    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=(
            error_detail
            if isinstance(error_detail, str) and error_detail
            else f"Postcode geocode service returned status {status_code}"
        ),
    )
