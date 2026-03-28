#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/.logs"

mkdir -p "$LOG_DIR"

port_listening() {
  local port="$1"
  ss -ltn 2>/dev/null | grep -q ":${port} "
}

pick_frontend_url() {
  if port_listening 5173; then
    echo "http://localhost:5173"
    return
  fi

  if port_listening 5174; then
    echo "http://localhost:5174"
    return
  fi

  if [[ -f "$LOG_DIR/frontend.log" ]]; then
    local logged_url
    logged_url="$(grep -Eo 'http://localhost:[0-9]+' "$LOG_DIR/frontend.log" | tail -n 1 || true)"
    if [[ -n "$logged_url" ]]; then
      echo "$logged_url"
      return
    fi
  fi

  echo "http://localhost:5173"
}

echo "[1/3] Checking database..."
if command -v pg_isready >/dev/null 2>&1 && pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
  echo "  - PostgreSQL is already running on 5432"
else
  echo "  - Starting PostgreSQL service"
  sudo service postgresql start >/dev/null 2>&1 || true
  sleep 2
fi

echo "[2/3] Checking backend..."
if port_listening 8000; then
  echo "  - Backend is already running on 8000"
else
  echo "  - Starting backend (uvicorn)"
  (
    cd "$ROOT_DIR/backend"
    nohup python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload >"$LOG_DIR/backend.log" 2>&1 &
  )
  sleep 2
fi

echo "[3/3] Checking frontend..."
if port_listening 5173 || port_listening 5174; then
  echo "  - Frontend is already running"
else
  echo "  - Starting frontend (Vite)"
  (
    cd "$ROOT_DIR/frontend"
    if [[ ! -d node_modules ]]; then
      npm install
    fi
    nohup npm run dev -- --host 0.0.0.0 --port 5173 >"$LOG_DIR/frontend.log" 2>&1 &
  )
  sleep 3
fi

FRONTEND_URL="$(pick_frontend_url)"

echo
echo "Quick start complete"
echo "Frontend URL: $FRONTEND_URL"
echo "Backend URL : http://localhost:8000"
echo "Health check: http://localhost:8000/health"
echo
echo "Logs:"
echo "  - $LOG_DIR/backend.log"
echo "  - $LOG_DIR/frontend.log"
