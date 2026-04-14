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
from app.services.stats_input_models import DashboardInputs, PublicImpactInputs
from app.services.stats_input_scope_service import _filter_bank_scoped_records


_GOODS_DONATION_ITEM_OPTIONS = (selectinload(DonationGoods.items),)
_PACKAGE_ITEM_OPTIONS = (
    selectinload(FoodPackage.package_items).selectinload(PackageItem.inventory_item),
)
_APPLICATION_ITEM_OPTIONS = (
    selectinload(Application.items).selectinload(ApplicationItem.package),
    selectinload(Application.items).selectinload(ApplicationItem.inventory_item),
)


def _goods_donations_query():
    return (
        select(DonationGoods)
        .options(*_GOODS_DONATION_ITEM_OPTIONS)
        .order_by(DonationGoods.created_at.asc())
    )


def _packages_query():
    return (
        select(FoodPackage)
        .options(*_PACKAGE_ITEM_OPTIONS)
        .order_by(FoodPackage.name.asc())
    )


def _applications_query(*, include_items: bool = True):
    query = select(Application).order_by(Application.created_at.asc())
    if include_items:
        query = query.options(*_APPLICATION_ITEM_OPTIONS)
    return query


def _distribution_snapshots_query():
    return select(ApplicationDistributionSnapshot).order_by(
        ApplicationDistributionSnapshot.created_at.asc(),
        ApplicationDistributionSnapshot.id.asc(),
    )


async def _load_public_impact_inputs(
    db: AsyncSession,
    *,
    include_packages: bool = False,
    include_application_items: bool = False,
    include_snapshots: bool = False,
):
    goods_donations = _filter_bank_scoped_records(
        await _fetch_scalars(db, _goods_donations_query())
    )
    packages = (
        _filter_bank_scoped_records(await _fetch_scalars(db, _packages_query()))
        if include_packages
        else []
    )
    applications = _filter_bank_scoped_records(
        await _fetch_scalars(
            db,
            _applications_query(include_items=include_application_items),
        )
    )
    distribution_snapshots = (
        await _fetch_scalars(db, _distribution_snapshots_query())
        if include_snapshots
        else []
    )
    return PublicImpactInputs(
        goods_donations=goods_donations,
        packages=packages,
        applications=applications,
        distribution_snapshots=distribution_snapshots,
    )


async def _load_dashboard_inputs(db: AsyncSession):
    return DashboardInputs(
        cash_donations=await _fetch_scalars(
            db,
            select(DonationCash).order_by(DonationCash.created_at.asc()),
        ),
        goods_donations=await _fetch_scalars(db, _goods_donations_query()),
        inventory_items=await _fetch_scalars(
            db,
            select(InventoryItem).order_by(InventoryItem.name.asc()),
        ),
        inventory_lot_rows=await _fetch_rows(
            db,
            select(InventoryLot, InventoryItem)
            .join(InventoryItem, InventoryItem.id == InventoryLot.inventory_item_id)
            .order_by(InventoryLot.expiry_date.asc(), InventoryLot.id.asc()),
        ),
        packages=await _fetch_scalars(db, _packages_query()),
        applications=await _fetch_scalars(db, _applications_query()),
        distribution_snapshots=await _fetch_scalars(db, _distribution_snapshots_query()),
        waste_events=await _fetch_scalars(
            db,
            select(InventoryWasteEvent).order_by(
                InventoryWasteEvent.occurred_at.asc(),
                InventoryWasteEvent.id.asc(),
            ),
        ),
    )
