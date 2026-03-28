#!/usr/bin/env bash
set -euo pipefail

# Admin management incremental verification (no full build required)
# - Default mode: read-only checks (health/login/GET endpoints + frontend wiring)
# - Mutating mode: adds PATCH/POST checks for lot adjustment and package packing
#
# Usage:
#   bash scripts/verify_admin_management_flow.sh
#   bash scripts/verify_admin_management_flow.sh --with-mutations
#   bash scripts/verify_admin_management_flow.sh --host http://127.0.0.1:8000 --with-mutations

HOST="http://127.0.0.1:8000"
WITH_MUTATIONS=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      HOST="${2:-}"
      shift 2
      ;;
    --with-mutations)
      WITH_MUTATIONS=1
      shift
      ;;
    -h|--help)
      cat <<'EOF'
Usage: verify_admin_management_flow.sh [options]

Options:
  --host <url>         Backend base URL (default: http://127.0.0.1:8000)
  --with-mutations     Run PATCH/POST checks that modify data
  -h, --help           Show this help
EOF
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_FILE="$ROOT_DIR/frontend/src/shared/lib/api.ts"
ADMIN_PAGE_FILE="$ROOT_DIR/frontend/src/pages/Admin/AdminFoodManagement.tsx"

ok() { printf "[PASS] %s\n" "$1"; }
warn() { printf "[WARN] %s\n" "$1"; }
fail() { printf "[FAIL] %s\n" "$1"; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

http_json() {
  # args: METHOD URL TOKEN(optional) DATA(optional)
  local method="$1"
  local url="$2"
  local token="${3:-}"
  local data="${4:-}"
  local body_file
  body_file="$(mktemp)"

  local status
  if [[ -n "$data" ]]; then
    if [[ -n "$token" ]]; then
      status="$(curl -sS -o "$body_file" -w "%{http_code}" -X "$method" "$url" -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "$data")"
    else
      status="$(curl -sS -o "$body_file" -w "%{http_code}" -X "$method" "$url" -H "Content-Type: application/json" -d "$data")"
    fi
  else
    if [[ -n "$token" ]]; then
      status="$(curl -sS -o "$body_file" -w "%{http_code}" -X "$method" "$url" -H "Authorization: Bearer $token")"
    else
      status="$(curl -sS -o "$body_file" -w "%{http_code}" -X "$method" "$url")"
    fi
  fi

  printf "%s\n%s\n" "$status" "$body_file"
}

parse_json() {
  local file="$1"
  local expr="$2"
  python3 - "$file" "$expr" <<'PY'
import json, sys
path, expr = sys.argv[1], sys.argv[2]
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)
if expr == 'access_token':
    print(data.get('access_token', ''))
elif expr == 'list_len':
    print(len(data) if isinstance(data, list) else -1)
elif expr == 'first_lot_id':
    if isinstance(data, list) and data:
        print(data[0].get('id', ''))
    else:
        print('')
elif expr == 'first_package_id':
    if isinstance(data, list) and data:
        print(data[0].get('id', ''))
    else:
        print('')
elif expr == 'has_low_stock_fields':
    # expects list rows with current_stock/threshold/stock_deficit
    if not isinstance(data, list):
        print('0')
    elif not data:
        print('1')
    else:
        row = data[0]
        keys = {'current_stock', 'threshold', 'stock_deficit'}
        print('1' if keys.issubset(row.keys()) else '0')
elif expr == 'has_lot_fields':
    # expects list rows with id/item_name/quantity/expiry_date/status
    if not isinstance(data, list):
        print('0')
    elif not data:
        print('1')
    else:
        row = data[0]
        keys = {'id', 'item_name', 'quantity', 'expiry_date', 'status'}
        print('1' if keys.issubset(row.keys()) else '0')
else:
    print('')
PY
}

require_cmd curl
require_cmd python3
require_cmd grep

printf "\n== Incremental Verification (Admin Management) ==\n"
printf "Host: %s\n" "$HOST"
printf "Mode: %s\n\n" "$([[ $WITH_MUTATIONS -eq 1 ]] && echo "with mutations" || echo "read-only")"

# 1) Frontend wiring checks (no runtime dependency)
[[ -f "$API_FILE" ]] || fail "Missing file: $API_FILE"
[[ -f "$ADMIN_PAGE_FILE" ]] || fail "Missing file: $ADMIN_PAGE_FILE"

grep -q "packPackage" "$API_FILE" || fail "adminAPI.packPackage not found in api.ts"
grep -q "getLowStockItems" "$API_FILE" || fail "adminAPI.getLowStockItems not found in api.ts"
grep -q "adjustInventoryLot" "$API_FILE" || fail "adminAPI.adjustInventoryLot not found in api.ts"
ok "Frontend API methods exist"

grep -q "packPackage(" "$ADMIN_PAGE_FILE" || fail "packPackage call not found in AdminFoodManagement.tsx"
grep -q "adjustInventoryLot(" "$ADMIN_PAGE_FILE" || fail "adjustInventoryLot call not found in AdminFoodManagement.tsx"
grep -q "getLowStockItems(" "$ADMIN_PAGE_FILE" || fail "getLowStockItems call not found in AdminFoodManagement.tsx"
ok "Admin page is wired to required API calls"

# 2) Health
mapfile -t _health_resp < <(http_json "GET" "$HOST/health")
health_status="${_health_resp[0]:-}"
health_body="${_health_resp[1]:-}"
if [[ "$health_status" != "200" ]]; then
  rm -f "$health_body"
  fail "Backend health check failed (status=$health_status). Start backend first: cd backend && python -m uvicorn app.main:app --reload"
fi
rm -f "$health_body"
ok "Backend health endpoint is reachable"

# 3) Login as admin
login_payload='{"email":"admin@foodbank.com","password":"admin123"}'
mapfile -t _login_resp < <(http_json "POST" "$HOST/api/v1/auth/login" "" "$login_payload")
login_status="${_login_resp[0]:-}"
login_body="${_login_resp[1]:-}"
[[ "$login_status" == "200" ]] || { cat "$login_body" >&2; rm -f "$login_body"; fail "Admin login failed (status=$login_status)"; }
TOKEN="$(parse_json "$login_body" access_token)"
rm -f "$login_body"
[[ -n "$TOKEN" ]] || fail "Login succeeded but access_token is missing"
ok "Admin login works and token acquired"

# 4) Low-stock endpoint
mapfile -t _low_resp < <(http_json "GET" "$HOST/api/v1/inventory/low-stock" "$TOKEN")
low_status="${_low_resp[0]:-}"
low_body="${_low_resp[1]:-}"
[[ "$low_status" == "200" ]] || { cat "$low_body" >&2; rm -f "$low_body"; fail "GET /inventory/low-stock failed (status=$low_status)"; }
[[ "$(parse_json "$low_body" has_low_stock_fields)" == "1" ]] || { cat "$low_body" >&2; rm -f "$low_body"; fail "Low-stock response schema mismatch"; }
low_count="$(parse_json "$low_body" list_len)"
rm -f "$low_body"
ok "Low-stock endpoint works (rows=$low_count)"

# 5) Lots endpoint
mapfile -t _lots_resp < <(http_json "GET" "$HOST/api/v1/inventory/lots?include_inactive=true" "$TOKEN")
lots_status="${_lots_resp[0]:-}"
lots_body="${_lots_resp[1]:-}"
[[ "$lots_status" == "200" ]] || { cat "$lots_body" >&2; rm -f "$lots_body"; fail "GET /inventory/lots failed (status=$lots_status)"; }
[[ "$(parse_json "$lots_body" has_lot_fields)" == "1" ]] || { cat "$lots_body" >&2; rm -f "$lots_body"; fail "Inventory lots response schema mismatch"; }
LOT_ID="$(parse_json "$lots_body" first_lot_id)"
lots_count="$(parse_json "$lots_body" list_len)"
rm -f "$lots_body"
ok "Inventory lots endpoint works (rows=$lots_count)"

# 6) Find a package for optional pack call
mapfile -t _pkg_resp < <(http_json "GET" "$HOST/api/v1/food-banks/1/packages" "")
pkg_status="${_pkg_resp[0]:-}"
pkg_body="${_pkg_resp[1]:-}"
if [[ "$pkg_status" == "200" ]]; then
  PACKAGE_ID="$(parse_json "$pkg_body" first_package_id)"
  pkg_count="$(parse_json "$pkg_body" list_len)"
  ok "Package listing endpoint works (rows=$pkg_count)"
else
  PACKAGE_ID=""
  warn "Package listing check skipped (status=$pkg_status)"
fi
rm -f "$pkg_body"

if [[ $WITH_MUTATIONS -eq 1 ]]; then
  # 7) Mutating checks: adjust lot
  if [[ -n "$LOT_ID" ]]; then
    mapfile -t _patch1_resp < <(http_json "PATCH" "$HOST/api/v1/inventory/lots/$LOT_ID" "$TOKEN" '{"damage_quantity":1}')
    patch1_status="${_patch1_resp[0]:-}"
    patch1_body="${_patch1_resp[1]:-}"
    [[ "$patch1_status" == "200" ]] || { cat "$patch1_body" >&2; rm -f "$patch1_body"; fail "PATCH damage_quantity failed (status=$patch1_status, lot_id=$LOT_ID)"; }
    rm -f "$patch1_body"
    ok "Lot damage adjustment works (lot_id=$LOT_ID)"

    mapfile -t _patch2_resp < <(http_json "PATCH" "$HOST/api/v1/inventory/lots/$LOT_ID" "$TOKEN" '{"status":"active"}')
    patch2_status="${_patch2_resp[0]:-}"
    patch2_body="${_patch2_resp[1]:-}"
    [[ "$patch2_status" == "200" ]] || { cat "$patch2_body" >&2; rm -f "$patch2_body"; fail "PATCH status failed (status=$patch2_status, lot_id=$LOT_ID)"; }
    rm -f "$patch2_body"
    ok "Lot status update works (lot_id=$LOT_ID)"
  else
    warn "No lot available; mutating lot checks skipped"
  fi

  # 8) Mutating checks: pack package
  if [[ -n "$PACKAGE_ID" ]]; then
    mapfile -t _pack_resp < <(http_json "POST" "$HOST/api/v1/packages/$PACKAGE_ID/pack" "$TOKEN" '{"quantity":1}')
    pack_status="${_pack_resp[0]:-}"
    pack_body="${_pack_resp[1]:-}"
    if [[ "$pack_status" == "200" ]]; then
      ok "Package packing works (package_id=$PACKAGE_ID)"
    elif [[ "$pack_status" == "400" ]]; then
      warn "Package packing returned 400 (likely insufficient inventory), endpoint reachable"
    else
      cat "$pack_body" >&2
      rm -f "$pack_body"
      fail "POST /packages/$PACKAGE_ID/pack failed (status=$pack_status)"
    fi
    rm -f "$pack_body"
  else
    warn "No package available; packing check skipped"
  fi
else
  warn "Mutating checks were skipped. Re-run with --with-mutations to validate PATCH/POST behavior."
fi

printf "\nAll selected incremental checks completed.\n"
