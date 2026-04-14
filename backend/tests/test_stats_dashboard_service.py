from __future__ import annotations

import asyncio
import sys
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace

import pytest

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import app.services.stats_dashboard_service as stats_dashboard_service_module


def _ns(**kwargs):
    return SimpleNamespace(**kwargs)


def test_build_dashboard_analytics_uses_source_service_and_preserves_dashboard_shape(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fixed_today = date(2026, 4, 14)

    rice = _ns(
        id=1,
        name="Rice",
        category="Grains & Pasta",
        unit="bags",
        threshold=10,
        food_bank_id=1,
    )
    milk = _ns(
        id=2,
        name="Milk",
        category="Dairy",
        unit="cartons",
        threshold=5,
        food_bank_id=1,
    )
    beans = _ns(
        id=3,
        name="Beans",
        category="Canned Goods",
        unit="cans",
        threshold=4,
        food_bank_id=1,
    )
    formula = _ns(
        id=4,
        name="Formula",
        category="Baby Food",
        unit="tins",
        threshold=6,
        food_bank_id=1,
    )

    emergency_pack = _ns(
        id=10,
        name="Emergency Pack A",
        category="Emergency Pack",
        applied_count=0,
        package_items=[
            _ns(quantity=2, inventory_item_id=rice.id, inventory_item=rice),
            _ns(quantity=1, inventory_item_id=formula.id, inventory_item=formula),
        ],
        food_bank_id=1,
    )

    collected_application = _ns(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        food_bank_id=1,
        redemption_code="COLLECTED-1",
        status="collected",
        week_start=date(2026, 4, 7),
        created_at=datetime(2026, 4, 10, 9, 0),
        updated_at=datetime(2026, 4, 11, 9, 0),
        redeemed_at=datetime(2026, 4, 11, 10, 30),
        deleted_at=None,
        items=[
            _ns(
                package_id=emergency_pack.id,
                inventory_item_id=None,
                quantity=2,
                package=emergency_pack,
                inventory_item=None,
            )
        ],
    )
    pending_application = _ns(
        id=uuid.uuid4(),
        user_id=collected_application.user_id,
        food_bank_id=1,
        redemption_code="PENDING-1",
        status="pending",
        week_start=date(2026, 4, 14),
        created_at=datetime(2026, 4, 12, 8, 0),
        updated_at=datetime(2026, 4, 12, 8, 0),
        redeemed_at=None,
        deleted_at=None,
        items=[
            _ns(
                package_id=emergency_pack.id,
                inventory_item_id=None,
                quantity=1,
                package=emergency_pack,
                inventory_item=None,
            )
        ],
    )
    expired_application = _ns(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        food_bank_id=1,
        redemption_code="EXPIRED-1",
        status="expired",
        week_start=date(2026, 3, 10),
        created_at=datetime(2026, 3, 10, 8, 0),
        updated_at=datetime(2026, 3, 15, 12, 0),
        redeemed_at=None,
        deleted_at=None,
        items=[
            _ns(
                package_id=None,
                inventory_item_id=beans.id,
                quantity=2,
                package=None,
                inventory_item=beans,
            )
        ],
    )
    invalid_application = _ns(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        food_bank_id=1,
        redemption_code="INVALID-1",
        status="pending",
        week_start=date(2026, 4, 14),
        created_at=datetime(2026, 4, 13, 8, 0),
        updated_at=datetime(2026, 4, 13, 8, 0),
        redeemed_at=None,
        deleted_at=datetime(2026, 4, 13, 9, 15),
        items=[
            _ns(
                package_id=emergency_pack.id,
                inventory_item_id=None,
                quantity=1,
                package=emergency_pack,
                inventory_item=None,
            )
        ],
    )

    inputs = (
        [
            _ns(
                status="completed",
                amount_pence=1000,
                created_at=datetime(2026, 4, 10, 9, 0),
                food_bank_id=1,
            ),
            _ns(
                status="completed",
                amount_pence=3000,
                created_at=datetime(2026, 4, 11, 9, 0),
                food_bank_id=1,
            ),
            _ns(
                status="completed",
                amount_pence=2000,
                created_at=datetime(2026, 3, 10, 9, 0),
                food_bank_id=1,
            ),
            _ns(
                status="failed",
                amount_pence=500,
                created_at=datetime(2026, 4, 12, 9, 0),
                food_bank_id=1,
            ),
        ],
        [
            _ns(
                status="received",
                donor_type="supermarket",
                donor_email="corp@example.com",
                donor_name="Fresh Market",
                created_at=datetime(2026, 4, 10, 9, 0),
                items=[_ns(item_name="Rice", quantity=5)],
                food_bank_id=1,
            ),
            _ns(
                status="received",
                donor_type="individual",
                donor_email="alice@example.com",
                donor_name="Alice",
                created_at=datetime(2026, 4, 11, 10, 0),
                items=[_ns(item_name="Milk", quantity=2)],
                food_bank_id=1,
            ),
            _ns(
                status="received",
                donor_type="individual",
                donor_email="alice@example.com",
                donor_name="Alice",
                created_at=datetime(2026, 4, 12, 10, 0),
                items=[_ns(item_name="Formula", quantity=1)],
                food_bank_id=1,
            ),
            _ns(
                status="received",
                donor_type=None,
                donor_email="bob@example.com",
                donor_name="Bob",
                created_at=datetime(2026, 3, 10, 10, 0),
                items=[_ns(item_name="Beans", quantity=4)],
                food_bank_id=1,
            ),
            _ns(
                status="pending",
                donor_type=None,
                donor_email="ignored@example.com",
                donor_name="Ignored",
                created_at=datetime(2026, 4, 13, 10, 0),
                items=[_ns(item_name="Formula", quantity=9)],
                food_bank_id=1,
            ),
        ],
        [rice, milk, beans, formula],
        [
            (
                _ns(
                    id=101,
                    inventory_item_id=rice.id,
                    quantity=8,
                    expiry_date=fixed_today + timedelta(days=6),
                    batch_reference="LOT-RICE",
                    deleted_at=None,
                ),
                rice,
            ),
            (
                _ns(
                    id=102,
                    inventory_item_id=milk.id,
                    quantity=6,
                    expiry_date=fixed_today + timedelta(days=60),
                    batch_reference="LOT-MILK",
                    deleted_at=None,
                ),
                milk,
            ),
            (
                _ns(
                    id=103,
                    inventory_item_id=formula.id,
                    quantity=2,
                    expiry_date=fixed_today + timedelta(days=11),
                    batch_reference="LOT-FORMULA",
                    deleted_at=None,
                ),
                formula,
            ),
            (
                _ns(
                    id=104,
                    inventory_item_id=rice.id,
                    quantity=99,
                    expiry_date=fixed_today + timedelta(days=90),
                    batch_reference="LOT-DELETED",
                    deleted_at=datetime(2026, 4, 1, 12, 0),
                ),
                rice,
            ),
        ],
        [emergency_pack],
        [
            collected_application,
            pending_application,
            expired_application,
            invalid_application,
        ],
        [],
        [
            _ns(
                quantity=3,
                occurred_at=datetime(2026, 4, 9, 14, 0),
                inventory_item_id=rice.id,
                inventory_lot_id=101,
            ),
            _ns(
                quantity=1,
                occurred_at=datetime(2026, 3, 9, 14, 0),
                inventory_item_id=beans.id,
                inventory_lot_id=None,
            ),
        ],
    )

    async def _load_inputs(_db):
        return inputs

    monkeypatch.setattr(stats_dashboard_service_module, "_today", lambda: fixed_today)
    monkeypatch.setattr(
        stats_dashboard_service_module,
        "_load_dashboard_inputs",
        _load_inputs,
    )
    monkeypatch.setattr(
        stats_dashboard_service_module,
        "_scope_dashboard_inputs",
        lambda scoped_inputs, _admin_user: scoped_inputs,
    )

    payload = asyncio.run(
        stats_dashboard_service_module.build_dashboard_analytics(
            range_key="month",
            admin_user={"role": "admin"},
            db=object(),
        )
    )

    assert payload.kpi.totalDonation == 8
    assert payload.kpi.totalSku == 4
    assert payload.kpi.totalPackageDistributed == 3
    assert payload.kpi.lowStockCount == 3
    assert payload.kpi.expiringLotCount == 2
    assert payload.kpi.redemptionRate == 50.0
    assert payload.kpi.trends.donation == "+100.0% vs last month"
    assert payload.kpi.trends.lowStock == "3 live inventory alert(s)"
    assert payload.kpi.trends.wastage == "+200.0% vs last month"

    assert payload.donation.source.labels == [
        "Supermarket",
        "Individual",
        "Organization",
        "Unspecified",
    ]
    assert payload.donation.source.data == [1.0, 2.0, 0.0, 0.0]
    assert payload.donation.category.labels == [
        "Grains & Pasta",
        "Dairy",
        "Baby Food",
    ]
    assert payload.donation.category.data == [5.0, 2.0, 1.0]
    assert payload.donation.donorType.data == [1.0, 0.0, 1.0]
    assert payload.donation.averageValue.value == "£20.00"
    assert payload.donation.averageValue.trend == "+0.0% vs last month"

    assert payload.inventory.health.data == [1.0, 2.0, 1.0]
    assert payload.inventory.category.labels == [
        "Grains & Pasta",
        "Dairy",
        "Baby Food",
    ]
    assert payload.inventory.lowStockAlerts[0].item_name == "Beans"
    assert payload.inventory.lowStockAlerts[0].status == "Out of Stock"
    assert payload.inventory.lowStockAlerts[1].item_name == "Formula"

    assert payload.package.redemption.data == [1.0, 1.0, 2.0]
    assert payload.package.packageType.labels == ["Emergency Pack"]
    assert payload.package.packageType.data == [3.0]
    assert payload.package.averageSupportDuration.value == "1.5"
    assert payload.package.itemsPerPackage.value == "3.0"

    assert payload.expiry.distribution.data == [2.0, 1.0, 0.0]
    assert payload.expiry.wastage.label == "Wasted Units"
    assert payload.expiry.expiringLots[0].item_name == "Rice"
    assert payload.expiry.expiringLots[0].days_until_expiry == 6
    assert payload.expiry.expiringLots[0].status_tone == "error"

    assert payload.redemption.breakdown.data == [1.0, 1.0, 1.0]
    assert payload.redemption.recentVerificationRecords[0].redemption_code == "INVALID-1"
    assert payload.redemption.recentVerificationRecords[0].status == "Invalid"
    assert payload.redemption.recentVerificationRecords[1].redemption_code == "COLLECTED-1"
    assert payload.redemption.recentVerificationRecords[1].status == "Success"
