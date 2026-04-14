from __future__ import annotations

from collections.abc import Mapping
from functools import lru_cache
from importlib.machinery import SourcelessFileLoader
from pathlib import Path


_LEGACY_MODULE_NAME = "app.services._stats_dashboard_legacy"
_LEGACY_PYC_PATH = Path(__file__).with_name(
    "_stats_dashboard_service_legacy.cpython-312.pyc"
)


@lru_cache(maxsize=1)
def _load_legacy_module():
    if not _LEGACY_PYC_PATH.exists():
        raise RuntimeError(
            f"Missing legacy stats dashboard implementation: {_LEGACY_PYC_PATH}"
        )
    loader = SourcelessFileLoader(_LEGACY_MODULE_NAME, str(_LEGACY_PYC_PATH))
    return loader.load_module()


def _strip_impact_metrics(payload):
    if hasattr(payload, "model_dump"):
        data = payload.model_dump()
    elif isinstance(payload, Mapping):
        data = dict(payload)
    else:
        return payload

    data.pop("impactMetrics", None)
    return data


async def build_dashboard_analytics(**kwargs):
    payload = await _load_legacy_module().build_dashboard_analytics(**kwargs)
    return _strip_impact_metrics(payload)
