import asyncio
import json
from datetime import date
from math import atan2, cos, radians, sin, sqrt
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.db_utils import fetch_rows, fetch_scalars, flush_refresh, sync_model_fields
from app.core.database_errors import raise_database_unavailable_http_exception
from app.core.security import require_admin
from app.models.food_bank import FoodBank
from app.models.inventory_item import InventoryItem
from app.models.inventory_lot import InventoryLot
from app.routers._shared import single_page_response
from app.schemas.food_bank import (
    FoodBankCreate,
    FoodBankDetailOut,
    FoodBankListResponse,
    FoodBankOut,
    FoodBankUpdate,
)
from app.schemas.inventory_item import InventoryItemListResponse, InventoryItemOut


router = APIRouter(tags=["Food Banks"])
NEAREST_FOOD_BANK_LIMIT = 25
USER_AGENT_HEADERS = {"User-Agent": "foodbank-app/1.0"}


def _serialize_inventory_item(item: InventoryItem, total_stock: int | None) -> InventoryItemOut:
    stock = int(total_stock or 0)
    return InventoryItemOut(id=item.id, name=item.name, category=item.category, stock=stock, total_stock=stock, unit=item.unit, threshold=item.threshold, food_bank_id=item.food_bank_id, updated_at=item.updated_at)


@router.get("/{food_bank_id}/inventory-items", response_model=InventoryItemListResponse)
async def list_food_bank_inventory_items(food_bank_id: int, db: AsyncSession = Depends(get_db)):
    await _get_food_bank_or_404(db, food_bank_id)

    stock_subquery = (
        select(InventoryLot.inventory_item_id, func.coalesce(func.sum(InventoryLot.quantity), 0).label("total_stock"))
        .where(and_(InventoryLot.deleted_at.is_(None), InventoryLot.expiry_date >= date.today()))
        .group_by(InventoryLot.inventory_item_id)
        .subquery()
    )

    query = (
        select(InventoryItem, func.coalesce(stock_subquery.c.total_stock, 0).label("total_stock"))
        .join(stock_subquery, InventoryItem.id == stock_subquery.c.inventory_item_id, isouter=True)
        .where(InventoryItem.food_bank_id == food_bank_id, func.coalesce(stock_subquery.c.total_stock, 0) > 0)
        .order_by(InventoryItem.category.asc(), InventoryItem.name.asc())
    )

    return single_page_response([_serialize_inventory_item(item, total_stock) for item, total_stock in await fetch_rows(db, query)])


def _haversine_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
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


async def _fetch_text(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    timeout: float = 20.0,
) -> tuple[int, str, str]:
    try:
        return await asyncio.to_thread(_blocking_fetch_text, url, headers=headers, timeout=timeout)
    except (OSError, TimeoutError, URLError) as exc:
        raise RuntimeError(str(exc)) from exc


async def _fetch_json(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    timeout: float = 20.0,
) -> tuple[int, object, str]:
    status_code, body, final_url = await _fetch_text(url, headers=headers, timeout=timeout)
    try:
        payload = json.loads(body)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON payload from {final_url}: {exc}") from exc
    return status_code, payload, final_url


def _coerce_coordinates(payload: object, *, lat_key: str, lng_key: str, source: str) -> dict[str, float | str] | None:
    if not isinstance(payload, dict):
        return None
    try:
        return {"lat": float(payload.get(lat_key)), "lng": float(payload.get(lng_key)), "source": source}
    except (TypeError, ValueError):
        return None


async def _get_food_bank_or_404(
    db: AsyncSession,
    food_bank_id: int,
    *,
    database_safe: bool = False,
) -> FoodBank:
    try:
        bank = (await db.execute(select(FoodBank).where(FoodBank.id == food_bank_id))).scalar_one_or_none()
    except Exception:
        if database_safe:
            raise_database_unavailable_http_exception()
        raise
    if bank is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Food bank not found")
    return bank


async def _geocode_postcode_coordinates(normalized_postcode: str) -> dict[str, float | str]:
    if not normalized_postcode:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Postcode cannot be empty")

    try:
        status_code, payload, _ = await _fetch_json(
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
        coords = _coerce_coordinates(
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
            detail=error_detail if isinstance(error_detail, str) and error_detail else f"Unable to resolve postcode: {normalized_postcode}",
        )

    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=(
            error_detail
            if isinstance(error_detail, str) and error_detail
            else f"Postcode geocode service returned status {status_code}"
        ),
    )


@router.get("/geocode")
async def geocode_postcode(postcode: str = Query(..., min_length=2, max_length=32)):
    normalized_postcode = postcode.strip()
    return await _geocode_postcode_coordinates(normalized_postcode)


@router.get("/external-feed")
async def get_external_food_banks_feed():
    try:
        status_code, payload, _ = await _fetch_json("https://www.givefood.org.uk/api/1/foodbanks/", headers=USER_AGENT_HEADERS, timeout=20.0)
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Failed to fetch external food bank feed: {exc}") from exc
    if status_code != status.HTTP_200_OK:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"External food bank feed returned status {status_code}")
    if not isinstance(payload, list):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Invalid upstream payload format")
    return payload


@router.get("", response_model=FoodBankListResponse)
async def list_food_banks(
    postcode: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    try:
        items = await fetch_scalars(db, select(FoodBank))
    except Exception:
        raise_database_unavailable_http_exception()
    if postcode and postcode.strip():
        coords = await _geocode_postcode_coordinates(postcode.strip())
        items.sort(
            key=lambda bank: _haversine_distance_km(
                float(coords["lat"]),
                float(coords["lng"]),
                float(bank.lat),
                float(bank.lng),
            )
        )
        items = items[:NEAREST_FOOD_BANK_LIMIT]
    return single_page_response(items)


@router.get("/{food_bank_id}", response_model=FoodBankDetailOut)
async def get_food_bank(
    food_bank_id: int,
    db: AsyncSession = Depends(get_db),
):
    return await _get_food_bank_or_404(db, food_bank_id, database_safe=True)


@router.post("", response_model=FoodBankOut, status_code=status.HTTP_201_CREATED)
async def create_food_bank(
    bank_in: FoodBankCreate,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    bank = FoodBank(
        name=bank_in.name,
        address=bank_in.address,
        lat=bank_in.lat,
        lng=bank_in.lng,
    )
    db.add(bank)
    return await flush_refresh(db, bank)


@router.patch("/{food_bank_id}", response_model=FoodBankOut)
async def update_food_bank(
    food_bank_id: int,
    bank_in: FoodBankUpdate,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    bank = await _get_food_bank_or_404(db, food_bank_id)
    sync_model_fields(bank, {key: value for key, value in bank_in.model_dump(exclude_unset=True).items() if value is not None})
    return await flush_refresh(db, bank)


@router.delete("/{food_bank_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_food_bank(
    food_bank_id: int,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    bank = await _get_food_bank_or_404(db, food_bank_id)
    await db.delete(bank)
    return None
