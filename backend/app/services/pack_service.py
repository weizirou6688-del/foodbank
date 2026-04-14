from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db_utils import fetch_one_or_none, fetch_scalars
from app.models.food_package import FoodPackage
from app.models.inventory_lot import InventoryLot
from app.models.package_item import PackageItem


async def pack_package_transaction(
    package_id: int,
    quantity: int,
    db: AsyncSession,
) -> dict:
    try:
        async with db.begin():
            package = await fetch_one_or_none(
                db,
                select(FoodPackage).where(FoodPackage.id == package_id),
            )
            if package is None:
                raise ValueError(f"Package {package_id} not found")

            recipe_items = await fetch_scalars(
                db,
                select(PackageItem).where(PackageItem.package_id == package_id),
            )
            if not recipe_items:
                raise ValueError(f"Package {package_id} has no recipe items")

            consumed_lots = []

            for recipe_item in recipe_items:
                item_id = recipe_item.inventory_item_id
                total_required = recipe_item.quantity * quantity
                lots = await fetch_scalars(
                    db,
                    select(InventoryLot)
                    .where(
                        InventoryLot.inventory_item_id == item_id,
                        InventoryLot.deleted_at.is_(None),
                        InventoryLot.expiry_date >= date.today(),
                    )
                    .order_by(InventoryLot.expiry_date),
                )
                if not lots:
                    raise ValueError(f"No available inventory for item {item_id} (required: {total_required})")

                remaining_needed = total_required
                for lot in lots:
                    if remaining_needed <= 0:
                        break

                    available = lot.quantity
                    to_deduct = min(available, remaining_needed)
                    remaining_in_lot = available - to_deduct
                    remaining_needed -= to_deduct

                    consumed_lots.append(
                        {
                            "item_id": item_id,
                            "lot_id": lot.id,
                            "quantity_used": to_deduct,
                            "remaining_in_lot": remaining_in_lot,
                            "expiry_date": str(lot.expiry_date),
                            "batch_reference": lot.batch_reference,
                        }
                    )

                    if remaining_in_lot == 0:
                        lot.deleted_at = datetime.now(timezone.utc)
                    else:
                        lot.quantity = remaining_in_lot

                if remaining_needed > 0:
                    raise ValueError(
                        f"Insufficient inventory for item {item_id}. "
                        f"Need: {total_required}, Available: {total_required - remaining_needed}"
                    )

            package.stock += quantity
        await db.refresh(package)

        return {
            "package_id": package.id,
            "package_name": package.name,
            "quantity": quantity,
            "new_stock": package.stock,
            "consumed_lots": consumed_lots,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except ValueError:
        raise
    except IntegrityError as exc:
        raise ValueError("Database integrity error during packing") from exc
    except Exception as exc:
        raise ValueError(f"Unexpected error during packing: {str(exc)}") from exc
