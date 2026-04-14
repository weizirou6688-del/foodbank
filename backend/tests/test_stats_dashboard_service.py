from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import app.services.stats_dashboard_service as stats_dashboard_service_module


def test_dashboard_wrapper_strips_legacy_impact_metrics(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class _LegacyDashboardModule:
        @staticmethod
        async def build_dashboard_analytics(**_kwargs):
            return {
                "impactMetrics": [
                    {
                        "key": "families_supported",
                        "value": "144",
                        "label": "Families Supported",
                    }
                ],
                "kpi": {"totalDonation": 1128},
            }

    monkeypatch.setattr(
        stats_dashboard_service_module,
        "_load_legacy_module",
        lambda: _LegacyDashboardModule(),
    )

    payload = asyncio.run(stats_dashboard_service_module.build_dashboard_analytics())

    assert payload == {"kpi": {"totalDonation": 1128}}
    assert "impactMetrics" not in payload
