from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime

from app.core.analytics_utils import as_utc_naive as _as_utc_naive
from app.core.analytics_utils import event_date as _event_date
from app.core.analytics_utils import in_period as _in_period
from app.models.application import Application
from app.models.application_distribution_snapshot import ApplicationDistributionSnapshot
from app.models.food_package import FoodPackage
from app.schemas.stats import DashboardVerificationRecordOut


def _package_display_name(application: Application) -> str:
    unique_names = list(
        dict.fromkeys(
            item.package.name if item.package is not None else item.inventory_item.name
            for item in application.items
            if item.package is not None or item.inventory_item is not None
        )
    )
    return ", ".join(unique_names) if unique_names else "Direct Item Support"


def _package_recipe_units(packages: list[FoodPackage]) -> dict[int, int]:
    return {
        package.id: sum(
            package_item.quantity for package_item in package.package_items
        )
        for package in packages
    }


def _group_distribution_snapshots(
    distribution_snapshots: list[ApplicationDistributionSnapshot],
) -> dict[object, list[ApplicationDistributionSnapshot]]:
    snapshots_by_application_id: dict[object, list[ApplicationDistributionSnapshot]] = (
        defaultdict(list)
    )
    for snapshot in distribution_snapshots:
        snapshots_by_application_id[snapshot.application_id].append(snapshot)
    return snapshots_by_application_id


def _resolved_redemption_counts(
    applications: list[Application],
    start: date,
    end: date,
) -> tuple[int, int]:
    window_applications = [
        application
        for application in applications
        if _in_period(_event_date(application.created_at), start, end)
    ]
    return (
        sum(
            application.deleted_at is not None
            or application.status in {"expired", "collected"}
            for application in window_applications
        ),
        sum(
            application.deleted_at is None and application.status == "collected"
            for application in window_applications
        ),
    )


def _application_distribution_summary(
    application: Application,
    application_snapshots: list[ApplicationDistributionSnapshot],
    package_recipe_units: dict[int, int],
    *,
    use_snapshot_packages: bool = False,
) -> tuple[int, int, int, int, list[tuple[str, int]]]:
    snapshot_groups: dict[str, list[ApplicationDistributionSnapshot]] = defaultdict(list)
    for snapshot in application_snapshots:
        snapshot_groups[snapshot.snapshot_type].append(snapshot)
    package_snapshots = snapshot_groups["package"]
    if (
        snapshot_groups["package_component"]
        or snapshot_groups["direct_item"]
        or (use_snapshot_packages and package_snapshots)
    ):
        package_quantity = sum(
            snapshot.requested_quantity for snapshot in package_snapshots
        )
        return (
            package_quantity,
            sum(
                snapshot.distributed_quantity
                for snapshot_type in ("package_component", "direct_item")
                for snapshot in snapshot_groups[snapshot_type]
            ),
            sum(
                (snapshot.recipe_unit_total or 0) * snapshot.requested_quantity
                for snapshot in package_snapshots
            ),
            package_quantity,
            [
                (
                    snapshot.package_category or "Uncategorized",
                    snapshot.requested_quantity,
                )
                for snapshot in package_snapshots
            ],
        )

    package_quantity = 0
    food_units = 0
    package_categories: list[tuple[str, int]] = []
    for item in application.items:
        if item.package_id is not None:
            package_quantity += item.quantity
            food_units += package_recipe_units.get(item.package_id, 0) * item.quantity
            if item.package is not None:
                package_categories.append(
                    (item.package.category or "Uncategorized", item.quantity)
                )
        elif item.inventory_item_id is not None:
            food_units += item.quantity
    return package_quantity, food_units, 0, 0, package_categories


def _build_verification_record(
    application: Application,
    *,
    primary_timestamp: datetime | None,
    status: str,
    status_tone: str,
) -> tuple[datetime, DashboardVerificationRecordOut]:
    verification_timestamp = (
        _as_utc_naive(primary_timestamp)
        or _as_utc_naive(application.updated_at)
        or _as_utc_naive(application.created_at)
        or datetime.min
    )
    return verification_timestamp, DashboardVerificationRecordOut(
        redemption_code=application.redemption_code,
        package_type=_package_display_name(application),
        verified_at=verification_timestamp.strftime("%Y-%m-%d %H:%M"),
        status=status,
        status_tone=status_tone,
    )