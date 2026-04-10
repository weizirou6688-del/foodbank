import pytest
from fastapi import HTTPException

from app.models.food_package import FoodPackage
from app.models.inventory_item import InventoryItem
from app.models.package_item import PackageItem
from app.routers.food_packages import (
    list_packages_for_bank,
    get_package_details,
    create_package,
    update_package,
    delete_package,
)
from app.schemas.food_package import FoodPackageUpdate
from app.schemas.food_package import FoodPackageCreateRequest
from tests.support import ExecuteResult, utcnow


class FakeSession:
    def __init__(self, *, packages=None, execute_rows_seq=None, scalar_values=None):
        self.packages = packages or {}
        self.execute_rows_seq = list(execute_rows_seq or [])
        self.scalar_values = list(scalar_values or [])
        self.added = []
        self.deleted = []
        self.updated = []
        self.did_commit = False
        self.did_rollback = False

    async def execute(self, query):
        if self.execute_rows_seq:
            return ExecuteResult(self.execute_rows_seq.pop(0))
        return ExecuteResult(list(self.packages.values()))

    async def scalar(self, _query):
        if self.scalar_values:
            return self.scalar_values.pop(0)
        return None

    def add(self, obj):
        self.added.append(obj)
        if isinstance(obj, FoodPackage) and getattr(obj, "id", None) is None:
            obj.id = 999
            obj.created_at = utcnow()

    async def delete(self, obj):
        self.deleted.append(obj)

    async def flush(self):
        return None

    async def refresh(self, _obj):
        return None

    async def commit(self):
        self.did_commit = True

    async def rollback(self):
        self.did_rollback = True


@pytest.mark.asyncio
async def test_list_packages_for_bank_empty():
    db = FakeSession()
    result = await list_packages_for_bank(food_bank_id=1, db=db)
    assert result == []


@pytest.mark.asyncio
async def test_list_packages_for_bank_returns_rows():
    pkg = FoodPackage(
        id=1,
        name="Family Pack",
        category="Family Bundle",
        stock=10,
        threshold=5,
        applied_count=0,
        food_bank_id=1,
        is_active=True,
        created_at=utcnow(),
    )
    db = FakeSession(packages={1: pkg})

    result = await list_packages_for_bank(food_bank_id=1, db=db)

    assert len(result) == 1
    assert result[0].name == "Family Pack"


@pytest.mark.asyncio
async def test_get_package_success():
    pkg = FoodPackage(
        id=1,
        name="Premium Pack",
        category="Emergency Pack",
        stock=5,
        threshold=3,
        applied_count=2,
        food_bank_id=1,
        is_active=True,
        created_at=utcnow(),
    )
    db = FakeSession(packages={1: pkg})

    result = await get_package_details(package_id=1, db=db)

    assert result.name == "Premium Pack"
    assert result.category == "Emergency Pack"


@pytest.mark.asyncio
async def test_get_package_not_found():
    db = FakeSession(packages={})

    with pytest.raises(HTTPException) as exc:
        await get_package_details(package_id=999, db=db)

    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_create_package_success():
    db = FakeSession(execute_rows_seq=[[1]], scalar_values=[1])
    admin = {"role": "admin"}

    payload = FoodPackageCreateRequest(
        name="New Pack",
        category="Breakfast",
        threshold=4,
        contents=[{"item_id": 1, "quantity": 1}],
        food_bank_id=1,
    )

    result = await create_package(package_in=payload, admin_user=admin, db=db)

    assert result.id == 999
    assert result.name == "New Pack"
    assert result.category == "Breakfast"
    assert len(db.added) == 2


@pytest.mark.asyncio
async def test_create_package_requires_food_bank():
    db = FakeSession(execute_rows_seq=[[1]])
    admin = {"role": "admin"}

    payload = FoodPackageCreateRequest(
        name="New Pack",
        category="Breakfast",
        threshold=4,
        contents=[{"item_id": 1, "quantity": 1}],
        food_bank_id=None,
    )

    with pytest.raises(HTTPException) as exc:
        await create_package(package_in=payload, admin_user=admin, db=db)

    assert exc.value.status_code == 400
    assert exc.value.detail == "food_bank_id is required for package creation"


@pytest.mark.asyncio
async def test_create_package_rejects_unknown_food_bank():
    db = FakeSession(scalar_values=[None])
    admin = {"role": "admin"}

    payload = FoodPackageCreateRequest(
        name="New Pack",
        category="Breakfast",
        threshold=4,
        contents=[{"item_id": 1, "quantity": 1}],
        food_bank_id=999,
    )

    with pytest.raises(HTTPException) as exc:
        await create_package(package_in=payload, admin_user=admin, db=db)

    assert exc.value.status_code == 404
    assert exc.value.detail == "Food bank not found"


@pytest.mark.asyncio
async def test_create_package_defaults_to_local_admin_food_bank():
    db = FakeSession(
        execute_rows_seq=[[
            InventoryItem(
                id=1,
                name="Rice",
                category="Grains & Pasta",
                unit="kg",
                threshold=5,
                food_bank_id=3,
            )
        ]],
        scalar_values=[3],
    )
    admin = {"role": "admin", "food_bank_id": 3}

    payload = FoodPackageCreateRequest(
        name="Scoped Pack",
        category="Breakfast",
        threshold=4,
        contents=[{"item_id": 1, "quantity": 1}],
        food_bank_id=None,
    )

    result = await create_package(package_in=payload, admin_user=admin, db=db)

    assert result.food_bank_id == 3


@pytest.mark.asyncio
async def test_create_package_rejects_foreign_inventory_for_local_admin():
    db = FakeSession(
        execute_rows_seq=[[
            InventoryItem(
                id=1,
                name="Rice",
                category="Grains & Pasta",
                unit="kg",
                threshold=5,
                food_bank_id=2,
            )
        ]],
        scalar_values=[1],
    )
    admin = {"role": "admin", "food_bank_id": 1}

    payload = FoodPackageCreateRequest(
        name="Scoped Pack",
        category="Breakfast",
        threshold=4,
        contents=[{"item_id": 1, "quantity": 1}],
        food_bank_id=None,
    )

    with pytest.raises(HTTPException) as exc:
        await create_package(package_in=payload, admin_user=admin, db=db)

    assert exc.value.status_code == 403
    assert exc.value.detail == "One or more inventory items are outside your food bank scope"


@pytest.mark.asyncio
async def test_create_package_rejects_inventory_from_other_food_bank_for_platform_admin():
    db = FakeSession(
        execute_rows_seq=[[
            InventoryItem(
                id=1,
                name="Rice",
                category="Grains & Pasta",
                unit="kg",
                threshold=5,
                food_bank_id=2,
            )
        ]],
        scalar_values=[1],
    )
    admin = {"role": "admin"}

    payload = FoodPackageCreateRequest(
        name="Scoped Pack",
        category="Breakfast",
        threshold=4,
        contents=[{"item_id": 1, "quantity": 1}],
        food_bank_id=1,
    )

    with pytest.raises(HTTPException) as exc:
        await create_package(package_in=payload, admin_user=admin, db=db)

    assert exc.value.status_code == 400
    assert exc.value.detail == "One or more inventory items are outside the selected food bank scope"


@pytest.mark.asyncio
async def test_update_package_success():
    pkg = FoodPackage(
        id=1,
        name="Old Pack",
        category="Breakfast",
        stock=5,
        threshold=3,
        applied_count=1,
        food_bank_id=1,
        is_active=True,
        created_at=utcnow(),
    )
    db = FakeSession(packages={1: pkg})
    admin = {"role": "admin"}

    payload = FoodPackageUpdate(name="Updated Pack", stock=10)

    result = await update_package(
        package_id=1, package_in=payload, admin_user=admin, db=db
    )

    assert result.name == "Updated Pack"
    assert result.stock == 10


@pytest.mark.asyncio
async def test_update_package_replaces_package_contents():
    pkg = FoodPackage(
        id=1,
        name="Old Pack",
        category="Breakfast",
        stock=5,
        threshold=3,
        applied_count=1,
        food_bank_id=1,
        is_active=True,
        created_at=utcnow(),
    )
    existing_item = PackageItem(
        id=10,
        package_id=1,
        inventory_item_id=99,
        quantity=4,
    )
    db = FakeSession(execute_rows_seq=[[pkg], [1, 2], [existing_item]])
    admin = {"role": "admin"}

    payload = FoodPackageUpdate(
        name="Updated Pack",
        contents=[
            {"item_id": 1, "quantity": 2},
            {"item_id": 2, "quantity": 3},
        ],
    )

    result = await update_package(
        package_id=1,
        package_in=payload,
        admin_user=admin,
        db=db,
    )

    new_package_items = [obj for obj in db.added if isinstance(obj, PackageItem)]

    assert result.name == "Updated Pack"
    assert db.deleted == [existing_item]
    assert len(new_package_items) == 2
    assert [item.inventory_item_id for item in new_package_items] == [1, 2]
    assert [item.quantity for item in new_package_items] == [2, 3]


@pytest.mark.asyncio
async def test_update_package_rejects_reassigning_package_when_contents_belong_to_other_food_bank():
    pkg = FoodPackage(
        id=1,
        name="Old Pack",
        category="Breakfast",
        stock=5,
        threshold=3,
        applied_count=1,
        food_bank_id=1,
        is_active=True,
        created_at=utcnow(),
    )
    pkg.package_items = [
        PackageItem(
            id=10,
            package_id=1,
            inventory_item_id=99,
            quantity=2,
        )
    ]
    db = FakeSession(
        execute_rows_seq=[
            [pkg],
            [
                InventoryItem(
                    id=99,
                    name="Rice",
                    category="Grains & Pasta",
                    unit="kg",
                    threshold=5,
                    food_bank_id=1,
                )
            ],
        ],
        scalar_values=[2],
    )
    admin = {"role": "admin"}

    payload = FoodPackageUpdate(food_bank_id=2)

    with pytest.raises(HTTPException) as exc:
        await update_package(
            package_id=1,
            package_in=payload,
            admin_user=admin,
            db=db,
        )

    assert exc.value.status_code == 400
    assert exc.value.detail == "One or more inventory items are outside the selected food bank scope"


@pytest.mark.asyncio
async def test_update_package_not_found():
    db = FakeSession(packages={})
    admin = {"role": "admin"}

    payload = FoodPackageUpdate(name="New Name")

    with pytest.raises(HTTPException) as exc:
        await update_package(
            package_id=999, package_in=payload, admin_user=admin, db=db
        )

    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_update_package_rejects_other_food_bank_for_local_admin():
    pkg = FoodPackage(
        id=1,
        name="Other Bank Pack",
        category="Breakfast",
        stock=5,
        threshold=3,
        applied_count=1,
        food_bank_id=2,
        is_active=True,
        created_at=utcnow(),
    )
    db = FakeSession(packages={1: pkg})
    admin = {"role": "admin", "food_bank_id": 1}

    with pytest.raises(HTTPException) as exc:
        await update_package(
            package_id=1,
            package_in=FoodPackageUpdate(name="Updated Pack"),
            admin_user=admin,
            db=db,
        )

    assert exc.value.status_code == 403
    assert exc.value.detail == "You can only manage packages for your assigned food bank"


@pytest.mark.asyncio
async def test_delete_package_success():
    pkg = FoodPackage(
        id=1,
        name="To Delete",
        category="Breakfast",
        stock=0,
        threshold=5,
        applied_count=0,
        food_bank_id=1,
        is_active=True,
        created_at=utcnow(),
    )
    db = FakeSession(packages={1: pkg}, scalar_values=[0])
    admin = {"role": "admin"}

    result = await delete_package(package_id=1, admin_user=admin, db=db)

    assert result is None
    assert db.deleted == [pkg]


@pytest.mark.asyncio
async def test_delete_package_soft_deletes_when_used_in_applications():
    pkg = FoodPackage(
        id=1,
        name="Keep History",
        category="Breakfast",
        stock=0,
        threshold=5,
        applied_count=0,
        food_bank_id=1,
        is_active=True,
        created_at=utcnow(),
    )
    db = FakeSession(packages={1: pkg}, scalar_values=[2])
    admin = {"role": "admin"}

    result = await delete_package(package_id=1, admin_user=admin, db=db)

    assert result is None
    assert pkg.is_active is False
    assert db.deleted == []


@pytest.mark.asyncio
async def test_delete_package_not_found():
    db = FakeSession(packages={})
    admin = {"role": "admin"}

    with pytest.raises(HTTPException) as exc:
        await delete_package(package_id=999, admin_user=admin, db=db)

    assert exc.value.status_code == 404
