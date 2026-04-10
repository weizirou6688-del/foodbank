"""
Food Bank location management routes.

Spec § 2.2: GET /food-banks, GET /food-banks/:id, POST, PATCH, DELETE
"""

import asyncio
from datetime import date
from html import unescape
import json
from math import atan2, cos, radians, sin, sqrt
import re
from typing import Optional
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urlparse
from urllib.request import Request, urlopen
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.database_errors import raise_database_unavailable_http_exception
from app.core.security import require_admin
from app.models.food_bank import FoodBank
from app.models.inventory_item import InventoryItem
from app.models.inventory_lot import InventoryLot
from app.modules.food_banks.schema import (
    FoodBankCreate,
    FoodBankDetailOut,
    FoodBankListResponse,
    FoodBankOut,
    FoodBankUpdate,
)
from app.schemas.inventory_item import InventoryItemListResponse, InventoryItemOut


router = APIRouter(tags=["Food Banks"])
NEAREST_FOOD_BANK_LIMIT = 25

# These regexes support a two-stage extraction strategy for Trussell opening
# hours: first use the structured table when available, then fall back to
# line-based text parsing if the HTML varies.
DAY_LINE_PATTERN = re.compile(
    r"^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*\|?\s*(Closed|\d{1,2}[:.]\d{2}\s*-\s*\d{1,2}[:.]\d{2})$",
    re.IGNORECASE,
)
DAY_TEXT_PATTERN = re.compile(
    r"^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)s?\s*[:|-]\s*(.+)$",
    re.IGNORECASE,
)


@router.get("/{food_bank_id}/inventory-items", response_model=InventoryItemListResponse)
async def list_food_bank_inventory_items(
    food_bank_id: int,
    db: AsyncSession = Depends(get_db),
):
    """List publicly available individual inventory items for the selected food bank.

    Public inventory is bank-scoped. Only items that belong to the requested
    food bank and currently have active stock are returned.
    """
    food_bank = await db.scalar(select(FoodBank).where(FoodBank.id == food_bank_id))
    if food_bank is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Food bank not found",
        )

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

    rows = (await db.execute(query)).all()
    items = [
        InventoryItemOut(
            id=item.id,
            name=item.name,
            category=item.category,
            stock=int(total_stock or 0),
            total_stock=int(total_stock or 0),
            unit=item.unit,
            threshold=item.threshold,
            food_bank_id=item.food_bank_id,
            updated_at=item.updated_at,
        )
        for item, total_stock in rows
    ]

    total = len(items)
    return {
        "items": items,
        "total": total,
        "page": 1,
        "size": total,
        "pages": 1,
    }


def _strip_html_to_lines(value: str) -> list[str]:
    """Convert raw HTML into compact text lines for fallback parsing."""
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", value, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</(p|div|li|h1|h2|h3|h4|h5|h6|section|article|tr)>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = unescape(text).replace("\xa0", " ")
    return [re.sub(r"\s+", " ", line).strip() for line in text.splitlines() if line.strip()]


def _extract_opening_hours_from_html(value: str) -> list[str]:
    """
    Extract opening-hour rows from official Trussell pages.

    The parser first targets the known opening-times table. If that fails, it
    falls back to normalized day/time text patterns so minor template changes do
    not immediately break the endpoint.
    """
    table_match = re.search(
        r'<table[^>]*location__opening-times[^>]*>(.*?)</table>',
        value,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if table_match:
        hours: list[str] = []
        row_matches = re.findall(
            r"<tr[^>]*>\s*<td[^>]*>\s*([A-Za-z]{3,9})\s*</td>\s*<td[^>]*>\s*(.*?)\s*</td>\s*</tr>",
            table_match.group(1),
            flags=re.IGNORECASE | re.DOTALL,
        )
        for day, time_value in row_matches:
            cleaned_time = re.sub(r"<[^>]+>", " ", time_value)
            cleaned_time = re.sub(r"\s+", " ", unescape(cleaned_time)).strip()
            if not cleaned_time:
                continue
            hours.append(f"{day.title()} | {cleaned_time}")
        if hours:
            return hours[:7]

    lines = _strip_html_to_lines(value)
    hours: list[str] = []
    seen: set[str] = set()

    for line in lines:
        normalized = line.replace("–", "-").replace("—", "-")
        day_line_match = DAY_LINE_PATTERN.match(normalized)
        if day_line_match:
            entry = f"{day_line_match.group(1).title()} | {day_line_match.group(2).strip()}"
            if entry not in seen:
                seen.add(entry)
                hours.append(entry)
            continue

        day_text_match = DAY_TEXT_PATTERN.match(normalized)
        if day_text_match:
            entry = f"{day_text_match.group(1).title()} | {day_text_match.group(2).strip()}"
            if entry not in seen:
                seen.add(entry)
                hours.append(entry)

    return hours[:7]


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
) -> tuple[int, object, str]:
    status_code, body, final_url = await _fetch_text(url, headers=headers, timeout=timeout)

    try:
        payload = json.loads(body)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON payload from {final_url}: {exc}") from exc

    return status_code, payload, final_url


async def _geocode_postcode_coordinates(normalized_postcode: str) -> dict[str, float | str]:
    if not normalized_postcode:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Postcode cannot be empty",
        )

    primary_error: Exception | None = None
    fallback_error: Exception | None = None

    try:
        primary_status, primary_payload, _ = await _fetch_json(
            f"https://api.postcodes.io/postcodes/{quote(normalized_postcode, safe='')}",
            headers={"User-Agent": "foodbank-app/1.0"},
            timeout=15.0,
        )
        if primary_status == status.HTTP_200_OK and isinstance(primary_payload, dict):
            result = primary_payload.get("result")
            if isinstance(result, dict):
                lat = result.get("latitude")
                lng = result.get("longitude")
                if isinstance(lat, (float, int)) and isinstance(lng, (float, int)):
                    return {
                        "lat": float(lat),
                        "lng": float(lng),
                        "source": "postcodes.io",
                    }
    except (RuntimeError, ValueError) as exc:
        primary_error = exc

    try:
        fallback_status, fallback_payload, _ = await _fetch_json(
            "https://nominatim.openstreetmap.org/search?"
            + urlencode({
                "q": normalized_postcode,
                "format": "jsonv2",
                "limit": 1,
            }),
            headers={"User-Agent": "foodbank-app/1.0"},
            timeout=15.0,
        )
        if fallback_status == status.HTTP_200_OK and isinstance(fallback_payload, list) and fallback_payload:
            first = fallback_payload[0]
            if isinstance(first, dict):
                lat_raw = first.get("lat")
                lon_raw = first.get("lon")
                try:
                    lat = float(lat_raw)
                    lng = float(lon_raw)
                    return {
                        "lat": lat,
                        "lng": lng,
                        "source": "nominatim",
                    }
                except (TypeError, ValueError):
                    pass
    except (RuntimeError, ValueError) as exc:
        fallback_error = exc

    if primary_error or fallback_error:
        error_message = fallback_error or primary_error
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to geocode postcode: {error_message}",
        )

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Unable to resolve postcode: {normalized_postcode}",
    )


@router.get("/geocode")
async def geocode_postcode(postcode: str = Query(..., min_length=2, max_length=32)):
    """
    Resolve postcode to coordinates.

    Provider strategy:
    1) Try postcodes.io (best for UK postcodes)
    2) Fallback to Nominatim (broader postcode coverage)
    """
    normalized_postcode = postcode.strip()
    return await _geocode_postcode_coordinates(normalized_postcode)


@router.get("/external-feed")
async def get_external_food_banks_feed():
    """
    Proxy external UK food bank feed for frontend usage.

    The upstream endpoint is proxied here so the browser can consume the feed
    without dealing with CORS or upstream request-header quirks directly.
    """
    upstream_url = "https://www.givefood.org.uk/api/1/foodbanks/"

    try:
        status_code, payload, _ = await _fetch_json(
            upstream_url,
            headers={"User-Agent": "foodbank-app/1.0"},
            timeout=20.0,
        )
    except HTTPException:
        raise
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch external food bank feed: {exc}",
        )

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


@router.get("/trussell-hours")
async def get_trussell_opening_hours(foodbank_url: str = Query(..., min_length=8, max_length=512)):
    """
    Return a normalized list of opening-hour lines for Trussell-linked sites.

    Keeping this logic on the server avoids pushing HTML scraping concerns into
    the browser application.
    """
    parsed = urlparse(foodbank_url.strip())
    hostname = (parsed.hostname or "").lower()
    if not hostname.endswith("foodbank.org.uk"):
        return {"hours": [], "source_url": None}

    base_url = foodbank_url.rstrip("/")
    candidate_urls = [
        f"{base_url}/locations/",
        f"{base_url}/locations",
        base_url,
    ]

    last_error: Exception | None = None

    for candidate_url in candidate_urls:
        try:
            status_code, html, resolved_url = await _fetch_text(
                candidate_url,
                headers={"User-Agent": "foodbank-app/1.0"},
                timeout=20.0,
            )
        except RuntimeError as exc:
            last_error = exc
            continue

        if status_code != status.HTTP_200_OK:
            continue

        hours = _extract_opening_hours_from_html(html)
        if hours:
            return {"hours": hours, "source_url": resolved_url}

    if last_error is not None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch Trussell opening hours: {last_error}",
        )

    return {"hours": [], "source_url": None}


@router.get("", response_model=FoodBankListResponse)
async def list_food_banks(
    postcode: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    List all food banks.
    
    Spec § 2.2: GET /food-banks (no auth).
    Supports ?postcode= for proximity filtering (within 2km).
    
    Note: proximity filtering not implemented in basic version.
    """
    try:
        result = await db.execute(select(FoodBank))
        items = list(result.scalars().all())
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
        total = len(items)
        return {
            "items": items,
            "total": total,
            "page": 1,
            "size": total,
            "pages": 1,
        }
    except Exception as exc:
        _ = exc
        raise_database_unavailable_http_exception()


@router.get("/{food_bank_id}", response_model=FoodBankDetailOut)
async def get_food_bank(
    food_bank_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Get single food bank with operating hours.
    
    Spec § 2.2: GET /food-banks/:id (no auth).
    """
    try:
        result = await db.execute(select(FoodBank).where(FoodBank.id == food_bank_id))
        bank = result.scalar_one_or_none()

        if not bank:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Food bank not found",
            )

        return bank
    except HTTPException:
        raise
    except Exception as exc:
        _ = exc
        raise_database_unavailable_http_exception()


@router.post("", response_model=FoodBankOut, status_code=status.HTTP_201_CREATED)
async def create_food_bank(
    bank_in: FoodBankCreate,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Create new food bank location (admin only).
    
    Spec § 2.2: POST /food-banks (requires admin role).
    """
    _ = admin_user
    
    bank = FoodBank(
        name=bank_in.name,
        address=bank_in.address,
        lat=bank_in.lat,
        lng=bank_in.lng,
    )
    
    db.add(bank)
    await db.flush()
    await db.refresh(bank)
    
    return bank


@router.patch("/{food_bank_id}", response_model=FoodBankOut)
async def update_food_bank(
    food_bank_id: int,
    bank_in: FoodBankUpdate,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Update food bank details (admin only).
    
    Spec § 2.2: PATCH /food-banks/:id (requires admin).
    """
    _ = admin_user
    
    result = await db.execute(select(FoodBank).where(FoodBank.id == food_bank_id))
    bank = result.scalar_one_or_none()
    
    if not bank:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Food bank not found",
        )
    
    # Update non-null fields only
    update_data = bank_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if value is not None:
            setattr(bank, key, value)
    
    await db.flush()
    await db.refresh(bank)
    
    return bank


@router.delete("/{food_bank_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_food_bank(
    food_bank_id: int,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Delete food bank (admin only).
    
    Spec § 2.2: DELETE /food-banks/:id (requires admin).
    
    Note: Cascading delete removes related hours/packages.
    """
    _ = admin_user
    
    result = await db.execute(select(FoodBank).where(FoodBank.id == food_bank_id))
    bank = result.scalar_one_or_none()
    
    if not bank:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Food bank not found",
        )
    
    await db.delete(bank)
    return None
