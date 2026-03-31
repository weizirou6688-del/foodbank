"""
Seed demo accounts and reference data explicitly for local startup workflows.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.bootstrap import (  # noqa: E402
    ensure_demo_food_banks,
    ensure_demo_inventory_and_packages,
    ensure_demo_users,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Seed demo users, food banks, and inventory data.",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress success output.",
    )
    return parser.parse_args()


async def seed_demo_data(quiet: bool) -> None:
    await ensure_demo_users()
    await ensure_demo_food_banks()
    await ensure_demo_inventory_and_packages()

    if not quiet:
        print("Demo data ensured successfully.")


if __name__ == "__main__":
    options = parse_args()
    asyncio.run(seed_demo_data(options.quiet))
