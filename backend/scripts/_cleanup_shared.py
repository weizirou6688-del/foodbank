"""破坏性维护脚本和清理预览共用的辅助函数。"""

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import func, select

from app.core.db_utils import fetch_rows, fetch_scalars
from app.models.application_item import ApplicationItem
from app.models.food_package import FoodPackage


async def count_rows(db, stmt) -> int:
    return int((await db.scalar(stmt)) or 0)


def preview_values(values: list[str], *, limit: int) -> str:
    text = ", ".join(values[:limit])
    if len(values) > limit:
        return f"{text}, ..."
    return text


async def sync_food_package_applied_counts(
    db,
    packages: Sequence[FoodPackage] | None = None,
) -> list[FoodPackage]:
    # 清理脚本会批量删申请记录,所以套餐计数器从剩下的 ApplicationItem
    # 重新算一遍,而不是临时去减
    package_totals = {
        int(package_id): int(total_quantity or 0)
        for package_id, total_quantity in await fetch_rows(
            db,
            select(
                ApplicationItem.package_id,
                func.coalesce(func.sum(ApplicationItem.quantity), 0),
            )
            .where(ApplicationItem.package_id.is_not(None))
            .group_by(ApplicationItem.package_id)
        )
        if package_id is not None
    }
    resolved_packages = list(packages) if packages is not None else await fetch_scalars(
        db,
        select(FoodPackage),
    )
    for package in resolved_packages:
        package.applied_count = package_totals.get(int(package.id), 0)
    return resolved_packages
