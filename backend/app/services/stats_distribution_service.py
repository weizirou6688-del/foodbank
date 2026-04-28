from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime

from app.core.analytics_utils import as_utc_naive as _as_utc_naive
from app.core.analytics_utils import event_date as _event_date
from app.core.analytics_utils import in_period as _in_period
from app.models.application import Application
from app.models.application_distribution_snapshot import ApplicationDistributionSnapshot
from app.models.food_package import FoodPackage
from app.schemas.stats import DashboardVerificationRecordOut


@dataclass(frozen=True)
class ResolvedRedemptionCounts:
    resolved_count: int
    success_count: int


@dataclass(frozen=True)
class ApplicationDistributionSummary:
    package_quantity: int
    food_units: int
    snapshot_package_units_total: int
    snapshot_package_quantity_total: int
    package_categories: list[tuple[str, int]]


@dataclass(frozen=True)
class VerificationRecordEntry:
    sort_key: datetime
    record: DashboardVerificationRecordOut


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
    snapshots_by_application_id: dict[object, list[ApplicationDistributionSnapshot]] = {}
    for snapshot in distribution_snapshots:
        snapshots_by_application_id.setdefault(snapshot.application_id, []).append(snapshot)
    return snapshots_by_application_id


def _resolved_redemption_counts(
    applications: list[Application],
    start: date,
    end: date,
) -> ResolvedRedemptionCounts:
    window_applications = [
        application
        for application in applications
        if _in_period(_event_date(application.created_at), start, end)
    ]
    return ResolvedRedemptionCounts(
        resolved_count=sum(
            application.deleted_at is not None
            or application.status in {"expired", "collected"}
            for application in window_applications
        ),
        success_count=sum(
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
) -> ApplicationDistributionSummary:
    package_snapshots = [
        snapshot
        for snapshot in application_snapshots
        if snapshot.snapshot_type == "package"
    ]
    package_component_snapshots = [
        snapshot
        for snapshot in application_snapshots
        if snapshot.snapshot_type == "package_component"
    ]
    direct_item_snapshots = [
        snapshot
        for snapshot in application_snapshots
        if snapshot.snapshot_type == "direct_item"
    ]
    # 有 snapshot 就优先用 snapshot,因为 package recipe 和 inventory category
    # 在 application 提交之后可能会变。
    if (
        package_component_snapshots
        or direct_item_snapshots
        or (use_snapshot_packages and package_snapshots)
    ):
        package_quantity = sum(
            snapshot.requested_quantity for snapshot in package_snapshots
        )
        return ApplicationDistributionSummary(
            package_quantity=package_quantity,
            food_units=sum(
                snapshot.distributed_quantity
                for snapshot in package_component_snapshots + direct_item_snapshots
            ),
            snapshot_package_units_total=sum(
                (snapshot.recipe_unit_total or 0) * snapshot.requested_quantity
                for snapshot in package_snapshots
            ),
            snapshot_package_quantity_total=package_quantity,
            package_categories=[
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
    return ApplicationDistributionSummary(
        package_quantity=package_quantity,
        food_units=food_units,
        snapshot_package_units_total=0,
        snapshot_package_quantity_total=0,
        package_categories=package_categories,
    )


def _build_verification_record(
    application: Application,
    *,
    primary_timestamp: datetime | None,
    status: str,
    status_tone: str,
) -> VerificationRecordEntry:
    verification_timestamp = (
        _as_utc_naive(primary_timestamp)
        or _as_utc_naive(application.updated_at)
        or _as_utc_naive(application.created_at)
        or datetime.min
    )
    package_names = list(
        dict.fromkeys(
            item.package.name if item.package is not None else item.inventory_item.name
            for item in application.items
            if item.package is not None or item.inventory_item is not None
        )
    )
    return VerificationRecordEntry(
        sort_key=verification_timestamp,
        record=DashboardVerificationRecordOut(
            redemption_code=application.redemption_code,
            package_type=", ".join(package_names)
            if package_names
            else "Direct Item Support",
            verified_at=verification_timestamp.strftime("%Y-%m-%d %H:%M"),
            status=status,
            status_tone=status_tone,
        ),
    )
