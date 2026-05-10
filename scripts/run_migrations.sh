#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"

if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
else
  echo "Error: python or python3 is required." >&2
  exit 1
fi

usage() {
  cat <<'EOF'
Optional Bash/WSL Alembic helper for this repository.

On Windows, the main local workflow is still documented in README.md and uses
direct Alembic commands plus scripts\quick_start.bat. This helper exists for
Bash-capable environments where you want a small wrapper around common Alembic
operations.

Usage:
  bash scripts/run_migrations.sh current
  bash scripts/run_migrations.sh history
  bash scripts/run_migrations.sh upgrade [target]
  bash scripts/run_migrations.sh downgrade <target>
  bash scripts/run_migrations.sh verify

Examples:
  bash scripts/run_migrations.sh current
  bash scripts/run_migrations.sh upgrade
  bash scripts/run_migrations.sh upgrade head
  bash scripts/run_migrations.sh downgrade -1
  bash scripts/run_migrations.sh verify
EOF
}

require_backend_dir() {
  if [[ ! -d "${BACKEND_DIR}" ]]; then
    echo "Error: backend directory not found at ${BACKEND_DIR}" >&2
    exit 1
  fi
}

run_verify() {
  (
    cd "${BACKEND_DIR}"
    echo "Inspecting current Alembic revision..."
    alembic current

    echo
    echo "Inspecting database table summary..."
    "${PYTHON_BIN}" <<'PY'
from sqlalchemy import create_engine, inspect

from app.core.config import settings
from app.core.database_urls import to_sync_sqlalchemy_url

engine = create_engine(to_sync_sqlalchemy_url(settings.database_url))
inspector = inspect(engine)
tables = sorted(inspector.get_table_names())

print(f"Database tables: {len(tables)}")
for table_name in (
    "alembic_version",
    "applications",
    "inventory_items",
    "inventory_lots",
    "food_packages",
    "restock_requests",
    "donations_cash",
    "donations_goods",
):
    if table_name in tables:
        print(f"  - {table_name}: {len(inspector.get_columns(table_name))} columns")
PY
  )
}

require_backend_dir

case "${1:-}" in
  current)
    (
      cd "${BACKEND_DIR}"
      alembic current
    )
    ;;
  history)
    (
      cd "${BACKEND_DIR}"
      alembic history
    )
    ;;
  upgrade)
    (
      cd "${BACKEND_DIR}"
      alembic upgrade "${2:-head}"
    )
    ;;
  downgrade)
    if [[ $# -lt 2 ]]; then
      echo "Error: downgrade requires a target, for example -1 or a revision id." >&2
      echo >&2
      usage
      exit 1
    fi
    (
      cd "${BACKEND_DIR}"
      alembic downgrade "$2"
    )
    ;;
  verify)
    run_verify
    ;;
  ""|-h|--help|help)
    usage
    ;;
  *)
    echo "Error: unsupported command '$1'." >&2
    echo >&2
    usage
    exit 1
    ;;
esac
