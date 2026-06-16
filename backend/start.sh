#!/usr/bin/env bash
# Render start command: run DB migrations, seed demo data (idempotent), then serve.
set -e
cd "$(dirname "$0")"

echo "==> Running Alembic migrations"
alembic upgrade head

echo "==> Seeding demo data (idempotent)"
python scripts/seed_demo_data.py --quiet || echo "WARN: seed step failed (continuing)"

echo "==> Starting Uvicorn on port ${PORT:-8000}"
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
