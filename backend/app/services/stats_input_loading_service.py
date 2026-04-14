from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db_utils import fetch_rows as _fetch_rows
from app.core.db_utils import fetch_scalars as _fetch_scalars
from app.models.application import Application
from app.models.application_distribution_snapshot import ApplicationDistributionSnapshot
from app.models.application_item import ApplicationItem
from app.models.donation_cash import DonationCash
from app.models.donation_goods import DonationGoods
from app.models.food_package import FoodPackage
from app.models.inventory_item import InventoryItem
from app.models.inventory_lot import InventoryLot
from app.models.inventory_waste_event import InventoryWasteEvent
from app.models.package_item import PackageItem
from app.services.stats_input_scope_service import _filter_bank_scoped_records


async def _load_public_impact_inputs(
    db: AsyncSession,
    *,
    include_packages: bool = False,
    include_application_items: bool = False,
    include_snapshots: bool = False,
):
    application_query = select(Application).order_by(Application.created_at.asc())
    if include_application_items:
        application_query = application_query.options(
            selectinload(Application.items).selectinload(ApplicationItem.package),
            selectinload(Application.items).selectinload(ApplicationItem.inventory_item),
        )

    results: list[object] = []
    results.append(
        _filter_bank_scoped_records(
            await _fetch_scalars(
                db,
                select(DonationGoods)
                .options(selectinload(DonationGoods.items))
                .order_by(DonationGoods.created_at.asc()),
            )
        )
    )
    if include_packages:
        results.append(
            _filter_bank_scoped_records(
                await _fetch_scalars(
                    db,
                    select(FoodPackage)
                    .options(selectinload(FoodPackage.package_items))
                    .order_by(FoodPackage.name.asc()),
                )
            )
        )
    results.append(_filter_bank_scoped_records(await _fetch_scalars(db, application_query)))
    if include_snapshots:
        results.append(
            await _fetch_scalars(
                db,
                select(ApplicationDistributionSnapshot).order_by(
                    ApplicationDistributionSnapshot.created_at.asc(),
                    ApplicationDistributionSnapshot.id.asc(),
                ),
            )
        )
    return tuple(results)


async def _load_dashboard_inputs(db: AsyncSession):
    return (
        await _fetch_scalars(
            db,
            select(DonationCash).order_by(DonationCash.created_at.asc()),
        ),
        await _fetch_scalars(
            db,
            select(DonationGoods)
            .options(selectinload(DonationGoods.items))
            .order_by(DonationGoods.created_at.asc()),
        ),
        await _fetch_scalars(
            db,
            select(InventoryItem).order_by(InventoryItem.name.asc()),
        ),
        await _fetch_rows(
            db,
            select(InventoryLot, InventoryItem)
            .join(InventoryItem, InventoryItem.id == InventoryLot.inventory_item_id)
            .order_by(InventoryLot.expiry_date.asc(), InventoryLot.id.asc()),
        ),
        await _fetch_scalars(
            db,
            select(FoodPackage)
            .options(
                selectinload(FoodPackage.package_items).selectinload(
                    PackageItem.inventory_item
                )
            )
            .order_by(FoodPackage.name.asc()),
        ),
        await _fetch_scalars(
            db,
            select(Application)
            .options(
                selectinload(Application.items).selectinload(ApplicationItem.package),
                selectinload(Application.items).selectinload(
                    ApplicationItem.inventory_item
                ),
            )
            .order_by(Application.created_at.asc()),
        ),
        await _fetch_scalars(
            db,
            select(ApplicationDistributionSnapshot).order_by(
                ApplicationDistributionSnapshot.created_at.asc(),
                ApplicationDistributionSnapshot.id.asc(),
            ),
        ),
        await _fetch_scalars(
            db,
            select(InventoryWasteEvent).order_by(
                InventoryWasteEvent.occurred_at.asc(),
                InventoryWasteEvent.id.asc(),
            ),
        ),
    )
