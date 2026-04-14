from __future__ import annotations

import argparse

import psycopg2

from _bootstrap import ensure_backend_on_path

ensure_backend_on_path()

from app.core.config import settings  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Check that the local project database is reachable.",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Only print failures.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    dsn = settings.database_url.replace("+asyncpg", "")

    try:
        with psycopg2.connect(dsn, connect_timeout=3) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT current_database(), current_user")
                database_name, database_user = cur.fetchone()
    except Exception as exc:
        print(f"Database check failed: {exc}")
        return 1

    if not args.quiet:
        print(
            "Database connection OK: "
            f"database={database_name}, user={database_user}",
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
