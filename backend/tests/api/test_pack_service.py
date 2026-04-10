"""Tests for pack_service functionality."""

from datetime import date, datetime

import pytest

from app.models.food_package import FoodPackage
from app.models.package_item import PackageItem
from app.models.inventory_item import InventoryItem
from app.models.inventory_lot import InventoryLot
from app.services.pack_service import pack_package_transaction
from tests.support import QueuedAsyncSession, utcnow


@pytest.mark.asyncio
async def test_pack_package_success_single_ingredient():
    """Test successful packing with single ingredient."""
    # Setup: Create package, recipe, and inventory lots
    package = FoodPackage(
        id=1,
        name="Basic Pack",
        category="Breakfast",
        stock=0,
        threshold=5,
        applied_count=0,
        food_bank_id=1,
        is_active=True,
        created_at=utcnow(),
    )

    recipe_item = PackageItem(
        id=1,
        package_id=1,
        inventory_item_id=10,
        quantity=5,  # 5 units per package
    )

    lot1 = InventoryLot(
        id=101,
        inventory_item_id=10,
        quantity=15,
        expiry_date=date(2026, 12, 31),
        received_date=date(2026, 1, 1),
        batch_reference="BATCH-001",
        created_at=datetime.now(),
        updated_at=datetime.now(),
        deleted_at=None,
    )

    db = QueuedAsyncSession()
    # Queue results for execute() calls:
    # 1. fetch package
    # 2. fetch recipe items
    # 3. fetch inventory lots for item 10
    db.add_execute_result([package])
    db.add_execute_result([recipe_item])
    db.add_execute_result([lot1])

    # Pack 2 packages: need 2 * 5 = 10 units
    result = await pack_package_transaction(1, 2, db)

    # Verify results
    assert result["package_id"] == 1
    assert result["quantity"] == 2
    assert result["new_stock"] == 2
    assert package.stock == 2
    assert lot1.quantity == 5  # 15 - 10 = 5
    assert lot1.deleted_at is None  # Not empty, not deleted
    assert db.committed is True
    assert len(result["consumed_lots"]) == 1
    assert result["consumed_lots"][0]["quantity_used"] == 10


@pytest.mark.asyncio
async def test_pack_package_uses_multiple_lots_fefo():
    """Test FEFO ordering: use earliest expiry lots first."""
    package = FoodPackage(
        id=1,
        name="Test Pack",
        category="Breakfast",
        stock=0,
        threshold=5,
        applied_count=0,
        food_bank_id=1,
        is_active=True,
        created_at=utcnow(),
    )

    recipe_item = PackageItem(
        id=1,
        package_id=1,
        inventory_item_id=20,
        quantity=10,  # 10 units per package
    )

    # Two lots: earlier expiry first
    lot1 = InventoryLot(
        id=201,
        inventory_item_id=20,
        quantity=5,
        expiry_date=date(2026, 6, 30),  # Earlier
        received_date=date(2026, 1, 1),
        batch_reference="BATCH-001",
        created_at=datetime.now(),
        updated_at=datetime.now(),
        deleted_at=None,
    )

    lot2 = InventoryLot(
        id=202,
        inventory_item_id=20,
        quantity=10,
        expiry_date=date(2026, 12, 31),  # Later
        received_date=date(2026, 2, 1),
        batch_reference="BATCH-002",
        created_at=datetime.now(),
        updated_at=datetime.now(),
        deleted_at=None,
    )

    db = QueuedAsyncSession()
    db.add_execute_result([package])
    db.add_execute_result([recipe_item])
    db.add_execute_result([lot1, lot2])  # Sorted by expiry_date

    # Pack 1 package: need 10 units
    # Should use: all 5 from lot1, 5 from lot2
    result = await pack_package_transaction(1, 1, db)

    assert result["new_stock"] == 1
    assert lot1.quantity == 5
    assert lot1.deleted_at is not None  # Soft-deleted (empty)
    assert lot2.quantity == 5  # 10 - 5 = 5
    assert len(result["consumed_lots"]) == 2
    assert result["consumed_lots"][0]["lot_id"] == 201
    assert result["consumed_lots"][0]["quantity_used"] == 5
    assert result["consumed_lots"][0]["remaining_in_lot"] == 0
    assert result["consumed_lots"][1]["lot_id"] == 202
    assert result["consumed_lots"][1]["quantity_used"] == 5


@pytest.mark.asyncio
async def test_pack_package_insufficient_inventory():
    """Test error when insufficient inventory."""
    package = FoodPackage(
        id=1,
        name="Test Pack",
        category="Breakfast",
        stock=0,
        threshold=5,
        applied_count=0,
        food_bank_id=1,
        is_active=True,
        created_at=utcnow(),
    )

    recipe_item = PackageItem(
        id=1,
        package_id=1,
        inventory_item_id=30,
        quantity=10,  # Need 10 units per package
    )

    lot1 = InventoryLot(
        id=301,
        inventory_item_id=30,
        quantity=5,  # Only 5 available
        expiry_date=date(2026, 12, 31),
        received_date=date(2026, 1, 1),
        batch_reference="BATCH-001",
        created_at=datetime.now(),
        updated_at=datetime.now(),
        deleted_at=None,
    )

    db = QueuedAsyncSession()
    db.add_execute_result([package])
    db.add_execute_result([recipe_item])
    db.add_execute_result([lot1])

    # Pack 1 package: need 10 units but only 5 available
    with pytest.raises(ValueError) as exc:
        await pack_package_transaction(1, 1, db)

    assert "Insufficient inventory" in str(exc.value)
    assert db.rolled_back is True


@pytest.mark.asyncio
async def test_pack_package_not_found():
    """Test error when package doesn't exist."""
    db = QueuedAsyncSession()
    db.add_execute_result([])  # No package found

    with pytest.raises(ValueError) as exc:
        await pack_package_transaction(999, 1, db)

    assert "not found" in str(exc.value)
    assert db.rolled_back is True


@pytest.mark.asyncio
async def test_pack_package_no_recipe():
    """Test error when package has no recipe items."""
    package = FoodPackage(
        id=1,
        name="Empty Pack",
        category="Breakfast",
        stock=0,
        threshold=5,
        applied_count=0,
        food_bank_id=1,
        is_active=True,
        created_at=utcnow(),
    )

    db = QueuedAsyncSession()
    db.add_execute_result([package])
    db.add_execute_result([])  # No recipe items

    with pytest.raises(ValueError) as exc:
        await pack_package_transaction(1, 1, db)

    assert "no recipe items" in str(exc.value)
    assert db.rolled_back is True


@pytest.mark.asyncio
async def test_pack_package_multiple_ingredients():
    """Test packing with multiple ingredients (complex recipe)."""
    package = FoodPackage(
        id=1,
        name="Complex Pack",
        category="Family Bundle",
        stock=0,
        threshold=5,
        applied_count=0,
        food_bank_id=1,
        is_active=True,
        created_at=utcnow(),
    )

    recipe_item1 = PackageItem(
        id=1,
        package_id=1,
        inventory_item_id=40,
        quantity=3,
    )

    recipe_item2 = PackageItem(
        id=2,
        package_id=1,
        inventory_item_id=41,
        quantity=2,
    )

    lot1 = InventoryLot(
        id=401,
        inventory_item_id=40,
        quantity=12,
        expiry_date=date(2026, 12, 31),
        received_date=date(2026, 1, 1),
        batch_reference="BATCH-001",
        created_at=datetime.now(),
        updated_at=datetime.now(),
        deleted_at=None,
    )

    lot2 = InventoryLot(
        id=402,
        inventory_item_id=41,
        quantity=10,
        expiry_date=date(2026, 12, 31),
        received_date=date(2026, 1, 1),
        batch_reference="BATCH-002",
        created_at=datetime.now(),
        updated_at=datetime.now(),
        deleted_at=None,
    )

    db = QueuedAsyncSession()
    db.add_execute_result([package])
    db.add_execute_result([recipe_item1, recipe_item2])
    db.add_execute_result([lot1])  # Lots for item 40
    db.add_execute_result([lot2])  # Lots for item 41

    # Pack 4 packages:
    # - Item 40: 4 * 3 = 12 units
    # - Item 41: 4 * 2 = 8 units
    result = await pack_package_transaction(1, 4, db)

    assert result["new_stock"] == 4
    assert lot1.quantity == 12  # Fully consumed lots stay positive when soft-deleted
    assert lot1.deleted_at is not None
    assert lot2.quantity == 2  # 10 - 8 = 2
    assert len(result["consumed_lots"]) == 2
    assert result["consumed_lots"][0]["remaining_in_lot"] == 0
