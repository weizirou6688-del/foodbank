from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest

from app.routers.stats import get_donation_stats, get_package_stats, get_stock_gap_analysis


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

    def all(self):
        return self._rows


class FakeSession:
    def __init__(self, *, execute_rows_seq=None):
        self.execute_rows_seq = list(execute_rows_seq or [])

    async def execute(self, _query):
        rows = self.execute_rows_seq.pop(0) if self.execute_rows_seq else []
        return _ExecuteResult(rows)


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
