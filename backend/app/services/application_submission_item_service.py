from __future__ import annotations

import uuid

from app.models.application_item import ApplicationItem
from app.models.food_package import FoodPackage


def apply_package_allocations(
    packages: dict[int, FoodPackage],
    requested_package_quantities: dict[int, int],
) -> None:
    for package_id, requested_quantity in requested_package_quantities.items():
        package = packages[package_id]
        package.stock -= requested_quantity
        package.applied_count += requested_quantity


def build_package_application_items(
    application_id: uuid.UUID,
    requested_package_quantities: dict[int, int],
) -> list[ApplicationItem]:
    return [
        ApplicationItem(
            application_id=application_id,
            package_id=package_id,
            quantity=requested_quantity,
        )
        for package_id, requested_quantity in requested_package_quantities.items()
    ]


def build_inventory_application_items(
    application_id: uuid.UUID,
    requested_inventory_quantities: dict[int, int],
) -> list[ApplicationItem]:
    return [
        ApplicationItem(
            application_id=application_id,
            inventory_item_id=inventory_item_id,
            quantity=requested_quantity,
        )
        for inventory_item_id, requested_quantity in requested_inventory_quantities.items()
    ]
