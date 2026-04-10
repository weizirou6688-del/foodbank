"""
Donation submission and tracking routes.

Spec 搂 2.5: POST /cash, POST /goods, GET /list (admin with ?type filter)
"""

import logging
import uuid
from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.database_errors import (
    is_database_unavailable_exception,
    raise_database_unavailable_http_exception,
)
from app.core.goods_donation_format import parse_goods_pickup_date
from app.core.security import (
    enforce_admin_food_bank_scope,
    get_admin_food_bank_id,
    get_optional_current_user,
    require_admin,
    require_platform_admin,
    require_supermarket,
)
from app.models.donation_cash import DonationCash
from app.models.donation_goods import DonationGoods
from app.models.donation_goods_item import DonationGoodsItem
from app.models.food_bank import FoodBank
from app.models.inventory_item import InventoryItem
from app.models.inventory_lot import InventoryLot
from app.models.restock_request import RestockRequest
from app.models.user import User
from app.services.email_service import (
    send_goods_donation_notification,
    send_thank_you_email,
)
from app.schemas.donation_cash import DonationCashCreate, DonationCashOut, DonationCashUpdate
from app.schemas.donation_goods import (
    DonationGoodsCreate,
    DonationGoodsItemCreatePayload,
    DonationGoodsOut,
    DonationGoodsUpdate,
    SupermarketDonationCreate,
    SupermarketDonationItemPayload,
)


router = APIRouter(tags=["Donations"])
logger = logging.getLogger("uvicorn.error")
DEFAULT_INVENTORY_CATEGORY = "Canned Goods"
DEFAULT_INVENTORY_UNIT = "units"


def _normalize_food_bank_match_text(value: str | None) -> str:
    return " ".join((value or "").strip().lower().split())


def _donation_scope_filter(model, admin_user: dict):
    admin_food_bank_id = get_admin_food_bank_id(admin_user)
    if admin_food_bank_id is None:
        return model.food_bank_id.is_not(None)
    return model.food_bank_id == admin_food_bank_id


async def _resolve_food_bank_from_metadata(
    *,
    food_bank_name: str | None,
    food_bank_address: str | None,
    db: AsyncSession,
) -> FoodBank | None:
    normalized_name = _normalize_food_bank_match_text(food_bank_name)
    normalized_address = _normalize_food_bank_match_text(food_bank_address)

    if not normalized_name and not normalized_address:
        return None

    banks = (await db.execute(select(FoodBank))).scalars().all()
    best_match: FoodBank | None = None
    best_score = 0

    for bank in banks:
        bank_name = _normalize_food_bank_match_text(bank.name)
        bank_address = _normalize_food_bank_match_text(bank.address)
        score = 0

        if normalized_name:
            if bank_name == normalized_name:
                score += 4
            elif bank_name in normalized_name or normalized_name in bank_name:
                score += 2

        if normalized_address:
            if bank_address == normalized_address:
                score += 3
            elif bank_address in normalized_address or normalized_address in bank_address:
                score += 1

        if score > best_score:
            best_match = bank
            best_score = score

    return best_match


def _ensure_pending_goods_pickup_date_is_not_past(
    pickup_date: date | str | None,
    status_value: str,
) -> None:
    parsed_pickup_date = parse_goods_pickup_date(pickup_date)
    if parsed_pickup_date is None or status_value != "pending":
        return

    if parsed_pickup_date < date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pending goods donations must use a pickup date on or after today",
        )


async def _resolve_food_bank(food_bank_id: int, db: AsyncSession) -> FoodBank:
    selected_food_bank = await db.scalar(
        select(FoodBank).where(FoodBank.id == food_bank_id)
    )
    if selected_food_bank is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Food bank not found",
        )
    return selected_food_bank


def _goods_items_summary(items: list[DonationGoodsItemCreatePayload]) -> str:
    return ", ".join(f"{item.item_name} x{item.quantity}" for item in items)


async def _load_goods_donation(db: AsyncSession, donation_id: uuid.UUID) -> DonationGoods | None:
    result = await db.execute(
        select(DonationGoods)
        .options(selectinload(DonationGoods.items))
        .where(DonationGoods.id == donation_id)
    )
    return result.scalar_one_or_none()


async def _resolve_or_create_inventory_item(
    item_name: str,
    food_bank_id: int | None,
    db: AsyncSession,
) -> InventoryItem:
    if food_bank_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Received goods donations must target a specific food bank",
        )

    normalized_name = item_name.strip()
    exact_name_query = select(InventoryItem).where(
        func.lower(InventoryItem.name) == normalized_name.lower()
    )
    exact_scoped_item = await db.scalar(
        exact_name_query.where(InventoryItem.food_bank_id == food_bank_id)
    )
    if exact_scoped_item is not None and exact_scoped_item.food_bank_id == food_bank_id:
        return exact_scoped_item

    fuzzy_name_query = (
        select(InventoryItem)
        .where(func.lower(InventoryItem.name).like(f"{normalized_name.lower()}%"))
        .order_by(InventoryItem.id)
    )
    fuzzy_scoped_item = await db.scalar(
        fuzzy_name_query.where(InventoryItem.food_bank_id == food_bank_id)
    )
    if fuzzy_scoped_item is not None and fuzzy_scoped_item.food_bank_id == food_bank_id:
        return fuzzy_scoped_item

    item = InventoryItem(
        name=normalized_name,
        category=DEFAULT_INVENTORY_CATEGORY,
        unit=DEFAULT_INVENTORY_UNIT,
        threshold=10,
        food_bank_id=food_bank_id,
    )
    db.add(item)
    await db.flush()
    return item


async def _sync_goods_donation_inventory(
    donation: DonationGoods,
    db: AsyncSession,
    items: list[DonationGoodsItem | DonationGoodsItemCreatePayload] | None = None,
) -> None:
    if donation.food_bank_id is None:
        return

    received_date = parse_goods_pickup_date(donation.pickup_date) or date.today()
    donation_items = items if items is not None else list(donation.items)

    for item in donation_items:
        inventory_item = await _resolve_or_create_inventory_item(
            item.item_name,
            donation.food_bank_id,
            db,
        )
        lot_expiry = item.expiry_date or (received_date + timedelta(days=365))
        db.add(
            InventoryLot(
                inventory_item_id=inventory_item.id,
                quantity=item.quantity,
                received_date=received_date,
                expiry_date=lot_expiry,
                batch_reference=f"donation-{donation.id}",
            )
        )

    await db.flush()


async def _resolve_supermarket_inventory_item(
    item_in: SupermarketDonationItemPayload,
    db: AsyncSession,
) -> InventoryItem:
    if item_in.inventory_item_id is not None:
        inventory_item = await db.scalar(
            select(InventoryItem).where(InventoryItem.id == item_in.inventory_item_id)
        )
        if inventory_item is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inventory item #{item_in.inventory_item_id} not found",
            )
        if inventory_item.food_bank_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inventory item must belong to a specific food bank",
            )
        return inventory_item

    normalized_name = (item_in.item_name or "").strip()
    inventory_item = await db.scalar(
        select(InventoryItem)
        .where(
            func.lower(InventoryItem.name) == normalized_name.lower(),
            InventoryItem.food_bank_id.is_not(None),
        )
        .order_by(InventoryItem.id)
    )
    if inventory_item is None or inventory_item.food_bank_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Inventory item '{normalized_name}' does not exist. "
                "Choose a low-stock item or enter an exact inventory name."
            ),
        )
    return inventory_item


async def _sync_supermarket_restock_requests(
    inventory_item_ids: set[int],
    db: AsyncSession,
) -> None:
    if not inventory_item_ids:
        return

    stock_rows = (
        await db.execute(
            select(
                InventoryLot.inventory_item_id,
                func.coalesce(func.sum(InventoryLot.quantity), 0).label("total_stock"),
            )
            .where(
                InventoryLot.inventory_item_id.in_(inventory_item_ids),
                InventoryLot.deleted_at.is_(None),
                InventoryLot.expiry_date >= date.today(),
            )
            .group_by(InventoryLot.inventory_item_id)
        )
    ).all()
    stock_by_item_id = {row[0]: int(row[1] or 0) for row in stock_rows}

    open_requests = (
        await db.execute(
            select(RestockRequest).where(
                RestockRequest.inventory_item_id.in_(inventory_item_ids),
                RestockRequest.status == "open",
            )
        )
    ).scalars().all()

    for request in open_requests:
        latest_stock = stock_by_item_id.get(request.inventory_item_id, 0)
        request.current_stock = latest_stock
        if latest_stock >= request.threshold:
            request.status = "fulfilled"

    await db.flush()

@router.post("/cash", response_model=DonationCashOut, status_code=status.HTTP_201_CREATED)
async def submit_cash_donation(
    donation_in: DonationCashCreate,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
):
    """
    Submit cash donation (public, no auth required).
    
    Spec 搂 2.5: POST /donations/cash (no auth).
    
    DonationCashCreate includes:
    - amount: Decimal USD amount
    - donor_name, donor_email, donor_phone: Optional
    - message: Optional
    
    TODO: Create DonationCash record, record transaction
    """
    try:
        payment_reference = donation_in.payment_reference or f"WEB-{uuid.uuid4().hex[:12].upper()}"

        async with db.begin():
            donation = DonationCash(
                donor_name=donation_in.donor_name,
                donor_type=donation_in.donor_type,
                donor_email=donation_in.donor_email,
                food_bank_id=donation_in.food_bank_id,
                amount_pence=donation_in.amount_pence,
                payment_reference=payment_reference,
                status="completed",
            )
            db.add(donation)
            await db.flush()
            await db.refresh(donation)

            if donation_in.donor_email:
                background_tasks.add_task(
                    send_thank_you_email,
                    donation_in.donor_email,
                    "cash",
                    (
                        f"Donor: {donation_in.donor_name or 'Anonymous'} | "
                        f"Amount (pence): {donation_in.amount_pence} | "
                        f"Reference: {payment_reference}"
                    ),
                )
                logger.info("Queued cash donation thank-you email for %s", donation_in.donor_email)

            return donation
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cash donation conflict detected",
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        if is_database_unavailable_exception(exc):
            raise_database_unavailable_http_exception()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit cash donation",
        ) from exc


@router.post("/goods", response_model=DonationGoodsOut, status_code=status.HTTP_201_CREATED)
async def submit_goods_donation(
    donation_in: DonationGoodsCreate,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: dict | None = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Submit goods donation (public, no auth required).
    
    Spec 搂 2.5: POST /donations/goods (no auth).
    
    DonationGoodsCreate includes:
    - donor_name, donor_email, donor_phone: Optional
    - items: List[DonationGoodsItemCreatePayload] (item_name, count, unit)
    
    TODO: Create DonationGoods record and DonationGoodsItem entries
    """
    try:
        donation_id: uuid.UUID | None = None
        resolved_status = donation_in.status or "pending"
        _ensure_pending_goods_pickup_date_is_not_past(
            donation_in.pickup_date,
            resolved_status,
        )

        async with db.begin():
            requested_food_bank_id = donation_in.food_bank_id
            admin_food_bank_id = get_admin_food_bank_id(current_user)
            if admin_food_bank_id is not None:
                requested_food_bank_id = requested_food_bank_id or admin_food_bank_id
                enforce_admin_food_bank_scope(
                    current_user,
                    requested_food_bank_id,
                    detail="You can only submit goods donations for your assigned food bank",
                )

            if requested_food_bank_id is not None:
                selected_food_bank = await _resolve_food_bank(requested_food_bank_id, db)
            else:
                selected_food_bank = await _resolve_food_bank_from_metadata(
                    food_bank_name=donation_in.food_bank_name,
                    food_bank_address=donation_in.food_bank_address,
                    db=db,
                )
            created_items: list[DonationGoodsItem] = []

            donation = DonationGoods(
                donor_user_id=donation_in.donor_user_id,
                food_bank_id=selected_food_bank.id if selected_food_bank is not None else None,
                food_bank_name=(
                    selected_food_bank.name
                    if selected_food_bank is not None
                    else donation_in.food_bank_name
                ),
                food_bank_address=(
                    selected_food_bank.address
                    if selected_food_bank is not None
                    else donation_in.food_bank_address
                ),
                donor_name=donation_in.donor_name,
                donor_type=donation_in.donor_type,
                donor_email=donation_in.donor_email,
                donor_phone=donation_in.donor_phone,
                postcode=donation_in.postcode,
                pickup_date=donation_in.pickup_date,
                item_condition=donation_in.item_condition,
                estimated_quantity=donation_in.estimated_quantity,
                notes=donation_in.notes,
                status=resolved_status,
            )
            db.add(donation)
            await db.flush()
            donation_id = donation.id

            for item in donation_in.items:
                donation_item = DonationGoodsItem(
                    donation_id=donation.id,
                    donation=donation,
                    item_name=item.item_name,
                    quantity=item.quantity,
                    expiry_date=item.expiry_date,
                )
                db.add(donation_item)
                created_items.append(donation_item)

            await db.flush()

            if resolved_status == "received":
                await _sync_goods_donation_inventory(donation, db, created_items)

            if donation_in.donor_email:
                goods_details = ", ".join(
                    f"{item.item_name} x{item.quantity}" for item in donation_in.items
                )
                selected_food_bank_name = (
                    selected_food_bank.name
                    if selected_food_bank is not None
                    else donation_in.food_bank_name
                )
                if selected_food_bank_name:
                    goods_details = f"{goods_details} | Food bank: {selected_food_bank_name}"
                background_tasks.add_task(
                    send_thank_you_email,
                    donation_in.donor_email,
                    "goods",
                    goods_details,
                )
                logger.info("Queued goods donation thank-you email for %s", donation_in.donor_email)

            notification_email = (
                selected_food_bank.notification_email
                if selected_food_bank is not None
                else None
            ) or donation_in.food_bank_email
            background_tasks.add_task(
                send_goods_donation_notification,
                notification_email=notification_email,
                food_bank_name=(
                    selected_food_bank.name
                    if selected_food_bank is not None
                    else donation_in.food_bank_name
                ),
                food_bank_address=(
                    selected_food_bank.address
                    if selected_food_bank is not None
                    else donation_in.food_bank_address
                ),
                donor_name=donation_in.donor_name,
                donor_email=donation_in.donor_email,
                donor_phone=donation_in.donor_phone,
                items_summary=_goods_items_summary(donation_in.items),
                pickup_date=donation_in.pickup_date,
                notes=donation_in.notes,
            )
            logger.info(
                "Queued goods donation notification for food_bank_id=%s recipient=%s",
                selected_food_bank.id if selected_food_bank is not None else None,
                notification_email,
            )

        result = await db.execute(
            select(DonationGoods)
            .options(selectinload(DonationGoods.items))
            .where(DonationGoods.id == donation_id)
        )
        return result.scalar_one()
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Goods donation conflict detected",
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        if is_database_unavailable_exception(exc):
            raise_database_unavailable_http_exception()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit goods donation",
        ) from exc


@router.post("/goods/supermarket", response_model=DonationGoodsOut, status_code=status.HTTP_201_CREATED)
async def submit_supermarket_goods_donation(
    donation_in: SupermarketDonationCreate,
    current_user: dict = Depends(require_supermarket),
    db: AsyncSession = Depends(get_db),
):
    """
    Submit a supermarket restock donation and sync it directly to inventory.
    """
    try:
        donation_id: uuid.UUID | None = None

        async with db.begin():
            supermarket_user = await db.scalar(
                select(User).where(User.id == current_user.get("sub"))
            )
            if supermarket_user is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Authenticated supermarket user not found",
                )

            resolved_items: list[tuple[SupermarketDonationItemPayload, InventoryItem]] = []
            scoped_food_bank_ids: set[int] = set()
            for item in donation_in.items:
                inventory_item = await _resolve_supermarket_inventory_item(item, db)
                resolved_items.append((item, inventory_item))
                if inventory_item.food_bank_id is None:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Inventory item must belong to a specific food bank",
                    )
                scoped_food_bank_ids.add(int(inventory_item.food_bank_id))

            if len(scoped_food_bank_ids) != 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="All supermarket donation items must belong to the same food bank",
                )

            donation_food_bank_id = scoped_food_bank_ids.pop()
            selected_food_bank = await _resolve_food_bank(donation_food_bank_id, db)

            donation = DonationGoods(
                donor_user_id=supermarket_user.id,
                food_bank_id=selected_food_bank.id,
                food_bank_name=selected_food_bank.name,
                food_bank_address=selected_food_bank.address,
                donor_name=supermarket_user.name,
                donor_type="supermarket",
                donor_email=supermarket_user.email,
                donor_phone=donation_in.donor_phone or "00000000000",
                pickup_date=donation_in.pickup_date,
                notes=donation_in.notes,
                status="received",
            )
            db.add(donation)
            await db.flush()
            donation_id = donation.id

            received_date = parse_goods_pickup_date(donation.pickup_date) or date.today()
            touched_inventory_item_ids: set[int] = set()

            for item, inventory_item in resolved_items:
                touched_inventory_item_ids.add(inventory_item.id)

                db.add(
                    DonationGoodsItem(
                        donation_id=donation.id,
                        donation=donation,
                        item_name=inventory_item.name,
                        quantity=item.quantity,
                        expiry_date=item.expiry_date,
                    )
                )
                db.add(
                    InventoryLot(
                        inventory_item_id=inventory_item.id,
                        quantity=item.quantity,
                        received_date=received_date,
                        expiry_date=item.expiry_date or (received_date + timedelta(days=365)),
                        batch_reference=f"supermarket-donation-{donation.id}",
                    )
                )

            await db.flush()
            await _sync_supermarket_restock_requests(touched_inventory_item_ids, db)

        result = await db.execute(
            select(DonationGoods)
            .options(selectinload(DonationGoods.items))
            .where(DonationGoods.id == donation_id)
        )
        return result.scalar_one()
    except HTTPException:
        raise
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Supermarket donation conflict detected",
        ) from exc
    except Exception as exc:
        if is_database_unavailable_exception(exc):
            raise_database_unavailable_http_exception()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit supermarket donation",
        ) from exc

@router.patch("/cash/{donation_id}", response_model=DonationCashOut)
async def update_cash_donation(
    donation_id: uuid.UUID,
    donation_in: DonationCashUpdate,
    admin_user: dict = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    _ = admin_user

    updates = donation_in.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided to update",
        )

    try:
        async with db.begin():
            donation = await db.scalar(
                select(DonationCash).where(DonationCash.id == donation_id)
            )
            if donation is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Cash donation not found",
                )

            for field, value in updates.items():
                setattr(donation, field, value)

            await db.flush()
            await db.refresh(donation)
            return donation
    except HTTPException:
        raise
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cash donation conflict detected",
        ) from exc
    except Exception as exc:
        if is_database_unavailable_exception(exc):
            raise_database_unavailable_http_exception()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update cash donation",
        ) from exc


@router.delete("/cash/{donation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cash_donation(
    donation_id: uuid.UUID,
    admin_user: dict = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    _ = admin_user

    try:
        async with db.begin():
            donation = await db.scalar(
                select(DonationCash).where(DonationCash.id == donation_id)
            )
            if donation is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Cash donation not found",
                )

            await db.delete(donation)
            await db.flush()
            return None
    except HTTPException:
        raise
    except Exception as exc:
        if is_database_unavailable_exception(exc):
            raise_database_unavailable_http_exception()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete cash donation",
        ) from exc


@router.patch("/goods/{donation_id}", response_model=DonationGoodsOut)
async def update_goods_donation(
    donation_id: uuid.UUID,
    donation_in: DonationGoodsUpdate,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    _ = admin_user

    updates = donation_in.model_dump(exclude_unset=True, exclude={"items"})
    items_payload = donation_in.items if "items" in donation_in.model_fields_set else None
    if not updates and items_payload is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided to update",
        )

    try:
        async with db.begin():
            donation = await _load_goods_donation(db, donation_id)
            if donation is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Goods donation not found",
                )

            enforce_admin_food_bank_scope(
                admin_user,
                donation.food_bank_id,
                detail="You can only manage goods donations for your assigned food bank",
            )

            previous_status = donation.status
            selected_food_bank: FoodBank | None = None
            if "food_bank_id" in donation_in.model_fields_set:
                enforce_admin_food_bank_scope(
                    admin_user,
                    donation_in.food_bank_id,
                    detail="You can only assign goods donations to your own food bank",
                )
                if donation_in.food_bank_id is not None:
                    selected_food_bank = await _resolve_food_bank(donation_in.food_bank_id, db)
                    updates["food_bank_id"] = selected_food_bank.id
                    updates["food_bank_name"] = selected_food_bank.name
                    updates["food_bank_address"] = selected_food_bank.address

            resulting_status = updates.get("status", donation.status)
            resulting_pickup_date = updates.get("pickup_date", donation.pickup_date)
            if (
                "pickup_date" in donation_in.model_fields_set
                or (
                    "status" in donation_in.model_fields_set
                    and resulting_status == "pending"
                )
            ):
                _ensure_pending_goods_pickup_date_is_not_past(
                    resulting_pickup_date,
                    resulting_status,
                )

            for field, value in updates.items():
                setattr(donation, field, value)

            if items_payload is not None:
                donation.items.clear()
                await db.flush()
                for item in items_payload:
                    donation.items.append(
                        DonationGoodsItem(
                            donation_id=donation.id,
                            item_name=item.item_name,
                            quantity=item.quantity,
                            expiry_date=item.expiry_date,
                        )
                    )

            if previous_status != "received" and donation.status == "received":
                await _sync_goods_donation_inventory(donation, db)

            await db.flush()

        refreshed = await _load_goods_donation(db, donation_id)
        if refreshed is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Goods donation not found",
            )
        return refreshed
    except HTTPException:
        raise
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Goods donation conflict detected",
        ) from exc
    except Exception as exc:
        if is_database_unavailable_exception(exc):
            raise_database_unavailable_http_exception()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update goods donation",
        ) from exc


@router.delete("/goods/{donation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goods_donation(
    donation_id: uuid.UUID,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    _ = admin_user

    try:
        async with db.begin():
            donation = await _load_goods_donation(db, donation_id)
            if donation is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Goods donation not found",
                )

            enforce_admin_food_bank_scope(
                admin_user,
                donation.food_bank_id,
                detail="You can only delete goods donations for your assigned food bank",
            )

            await db.delete(donation)
            await db.flush()
            return None
    except HTTPException:
        raise
    except Exception as exc:
        if is_database_unavailable_exception(exc):
            raise_database_unavailable_http_exception()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete goods donation",
        ) from exc


@router.get("", response_model=List[dict])
async def list_donations(
    type: Optional[str] = None,  # "cash" or "goods"
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    List all donations (admin only, with optional type filter).
    
    Spec 搂 2.5: GET /donations?type= (requires admin).
    
    Supports filters:
    - ?type=cash 鈫?only DonationCash
    - ?type=goods 鈫?only DonationGoods
    
    TODO: Query donations with optional type filter
    """
    normalized = type.lower() if type else None
    if normalized not in (None, "cash", "goods"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="type must be one of: cash, goods",
        )

    admin_food_bank_id = get_admin_food_bank_id(admin_user)
    response: list[dict] = []

    if normalized in (None, "cash"):
        cash_query = select(DonationCash).order_by(DonationCash.created_at.desc())
        cash_query = cash_query.where(_donation_scope_filter(DonationCash, admin_user))
        cash_rows = (await db.execute(cash_query)).scalars().all()
        if admin_food_bank_id is None:
            cash_rows = [
                row
                for row in cash_rows
                if not hasattr(row, "food_bank_id") or getattr(row, "food_bank_id", None) is not None
            ]
        for row in cash_rows:
            payload = DonationCashOut.model_validate(row).model_dump(mode="json")
            payload["donation_type"] = "cash"
            response.append(payload)

    if normalized in (None, "goods"):
        goods_query = (
            select(DonationGoods)
            .options(selectinload(DonationGoods.items))
            .order_by(DonationGoods.created_at.desc())
        )
        goods_query = goods_query.where(_donation_scope_filter(DonationGoods, admin_user))
        goods_rows = (await db.execute(goods_query)).scalars().all()
        if admin_food_bank_id is None:
            goods_rows = [
                row
                for row in goods_rows
                if not hasattr(row, "food_bank_id") or getattr(row, "food_bank_id", None) is not None
            ]
        for row in goods_rows:
            payload = DonationGoodsOut.model_validate(row).model_dump(mode="json")
            payload["donation_type"] = "goods"
            response.append(payload)

    response.sort(key=lambda d: d.get("created_at", ""), reverse=True)
    return response
