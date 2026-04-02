import uuid
from datetime import datetime, timedelta
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi import HTTPException

from app.models.donation_cash import DonationCash
from app.models.donation_goods import DonationGoods
from app.models.donation_goods_item import DonationGoodsItem
from app.models.food_bank import FoodBank
from app.routers.donations import list_donations, submit_cash_donation, submit_goods_donation
from app.schemas.donation_cash import DonationCashCreate
from app.schemas.donation_goods import DonationGoodsCreate, DonationGoodsItemCreatePayload


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


class FakeSession:
    def __init__(self, *, cash_rows=None, goods_rows=None, food_bank_rows=None):
        self.added = []
        self._cash_rows = cash_rows or []
        self._goods_rows = goods_rows or []
        self._food_bank_rows = food_bank_rows or []

    def begin(self):
        return _Begin()

    def add(self, obj):
        self.added.append(obj)
        if getattr(obj, "id", None) is None and isinstance(obj, (DonationCash, DonationGoods)):
            obj.id = uuid.uuid4()
        if isinstance(obj, DonationGoodsItem):
            # nothing special needed; donation_id is set by caller
            pass

    async def flush(self):
        return None

    async def refresh(self, _obj):
        return None

    async def scalar(self, query):
        q = str(query)
        if "food_banks" in q:
            return self._food_bank_rows[0] if self._food_bank_rows else None
        return None

    async def execute(self, query):
        q = str(query)
        if "donations_cash" in q:
            return _ExecuteResult(self._cash_rows)
        if "donations_goods" in q:
            rows = self._goods_rows or [x for x in self.added if isinstance(x, DonationGoods)]
            return _ExecuteResult(rows)
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
        donor_phone="123456",
        postcode="SW1A 1AA",
        pickup_date="2026-04-03",
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
    assert str(result.pickup_date) == "2026-04-03"
    assert result.item_condition == "New or unopened"
    assert result.estimated_quantity == "2 bags"
    goods_rows = [x for x in db.added if isinstance(x, DonationGoods)]
    item_rows = [x for x in db.added if isinstance(x, DonationGoodsItem)]
    assert len(goods_rows) == 1
    assert len(item_rows) == 2
    assert all(item.donation_id == goods_rows[0].id for item in item_rows)


@pytest.mark.asyncio
async def test_submit_goods_donation_supports_external_food_bank_metadata():
    db = FakeSession()
    payload = DonationGoodsCreate(
        food_bank_name="Give Food Directory Listing",
        food_bank_address="Unit 4, Example Road, Cardiff, CF10 1AA",
        donor_name="Alice",
        donor_email="alice@example.com",
        donor_phone="123456",
        postcode="CF10 1AA",
        pickup_date="2026-04-03",
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
        donor_phone="888",
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
