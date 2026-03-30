"""
Food Bank location management routes.

Spec § 2.2: GET /food-banks, GET /food-banks/:id, POST, PATCH, DELETE
"""

from html import unescape
import re
from typing import Optional
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.database_errors import raise_database_unavailable_http_exception
from app.core.security import require_admin
from app.models.food_bank import FoodBank
from app.modules.food_banks.schema import (
    FoodBankCreate,
    FoodBankDetailOut,
    FoodBankListResponse,
    FoodBankOut,
    FoodBankUpdate,
)


router = APIRouter(tags=["Food Banks"])

DAY_LINE_PATTERN = re.compile(
    r"^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*\|?\s*(Closed|\d{1,2}[:.]\d{2}\s*-\s*\d{1,2}[:.]\d{2})$",
    re.IGNORECASE,
)
DAY_TEXT_PATTERN = re.compile(
    r"^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)s?\s*[:|-]\s*(.+)$",
    re.IGNORECASE,
)


def _strip_html_to_lines(value: str) -> list[str]:
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", value, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</(p|div|li|h1|h2|h3|h4|h5|h6|section|article|tr)>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = unescape(text).replace("\xa0", " ")
    return [re.sub(r"\s+", " ", line).strip() for line in text.splitlines() if line.strip()]


def _extract_opening_hours_from_html(value: str) -> list[str]:
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


@router.get("/geocode")
async def geocode_postcode(postcode: str = Query(..., min_length=2, max_length=32)):
    """
    Resolve postcode to coordinates.

    Provider strategy:
    1) Try postcodes.io (best for UK postcodes)
    2) Fallback to Nominatim (broader postcode coverage)
    """
    normalized_postcode = postcode.strip()
    if not normalized_postcode:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Postcode cannot be empty",
        )

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Primary: UK postcode service
            primary = await client.get(
                f"https://api.postcodes.io/postcodes/{normalized_postcode}"
            )
            if primary.status_code == status.HTTP_200_OK:
                primary_json = primary.json()
                result = primary_json.get("result") if isinstance(primary_json, dict) else None
                if isinstance(result, dict):
                    lat = result.get("latitude")
                    lng = result.get("longitude")
                    if isinstance(lat, (float, int)) and isinstance(lng, (float, int)):
                        return {
                            "lat": float(lat),
                            "lng": float(lng),
                            "source": "postcodes.io",
                        }

            # Fallback: broader geocoder
            fallback = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    "q": normalized_postcode,
                    "format": "jsonv2",
                    "limit": 1,
                },
                headers={
                    "User-Agent": "foodbank-app/1.0",
                },
            )
            fallback.raise_for_status()
            fallback_json = fallback.json()

            if isinstance(fallback_json, list) and fallback_json:
                first = fallback_json[0]
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

    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to geocode postcode: {exc}",
        )

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Unable to resolve postcode: {normalized_postcode}",
    )


@router.get("/external-feed")
async def get_external_food_banks_feed():
    """
    Proxy external UK food bank feed for frontend usage.

    The upstream endpoint does not expose CORS headers for browsers, so the
    frontend must access it via this backend endpoint.
    """
    upstream_url = "https://www.givefood.org.uk/api/1/foodbanks/"

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(
                upstream_url,
                headers={
                    "User-Agent": "foodbank-app/1.0",
                },
            )
            response.raise_for_status()
            payload = response.json()

            if not isinstance(payload, list):
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Invalid upstream payload format",
                )

            return payload
    except HTTPException:
        raise
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch external food bank feed: {exc}",
        )


@router.get("/trussell-hours")
async def get_trussell_opening_hours(foodbank_url: str = Query(..., min_length=8, max_length=512)):
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

    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            for candidate_url in candidate_urls:
                response = await client.get(
                    candidate_url,
                    headers={
                        "User-Agent": "foodbank-app/1.0",
                    },
                )
                if response.status_code != status.HTTP_200_OK:
                    continue

                hours = _extract_opening_hours_from_html(response.text)
                if hours:
                    return {"hours": hours, "source_url": candidate_url}
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch Trussell opening hours: {exc}",
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
    _ = postcode
    try:
        result = await db.execute(select(FoodBank))
        items = list(result.scalars().all())
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
