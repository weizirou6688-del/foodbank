#!/usr/bin/env bash

set -euo pipefail

DB_NAME="${DB_NAME:-foodbank}"
DB_USER="${DB_USER:-foodbank}"
DB_PASSWORD="${DB_PASSWORD:-foodbank}"
POSTGRES_SUPERUSER="${POSTGRES_SUPERUSER:-postgres}"

usage() {
  cat <<EOF
Optional Bash/WSL PostgreSQL bootstrap helper for local development.

Defaults:
  DB_NAME=${DB_NAME}
  DB_USER=${DB_USER}
  POSTGRES_SUPERUSER=${POSTGRES_SUPERUSER}

You can override them for one run:
  DB_NAME=mydb DB_USER=myuser DB_PASSWORD=secret bash scripts/init_db.sh

Notes:
  - This helper is mainly for Linux, WSL, or other Bash-capable environments.
  - On Windows, README.md documents the primary local workflow.
  - The script expects local PostgreSQL tooling plus sudo access to the
    PostgreSQL superuser account.
EOF
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: required command '$1' is not available." >&2
    exit 1
  fi
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || "${1:-}" == "help" ]]; then
  usage
  exit 0
fi

require_command sudo
require_command psql

echo "Preparing local PostgreSQL database '${DB_NAME}' for user '${DB_USER}'..."

sudo -u "${POSTGRES_SUPERUSER}" psql postgres \
  -v ON_ERROR_STOP=1 \
  -v db_user="${DB_USER}" \
  -v db_password="${DB_PASSWORD}" <<'SQL'
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_roles
        WHERE rolname = :'db_user'
    ) THEN
        EXECUTE format('CREATE USER %I WITH PASSWORD %L', :'db_user', :'db_password');
    ELSE
        EXECUTE format('ALTER USER %I WITH PASSWORD %L', :'db_user', :'db_password');
    END IF;
END $$;
SQL

sudo -u "${POSTGRES_SUPERUSER}" psql postgres \
  -v ON_ERROR_STOP=1 \
  -v db_name="${DB_NAME}" \
  -v db_user="${DB_USER}" <<'SQL'
SELECT format('CREATE DATABASE %I OWNER %I', :'db_name', :'db_user')
WHERE NOT EXISTS (
    SELECT 1
    FROM pg_database
    WHERE datname = :'db_name'
)\gexec
SQL

sudo -u "${POSTGRES_SUPERUSER}" psql "${DB_NAME}" \
  -v ON_ERROR_STOP=1 \
  -v db_user="${DB_USER}" <<'SQL'
SELECT format('GRANT ALL PRIVILEGES ON DATABASE %I TO %I', current_database(), :'db_user')\gexec
SELECT format('GRANT ALL PRIVILEGES ON SCHEMA public TO %I', :'db_user')\gexec
SELECT format(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO %I',
    :'db_user'
)\gexec
SELECT format(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO %I',
    :'db_user'
)\gexec
SQL

echo
echo "Database bootstrap complete."
echo "Next steps:"
echo "  1. cd backend"
echo "  2. alembic upgrade head"
