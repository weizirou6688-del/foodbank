from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal
from app.core.db_utils import fetch_rows, fetch_scalars
from app.models.application import Application
from app.models.application_distribution_snapshot import ApplicationDistributionSnapshot
from app.models.application_item import ApplicationItem
from app.models.food_package import FoodPackage
from app.models.inventory_item import InventoryItem
from app.models.inventory_lot import InventoryLot
from app.models.inventory_waste_event import InventoryWasteEvent
from app.models.package_item import PackageItem
from app.services.dashboard_distribution_snapshot_service import (
    record_application_distribution_snapshots,
    record_inventory_waste_event,
)


async def ensure_dashboard_history() -> None:
    async with AsyncSessionLocal() as db:
        changed = False

        applications_by_id = {
            application.id: application
            for application in await fetch_scalars(
                db,
                select(Application).order_by(Application.created_at.asc()),
            )
        }

        existing_snapshots = await fetch_scalars(
            db,
            select(ApplicationDistributionSnapshot).order_by(
                ApplicationDistributionSnapshot.id.asc()
            ),
        )
        existing_snapshot_application_ids = {
            snapshot.application_id for snapshot in existing_snapshots
        }
        for snapshot in existing_snapshots:
            application = applications_by_id.get(snapshot.application_id)
            if application is not None and snapshot.created_at != application.created_at:
                snapshot.created_at = application.created_at
                changed = True

        applications_query = (
            select(Application)
            .options(
                selectinload(Application.items)
                .selectinload(ApplicationItem.package)
                .selectinload(FoodPackage.package_items)
                .selectinload(PackageItem.inventory_item),
                selectinload(Application.items).selectinload(ApplicationItem.inventory_item),
            )
            .order_by(Application.created_at.asc())
        )
        if existing_snapshot_application_ids:
            applications_query = applications_query.where(
                Application.id.not_in(existing_snapshot_application_ids)
            )

        applications = await fetch_scalars(db, applications_query)

        for application in applications:
            requested_package_quantities: dict[int, int] = {}
            packages_by_id: dict[int, FoodPackage] = {}
            requested_inventory_quantities: dict[int, int] = {}
            inventory_items_by_id: dict[int, InventoryItem] = {}

            for item in application.items:
                if item.package is not None:
                    requested_package_quantities[item.package.id] = (
                        requested_package_quantities.get(item.package.id, 0) + item.quantity
                    )
                    packages_by_id[item.package.id] = item.package
                elif item.inventory_item is not None:
                    requested_inventory_quantities[item.inventory_item.id] = (
                        requested_inventory_quantities.get(item.inventory_item.id, 0)
                        + item.quantity
                    )
                    inventory_items_by_id[item.inventory_item.id] = item.inventory_item

            await record_application_distribution_snapshots(
                db,
                application.id,
                requested_package_quantities,
                packages_by_id,
                requested_inventory_quantities,
                inventory_items_by_id,
                snapshot_created_at=application.created_at,
            )
            if requested_package_quantities or requested_inventory_quantities:
                changed = True

        existing_waste_lot_ids = {
            lot_id
            for lot_id in await fetch_scalars(
                db,
                select(InventoryWasteEvent.inventory_lot_id).where(
                    InventoryWasteEvent.inventory_lot_id.is_not(None)
                ),
            )
            if lot_id is not None
        }

        deleted_lots = await fetch_rows(
            db,
            select(InventoryLot, InventoryItem)
            .join(InventoryItem, InventoryItem.id == InventoryLot.inventory_item_id)
            .where(
                InventoryLot.deleted_at.is_not(None),
                InventoryLot.id.not_in(existing_waste_lot_ids)
                if existing_waste_lot_ids
                else True,
            ),
        )

        for lot, inventory_item in deleted_lots:
            record_inventory_waste_event(
                db,
                lot,
                inventory_item,
                lot.quantity,
                "manual_waste",
                occurred_at=lot.deleted_at,
            )
            changed = True

        if changed:
            await db.commit()
