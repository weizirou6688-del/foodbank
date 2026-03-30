"""
Restock request management routes.
"""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.database_errors import (
    is_database_unavailable_exception,
    raise_database_unavailable_http_exception,
)
from app.core.security import require_admin, require_admin_or_supermarket
from app.models.inventory_item import InventoryItem
from app.models.inventory_lot import InventoryLot
from app.models.restock_request import RestockRequest
from app.schemas.restock_request import (
    RestockRequestCreate,
    RestockRequestFulfil,
    RestockRequestListResponse,
    RestockRequestOut,
)


router = APIRouter(tags=["Restock Requests"])


@router.get("", response_model=RestockRequestListResponse)
async def list_restock_requests(
    admin_user: dict = Depends(require_admin_or_supermarket),
    db: AsyncSession = Depends(get_db),
):
    _ = admin_user
    result = await db.execute(
        select(RestockRequest).order_by(RestockRequest.created_at.desc())
    )
    items = list(result.scalars().all())
    total = len(items)
    return {
        "items": items,
        "total": total,
        "page": 1,
        "size": total,
        "pages": 1,
    }


@router.post("", response_model=RestockRequestOut, status_code=status.HTTP_201_CREATED)
async def create_restock_request(
    request_in: RestockRequestCreate,
    admin_user: dict = Depends(require_admin_or_supermarket),
    db: AsyncSession = Depends(get_db),
):
    _ = admin_user
    try:
        async with db.begin():
            item = await db.scalar(
                select(InventoryItem).where(InventoryItem.id == request_in.inventory_item_id)
            )
            if item is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Inventory item not found",
                )

            existing_open_request = await db.scalar(
                select(RestockRequest).where(
                    RestockRequest.inventory_item_id == request_in.inventory_item_id,
                    RestockRequest.status == "open",
                )
            )
            if existing_open_request is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An open restock request already exists for this inventory item",
                )

            request = RestockRequest(
                inventory_item_id=request_in.inventory_item_id,
                current_stock=request_in.current_stock,
                threshold=request_in.threshold,
                urgency=request_in.urgency,
                assigned_to_user_id=request_in.assigned_to_user_id,
                status="open",
            )
            db.add(request)
            await db.flush()
            await db.refresh(request)
            return request
    except HTTPException:
        raise
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Restock request conflict detected",
        ) from exc
    except Exception as exc:
        if is_database_unavailable_exception(exc):
            raise_database_unavailable_http_exception()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create restock request",
        ) from exc


@router.delete("/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
async def decline_restock_request(
    request_id: int,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    _ = admin_user
    try:
        async with db.begin():
            request = await db.scalar(
                select(RestockRequest).where(RestockRequest.id == request_id)
            )
            if request is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Restock request not found",
                )

            if request.status == "fulfilled":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Fulfilled request cannot be cancelled",
                )

            request.status = "cancelled"
            await db.flush()
            return None
    except HTTPException:
        raise
    except Exception as exc:
        if is_database_unavailable_exception(exc):
            raise_database_unavailable_http_exception()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel restock request",
        ) from exc


@router.post("/{request_id}/fulfil", response_model=RestockRequestOut)
async def fulfil_restock_request(
    request_id: int,
    fulfil_in: RestockRequestFulfil,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    _ = admin_user
    _ = fulfil_in.notes
    try:
        async with db.begin():
            request = await db.scalar(
                select(RestockRequest).where(RestockRequest.id == request_id)
            )
            if request is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Restock request not found",
                )

            if request.status == "cancelled":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Cancelled request cannot be fulfilled",
                )

            item = await db.scalar(
                select(InventoryItem).where(InventoryItem.id == request.inventory_item_id)
            )
            if item is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Inventory item not found",
                )

            replenish_quantity = max(request.threshold - request.current_stock, 1)
            db.add(
                InventoryLot(
                    inventory_item_id=item.id,
                    quantity=replenish_quantity,
                    received_date=date.today(),
                    expiry_date=date.today() + timedelta(days=365),
                    batch_reference=f"restock-request-{request.id}",
                )
            )

            request.status = "fulfilled"
            await db.flush()
            await db.refresh(request)
            return request
    except HTTPException:
        raise
    except Exception as exc:
        if is_database_unavailable_exception(exc):
            raise_database_unavailable_http_exception()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fulfil restock request",
        ) from exc
