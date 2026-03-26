"""Integration tests for pack_package endpoint."""

from datetime import date, datetime
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import pytest
from fastapi import HTTPException, status

from app.models.food_package import FoodPackage
from app.models.package_item import PackageItem
from app.models.inventory_lot import InventoryLot
from app.routers.food_packages import pack_package
from app.schemas.food_package import PackRequest


class MockAsyncSession:
    """Mock database session for integration testing."""

    def __init__(self):
        self.packages = {}
        self.package_items = {}
        self.inventory_lots = {}
        self.committed = False
        self.rolled_back = False
        self.execute_queue = []

    def add_execute_result(self, result_rows):
        """Queue results for execute() calls."""
        self.execute_queue.append(result_rows)

    async def execute(self, query):
        """Simulate db.execute()."""
        if self.execute_queue:
            return _ExecuteResult(self.execute_queue.pop(0))
        return _ExecuteResult([])

    async def flush(self):
        pass

    async def refresh(self, obj):
        pass

    async def commit(self):
        self.committed = True

    async def rollback(self):
        self.rolled_back = True


class _ExecuteResult:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return _ScalarResult(self._rows)

    def scalar_one_or_none(self):
        return self._rows[0] if self._rows else None


class _ScalarResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


@pytest.mark.asyncio
async def test_pack_package_endpoint_success():
    """Test pack_package endpoint successfully packs a package."""
    # Setup test data
    package = FoodPackage(
        id=1,
        name="Test Pack",
        category="Breakfast",
        stock=0,
        threshold=5,
        applied_count=0,
        food_bank_id=1,
        is_active=True,
        created_at=datetime.utcnow(),
    )

    recipe_item = PackageItem(
        id=1,
        package_id=1,
        inventory_item_id=10,
        quantity=5,
    )

    lot1 = InventoryLot(
        id=101,
        inventory_item_id=10,
        quantity=20,
        expiry_date=date(2026, 12, 31),
        received_date=date(2026, 1, 1),
        batch_reference="BATCH-001",
        created_at=datetime.now(),
        updated_at=datetime.now(),
        deleted_at=None,
    )

    db = MockAsyncSession()
    db.add_execute_result([package])
    db.add_execute_result([recipe_item])
    db.add_execute_result([lot1])

    admin_user = {"role": "admin", "id": 1}
    pack_request = PackRequest(quantity=2)

    # Call endpoint
    response = await pack_package(
        package_id=1,
        pack_in=pack_request,
        admin_user=admin_user,
        db=db,
    )

    # Assertions
    assert response.package_id == 1
    assert response.package_name == "Test Pack"
    assert response.quantity == 2
    assert response.new_stock == 2
    assert len(response.consumed_lots) == 1
    assert response.consumed_lots[0].quantity_used == 10
    assert db.committed is True


@pytest.mark.asyncio
async def test_pack_package_endpoint_insufficient_inventory():
    """Test pack_package endpoint returns 400 when inventory insufficient."""
    package = FoodPackage(
        id=1,
        name="Test Pack",
        category="Breakfast",
        stock=0,
        threshold=5,
        applied_count=0,
        food_bank_id=1,
        is_active=True,
        created_at=datetime.utcnow(),
    )

    recipe_item = PackageItem(
        id=1,
        package_id=1,
        inventory_item_id=10,
        quantity=10,  # Need 10 per package
    )

    lot1 = InventoryLot(
        id=101,
        inventory_item_id=10,
        quantity=5,  # Only 5 available
        expiry_date=date(2026, 12, 31),
        received_date=date(2026, 1, 1),
        batch_reference="BATCH-001",
        created_at=datetime.now(),
        updated_at=datetime.now(),
        deleted_at=None,
    )

    db = MockAsyncSession()
    db.add_execute_result([package])
    db.add_execute_result([recipe_item])
    db.add_execute_result([lot1])

    admin_user = {"role": "admin", "id": 1}
    pack_request = PackRequest(quantity=1)

    # Call endpoint - should raise HTTPException
    with pytest.raises(HTTPException) as exc:
        await pack_package(
            package_id=1,
            pack_in=pack_request,
            admin_user=admin_user,
            db=db,
        )

    assert exc.value.status_code == status.HTTP_400_BAD_REQUEST
    assert db.rolled_back is True


@pytest.mark.asyncio
async def test_pack_package_endpoint_not_found():
    """Test pack_package endpoint returns 404 when package not found."""
    db = MockAsyncSession()
    db.add_execute_result([])  # No package

    admin_user = {"role": "admin", "id": 1}
    pack_request = PackRequest(quantity=1)

    # Call endpoint - should raise HTTPException
    with pytest.raises(HTTPException) as exc:
        await pack_package(
            package_id=999,
            pack_in=pack_request,
            admin_user=admin_user,
            db=db,
        )

    assert exc.value.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.asyncio
async def test_pack_package_endpoint_fefo_ordering():
    """Test pack_package endpoint respects FEFO ordering."""
    package = FoodPackage(
        id=1,
        name="Test Pack",
        category="Breakfast",
        stock=0,
        threshold=5,
        applied_count=0,
        food_bank_id=1,
        is_active=True,
        created_at=datetime.utcnow(),
    )

    recipe_item = PackageItem(
        id=1,
        package_id=1,
        inventory_item_id=10,
        quantity=5,
    )

    # Two lots with different expiry dates
    lot1 = InventoryLot(
        id=101,
        inventory_item_id=10,
        quantity=3,
        expiry_date=date(2026, 6, 30),  # Earlier expiry
        received_date=date(2026, 1, 1),
        batch_reference="BATCH-001",
        created_at=datetime.now(),
        updated_at=datetime.now(),
        deleted_at=None,
    )

    lot2 = InventoryLot(
        id=102,
        inventory_item_id=10,
        quantity=7,
        expiry_date=date(2026, 12, 31),  # Later expiry
        received_date=date(2026, 2, 1),
        batch_reference="BATCH-002",
        created_at=datetime.now(),
        updated_at=datetime.now(),
        deleted_at=None,
    )

    db = MockAsyncSession()
    db.add_execute_result([package])
    db.add_execute_result([recipe_item])
    db.add_execute_result([lot1, lot2])  # Sorted by expiry_date

    admin_user = {"role": "admin", "id": 1}
    pack_request = PackRequest(quantity=1)

    # Call endpoint
    response = await pack_package(
        package_id=1,
        pack_in=pack_request,
        admin_user=admin_user,
        db=db,
    )

    # Verify FEFO: lot1 consumed first (earlier expiry)
    assert response.quantity == 1
    assert response.new_stock == 1
    assert len(response.consumed_lots) == 2
    
    # First entry should be from lot1
    assert response.consumed_lots[0].lot_id == 101
    assert response.consumed_lots[0].quantity_used == 3
    
    # Second entry should be from lot2
    assert response.consumed_lots[1].lot_id == 102
    assert response.consumed_lots[1].quantity_used == 2
    
    # Verify soft-delete of empty lot
    assert lot1.deleted_at is not None
    assert lot2.deleted_at is None
