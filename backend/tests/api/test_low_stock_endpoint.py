from __future__ import annotations

import pytest
from sqlalchemy.dialects import sqlite

import app.routers.inventory as inventory_router


def _compile_sql(query) -> str:
    return str(
        query.compile(
            dialect=sqlite.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    ).lower()


@pytest.mark.asyncio
async def test_get_low_stock_items_builds_scoped_query_with_default_threshold(monkeypatch):
    captured: dict[str, object] = {}

    async def fake_fetch_rows(_db, query):
        captured["query"] = query
        return [
            (1, "Rice", "Grains & Pasta", "kg", 3, 10, 7),
        ]

    monkeypatch.setattr(inventory_router, "fetch_rows", fake_fetch_rows)

    result = await inventory_router.get_low_stock_items(
        threshold=None,
        admin_user={"role": "admin", "food_bank_id": 4},
        db=object(),
    )

    assert len(result) == 1
    assert result[0].id == 1
    assert result[0].name == "Rice"
    assert result[0].current_stock == 3
    assert result[0].threshold == 10
    assert result[0].stock_deficit == 7

    sql = _compile_sql(captured["query"])
    assert "inventory_lots.deleted_at is null" in sql
    assert "inventory_lots.expiry_date >=" in sql
    assert "inventory_items.food_bank_id = 4" in sql
    assert "coalesce(anon_1.total_stock, 0) < inventory_items.threshold" in sql
    assert "order by inventory_items.threshold - coalesce(anon_1.total_stock, 0) desc" in sql


@pytest.mark.asyncio
async def test_get_low_stock_items_uses_override_threshold_literal(monkeypatch):
    captured: dict[str, object] = {}

    async def fake_fetch_rows(_db, query):
        captured["query"] = query
        return [
            (2, "Beans", "Canned Goods", "can", 60, 80, 20),
        ]

    monkeypatch.setattr(inventory_router, "fetch_rows", fake_fetch_rows)

    result = await inventory_router.get_low_stock_items(
        threshold=80,
        admin_user={"role": "admin", "food_bank_id": 7},
        db=object(),
    )

    assert len(result) == 1
    assert result[0].id == 2
    assert result[0].threshold == 80
    assert result[0].current_stock == 60
    assert result[0].stock_deficit == 20

    sql = _compile_sql(captured["query"])
    assert "80 as threshold" in sql
    assert "80 - coalesce(anon_1.total_stock, 0)" in sql
    assert "coalesce(anon_1.total_stock, 0) < 80" in sql
    assert "inventory_items.food_bank_id = 7" in sql


@pytest.mark.asyncio
async def test_get_low_stock_items_platform_admin_limits_to_scoped_records(monkeypatch):
    captured: dict[str, object] = {}

    async def fake_fetch_rows(_db, query):
        captured["query"] = query
        return []

    monkeypatch.setattr(inventory_router, "fetch_rows", fake_fetch_rows)

    result = await inventory_router.get_low_stock_items(
        threshold=None,
        admin_user={"role": "admin"},
        db=object(),
    )

    assert result == []
    sql = _compile_sql(captured["query"])
    assert "inventory_items.food_bank_id is not null" in sql


@pytest.mark.asyncio
async def test_get_low_stock_items_returns_empty_list_when_query_is_empty(monkeypatch):
    async def fake_fetch_rows(_db, _query):
        return []

    monkeypatch.setattr(inventory_router, "fetch_rows", fake_fetch_rows)

    result = await inventory_router.get_low_stock_items(
        threshold=25,
        admin_user={"role": "admin", "food_bank_id": 2},
        db=object(),
    )

    assert result == []
