# ABC Community Food Bank

A Food Bank Information Management System with a React + TypeScript frontend and a FastAPI backend.

## Tech Stack

- Frontend: React 18 + TypeScript + Vite
- State: Zustand
- Routing: React Router v6
- Styling: CSS Modules + Tailwind CSS
- Backend: FastAPI + SQLAlchemy + Alembic
- Database: PostgreSQL

## Quick Start (Windows)

### One-Click Start

Double-click `scripts\quick_start.bat` to start all services automatically.

Startup now uses a shared repo-root `dev.env` file for frontend/backend port defaults. If the preferred port is already occupied by another app, the script will fall back to an available local port and print the actual frontend/backend URLs at the end. Active ports are also written to `.logs\frontend.port` and `.logs\backend.port`. Per-port runtime logs are written to `.logs\frontend_<port>.log` and `.logs\backend_<port>.log`.

If the repo-local `.venv` exists, the quick-start and backend launcher scripts will prefer that interpreter over the system `python` executable. This avoids mixed environments and makes stop/restart behaviour more predictable on Windows.

Or run from command line:

```batch
cd scripts
quick_start.bat
```

### Stop Services

```batch
cd scripts
stop.bat
```

### Cleanup Synthetic Analytics Data

Preview what the local analytics-data cleanup would remove:

```batch
cd scripts
cleanup_analytics_data.bat
```

Apply the cleanup:

```batch
cd scripts
cleanup_analytics_data.bat --apply
```

## Manual Setup

### Prerequisites

- **Node.js 18+** (for frontend)
- **Python 3.11+** (for backend)
- **PostgreSQL 14+** (for database)

### Database

Make sure PostgreSQL is running on port 5432.

Project-local database credentials are expected to be:

```text
Database: foodbank
User: foodbank
Password: foodbank
```

Note:

- These are project database credentials, not the PostgreSQL superuser password.
- Demo account passwords below are only for application login, not for PostgreSQL admin access.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend will be available at http://localhost:5173

### Backend

1. Create `.env` file in `backend/` directory:

```bash
cd backend
copy .env.example .env
```

2. Install dependencies and start:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend will be available at http://localhost:8000
API docs at http://localhost:8000/docs

Quick-start preflight now checks:

- Python, Node.js, and npm availability
- `backend\.env` presence
- frontend dependency installation
- backend Python package availability
- project database connectivity before reusing or launching the backend

In restricted or sandboxed Windows environments, Vite/esbuild can still fail with `spawn EPERM`. If that happens, start the frontend from a normal local terminal session.

## Demo Accounts

| Role        | Email                    | Password         |
|-------------|--------------------------|------------------|
| Admin       | admin@foodbank.com       | admin123         |
| Supermarket | supermarket@foodbank.com | supermarket123   |
| Public User | user@example.com         | user12345        |

## Notes

- Demo data is now explicitly ensured by the quick-start flow instead of being implicitly mutated during every FastAPI startup.
- Inventory is tracked with lot-based stock internally, while some frontend screens still use compatibility `stock` fields from the API.
- Some admin reporting widgets are still demo-style placeholders and do not yet represent complete production analytics.
- If local PostgreSQL has been used before, prefer running Alembic against a clean project database rather than reusing a half-initialized schema.
- For the full Windows database setup and analytics-data workflow, see [docs/Windows本地数据库与分析数据生成指南_20260329.md](docs/Windows本地数据库与分析数据生成指南_20260329.md).
