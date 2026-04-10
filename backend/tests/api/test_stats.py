from datetime import date, datetime
from types import SimpleNamespace

import pytest

from app.routers.stats import (
    get_dashboard_analytics,
    get_donation_stats,
    get_package_stats,
    get_public_goods_impact_metrics,
    get_public_impact_metrics,
    get_stock_gap_analysis,
)
from tests.support import ExecuteResult


class FakeSession:
    def __init__(self, *, execute_rows_seq=None):
        self.execute_rows_seq = list(execute_rows_seq or [])

    async def execute(self, _query):
        rows = self.execute_rows_seq.pop(0) if self.execute_rows_seq else []
        return ExecuteResult(rows)


@pytest.mark.asyncio
async def test_get_donation_stats_empty():
    db = FakeSession(execute_rows_seq=[[(0, 0)], [(0,)], [], []])

    result = await get_donation_stats(admin_user={"role": "admin"}, db=db)

    assert result["total_cash_donations"] == 0
    assert result["total_goods_donations"] == 0
    assert result["average_cash_per_donation"] == 0
    assert result["donations_by_week"] == []


@pytest.mark.asyncio
async def test_get_donation_stats_aggregates_weekly():
    db = FakeSession(
        execute_rows_seq=[
            [(3000, 1500)],
            [(1,)],
            [("2026-W13", 3000)],
            [("2026-W13", 1)],
        ]
    )

    result = await get_donation_stats(admin_user={"role": "admin"}, db=db)

    assert result["total_cash_donations"] == 3000
    assert result["total_goods_donations"] == 1
    assert result["average_cash_per_donation"] == 1500
    assert len(result["donations_by_week"]) == 1
    assert result["donations_by_week"][0]["cash"] == 3000
    assert result["donations_by_week"][0]["goods_count"] == 1


@pytest.mark.asyncio
async def test_get_package_stats_empty():
    db = FakeSession(execute_rows_seq=[[]])

    result = await get_package_stats(admin_user={"role": "admin"}, db=db)

    assert result == []


@pytest.mark.asyncio
async def test_get_package_stats_aggregates_and_sorts():
    db = FakeSession(
        execute_rows_seq=[
            [
                (1, "Basic", 2, 3),
                (2, "Family", 1, 5),
            ]
        ]
    )

    result = await get_package_stats(admin_user={"role": "admin"}, db=db)

    assert len(result) == 2
    assert result[0]["package_id"] == 1
    assert result[0]["request_count"] == 2
    assert result[0]["total_requested_items"] == 3
    assert result[0]["package_name"] == "Basic"


@pytest.mark.asyncio
async def test_get_stock_gap_analysis_empty():
    db = FakeSession(execute_rows_seq=[[]])

    result = await get_stock_gap_analysis(admin_user={"role": "admin"}, db=db)

    assert result == []


@pytest.mark.asyncio
async def test_get_stock_gap_analysis_filters_and_sorts():
    db = FakeSession(execute_rows_seq=[[(1, "Rice", 1, 6, 5), (2, "Beans", 4, 6, 2)]])

    result = await get_stock_gap_analysis(admin_user={"role": "admin"}, db=db)

    assert len(result) == 2
    assert result[0]["package_id"] == 1
    assert result[0]["gap"] == 5
    assert result[1]["package_id"] == 2
    assert result[1]["gap"] == 2


@pytest.mark.asyncio
async def test_get_public_impact_metrics_empty():
    db = FakeSession(execute_rows_seq=[[], [], [], []])

    result = await get_public_impact_metrics(range_key="year", db=db)

    assert len(result.impactMetrics) == 4
    assert result.impactMetrics[0].label == 'Food Units Distributed'
    assert result.impactMetrics[0].value == '0'
    assert result.impactMetrics[0].note == 'All Time'
    assert result.impactMetrics[2].value == '0.0%'
    assert result.impactMetrics[3].note == 'This Year'


@pytest.mark.asyncio
async def test_get_public_impact_metrics_aggregates_current_period():
    current_year = date.today().year

    goods_current = SimpleNamespace(
        status='received',
        pickup_date=f"10/01/{current_year}",
        created_at=datetime(current_year, 1, 10),
        items=[SimpleNamespace(quantity=8), SimpleNamespace(quantity=4)],
    )
    goods_previous = SimpleNamespace(
        status='received',
        pickup_date=f"12/02/{current_year - 1}",
        created_at=datetime(current_year - 1, 2, 12),
        items=[SimpleNamespace(quantity=5)],
    )

    current_application = SimpleNamespace(
        id='app-current',
        user_id='user-1',
        created_at=datetime(current_year, 1, 15),
        deleted_at=None,
        status='collected',
        items=[],
    )
    previous_application = SimpleNamespace(
        id='app-previous',
        user_id='user-2',
        created_at=datetime(current_year - 1, 3, 20),
        deleted_at=None,
        status='collected',
        items=[],
    )

    current_snapshot = SimpleNamespace(
        application_id='app-current',
        snapshot_type='direct_item',
        distributed_quantity=18,
    )
    previous_snapshot = SimpleNamespace(
        application_id='app-previous',
        snapshot_type='direct_item',
        distributed_quantity=9,
    )

    db = FakeSession(
        execute_rows_seq=[
            [goods_current, goods_previous],
            [],
            [current_application, previous_application],
            [current_snapshot, previous_snapshot],
        ]
    )

    result = await get_public_impact_metrics(range_key="year", db=db)
    metrics = {metric.key: metric for metric in result.impactMetrics}

    assert metrics['food_units_distributed'].value == '27'
    assert metrics['food_units_distributed'].change == '+100.0%'
    assert metrics['families_supported'].value == '2'
    assert metrics['families_supported'].note == 'All Time'
    assert metrics['aid_redemption_success_rate'].value == '100.0%'
    assert metrics['goods_units_year'].value == '12'


@pytest.mark.asyncio
async def test_get_public_goods_impact_metrics_aligns_dashboard_counts():
    current_year = date.today().year

    cash_partner = SimpleNamespace(
        status='completed',
        donor_type='organization',
        donor_email='partner@example.org',
        donor_name='Community Partner',
    )
    goods_current = SimpleNamespace(
        status='received',
        donor_type='supermarket',
        donor_email='market@example.org',
        donor_name='Neighbourhood Market',
        pickup_date=f"01/04/{current_year}",
        created_at=datetime(current_year, 4, 1),
        items=[
            SimpleNamespace(quantity=10, item_name='Rice'),
            SimpleNamespace(quantity=5, item_name='Beans'),
        ],
    )
    goods_previous = SimpleNamespace(
        status='received',
        donor_type='individual',
        donor_email='donor@example.org',
        donor_name='Helpful Donor',
        pickup_date=f"01/03/{current_year}",
        created_at=datetime(current_year, 3, 1),
        items=[SimpleNamespace(quantity=5, item_name='Pasta')],
    )
    current_application = SimpleNamespace(
        user_id='family-1',
        created_at=datetime(current_year, 4, 2),
        deleted_at=None,
    )
    previous_application = SimpleNamespace(
        user_id='family-2',
        created_at=datetime(current_year, 3, 2),
        deleted_at=None,
    )

    db = FakeSession(
        execute_rows_seq=[
            [cash_partner],
            [goods_previous, goods_current],
            [previous_application, current_application],
        ]
    )

    result = await get_public_goods_impact_metrics(range_key="month", db=db)
    metrics = {metric.key: metric for metric in result.impactMetrics}

    assert metrics['goods_units_current_period'].value == '15'
    assert metrics['goods_units_current_period'].label == 'Items Donated This Month'
    assert metrics['goods_units_current_period'].change == '+200.0%'
    assert metrics['families_supported'].value == '2'
    assert metrics['families_supported'].change == '+0.0%'
    assert metrics['partner_organizations'].value == '2'



@pytest.mark.asyncio
async def test_get_dashboard_analytics_ignores_unscoped_legacy_donations():
    current_year = date.today().year

    cash_partner = SimpleNamespace(
        status='completed',
        donor_type='organization',
        donor_email='partner@example.org',
        donor_name='Community Partner',
        amount_pence=1500,
        created_at=datetime(current_year, 4, 1),
        food_bank_id=1,
    )
    legacy_shared_cash = SimpleNamespace(
        status='completed',
        donor_type='organization',
        donor_email='legacy-shared@example.org',
        donor_name='Legacy Shared Partner',
        amount_pence=9900,
        created_at=datetime(current_year, 4, 1),
        food_bank_id=None,
    )
    goods_current = SimpleNamespace(
        status='received',
        donor_type='supermarket',
        donor_email='market@example.org',
        donor_name='Neighbourhood Market',
        pickup_date=f"01/04/{current_year}",
        created_at=datetime(current_year, 4, 1),
        food_bank_id=1,
        items=[
            SimpleNamespace(quantity=10, item_name='Rice'),
            SimpleNamespace(quantity=5, item_name='Beans'),
        ],
    )
    goods_previous = SimpleNamespace(
        status='received',
        donor_type='individual',
        donor_email='donor@example.org',
        donor_name='Helpful Donor',
        pickup_date=f"01/03/{current_year}",
        created_at=datetime(current_year, 3, 1),
        food_bank_id=1,
        items=[SimpleNamespace(quantity=5, item_name='Pasta')],
    )
    legacy_shared_goods = SimpleNamespace(
        status='received',
        donor_type='individual',
        donor_email='legacy-shared-goods@example.org',
        donor_name='Legacy Shared Goods',
        pickup_date=f"01/04/{current_year}",
        created_at=datetime(current_year, 4, 1),
        food_bank_id=None,
        items=[SimpleNamespace(quantity=40, item_name='Shared Beans')],
    )
    current_application = SimpleNamespace(
        id='app-current',
        user_id='family-1',
        created_at=datetime(current_year, 4, 2),
        deleted_at=None,
        status='pending',
        week_start=date(current_year, 4, 1),
        food_bank_id=1,
        items=[],
    )

    db = FakeSession(
        execute_rows_seq=[
            [cash_partner, legacy_shared_cash],
            [goods_previous, goods_current, legacy_shared_goods],
            [],
            [],
            [],
            [current_application],
            [],
            [],
        ]
    )

    result = await get_dashboard_analytics(range_key='month', admin_user={'role': 'admin'}, db=db)
    metrics = {metric.key: metric for metric in result.impactMetrics}

    assert result.kpi.totalDonation == 15
    assert result.kpi.trends.donation == '+200.0% vs last month'
    assert metrics['families_supported'].value == '1'
    assert metrics['partner_organizations'].value == '2'
    assert metrics['goods_units_year'].value == '20'


@pytest.mark.asyncio
async def test_get_dashboard_analytics_local_admin_scopes_inventory_to_related_package_items():
    current_year = date.today().year

    related_inventory_item = SimpleNamespace(
        id=11,
        name='Rice',
        category='Grains & Pasta',
        unit='bags',
        threshold=10,
    )
    unrelated_inventory_item = SimpleNamespace(
        id=22,
        name='Beans',
        category='Canned Goods',
        unit='cans',
        threshold=6,
    )
    related_lot = SimpleNamespace(
        id=101,
        inventory_item_id=11,
        quantity=3,
        deleted_at=None,
        expiry_date=date(current_year, 12, 1),
        batch_reference='LOT-101',
    )
    unrelated_lot = SimpleNamespace(
        id=202,
        inventory_item_id=22,
        quantity=20,
        deleted_at=None,
        expiry_date=date(current_year, 12, 1),
        batch_reference='LOT-202',
    )
    package = SimpleNamespace(
        id=7,
        name='Local Package',
        category='Emergency Pack',
        food_bank_id=1,
        is_active=True,
        applied_count=2,
        package_items=[SimpleNamespace(inventory_item_id=11, quantity=2)],
    )

    db = FakeSession(
        execute_rows_seq=[
            [],
            [],
            [related_inventory_item, unrelated_inventory_item],
            [(related_lot, related_inventory_item), (unrelated_lot, unrelated_inventory_item)],
            [package],
            [],
            [],
            [],
        ]
    )

    result = await get_dashboard_analytics(
        range_key='month',
        admin_user={'role': 'admin', 'food_bank_id': 1},
        db=db,
    )

    assert result.kpi.totalSku == 1
    assert result.kpi.lowStockCount == 1
    assert len(result.inventory.lowStockAlerts) == 1
    assert result.inventory.lowStockAlerts[0].item_name == 'Rice'
