"""Compatibility shim for the archived legacy inventory cleanup script.

The maintained implementation now lives under ``backend/scripts/legacy`` so we
can keep historical maintenance utilities separate from active operational
scripts. This shim preserves the old module path for existing wrappers or local
notes.
"""

from __future__ import annotations

import asyncio

from legacy.cleanup_legacy_bankless_inventory import *  # noqa: F401,F403
from legacy.cleanup_legacy_bankless_inventory import main


if __name__ == "__main__":
    asyncio.run(main())
