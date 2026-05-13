# Backend Implementation

Last updated: 2026-04-14

This document summarizes the backend that is currently implemented in this
repository. The source of truth is the code under `backend/app`, the Alembic
history under `backend/alembic`, and the live OpenAPI schema served by the app.

## Overview

- Web framework: FastAPI with Uvicorn
- Runtime ORM access: SQLAlchemy 2 async engine and `AsyncSession`
- Database: PostgreSQL
- Migrations: Alembic
- Runtime DB driver: `asyncpg`
- Migration / admin DB driver: `psycopg2-binary`
- Auth: JWT bearer access tokens only
- Password reset: email + verification code flow backed by
  `password_reset_tokens`
- Mail: SMTP via `aiosmtplib`

## Dependency Layers

- `backend/requirements.txt`
  - runtime web stack
  - runtime database access
  - Alembic and database admin tooling
- `backend/requirements-dev.txt`
  - test-only additions such as `pytest` and `httpx`

## Runtime Architecture

### App entrypoint

- File: `backend/app/main.py`
- Registers all routers under `/api/v1`
- Configures CORS
- Exposes `/` and `/health`
- Starts in degraded mode if the database is unavailable
- Runs startup tasks for:
  - redemption code normalization
  - dashboard history backfill
  - application expiry pass and background loop

### Configuration model

- File: `backend/app/core/config.py`
- Loads local defaults from repo-root `dev.env`
- Loads backend runtime settings from `backend/.env`
- Treat `backend/.env` as the runtime source for secrets and DB credentials
- Treat `dev.env` as local development defaults for ports and startup scripts

### Database access model

- File: `backend/app/core/database.py`
- Uses `create_async_engine(settings.database_url)`
- Runtime connections expect `postgresql+asyncpg://...`
- Alembic converts that DSN to `postgresql+psycopg2://...` in
  `backend/alembic/env.py`
- Application startup does not call `Base.metadata.create_all()`
- Schema changes are expected to flow through Alembic migrations

## Auth Model

### Current token behavior

- Login endpoint: `POST /api/v1/auth/login`
- Response model: `access_token`, `token_type`, `user`
- Token type enforced by `app/core/security.py` is `access`
- There is no refresh-token issuance or `/api/v1/auth/refresh` endpoint in the
  current backend

### Auth endpoints

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `GET /api/v1/auth/me`

### Authorization model

- Roles: `public`, `supermarket`, `admin`
- Local admin scope is represented by `role=admin` plus `food_bank_id`
- Platform admin is an admin token without a scoped `food_bank_id`
- Route guards live in `backend/app/core/security.py`

## API Domains

### Health

- Prefix: none
- Paths: `/`, `/health`

### Food banks

- Prefix: `/api/v1/food-banks`
- Includes internal food-bank records, geocoding, and external feed proxying

### Applications

- Prefix: `/api/v1/applications`
- Covers public submission, user history, admin record views, redemption lookup,
  redeem, and void flows

### Donations

- Prefix: `/api/v1/donations`
- Covers cash donations, goods donations, supermarket intake, and admin queries

### Inventory

- Prefix: `/api/v1/inventory`
- Covers item CRUD, stock in/out, low-stock alerts, and lot management

### Food packages

- Mounted under `/api/v1`
- Main paths:
  - `/api/v1/packages`
  - `/api/v1/packages/{package_id}`
  - `/api/v1/packages/{package_id}/pack`
  - `/api/v1/food-banks/{food_bank_id}/packages`

### Stats

- Prefix: `/api/v1/stats`
- Includes public impact metrics, dashboard analytics, and supporting admin
  stats endpoints

## Data Model Notes

### Core persistence rules

- PostgreSQL + Alembic are the schema source of truth
- ORM models are expected to match the migrated schema
- Audit and soft-delete columns exist on multiple operational tables
- Inventory availability is lot-based, not item-stock-column-based

### Important operational tables

- `inventory_lots` is the stock source used for FEFO behavior
- `application_distribution_snapshots` preserves fulfillment history
- `password_reset_tokens` is active, not legacy residue
- `donations_cash` supports one-time and monthly donation metadata

## Current Development Notes

- `scripts/quick_start.bat` can start backend and frontend locally
- Demo data is only seeded when explicitly requested by scripts or direct
  script execution
- Historical exported API docs under `docs/API_Docs_*.html` may lag behind the
  current backend implementation
- For current contract inspection, prefer:
  - `http://localhost:8000/docs`
  - `http://localhost:8000/openapi.json`
  - the router and schema code under `backend/app`

## Recommended Source Order

When checking backend behavior, use this order:

1. Router and service code under `backend/app`
2. Pydantic schemas under `backend/app/schemas`
3. Alembic migrations under `backend/alembic/versions`
4. Live `/docs` or `/openapi.json`
5. Historical reports only as dated context
