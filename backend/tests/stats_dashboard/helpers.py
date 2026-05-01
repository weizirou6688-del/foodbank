from __future__ import annotations

import asyncio
from datetime import date

import pytest

import app.services.stats_dashboard_service as stats_dashboard_service_module


def build_dashboard_payload(
    monkeypatch: pytest.MonkeyPatch,
    *,
    today: date,
    range_key: str = "month",
    admin_user: dict | None = None,
    cash_donations: list[object] | tuple[object, ...] = (),
    goods_donations: list[object] | tuple[object, ...] = (),
    inventory_items: list[object] | tuple[object, ...] = (),
    inventory_lot_rows: list[tuple[object, object]]
    | tuple[tuple[object, object], ...] = (),
    packages: list[object] | tuple[object, ...] = (),
    applications: list[object] | tuple[object, ...] = (),
    distribution_snapshots: list[object] | tuple[object, ...] = (),
    waste_events: list[object] | tuple[object, ...] = (),
):
    async def _load_inputs(_db):
        return (
            list(cash_donations),
            list(goods_donations),
            list(inventory_items),
            list(inventory_lot_rows),
            list(packages),
            list(applications),
            list(distribution_snapshots),
            list(waste_events),
        )

    monkeypatch.setattr(stats_dashboard_service_module, "_today", lambda: today)
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

    return asyncio.run(
        stats_dashboard_service_module.build_dashboard_analytics(
            range_key=range_key,
            admin_user=admin_user or {"role": "admin"},
            db=object(),
        )
    )
