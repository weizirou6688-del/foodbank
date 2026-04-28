"""公众端 food-bank 发现相关路由,包含 postcode 地理编码和上游 feed 透传。"""

from __future__ import annotations

import asyncio
import json
from dataclasses import asdict, dataclass
from datetime import date
from math import atan2, cos, radians, sin, sqrt
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.database_errors import raise_database_unavailable_http_exception
from app.core.db_utils import fetch_scalars
from app.models.food_bank import FoodBank
from app.models.inventory_item import InventoryItem
from app.models.inventory_lot import InventoryLot
from app.models.user import User
from app.routers._shared import single_page_response
from app.schemas.food_bank import FoodBankListResponse, FoodBankOut
from app.schemas.inventory_item import InventoryItemListResponse, InventoryItemOut


router = APIRouter()

NEAREST_FOOD_BANK_LIMIT = 25
USER_AGENT_HEADERS = {"User-Agent": "foodbank-app/1.0"}


@dataclass(frozen=True)
class TextResponse:
    status_code: int
    body: str
    final_url: str


@dataclass(frozen=True)
class JsonResponse:
    status_code: int
    payload: object
    final_url: str


@dataclass(frozen=True)
class GeoCoordinates:
    lat: float
    lng: float
    source: str


def _normalized_postcode(postcode: str | None) -> str:
    return postcode.strip() if isinstance(postcode, str) else ""


def _serialize_inventory_item(
    item: InventoryItem,
    total_stock: int | None,
) -> InventoryItemOut:
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


def _haversine_distance_km(
    lat1: float,
    lng1: float,
    lat2: float,
    lng2: float,
) -> float:
    earth_radius_km = 6371
    d_lat = radians(lat2 - lat1)
    d_lng = radians(lng2 - lng1)
    a = (
        sin(d_lat / 2) ** 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lng / 2) ** 2
    )
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return earth_radius_km * c


def _inventory_stock_subquery():
    return (
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


def _nearest_food_banks(
    food_banks: list[FoodBank],
    coordinates: GeoCoordinates,
) -> list[FoodBank]:
    return sorted(
        food_banks,
        key=lambda bank: _haversine_distance_km(
            coordinates.lat,
            coordinates.lng,
            float(bank.lat),
            float(bank.lng),
        ),
    )[:NEAREST_FOOD_BANK_LIMIT]


def _blocking_fetch_text(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    timeout: float = 20.0,
) -> TextResponse:
    request = Request(url, headers=headers or {})

    try:
        with urlopen(request, timeout=timeout) as response:
            body = response.read().decode("utf-8", errors="replace")
            return TextResponse(
                status_code=int(getattr(response, "status", 200)),
                body=body,
                final_url=response.geturl(),
            )
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        return TextResponse(
            status_code=exc.code,
            body=body,
            final_url=exc.geturl(),
        )


async def _fetch_text(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    timeout: float = 20.0,
) -> TextResponse:
    try:
        # urllib 是阻塞的,扔到 worker 线程跑,
        # 别让每个 postcode 或上游 feed 请求都把 event loop 卡住
        return await asyncio.to_thread(
            _blocking_fetch_text,
            url,
            headers=headers,
            timeout=timeout,
        )
    except (OSError, TimeoutError, URLError) as exc:
        raise RuntimeError(str(exc)) from exc


async def _fetch_json(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    timeout: float = 20.0,
) -> JsonResponse:
    response = await _fetch_text(
        url,
        headers=headers,
        timeout=timeout,
    )
    try:
        payload = json.loads(response.body)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON payload from {response.final_url}: {exc}") from exc
    return JsonResponse(
        status_code=response.status_code,
        payload=payload,
        final_url=response.final_url,
    )


def _coerce_coordinates(
    payload: object,
    *,
    lat_key: str,
    lng_key: str,
    source: str,
) -> GeoCoordinates | None:
    if not isinstance(payload, dict):
        return None
    try:
        return GeoCoordinates(
            lat=float(payload.get(lat_key)),
            lng=float(payload.get(lng_key)),
            source=source,
        )
    except (TypeError, ValueError):
        return None


async def _get_food_bank_or_404(
    db: AsyncSession,
    food_bank_id: int,
) -> FoodBank:
    bank = (
        await db.execute(select(FoodBank).where(FoodBank.id == food_bank_id))
    ).scalar_one_or_none()
    if bank is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Food bank not found",
        )
    return bank


async def _food_bank_ids_with_local_admin_accounts(db: AsyncSession) -> set[int]:
    rows = await fetch_scalars(
        db,
        select(User.food_bank_id)
        .where(
            User.role == "admin",
            User.food_bank_id.is_not(None),
        )
        .distinct(),
    )
    return {
        int(food_bank_id)
        for food_bank_id in rows
        if food_bank_id is not None and int(food_bank_id) > 0
    }


def _serialize_food_bank(
    bank: FoodBank,
    *,
    food_bank_ids_with_local_admin_accounts: set[int],
) -> FoodBankOut:
    return FoodBankOut(
        id=bank.id,
        name=bank.name,
        address=bank.address,
        notification_email=bank.notification_email,
        lat=float(bank.lat),
        lng=float(bank.lng),
        created_at=bank.created_at,
        has_local_admin_account=bank.id in food_bank_ids_with_local_admin_accounts,
    )


async def _geocode_postcode_coordinates(
    normalized_postcode: str,
) -> GeoCoordinates:
    if not normalized_postcode:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Postcode cannot be empty",
        )

    try:
        response = await _fetch_json(
            f"https://api.postcodes.io/postcodes/{quote(normalized_postcode, safe='')}",
            headers=USER_AGENT_HEADERS,
            timeout=15.0,
        )
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to geocode postcode: {exc}",
        ) from exc

    payload = response.payload
    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Invalid postcode geocode payload",
        )

    if response.status_code == status.HTTP_200_OK:
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
    if response.status_code in {status.HTTP_400_BAD_REQUEST, status.HTTP_404_NOT_FOUND}:
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
            else f"Postcode geocode service returned status {response.status_code}"
        ),
    )


def _external_food_bank_feed_payload(response: JsonResponse) -> list[object]:
    if response.status_code != status.HTTP_200_OK:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"External food bank feed returned status {response.status_code}",
        )
    if not isinstance(response.payload, list):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Invalid upstream payload format",
        )
    return response.payload


@router.get("/{food_bank_id}/inventory-items", response_model=InventoryItemListResponse)
async def list_food_bank_inventory_items(
    food_bank_id: int,
    db: AsyncSession = Depends(get_db),
):
    await _get_food_bank_or_404(db, food_bank_id)
    stock_subquery = _inventory_stock_subquery()
    rows = (
        await db.execute(
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
    ).all()
    return single_page_response(
        [_serialize_inventory_item(item, total_stock) for item, total_stock in rows]
    )


@router.get("/geocode")
async def geocode_postcode(
    postcode: str = Query(..., min_length=2, max_length=32),
):
    return asdict(await _geocode_postcode_coordinates(_normalized_postcode(postcode)))


@router.get("/external-feed")
async def get_external_food_banks_feed():
    try:
        response = await _fetch_json(
            "https://www.givefood.org.uk/api/1/foodbanks/",
            headers=USER_AGENT_HEADERS,
            timeout=20.0,
        )
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch external food bank feed: {exc}",
        ) from exc

    return _external_food_bank_feed_payload(response)


@router.get("", response_model=FoodBankListResponse)
async def list_food_banks(
    postcode: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    try:
        items = await fetch_scalars(db, select(FoodBank))
        food_bank_ids_with_local_admin_accounts = (
            await _food_bank_ids_with_local_admin_accounts(db)
        )
    except Exception:
        raise_database_unavailable_http_exception()

    normalized_postcode = _normalized_postcode(postcode)
    if normalized_postcode:
        # 距离排序放在 DB 读完之后做,坐标的真实来源还是我们自己的 food-bank 表
        coords = await _geocode_postcode_coordinates(normalized_postcode)
        items = _nearest_food_banks(items, coords)

    return single_page_response(
        [
            _serialize_food_bank(
                item,
                food_bank_ids_with_local_admin_accounts=food_bank_ids_with_local_admin_accounts,
            )
            for item in items
        ]
    )


@router.get("/{food_bank_id}", response_model=FoodBankOut)
async def get_food_bank(
    food_bank_id: int,
    db: AsyncSession = Depends(get_db),
):
    bank = await _get_food_bank_or_404(db, food_bank_id)
    return _serialize_food_bank(
        bank,
        food_bank_ids_with_local_admin_accounts=(
            await _food_bank_ids_with_local_admin_accounts(db)
        ),
    )
