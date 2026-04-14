from __future__ import annotations

from app.core.analytics_utils import is_bank_scoped_record as _is_bank_scoped_record
from app.core.security import get_admin_food_bank_id
from app.models.application import Application
from app.models.food_package import FoodPackage
from app.models.inventory_item import InventoryItem
from app.models.inventory_lot import InventoryLot
from app.services.stats_input_models import DashboardInputs, coerce_dashboard_inputs


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


def _bank_scoped_dashboard_inputs(inputs: DashboardInputs) -> DashboardInputs:
    return DashboardInputs(
        cash_donations=_filter_bank_scoped_records(inputs.cash_donations),
        goods_donations=_filter_bank_scoped_records(inputs.goods_donations),
        inventory_items=_filter_bank_scoped_records(inputs.inventory_items),
        inventory_lot_rows=_filter_bank_scoped_inventory_lot_rows(
            inputs.inventory_lot_rows
        ),
        packages=_filter_bank_scoped_records(inputs.packages),
        applications=_filter_bank_scoped_records(inputs.applications),
        distribution_snapshots=list(inputs.distribution_snapshots),
        waste_events=list(inputs.waste_events),
    )


def _filter_inventory_lot_rows_by_food_bank_id(
    rows: list[tuple[InventoryLot, InventoryItem]],
    food_bank_id: int,
) -> list[tuple[InventoryLot, InventoryItem]]:
    return [
        (lot, inventory_item)
        for lot, inventory_item in rows
        if getattr(inventory_item, "food_bank_id", food_bank_id) == food_bank_id
    ]


def _admin_scoped_dashboard_inputs(
    inputs: DashboardInputs,
    admin_food_bank_id: int,
) -> DashboardInputs:
    cash_donations = _filter_records_by_food_bank_id(
        inputs.cash_donations,
        admin_food_bank_id,
    )
    goods_donations = _filter_records_by_food_bank_id(
        inputs.goods_donations,
        admin_food_bank_id,
    )
    inventory_items = _filter_records_by_food_bank_id(
        inputs.inventory_items,
        admin_food_bank_id,
    )
    packages = _filter_records_by_food_bank_id(inputs.packages, admin_food_bank_id)
    applications = _filter_records_by_food_bank_id(
        inputs.applications,
        admin_food_bank_id,
    )
    inventory_lot_rows = _filter_inventory_lot_rows_by_food_bank_id(
        inputs.inventory_lot_rows,
        admin_food_bank_id,
    )

    scoped_application_ids = {application.id for application in applications}
    distribution_snapshots = [
        snapshot
        for snapshot in inputs.distribution_snapshots
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
        for waste_event in inputs.waste_events
        if (
            waste_event.inventory_item_id in scoped_inventory_item_ids
            or waste_event.inventory_lot_id in scoped_lot_ids
        )
    ]

    return DashboardInputs(
        cash_donations=cash_donations,
        goods_donations=goods_donations,
        inventory_items=inventory_items,
        inventory_lot_rows=inventory_lot_rows,
        packages=packages,
        applications=applications,
        distribution_snapshots=distribution_snapshots,
        waste_events=waste_events,
    )


def _scope_dashboard_inputs(
    inputs,
    admin_user: dict,
):
    scoped_inputs = _bank_scoped_dashboard_inputs(coerce_dashboard_inputs(inputs))
    admin_food_bank_id = get_admin_food_bank_id(admin_user)
    if admin_food_bank_id is None:
        return scoped_inputs

    return _admin_scoped_dashboard_inputs(scoped_inputs, admin_food_bank_id)
