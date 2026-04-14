from __future__ import annotations

import argparse
import asyncio

from _bootstrap import ensure_backend_on_path

ensure_backend_on_path()

from app.core.bootstrap import ensure_full_demo_data  # noqa: E402


async def main() -> None:
    parser = argparse.ArgumentParser(description="Seed demo users, food banks, and inventory data.")
    parser.add_argument("--quiet", action="store_true", help="Suppress success output.")
    options = parser.parse_args()
    await ensure_full_demo_data()
    if not options.quiet:
        print("Demo data ensured successfully.")


if __name__ == "__main__":
    asyncio.run(main())
