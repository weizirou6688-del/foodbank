from datetime import date

import pytest

from app.core.bootstrap import _cleanup_legacy_demo_shared_records
from app.models.donation_cash import DonationCash
from app.models.donation_goods import DonationGoods
from app.models.inventory_lot import InventoryLot
from tests.support import ExecuteResult


class FakeBootstrapSession:
    def __init__(self, execute_rows_seq):
        self.execute_rows_seq = list(execute_rows_seq)
        self.deleted = []

    async def execute(self, _query):
        rows = self.execute_rows_seq.pop(0) if self.execute_rows_seq else []
        return ExecuteResult(rows)

    async def delete(self, obj):
        self.deleted.append(obj)


@pytest.mark.asyncio
async def test_cleanup_legacy_demo_shared_records_removes_unscoped_demo_rows():
    legacy_cash = DonationCash(
        donor_name="Mary Network Donor",
        donor_email="mary.network.donor@example.com",
        amount_pence=2500,
        payment_reference="DEMO-LOCAL-CASH-001",
        status="completed",
        food_bank_id=None,
    )
    legacy_goods = DonationGoods(
        donor_name="Ahmed Goods Donor",
        donor_email="ahmed.goods.donor@example.com",
        donor_phone="07123456789",
        status="pending",
        food_bank_id=None,
    )
    legacy_lot = InventoryLot(
        inventory_item_id=11,
        quantity=5,
        received_date=date(2026, 4, 1),
        expiry_date=date(2026, 8, 1),
        batch_reference="demo-seed-rice-2kg",
    )
    db = FakeBootstrapSession(
        execute_rows_seq=[
            [legacy_cash],
            [legacy_goods],
            [(legacy_lot, "Rice (2kg)", 7)],
        ]
    )

    changed = await _cleanup_legacy_demo_shared_records(db)

    assert changed is True
    assert db.deleted == [legacy_cash, legacy_goods]
    assert legacy_lot.deleted_at is not None
