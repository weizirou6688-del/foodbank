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

## Demo Accounts

| Role        | Email                    | Password         |
|-------------|--------------------------|------------------|
| Admin       | admin@foodbank.com       | admin123         |
| Supermarket | supermarket@foodbank.com | supermarket123   |
| Public User | user@example.com         | user12345        |

## Notes

- The backend seeds demo users and demo food banks on startup.
- Inventory is tracked with lot-based stock internally, while some frontend screens still use compatibility `stock` fields from the API.
- Some admin reporting widgets are still demo-style placeholders and do not yet represent complete production analytics.
- If local PostgreSQL has been used before, prefer running Alembic against a clean project database rather than reusing a half-initialized schema.
- For the full Windows database setup and analytics-data workflow, see [docs/Windows本地数据库与分析数据生成指南_20260329.md](c:/Users/weicq/Desktop/foodbank/docs/Windows本地数据库与分析数据生成指南_20260329.md).
