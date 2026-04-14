from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db_utils import fetch_scalars
from app.core.security import get_admin_food_bank_id
from app.models.donation_cash import DonationCash
from app.models.donation_goods import DonationGoods
from app.routers._shared import bank_scoped_clause
from app.schemas.donation_cash import DonationCashOut
from app.schemas.donation_goods import DonationGoodsOut
from app.services.donation_service_resolvers import GOODS_DONATION_OPTIONS


async def list_donations(
    type: str | None,
    admin_user: dict,
    db: AsyncSession,
) -> list[dict]:
    normalized = type.lower() if type else None
    if normalized not in (None, "cash", "goods"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="type must be one of: cash, goods",
        )

    platform_admin = get_admin_food_bank_id(admin_user) is None
    response: list[dict] = []
    query_specs = [
        (
            "cash",
            normalized in (None, "cash"),
            select(DonationCash)
            .where(bank_scoped_clause(DonationCash, admin_user))
            .order_by(DonationCash.created_at.desc()),
            DonationCashOut,
        ),
        (
            "goods",
            normalized in (None, "goods"),
            select(DonationGoods)
            .options(*GOODS_DONATION_OPTIONS)
            .where(bank_scoped_clause(DonationGoods, admin_user))
            .order_by(DonationGoods.created_at.desc()),
            DonationGoodsOut,
        ),
    ]
    for donation_type, enabled, query, schema in query_specs:
        if not enabled:
            continue
        rows = await fetch_scalars(db, query)
        if platform_admin:
            rows = [row for row in rows if getattr(row, "food_bank_id", None) is not None]
        response.extend(
            {**schema.model_validate(row).model_dump(mode="json"), "donation_type": donation_type}
            for row in rows
        )

    response.sort(key=lambda donation: donation.get("created_at", ""), reverse=True)
    return response
