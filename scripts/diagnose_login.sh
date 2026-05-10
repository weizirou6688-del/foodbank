#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
FRONTEND_DIR="${ROOT_DIR}/frontend"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_ok() {
  echo -e "${GREEN}OK${NC} $1"
}

print_warn() {
  echo -e "${YELLOW}WARN${NC} $1"
}

print_error() {
  echo -e "${RED}ERR${NC} $1"
}

echo "ABC Community Food Bank login diagnostics"
echo "Repository root: ${ROOT_DIR}"
echo
echo "This is an optional Bash/WSL helper."
echo "On Windows, the primary workflow still uses README.md and scripts\\quick_start.bat."
echo

echo "1. Checking backend listener on port 8000..."
if command -v lsof >/dev/null 2>&1 && lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
  print_ok "Backend appears to be listening on port 8000."
else
  print_warn "Backend is not currently confirmed on port 8000."
  echo "  Start example:"
  echo "  cd ${BACKEND_DIR} && uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
fi

echo
echo "2. Checking frontend listener on port 5173..."
if command -v lsof >/dev/null 2>&1 && lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null 2>&1; then
  print_ok "Frontend appears to be listening on port 5173."
else
  print_warn "Frontend is not currently confirmed on port 5173."
  echo "  Start example:"
  echo "  cd ${FRONTEND_DIR} && npm run dev"
fi

echo
echo "3. Checking login endpoint..."
RESPONSE="$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@foodbank.com","password":"admin123"}' 2>/dev/null || true)"

if echo "${RESPONSE}" | grep -q '"access_token"'; then
  print_ok "Login endpoint returned an access token."
else
  print_error "Login endpoint did not return an access token."
  if [[ -n "${RESPONSE}" ]]; then
    echo "  Response: ${RESPONSE}"
  else
    echo "  No response received from http://localhost:8000/api/v1/auth/login"
  fi
fi

echo
echo "4. Checking frontend API environment hints..."
ENV_FILES=(
  "${FRONTEND_DIR}/.env.local"
  "${ROOT_DIR}/.env.local"
)

FOUND_ENV_FILE=""
for env_file in "${ENV_FILES[@]}"; do
  if [[ -f "${env_file}" ]]; then
    FOUND_ENV_FILE="${env_file}"
    break
  fi
done

if [[ -n "${FOUND_ENV_FILE}" ]]; then
  print_ok "Found environment file: ${FOUND_ENV_FILE}"
  API_URL="$(grep '^VITE_API_URL=' "${FOUND_ENV_FILE}" | cut -d'=' -f2- || true)"
  if [[ -n "${API_URL}" ]]; then
    echo "  VITE_API_URL=${API_URL}"
  else
    print_warn "No VITE_API_URL entry found in ${FOUND_ENV_FILE}"
  fi
else
  print_warn "No frontend .env.local file found; dev proxy defaults may be in use."
fi

echo
echo "5. Checking demo account logins..."
TEST_ACCOUNTS=(
  "admin@foodbank.com:admin123:admin"
  "supermarket@foodbank.com:supermarket123:supermarket"
  "user@example.com:user12345:public"
)

for account in "${TEST_ACCOUNTS[@]}"; do
  IFS=':' read -r EMAIL PASSWORD ROLE <<< "${account}"
  RESPONSE="$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}" 2>/dev/null || true)"

  if echo "${RESPONSE}" | grep -q '"access_token"'; then
    print_ok "${EMAIL} (${ROLE})"
  else
    print_error "${EMAIL} (${ROLE})"
  fi
done

echo
echo "Suggested access points:"
echo "  Frontend: http://localhost:5173"
echo "  Backend : http://localhost:8000"
echo "  Docs    : http://localhost:8000/docs"
