from __future__ import annotations

import asyncio
from collections.abc import Awaitable


def async_raise(error: Exception):
    async def _call(*_args, **_kwargs):
        raise error

    return _call


def async_return(value: object):
    async def _call(*_args, **_kwargs):
        return value

    return _call


def assert_http_exception(exc_info, *, status_code: int, detail: str) -> None:
    assert exc_info.value.status_code == status_code
    assert exc_info.value.detail == detail


class CapturingSession:
    def __init__(self) -> None:
        self.added: list[object] = []
        self.flush_calls = 0
        self.refreshed: list[object] = []

    def add(self, value: object) -> None:
        self.added.append(value)

    async def flush(self) -> None:
        self.flush_calls += 1

    async def refresh(self, value: object) -> None:
        self.refreshed.append(value)


def patch_attrs(monkeypatch, target: object, /, **replacements: object) -> None:
    for name, value in replacements.items():
        monkeypatch.setattr(target, name, value)


def run_async(awaitable: Awaitable[object]):
    return asyncio.run(awaitable)
