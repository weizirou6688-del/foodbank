from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.db_utils import fetch_one_or_none, fetch_scalars, flush_refresh
from app.core.database_errors import run_guarded_transaction
from app.core.security import require_admin, require_admin_or_supermarket
from app.models.inventory_item import InventoryItem
from app.models.inventory_lot import InventoryLot
from app.models.restock_request import RestockRequest
from app.routers._shared import (
    bank_scoped_clause,
    require_by_id,
    require_scoped_by_id,
    single_page_response,
)
from app.schemas.restock_request import (
    RestockRequestCreate,
    RestockRequestListResponse,
    RestockRequestOut,
)


router = APIRouter(tags=["Restock Requests"])
RESTOCK_REQUEST_OPTIONS = (selectinload(RestockRequest.inventory_item),)


def serialize_restock_request(
    request: RestockRequest,
    inventory_item: InventoryItem | None = None,
) -> RestockRequestOut:
    item = inventory_item or request.inventory_item
    return RestockRequestOut(
        id=request.id,
        inventory_item_id=request.inventory_item_id,
        inventory_item_name=item.name if item is not None else None,
        inventory_item_unit=item.unit if item is not None else None,
        current_stock=request.current_stock,
        threshold=request.threshold,
        stock_deficit=max(request.threshold - request.current_stock, 0),
        urgency=request.urgency,
        assigned_to_user_id=request.assigned_to_user_id,
        status=request.status,
        created_at=request.created_at,
    )


async def _get_restock_item(db: AsyncSession, inventory_item_id: int, admin_user: dict, *, detail: str) -> InventoryItem:
    return await require_scoped_by_id(
        db, InventoryItem, inventory_item_id, admin_user, detail=detail, not_found_detail="Inventory item not found",
    )


async def _get_restock_request_and_item(
    db: AsyncSession, request_id: int, admin_user: dict, *, detail: str,
) -> tuple[RestockRequest, InventoryItem]:
    request = await require_by_id(db, RestockRequest, request_id, detail="Restock request not found")
    return request, await _get_restock_item(db, request.inventory_item_id, admin_user, detail=detail)


@router.get("", response_model=RestockRequestListResponse)
async def list_restock_requests(
    admin_user: dict = Depends(require_admin_or_supermarket),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(RestockRequest)
        .join(InventoryItem, InventoryItem.id == RestockRequest.inventory_item_id)
        .options(*RESTOCK_REQUEST_OPTIONS)
        .order_by(RestockRequest.created_at.desc())
    )
    query = query.where(bank_scoped_clause(InventoryItem, admin_user))
    return single_page_response(
        [serialize_restock_request(request) for request in await fetch_scalars(db, query)]
    )


@router.post("", response_model=RestockRequestOut, status_code=status.HTTP_201_CREATED)
async def create_restock_request(
    request_in: RestockRequestCreate,
    admin_user: dict = Depends(require_admin_or_supermarket),
    db: AsyncSession = Depends(get_db),
):
    async def _action() -> RestockRequestOut:
        inventory_item = await _get_restock_item(
            db,
            request_in.inventory_item_id,
            admin_user,
            detail="You can only create restock requests for your assigned food bank",
        )

        existing_open_request = await fetch_one_or_none(
            db,
            select(RestockRequest).where(
                RestockRequest.inventory_item_id == request_in.inventory_item_id,
                RestockRequest.status == "open",
            ),
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
        created_request = await flush_refresh(db, request)
        return serialize_restock_request(created_request, inventory_item)

    return await run_guarded_transaction(
        db,
        _action,
        conflict_detail="Restock request conflict detected",
        failure_detail="Failed to create restock request",
    )


@router.delete("/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
async def decline_restock_request(
    request_id: int,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    async def _action() -> None:
        request, _ = await _get_restock_request_and_item(db, request_id, admin_user, detail="You can only manage restock requests for your assigned food bank")
        if request.status == "fulfilled":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Fulfilled request cannot be cancelled",
            )

        request.status = "cancelled"
        await db.flush()

    return await run_guarded_transaction(db, _action, failure_detail="Failed to cancel restock request")


@router.post("/{request_id}/fulfil", response_model=RestockRequestOut)
async def fulfil_restock_request(
    request_id: int,
    admin_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    async def _action() -> RestockRequestOut:
        request, item = await _get_restock_request_and_item(db, request_id, admin_user, detail="You can only manage restock requests for your assigned food bank")
        if request.status == "cancelled":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cancelled request cannot be fulfilled",
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
        return serialize_restock_request(await flush_refresh(db, request), item)

    return await run_guarded_transaction(db, _action, failure_detail="Failed to fulfil restock request")
