from __future__ import annotations

from app.core.analytics_utils import is_bank_scoped_record as _is_bank_scoped_record
from app.core.security import get_admin_food_bank_id
from app.models.application import Application
from app.models.food_package import FoodPackage
from app.models.inventory_item import InventoryItem
from app.models.inventory_lot import InventoryLot


def _filter_records_by_food_bank_id(records: list[object], food_bank_id: int) -> list[object]:
    return [
        record
        for record in records
        if getattr(record, "food_bank_id", food_bank_id) == food_bank_id
    ]


def _filter_bank_scoped_records(records: list[object]) -> list[object]:
    return [record for record in records if _is_bank_scoped_record(record)]


def _filter_bank_scoped_inventory_lot_rows(
    rows: list[tuple[InventoryLot, InventoryItem]],
) -> list[tuple[InventoryLot, InventoryItem]]:
    return [
        (lot, inventory_item)
        for lot, inventory_item in rows
        if _is_bank_scoped_record(inventory_item)
    ]


def _collect_scoped_inventory_item_ids(
    packages: list[FoodPackage],
    applications: list[Application],
) -> set[int]:
    return {
        int(item_id)
        for records in (
            (
                package_item.inventory_item_id
                for package in packages
                for package_item in package.package_items
            ),
            (
                application_item.inventory_item_id
                for application in applications
                for application_item in application.items
            ),
        )
        for item_id in records
        if item_id is not None
    }


def _scope_dashboard_inputs(
    inputs,
    admin_user: dict,
):
    (
        cash_donations,
        goods_donations,
        inventory_items,
        inventory_lot_rows,
        packages,
        applications,
        distribution_snapshots,
        waste_events,
    ) = inputs
    cash_donations, goods_donations, inventory_items, packages, applications = [
        _filter_bank_scoped_records(records)
        for records in (
            cash_donations,
            goods_donations,
            inventory_items,
            packages,
            applications,
        )
    ]
    inventory_lot_rows = _filter_bank_scoped_inventory_lot_rows(inventory_lot_rows)
    admin_food_bank_id = get_admin_food_bank_id(admin_user)
    if admin_food_bank_id is None:
        return (
            cash_donations,
            goods_donations,
            inventory_items,
            inventory_lot_rows,
            packages,
            applications,
            distribution_snapshots,
            waste_events,
        )

    cash_donations, goods_donations, inventory_items, packages, applications = [
        _filter_records_by_food_bank_id(records, admin_food_bank_id)
        for records in (
            cash_donations,
            goods_donations,
            inventory_items,
            packages,
            applications,
        )
    ]
    inventory_lot_rows = [
        (lot, inventory_item)
        for lot, inventory_item in inventory_lot_rows
        if getattr(inventory_item, "food_bank_id", admin_food_bank_id)
        == admin_food_bank_id
    ]
    scoped_application_ids = {application.id for application in applications}
    distribution_snapshots = [
        snapshot
        for snapshot in distribution_snapshots
        if snapshot.application_id in scoped_application_ids
    ]
    allowed_inventory_item_ids = {inventory_item.id for inventory_item in inventory_items}
    scoped_inventory_item_ids = (
        _collect_scoped_inventory_item_ids(packages, applications)
        & allowed_inventory_item_ids
    )
    inventory_items = [
        inventory_item
        for inventory_item in inventory_items
        if inventory_item.id in scoped_inventory_item_ids
    ]
    inventory_lot_rows = [
        (lot, inventory_item)
        for lot, inventory_item in inventory_lot_rows
        if lot.inventory_item_id in scoped_inventory_item_ids
    ]
    scoped_lot_ids = {lot.id for lot, _ in inventory_lot_rows}
    waste_events = [
        waste_event
        for waste_event in waste_events
        if (
            waste_event.inventory_item_id in scoped_inventory_item_ids
            or waste_event.inventory_lot_id in scoped_lot_ids
        )
    ]

    return (
        cash_donations,
        goods_donations,
        inventory_items,
        inventory_lot_rows,
        packages,
        applications,
        distribution_snapshots,
        waste_events,
    )
