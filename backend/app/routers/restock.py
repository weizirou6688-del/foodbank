"""
Restock request management routes.

Spec § 2.7: GET (list), POST (create), DELETE /:id (decline), POST /:id/fulfil
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_admin
from app.models.inventory_item import InventoryItem
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
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    List all restock requests (admin only).
    
    Spec § 2.7: GET /restock-requests (requires admin).
    
    Returns: All requests with status (pending, fulfilled, declined)
    
    TODO: Query all RestockRequest records, ordered by created date
    """
    _ = admin_user
    result = await db.execute(
        select(RestockRequest).order_by(RestockRequest.created_at.desc())
    )
    items = list(result.scalars().all())
    total = len(items)
    # TODO: 实现真实分页
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
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Submit restock request (admin only).
    
    Spec § 2.7: POST /restock-requests (requires admin).
    
    RestockRequestCreate includes:
    - inventory_item_id: int
    - requested_quantity: int (target stock level)
    - priority: str ("low", "medium", "high")
    - notes: Optional
    
    TODO: Create RestockRequest with status=pending
    """
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
    """
    Decline restock request (admin only).
    
    Spec § 2.7: DELETE /restock-requests/:id (requires admin).
    
    Sets status=declined.
    
    TODO: Mark request as declined
    """
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
    """
    Mark restock request as fulfilled (admin only).
    
    Spec § 2.7: POST /restock-requests/:id/fulfil (requires admin).
    
    RestockRequestFulfil includes:
    - notes: Optional (confirmation notes)
    
    Sets status=fulfilled and updates fulfil_date=now().
    
    TODO: Mark request fulfilled, optionally update inventory
    """
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

            if item.stock < request.threshold:
                item.stock = request.threshold

            request.status = "fulfilled"
            await db.flush()
            await db.refresh(request)
            return request
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fulfil restock request",
        ) from exc
