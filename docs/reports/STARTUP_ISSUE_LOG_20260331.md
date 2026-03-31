# Startup Issue Log - 2026-03-31

## Current Verified State

- Frontend is reachable at `http://localhost:5173`
- Backend is reachable at `http://localhost:8000`
- Health endpoint now returns `{"status":"ok","database":"connected"}`
- Active ports are recorded in:
  - `.logs/backend.port`
  - `.logs/frontend.port`
- Demo login was verified through the frontend proxy:
  - `admin@foodbank.com / admin123`

## What Was Fixed In This Round

### 1. Port occupation is no longer treated as service identity

- Area: startup scripts
- Fix:
  - `scripts/quick_start.bat` now checks whether the listener on a port is actually this project before reusing it
  - if the preferred port belongs to another process, the script falls back within the configured port range
- Result:
  - the original symptom of "all test accounts cannot log in" is no longer masked by accidentally talking to the wrong service

### 2. `/health` now reflects database readiness correctly

- Area: backend health reporting
- Files:
  - `backend/app/main.py`
  - `backend/app/core/database.py`
- Fix:
  - database readiness is checked with an actual round-trip query
  - FastAPI stores `db_ready` and `db_error` in app state
  - `GET /health` now returns:
    - `200` with `status: ok` when the database is connected
    - `503` with `status: degraded` when the database is unavailable
- Result:
  - startup scripts can distinguish a usable backend from a degraded one

### 3. Quick start now checks real database connectivity

- Area: startup preflight
- Files:
  - `scripts/quick_start.bat`
  - `backend/scripts/check_database.py`
- Fix:
  - quick start now validates the configured project database with the actual DB user and database name
  - it no longer relies on "something is listening on 5432" as a sufficient signal
- Result:
  - database failures are surfaced before backend reuse/startup decisions

### 4. Demo seed side effects were removed from FastAPI startup

- Area: backend startup behavior
- Files:
  - `backend/app/main.py`
  - `backend/scripts/seed_demo_data.py`
- Fix:
  - app startup now initializes tables and checks DB connectivity only
  - demo users and reference data are ensured explicitly from quick start
- Result:
  - app boot and demo-data mutation are no longer coupled

### 5. Frontend port, proxy, and CORS configuration now share one source of truth

- Area: frontend/backend local-dev config
- Files:
  - `dev.env`
  - `frontend/vite.config.ts`
  - `frontend/src/shared/lib/apiBaseUrl.ts`
  - `backend/app/core/config.py`
- Fix:
  - local host and port defaults are centralized in repo-root `dev.env`
  - backend CORS defaults are generated from the same frontend port range
  - frontend dev requests always use the same-origin Vite proxy in development
- Result:
  - the previous mismatch between startup scripts, Vite config, API base-url logic, and backend CORS defaults has been removed

### 6. Quick start now performs environment and dependency checks

- Area: startup robustness
- File:
  - `scripts/quick_start.bat`
- Fix:
  - checks for:
    - `backend/.env`
    - `python`, `node`, `npm`
    - frontend dependency installation
    - backend Python package availability
- Result:
  - common missing-environment failures now stop early with actionable messages

### 7. Startup logs and port records are cleaner

- Area: logging and operational cleanup
- Files:
  - `scripts/start_backend.ps1`
  - `scripts/start_frontend.ps1`
  - `scripts/quick_start.bat`
  - `scripts/stop.bat`
  - `.gitignore`
- Fix:
  - per-port logs are written under `.logs/`
  - each launcher overwrites its current per-port log on a fresh start instead of appending stale sessions forever
  - port files are written during startup flow instead of only at the very end
  - `stop.bat` now avoids duplicate saved-port/range kills
  - batch files were restored to CRLF for reliable `cmd.exe` label handling
- Result:
  - startup/stop behavior is easier to reason about and logs are materially easier to read

## Environment-Specific Issue Confirmed

### Vite/esbuild can still fail in a restricted environment

- Area: frontend toolchain
- Evidence:
  - reproduced directly in `.logs/frontend_5173.log`
  - error: `Error: spawn EPERM`
- Meaning:
  - this is not a project-code regression
  - it is an environment/process-spawn restriction affecting Vite/esbuild
- Current handling:
  - the frontend was successfully started outside the restricted sandbox and verified afterward
- Remaining risk:
  - the same machine/session may require the same workaround again when the frontend is started from a restricted execution context

## Verification Performed

1. `python backend/scripts/check_database.py`
   - result: success
2. `python -m pytest tests/api/test_error_handling.py`
   - result: `12 passed`
3. `cmd /c scripts\quick_start.bat`
   - result: success
4. `GET http://127.0.0.1:8000/health`
   - result: `{"status":"ok","database":"connected"}`
5. `GET http://127.0.0.1:5173/api/v1/food-banks`
   - result: `200`
6. `POST http://127.0.0.1:5173/api/v1/auth/login`
   - result: login success for `admin@foodbank.com`

## Remaining Non-Startup Issues Observed During Verification

These were observed in runtime logs during this round, but were not part of the startup-fix scope.

### 1. External food-bank feed can still return `502`

- Evidence:
  - observed in `.logs/backend_8000.log`
- Impact:
  - some external-feed dependent features may still fail even though local startup is healthy

### 2. Food package response serialization may still hit `MissingGreenlet`

- Evidence:
  - observed in `.logs/backend_8000.log`
  - log shows a `ResponseValidationError` while serializing `package_items`
- Inference:
  - this looks like an async SQLAlchemy lazy-load issue in food-package response serialization
- Impact:
  - parts of the package-management flow may still throw 500s independently of startup

## Files Changed In This Round

- `dev.env`
- `README.md`
- `.gitignore`
- `backend/app/core/config.py`
- `backend/app/core/database.py`
- `backend/app/main.py`
- `backend/scripts/check_database.py`
- `backend/scripts/seed_demo_data.py`
- `backend/tests/api/test_error_handling.py`
- `frontend/vite.config.ts`
- `frontend/src/shared/lib/apiBaseUrl.ts`
- `scripts/quick_start.bat`
- `scripts/start_backend.ps1`
- `scripts/start_frontend.ps1`
- `scripts/stop.bat`
