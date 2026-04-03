from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal
from app.models.application import Application
from app.models.application_distribution_snapshot import ApplicationDistributionSnapshot
from app.models.application_item import ApplicationItem
from app.models.food_package import FoodPackage
from app.models.inventory_item import InventoryItem
from app.models.inventory_lot import InventoryLot
from app.models.inventory_waste_event import InventoryWasteEvent
from app.models.package_item import PackageItem


def _build_package_snapshot_rows(
    application_id: uuid.UUID,
    package: FoodPackage,
    requested_quantity: int,
    snapshot_created_at: datetime | None,
) -> list[ApplicationDistributionSnapshot]:
    recipe_unit_total = sum(package_item.quantity for package_item in package.package_items)
    rows = [
        ApplicationDistributionSnapshot(
            application_id=application_id,
            snapshot_type="package",
            package_id=package.id,
            package_name=package.name,
            package_category=package.category,
            requested_quantity=requested_quantity,
            distributed_quantity=requested_quantity,
            recipe_unit_total=recipe_unit_total,
            created_at=snapshot_created_at,
        )
    ]

    for package_item in package.package_items:
        inventory_item = package_item.inventory_item
        if inventory_item is None:
            continue

        rows.append(
            ApplicationDistributionSnapshot(
                application_id=application_id,
                snapshot_type="package_component",
                package_id=package.id,
                package_name=package.name,
                package_category=package.category,
                inventory_item_id=inventory_item.id,
                inventory_item_name=inventory_item.name,
                inventory_item_category=inventory_item.category,
                inventory_item_unit=inventory_item.unit,
                requested_quantity=requested_quantity,
                quantity_per_package=package_item.quantity,
                distributed_quantity=requested_quantity * package_item.quantity,
                created_at=snapshot_created_at,
            )
        )

    return rows


def _build_direct_item_snapshot_row(
    application_id: uuid.UUID,
    inventory_item: InventoryItem,
    requested_quantity: int,
    snapshot_created_at: datetime | None,
) -> ApplicationDistributionSnapshot:
    return ApplicationDistributionSnapshot(
        application_id=application_id,
        snapshot_type="direct_item",
        inventory_item_id=inventory_item.id,
        inventory_item_name=inventory_item.name,
        inventory_item_category=inventory_item.category,
        inventory_item_unit=inventory_item.unit,
        requested_quantity=requested_quantity,
        distributed_quantity=requested_quantity,
        created_at=snapshot_created_at,
    )


async def record_application_distribution_snapshots(
    db: AsyncSession,
    application_id: uuid.UUID,
    requested_package_quantities: dict[int, int],
    packages_by_id: dict[int, FoodPackage],
    requested_inventory_quantities: dict[int, int],
    inventory_items_by_id: dict[int, InventoryItem],
    snapshot_created_at: datetime | None = None,
) -> None:
    rows: list[ApplicationDistributionSnapshot] = []

    for package_id, requested_quantity in requested_package_quantities.items():
        package = packages_by_id.get(package_id)
        if package is None:
            continue
        rows.extend(
            _build_package_snapshot_rows(
                application_id,
                package,
                requested_quantity,
                snapshot_created_at,
            )
        )

    for inventory_item_id, requested_quantity in requested_inventory_quantities.items():
        inventory_item = inventory_items_by_id.get(inventory_item_id)
        if inventory_item is None:
            continue
        rows.append(
            _build_direct_item_snapshot_row(
                application_id,
                inventory_item,
                requested_quantity,
                snapshot_created_at,
            )
        )

    if rows:
        db.add_all(rows)


def record_inventory_waste_event(
    db: AsyncSession,
    lot: InventoryLot,
    inventory_item: InventoryItem,
    quantity: int,
    reason: str,
    occurred_at: datetime | None = None,
) -> None:
    if quantity <= 0:
        return

    db.add(
        InventoryWasteEvent(
            inventory_lot_id=lot.id,
            inventory_item_id=inventory_item.id,
            item_name=inventory_item.name,
            item_category=inventory_item.category,
            item_unit=inventory_item.unit,
            quantity=quantity,
            reason=reason,
            batch_reference=lot.batch_reference,
            expiry_date=lot.expiry_date,
            occurred_at=occurred_at or datetime.now(timezone.utc),
        )
    )


async def lot_has_waste_event(db: AsyncSession, lot_id: int) -> bool:
    existing_event_id = await db.scalar(
        select(InventoryWasteEvent.id).where(InventoryWasteEvent.inventory_lot_id == lot_id)
    )
    return existing_event_id is not None


async def ensure_dashboard_history() -> None:
    async with AsyncSessionLocal() as db:
        changed = False

        applications_by_id = {
            application.id: application
            for application in (
                await db.execute(select(Application).order_by(Application.created_at.asc()))
            ).scalars().all()
        }

        existing_snapshots = list(
            (
                await db.execute(
                    select(ApplicationDistributionSnapshot).order_by(
                        ApplicationDistributionSnapshot.id.asc()
                    )
                )
            ).scalars().all()
        )
        existing_snapshot_application_ids: set[uuid.UUID] = set()
        for snapshot in existing_snapshots:
            existing_snapshot_application_ids.add(snapshot.application_id)
            application = applications_by_id.get(snapshot.application_id)
            if application is None:
                continue
            if snapshot.created_at != application.created_at:
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

        applications = list((await db.execute(applications_query)).scalars().all())

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
                        requested_inventory_quantities.get(item.inventory_item.id, 0) + item.quantity
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
            for lot_id in (
                await db.execute(
                    select(InventoryWasteEvent.inventory_lot_id).where(
                        InventoryWasteEvent.inventory_lot_id.is_not(None)
                    )
                )
            ).scalars().all()
            if lot_id is not None
        }

        deleted_lots = (
            await db.execute(
                select(InventoryLot, InventoryItem)
                .join(InventoryItem, InventoryItem.id == InventoryLot.inventory_item_id)
                .where(
                    InventoryLot.deleted_at.is_not(None),
                    InventoryLot.id.not_in(existing_waste_lot_ids) if existing_waste_lot_ids else True,
                )
            )
        ).all()

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
