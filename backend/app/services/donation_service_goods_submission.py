from __future__ import annotations

from datetime import date, timedelta

from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database_errors import run_guarded_transaction
from app.core.goods_donation_format import parse_goods_pickup_date
from app.models.donation_goods import DonationGoods
from app.models.user import User
from app.routers._shared import require_by_id
from app.schemas.donation_goods import DonationGoodsCreate, SupermarketDonationCreate
from app.services.donation_service_common import (
    create_goods_donation,
    ensure_pending_goods_pickup_date_is_not_past,
)
from app.services.donation_service_goods_notifications import queue_goods_emails
from app.services.donation_service_inventory_support import (
    append_goods_donation_items,
    goods_donation_item,
    inventory_lot,
    resolve_supermarket_inventory_item,
    sync_goods_donation_inventory,
    sync_supermarket_restock_requests,
)
from app.services.donation_service_resolvers import (
    require_goods_donation,
    resolve_food_bank,
    resolve_selected_food_bank_for_goods_donation,
)


async def submit_goods_donation(
    donation_in: DonationGoodsCreate,
    background_tasks: BackgroundTasks,
    current_user: dict | None,
    db: AsyncSession,
) -> DonationGoods:
    resolved_status = donation_in.status or "pending"
    ensure_pending_goods_pickup_date_is_not_past(
        donation_in.pickup_date,
        resolved_status,
    )

    async def action() -> DonationGoods:
        selected_food_bank = await resolve_selected_food_bank_for_goods_donation(
            donation_in,
            current_user,
            db,
        )
        donation = await create_goods_donation(
            db,
            selected_food_bank=selected_food_bank,
            fallback_name=donation_in.food_bank_name,
            fallback_address=donation_in.food_bank_address,
            donor_user_id=donation_in.donor_user_id,
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
        created_items = await append_goods_donation_items(donation, donation_in.items, db)
        if resolved_status == "received":
            await sync_goods_donation_inventory(donation, db, created_items)

        queue_goods_emails(background_tasks, donation_in, selected_food_bank)
        return await require_goods_donation(db, donation.id)

    return await run_guarded_transaction(
        db,
        action,
        conflict_detail="Goods donation conflict detected",
        failure_detail="Failed to submit goods donation",
    )


async def submit_supermarket_goods_donation(
    donation_in: SupermarketDonationCreate,
    current_user: dict,
    db: AsyncSession,
) -> DonationGoods:
    async def action() -> DonationGoods:
        supermarket_user = await require_by_id(
            db,
            User,
            current_user.get("sub"),
            detail="Authenticated supermarket user not found",
        )
        resolved_items = [
            (item, await resolve_supermarket_inventory_item(item, db))
            for item in donation_in.items
        ]
        scoped_food_bank_ids = {
            int(inventory_item.food_bank_id) for _, inventory_item in resolved_items
        }
        if len(scoped_food_bank_ids) != 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="All supermarket donation items must belong to the same food bank",
            )

        selected_food_bank = await resolve_food_bank(scoped_food_bank_ids.pop(), db)
        donation = await create_goods_donation(
            db,
            selected_food_bank=selected_food_bank,
            donor_user_id=supermarket_user.id,
            donor_name=supermarket_user.name,
            donor_type="supermarket",
            donor_email=supermarket_user.email,
            donor_phone=donation_in.donor_phone or "00000000000",
            pickup_date=donation_in.pickup_date,
            notes=donation_in.notes,
            status="received",
        )

        received_date = parse_goods_pickup_date(donation.pickup_date) or date.today()
        touched_inventory_item_ids = {inventory_item.id for _, inventory_item in resolved_items}
        db.add_all(
            [
                goods_donation_item(
                    donation,
                    item_name=inventory_item.name,
                    quantity=item.quantity,
                    expiry_date=item.expiry_date,
                )
                for item, inventory_item in resolved_items
            ],
        )
        db.add_all(
            [
                inventory_lot(
                    inventory_item_id=inventory_item.id,
                    quantity=item.quantity,
                    received_date=received_date,
                    expiry_date=item.expiry_date or (received_date + timedelta(days=365)),
                    batch_reference=f"supermarket-donation-{donation.id}",
                )
                for item, inventory_item in resolved_items
            ],
        )

        await db.flush()
        await sync_supermarket_restock_requests(touched_inventory_item_ids, db)
        return await require_goods_donation(db, donation.id)

    return await run_guarded_transaction(
        db,
        action,
        conflict_detail="Supermarket donation conflict detected",
        failure_detail="Failed to submit supermarket donation",
    )
