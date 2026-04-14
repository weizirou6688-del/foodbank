from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database_errors import run_guarded_transaction
from app.core.security import enforce_admin_food_bank_scope
from app.models.donation_goods import DonationGoods
from app.schemas.donation_goods import DonationGoodsUpdate
from app.services.donation_service_common import (
    delete_donation,
    ensure_pending_goods_pickup_date_is_not_past,
    require_update_fields,
)
from app.services.donation_service_inventory_support import (
    replace_goods_donation_items,
    sync_goods_donation_inventory,
)
from app.services.donation_service_resolvers import (
    require_admin_goods_donation,
    require_goods_donation,
    resolve_food_bank,
)


async def update_goods_donation(
    donation_id: uuid.UUID,
    donation_in: DonationGoodsUpdate,
    admin_user: dict,
    db: AsyncSession,
) -> DonationGoods:
    updates = donation_in.model_dump(exclude_unset=True, exclude={"items"})
    items_payload = donation_in.items if "items" in donation_in.model_fields_set else None
    require_update_fields(bool(updates) or items_payload is not None)

    async def action() -> DonationGoods:
        donation = await require_admin_goods_donation(
            db,
            donation_id,
            admin_user,
            detail="You can only manage goods donations for your assigned food bank",
        )

        previous_status = donation.status
        if "food_bank_id" in donation_in.model_fields_set:
            enforce_admin_food_bank_scope(
                admin_user,
                donation_in.food_bank_id,
                detail="You can only assign goods donations to your own food bank",
            )
            if donation_in.food_bank_id is not None:
                selected_food_bank = await resolve_food_bank(donation_in.food_bank_id, db)
                updates["food_bank_id"] = selected_food_bank.id
                updates["food_bank_name"] = selected_food_bank.name
                updates["food_bank_address"] = selected_food_bank.address
            else:
                updates["food_bank_name"] = None
                updates["food_bank_address"] = None

        resulting_status = updates.get("status", donation.status)
        resulting_pickup_date = updates.get("pickup_date", donation.pickup_date)
        if (
            "pickup_date" in donation_in.model_fields_set
            or ("status" in donation_in.model_fields_set and resulting_status == "pending")
        ):
            ensure_pending_goods_pickup_date_is_not_past(
                resulting_pickup_date,
                resulting_status,
            )

        for field_name, value in updates.items():
            setattr(donation, field_name, value)

        if items_payload is not None:
            await replace_goods_donation_items(donation, items_payload, db)
        if previous_status != "received" and donation.status == "received":
            await sync_goods_donation_inventory(donation, db)

        await db.flush()
        return await require_goods_donation(db, donation_id)

    return await run_guarded_transaction(
        db,
        action,
        conflict_detail="Goods donation conflict detected",
        failure_detail="Failed to update goods donation",
    )


async def delete_goods_donation(
    donation_id: uuid.UUID,
    admin_user: dict,
    db: AsyncSession,
) -> None:
    return await delete_donation(
        db,
        lambda: require_admin_goods_donation(
            db,
            donation_id,
            admin_user,
            detail="You can only delete goods donations for your assigned food bank",
        ),
        failure_detail="Failed to delete goods donation",
    )
