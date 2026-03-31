"""
Pack service for handling food package assembly operations.

Spec § 6.3: Pack packages as independent management operation.
When admin receives donations and wants to prepare pre-assembled packages,
they call pack_package_transaction to atomically:
- Fetch package recipe (package_items)
- Deduct inventory from corresponding lots using FEFO (expiry_date ascending)
- Increase package stock
- Log operation (optional)
"""

from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.models.food_package import FoodPackage
from app.models.inventory_lot import InventoryLot
from app.models.package_item import PackageItem

async def pack_package_transaction(
    package_id: int,
    quantity: int,
    db: AsyncSession,
) -> dict:
    """
    Atomically pack (assemble) food packages.

    Workflow:
    1. Fetch package and validate it exists
    2. Fetch package recipe (package_items with their inventory_item references)
    3. For each recipe item, deduct required quantity from inventory lots
       using FEFO (First Expiry First Out - order by expiry_date ASC)
    4. Increase package.stock by quantity
    5. Commit transaction
    6. Return pack result (new stock, items consumed from lots)

    Args:
        package_id: ID of food package to pack
        quantity: Number of complete packages to assemble
        db: AsyncSession for database operations

    Returns:
        dict with:
        - package_id: ID of packed package
        - quantity: number of packages assembled
        - new_stock: updated package stock after packing
        - consumed_lots: list of {item_id, lot_id, quantity_used, remaining_quantity}
        - timestamp: operation timestamp

    Raises:
        ValueError: If package not found or stock insufficient for any ingredient
        Exception: On database errors
    """
    try:
        # Step 1: Fetch package and validate
        result = await db.execute(
            select(FoodPackage).where(FoodPackage.id == package_id)
        )
        package = result.scalar_one_or_none()

        if not package:
            raise ValueError(f"Package {package_id} not found")

        # Step 2: Fetch package recipe (package_items)
        result = await db.execute(
            select(PackageItem).where(PackageItem.package_id == package_id)
        )
        recipe_items = result.scalars().all()

        if not recipe_items:
            raise ValueError(f"Package {package_id} has no recipe items")

        # Track consumed lots for response
        consumed_lots = []

        # Step 3: For each recipe item, deduct from inventory lots (FEFO)
        for recipe_item in recipe_items:
            item_id = recipe_item.inventory_item_id
            required_per_package = recipe_item.quantity
            total_required = required_per_package * quantity

            # Query lots for this item ordered by expiry_date (FEFO)
            # Only include non-deleted, non-expired lots
            result = await db.execute(
                select(InventoryLot)
                .where(
                    InventoryLot.inventory_item_id == item_id,
                    InventoryLot.deleted_at.is_(None),  # active only
                    InventoryLot.expiry_date >= date.today(),  # non-expired only
                )
                .order_by(InventoryLot.expiry_date)  # FEFO: earliest expiry first
            )
            lots = result.scalars().all()

            if not lots:
                raise ValueError(
                    f"No available inventory for item {item_id} (required: {total_required})"
                )

            # Deduct from lots in FEFO order
            remaining_needed = total_required
            for lot in lots:
                if remaining_needed <= 0:
                    break

                available = lot.quantity
                to_deduct = min(available, remaining_needed)

                # Deduct from this lot
                lot.quantity -= to_deduct
                remaining_needed -= to_deduct

                # Track consumption for response
                consumed_lots.append({
                    "item_id": item_id,
                    "lot_id": lot.id,
                    "quantity_used": to_deduct,
                    "remaining_in_lot": lot.quantity,
                    "expiry_date": str(lot.expiry_date),
                    "batch_reference": lot.batch_reference,
                })

                # Mark empty lots as deleted (soft-delete)
                if lot.quantity == 0:
                    lot.deleted_at = datetime.utcnow()

            # Verify we had enough stock
            if remaining_needed > 0:
                raise ValueError(
                    f"Insufficient inventory for item {item_id}. "
                    f"Need: {total_required}, Available: {total_required - remaining_needed}"
                )

        # Step 4: Increase package stock
        package.stock += quantity

        # Step 5: Commit all changes
        await db.commit()
        await db.refresh(package)

        # Step 6: Return result
        return {
            "package_id": package.id,
            "package_name": package.name,
            "quantity": quantity,
            "new_stock": package.stock,
            "consumed_lots": consumed_lots,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except ValueError as exc:
        await db.rollback()
        raise
    except IntegrityError as exc:
        await db.rollback()
        raise ValueError("Database integrity error during packing") from exc
    except Exception as exc:
        await db.rollback()
        raise ValueError(f"Unexpected error during packing: {str(exc)}") from exc





































































































































































