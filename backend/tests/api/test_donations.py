import uuid
from datetime import date, datetime, timedelta
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi import HTTPException

from app.models.donation_cash import DonationCash
from app.models.donation_goods import DonationGoods
from app.models.donation_goods_item import DonationGoodsItem
from app.models.food_bank import FoodBank
from app.models.inventory_item import InventoryItem
from app.models.inventory_lot import InventoryLot
from app.models.restock_request import RestockRequest
from app.models.user import User
from app.routers import donations as donations_router
from app.routers.donations import (
    list_donations,
    submit_cash_donation,
    submit_goods_donation,
    submit_supermarket_goods_donation,
)
from app.schemas.donation_cash import DonationCashCreate
from app.schemas.donation_goods import (
    DonationGoodsCreate,
    DonationGoodsItemCreatePayload,
    SupermarketDonationCreate,
    SupermarketDonationItemPayload,
)


class _Begin:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _ScalarResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class _ExecuteResult:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return _ScalarResult(self._rows)

    def scalar_one(self):
        if len(self._rows) != 1:
            raise AssertionError(f"Expected exactly one row, got {len(self._rows)}")
        return self._rows[0]

    def all(self):
        return self._rows


class FakeSession:
    def __init__(
        self,
        *,
        cash_rows=None,
        goods_rows=None,
        food_bank_rows=None,
        inventory_rows=None,
        user_rows=None,
        restock_rows=None,
        stock_rows=None,
    ):
        self.added = []
        self._cash_rows = cash_rows or []
        self._goods_rows = goods_rows or []
        self._food_bank_rows = food_bank_rows or []
        self._inventory_rows = inventory_rows or []
        self._user_rows = user_rows or []
        self._restock_rows = restock_rows or []
        self._stock_rows = stock_rows or []

    def begin(self):
        return _Begin()

    def add(self, obj):
        self.added.append(obj)
        if getattr(obj, "id", None) is None and isinstance(obj, (DonationCash, DonationGoods)):
            obj.id = uuid.uuid4()
        if isinstance(obj, InventoryLot) and getattr(obj, "id", None) is None:
            obj.id = 999

    async def flush(self):
        return None

    async def refresh(self, _obj):
        return None

    async def scalar(self, query):
        q = str(query)
        if "food_banks" in q:
            return self._food_bank_rows[0] if self._food_bank_rows else None
        if "FROM users" in q or "from users" in q:
            return self._user_rows[0] if self._user_rows else None
        if "inventory_items.id" in q:
            return self._inventory_rows[0] if self._inventory_rows else None
        if "inventory_items.name" in q or "lower(inventory_items.name)" in q:
            return self._inventory_rows[0] if self._inventory_rows else None
        return None

    async def execute(self, query):
        q = str(query)
        try:
            params = query.compile().params
        except Exception:
            params = {}
        food_bank_filter = next(
            (
                value
                for key, value in params.items()
                if "food_bank_id" in str(key) and value is not None
            ),
            None,
        )
        if "donations_cash" in q:
            rows = self._cash_rows
            if food_bank_filter is not None:
                rows = [
                    row
                    for row in rows
                    if getattr(row, "food_bank_id", None) == food_bank_filter
                ]
            return _ExecuteResult(rows)
        if "donations_goods" in q:
            rows = self._goods_rows or [x for x in self.added if isinstance(x, DonationGoods)]
            if food_bank_filter is not None:
                rows = [
                    row
                    for row in rows
                    if getattr(row, "food_bank_id", None) == food_bank_filter
                ]
            return _ExecuteResult(rows)
        if "restock_requests" in q:
            return _ExecuteResult(self._restock_rows)
        if "sum(inventory_lots.quantity)" in q:
            return _ExecuteResult(self._stock_rows)
        return _ExecuteResult([])
@pytest.mark.asyncio
async def test_submit_cash_donation_success():
    db = FakeSession()
    payload = DonationCashCreate(
        donor_name="Pat Donor",
        donor_email="donor@example.com",
        amount_pence=1500,
    )

    result = await submit_cash_donation(donation_in=payload, db=db)

    assert isinstance(result, DonationCash)
    assert result.donor_name == "Pat Donor"
    assert result.donor_email == "donor@example.com"
    assert result.amount_pence == 1500
    assert result.payment_reference is not None
    assert result.payment_reference.startswith("WEB-")
    assert result.status == "completed"


@pytest.mark.asyncio
async def test_submit_goods_donation_success_creates_items():
    future_pickup_date = (date.today() + timedelta(days=7)).strftime("%d/%m/%Y")
    bank = FoodBank(
        id=7,
        name="Downtown Community Food Bank",
        address="123 Main Street, London, SW1A 1AA",
        lat=51.501,
        lng=-0.141,
    )
    db = FakeSession(food_bank_rows=[bank])
    payload = DonationGoodsCreate(
        food_bank_id=bank.id,
        food_bank_name=bank.name,
        food_bank_address=bank.address,
        donor_name="Alice",
        donor_email="alice@example.com",
        donor_phone="07123456789",
        postcode="SW1A 1AA",
        pickup_date=future_pickup_date,
        item_condition="New or unopened",
        estimated_quantity="2 bags",
        notes="Leave with concierge",
        items=[
            DonationGoodsItemCreatePayload(item_name="Rice", quantity=2),
            DonationGoodsItemCreatePayload(item_name="Beans", quantity=1),
        ],
    )

    result = await submit_goods_donation(donation_in=payload, db=db)

    assert isinstance(result, DonationGoods)
    assert result.status == "pending"
    assert result.food_bank_id == bank.id
    assert result.food_bank_name == bank.name
    assert result.food_bank_address == bank.address
    assert result.postcode == "SW1A 1AA"
    assert result.pickup_date == future_pickup_date
    assert result.item_condition == "New or unopened"
    assert result.estimated_quantity == "2 bags"
    goods_rows = [x for x in db.added if isinstance(x, DonationGoods)]
    item_rows = [x for x in db.added if isinstance(x, DonationGoodsItem)]
    assert len(goods_rows) == 1
    assert len(item_rows) == 2
    assert all(item.donation_id == goods_rows[0].id for item in item_rows)


@pytest.mark.asyncio
async def test_submit_goods_donation_supports_external_food_bank_metadata():
    future_pickup_date = (date.today() + timedelta(days=7)).strftime("%d/%m/%Y")
    db = FakeSession()
    payload = DonationGoodsCreate(
        food_bank_name="Give Food Directory Listing",
        food_bank_address="Unit 4, Example Road, Cardiff, CF10 1AA",
        donor_name="Alice",
        donor_email="alice@example.com",
        donor_phone="07123456789",
        postcode="CF10 1AA",
        pickup_date=future_pickup_date,
        item_condition="Good",
        estimated_quantity="1 box",
        notes="Ring the bell",
        items=[
            DonationGoodsItemCreatePayload(item_name="Rice", quantity=2),
        ],
    )

    result = await submit_goods_donation(donation_in=payload, db=db)

    assert isinstance(result, DonationGoods)
    assert result.food_bank_id is None
    assert result.food_bank_name == "Give Food Directory Listing"
    assert result.food_bank_address == "Unit 4, Example Road, Cardiff, CF10 1AA"
    goods_rows = [x for x in db.added if isinstance(x, DonationGoods)]
    item_rows = [x for x in db.added if isinstance(x, DonationGoodsItem)]
    assert len(goods_rows) == 1
    assert len(item_rows) == 1
    assert item_rows[0].donation_id == goods_rows[0].id


@pytest.mark.asyncio
async def test_submit_goods_donation_received_uses_created_items_for_inventory_sync(monkeypatch):
    captured = {}
    db = FakeSession()

    async def fake_sync(donation, db_session, items=None):
        captured["donation_id"] = donation.id
        captured["db"] = db_session
        captured["items"] = list(items or [])

    monkeypatch.setattr(donations_router, "_sync_goods_donation_inventory", fake_sync)

    payload = DonationGoodsCreate(
        donor_name="Alice",
        donor_email="alice@example.com",
        donor_phone="07123456789",
        pickup_date="03/04/2026",
        items=[
            DonationGoodsItemCreatePayload(item_name="Rice", quantity=2),
            DonationGoodsItemCreatePayload(item_name="Beans", quantity=1),
        ],
        status="received",
    )

    result = await submit_goods_donation(donation_in=payload, db=db)

    assert isinstance(result, DonationGoods)
    assert result.status == "received"
    assert captured["donation_id"] == result.id
    assert captured["db"] is db
    assert len(captured["items"]) == 2
    assert all(isinstance(item, DonationGoodsItem) for item in captured["items"])
    assert [item.item_name for item in captured["items"]] == ["Rice", "Beans"]
    assert [item.quantity for item in captured["items"]] == [2, 1]


@pytest.mark.asyncio
async def test_submit_supermarket_goods_donation_syncs_inventory_and_restock_state():
    supermarket_user = User(
        id=uuid.uuid4(),
        name="Partner Supermarket",
        email="supermarket@foodbank.com",
        password_hash="hashed",
        role="supermarket",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    inventory_item = InventoryItem(
        id=12,
        name="Rice",
        category="Grains & Pasta",
        unit="bags",
        threshold=10,
    )
    open_request = RestockRequest(
        id=5,
        inventory_item_id=12,
        current_stock=2,
        threshold=10,
        urgency="high",
        status="open",
    )
    db = FakeSession(
        user_rows=[supermarket_user],
        inventory_rows=[inventory_item],
        restock_rows=[open_request],
        stock_rows=[(12, 12)],
    )
    payload = SupermarketDonationCreate(
        notes="Loaded from supermarket dashboard",
        items=[
            SupermarketDonationItemPayload(inventory_item_id=12, quantity=10, expiry_date=date(2026, 7, 1)),
        ],
    )

    result = await submit_supermarket_goods_donation(
        donation_in=payload,
        current_user={"sub": str(supermarket_user.id), "role": "supermarket"},
        db=db,
    )

    assert isinstance(result, DonationGoods)
    assert result.status == "received"
    assert result.donor_user_id == supermarket_user.id
    assert result.donor_name == "Partner Supermarket"
    assert result.donor_email == "supermarket@foodbank.com"

    item_rows = [row for row in db.added if isinstance(row, DonationGoodsItem)]
    lots = [row for row in db.added if isinstance(row, InventoryLot)]
    assert len(item_rows) == 1
    assert item_rows[0].item_name == "Rice"
    assert item_rows[0].quantity == 10
    assert len(lots) == 1
    assert lots[0].inventory_item_id == 12
    assert lots[0].quantity == 10
    assert lots[0].expiry_date == date(2026, 7, 1)
    assert open_request.current_stock == 12
    assert open_request.status == "fulfilled"


@pytest.mark.asyncio
async def test_submit_supermarket_goods_donation_rejects_unknown_inventory_name():
    supermarket_user = User(
        id=uuid.uuid4(),
        name="Partner Supermarket",
        email="supermarket@foodbank.com",
        password_hash="hashed",
        role="supermarket",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db = FakeSession(user_rows=[supermarket_user])
    payload = SupermarketDonationCreate(
        items=[
            SupermarketDonationItemPayload(item_name="Unknown Item", quantity=3),
        ],
    )

    with pytest.raises(HTTPException) as exc:
        await submit_supermarket_goods_donation(
            donation_in=payload,
            current_user={"sub": str(supermarket_user.id), "role": "supermarket"},
            db=db,
        )

    assert exc.value.status_code == 400
    assert "does not exist" in exc.value.detail


@pytest.mark.asyncio
async def test_list_donations_with_invalid_filter():
    db = FakeSession()
    with pytest.raises(HTTPException) as exc:
        await list_donations(type="other", admin_user={"role": "admin"}, db=db)
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_list_donations_cash_only():
    now = datetime.utcnow()
    cash = DonationCash(
        id=uuid.uuid4(),
        donor_name="Casey",
        donor_email="c@example.com",
        amount_pence=100,
        payment_reference="P1",
        status="completed",
    )
    cash.created_at = now
    db = FakeSession(cash_rows=[cash])

    result = await list_donations(type="cash", admin_user={"role": "admin"}, db=db)
    assert len(result) == 1
    assert result[0]["donation_type"] == "cash"
    assert result[0]["donor_name"] == "Casey"
    assert result[0]["donor_email"] == "c@example.com"


@pytest.mark.asyncio
async def test_list_donations_merge_and_sort_desc():
    now = datetime.utcnow()
    old = now - timedelta(days=1)

    cash = DonationCash(
        id=uuid.uuid4(),
        donor_name="Cash Donor",
        donor_email="cash@example.com",
        amount_pence=300,
        payment_reference="P2",
        status="completed",
    )
    cash.created_at = old

    goods = DonationGoods(
        id=uuid.uuid4(),
        donor_user_id=None,
        donor_name="Bob",
        donor_email="goods@example.com",
        donor_phone="07123456789",
        notes=None,
        status="pending",
    )
    goods.created_at = now
    goods.items = [
        DonationGoodsItem(
            id=1,
            donation_id=goods.id,
            item_name="Pasta",
            quantity=3,
        )
    ]

    db = FakeSession(cash_rows=[cash], goods_rows=[goods])

    result = await list_donations(type=None, admin_user={"role": "admin"}, db=db)
    assert len(result) == 2
    assert result[0]["donation_type"] == "goods"
    assert result[0]["items"][0]["item_name"] == "Pasta"
    assert result[1]["donation_type"] == "cash"


@pytest.mark.asyncio
async def test_list_donations_local_admin_scopes_to_assigned_food_bank():
    now = datetime.utcnow()
    cash = DonationCash(
        id=uuid.uuid4(),
        donor_name="Platform Cash",
        donor_email="cash@example.com",
        amount_pence=300,
        payment_reference="P3",
        status="completed",
        food_bank_id=None,
    )
    cash.created_at = now - timedelta(hours=2)

    own_goods = DonationGoods(
        id=uuid.uuid4(),
        donor_user_id=None,
        donor_name="Own Bank Donor",
        donor_email="own@example.com",
        donor_phone="07123456789",
        notes=None,
        status="pending",
        food_bank_id=7,
    )
    own_goods.created_at = now
    own_goods.items = [
        DonationGoodsItem(
            id=1,
            donation_id=own_goods.id,
            item_name="Rice",
            quantity=2,
        )
    ]

    other_goods = DonationGoods(
        id=uuid.uuid4(),
        donor_user_id=None,
        donor_name="Other Bank Donor",
        donor_email="other@example.com",
        donor_phone="07987654321",
        notes=None,
        status="pending",
        food_bank_id=9,
    )
    other_goods.created_at = now - timedelta(hours=1)
    other_goods.items = [
        DonationGoodsItem(
            id=2,
            donation_id=other_goods.id,
            item_name="Beans",
            quantity=4,
        )
    ]

    db = FakeSession(cash_rows=[cash], goods_rows=[own_goods, other_goods])

    result = await list_donations(
        type=None,
        admin_user={"role": "admin", "food_bank_id": 7},
        db=db,
    )

    assert len(result) == 1
    assert result[0]["donation_type"] == "goods"
    assert result[0]["donor_name"] == "Own Bank Donor"
    assert result[0]["items"][0]["item_name"] == "Rice"
