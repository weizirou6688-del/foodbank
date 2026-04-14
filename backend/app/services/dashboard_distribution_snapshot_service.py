from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.application_distribution_snapshot import ApplicationDistributionSnapshot
from app.models.food_package import FoodPackage
from app.models.inventory_item import InventoryItem
from app.models.inventory_lot import InventoryLot
from app.models.inventory_waste_event import InventoryWasteEvent


def build_package_snapshot_rows(
    application_id: uuid.UUID,
    package: FoodPackage,
    requested_quantity: int,
    snapshot_created_at: datetime | None,
) -> list[ApplicationDistributionSnapshot]:
    recipe_unit_total = sum(package_item.quantity for package_item in package.package_items)
    package_fields = {
        "package_id": package.id,
        "package_name": package.name,
        "package_category": package.category,
    }
    rows = [
        ApplicationDistributionSnapshot(
            application_id=application_id,
            snapshot_type="package",
            **package_fields,
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
                **package_fields,
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
            build_package_snapshot_rows(
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
            ApplicationDistributionSnapshot(
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
    return (
        await db.scalar(
            select(InventoryWasteEvent.id).where(
                InventoryWasteEvent.inventory_lot_id == lot_id
            )
        )
        is not None
    )
