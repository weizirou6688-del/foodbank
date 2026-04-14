from __future__ import annotations

from dataclasses import dataclass
from typing import TypeAlias


DashboardInputsTuple: TypeAlias = tuple[
    list[object],
    list[object],
    list[object],
    list[tuple[object, object]],
    list[object],
    list[object],
    list[object],
    list[object],
]

PublicImpactInputsTuple: TypeAlias = tuple[
    list[object],
    list[object],
    list[object],
    list[object],
]


@dataclass(slots=True)
class DashboardInputs:
    cash_donations: list[object]
    goods_donations: list[object]
    inventory_items: list[object]
    inventory_lot_rows: list[tuple[object, object]]
    packages: list[object]
    applications: list[object]
    distribution_snapshots: list[object]
    waste_events: list[object]


@dataclass(slots=True)
class PublicImpactInputs:
    goods_donations: list[object]
    packages: list[object]
    applications: list[object]
    distribution_snapshots: list[object]


def coerce_dashboard_inputs(
    value: DashboardInputs | DashboardInputsTuple,
) -> DashboardInputs:
    if isinstance(value, DashboardInputs):
        return value

    (
        cash_donations,
        goods_donations,
        inventory_items,
        inventory_lot_rows,
        packages,
        applications,
        distribution_snapshots,
        waste_events,
    ) = value
    return DashboardInputs(
        cash_donations=list(cash_donations),
        goods_donations=list(goods_donations),
        inventory_items=list(inventory_items),
        inventory_lot_rows=list(inventory_lot_rows),
        packages=list(packages),
        applications=list(applications),
        distribution_snapshots=list(distribution_snapshots),
        waste_events=list(waste_events),
    )


def coerce_public_impact_inputs(
    value: PublicImpactInputs | tuple[object, ...],
) -> PublicImpactInputs:
    if isinstance(value, PublicImpactInputs):
        return value

    if len(value) == 2:
        goods_donations, applications = value
        packages: list[object] = []
        distribution_snapshots: list[object] = []
    elif len(value) == 3:
        goods_donations, packages, applications = value
        distribution_snapshots = []
    elif len(value) == 4:
        goods_donations, packages, applications, distribution_snapshots = value
    else:
        raise ValueError(
            "Public impact inputs must contain 2, 3, or 4 collections."
        )

    return PublicImpactInputs(
        goods_donations=list(goods_donations),
        packages=list(packages),
        applications=list(applications),
        distribution_snapshots=list(distribution_snapshots),
    )
