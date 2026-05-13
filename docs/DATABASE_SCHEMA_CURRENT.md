# Current Database Schema Reference

Last updated: 2026-04-14

This file is the current repository-aligned database reference. It is based on
the SQLAlchemy models under `backend/app/models`, the Alembic history under
`backend/alembic/versions`, and the current backend implementation.

It is intentionally no longer treated as a live row-count snapshot of one local
database instance. Older schema snapshots caused confusion after the ORM / DB
drift cleanup because they still described removed tables, missing models, and
startup behavior that no longer matched the code.

## Source Of Truth

Use this order when checking current database behavior:

1. Alembic migrations under `backend/alembic/versions`
2. SQLAlchemy models under `backend/app/models`
3. Runtime backend code under `backend/app`
4. Live `/docs` or `/openapi.json`

Do not treat historical exported HTML docs or old project reports as schema
authority.

## Stack

- Database engine: PostgreSQL
- Runtime ORM: SQLAlchemy 2 async ORM
- Runtime driver: `asyncpg`
- Migration tool: Alembic
- Migration / admin driver: `psycopg2-binary`

## Current Schema Rules

- Production and local schema changes should flow through Alembic migrations.
- FastAPI startup does not call `Base.metadata.create_all()`.
- The ORM models in `backend/app/models` are expected to align with the
  migration-defined schema.
- `password_reset_tokens` is an active table, not legacy residue.

## Active Tables By Domain

### Auth

- `users`
- `password_reset_tokens`

Notes:

- Authentication is access-token-only at the API layer.
- There is no refresh-token table or `/api/v1/auth/refresh` endpoint in the
  current backend.
- `users.food_bank_id` remains the admin scope marker for local admins.

### Food Bank Directory

- `food_banks`

Notes:

- `food_banks` stores location and notification metadata.
- Opening hours are no longer modeled as a live runtime table in the current
  backend.

### Inventory

- `inventory_items`
- `inventory_lots`
- `inventory_waste_events`
- `restock_requests`

Notes:

- Item-level inventory availability is lot-based.
- `inventory_items.stock` has already been removed from the schema history.
- `inventory_items.food_bank_id = NULL` is treated as historical legacy residue,
  not the target business model.
- `restock_requests` still exists in the schema as a low-stock workflow table,
  but the standalone runtime API entry `/api/v1/restock` has been removed.

### Packages

- `food_packages`
- `package_items`

Notes:

- `food_packages.stock` is still an active package-level field.
- Package composition is modeled through `package_items`.
- Package records are scoped by `food_bank_id` and soft-delete / active flags.

### Applications

- `applications`
- `application_items`
- `application_distribution_snapshots`

Notes:

- `applications.redemption_code` remains unique.
- Distribution snapshots are kept as audit history even if recipes later change.
- Redemption lookup still includes legacy code-format compatibility in runtime
  logic.

### Donations

- `donations_cash`
- `donations_goods`
- `donation_goods_items`

Notes:

- `donations_cash` supports one-time and monthly donation metadata.
- `donations_goods` stores donor/contact info plus food-bank snapshot fields.
- `food_bank_id = NULL` donation rows are treated as historical legacy data, not
  the intended steady-state model.

## Removed Or Historical-Only Schema Paths

### `food_bank_hours`

- This table existed in earlier migrations.
- It was removed from the current runtime model and later dropped by
  `backend/alembic/versions/20260411_0023_drop_food_bank_hours_table.py`.
- Any references to `FoodBankHourOut`, `/food_bank_hours`, or temporal opening
  hours in old docs should be treated as historical only.

### `inventory_items.stock`

- This column was part of the old pre-lot inventory model.
- Stock was migrated into `inventory_lots` in
  `backend/alembic/versions/20260326_0007_migrate_inventory_stock.py`.
- The deprecated column was removed by
  `backend/alembic/versions/20260326_0013_remove_inventory_items_stock.py`.

## Current Data Modeling Notes

- Soft-delete columns exist on several operational tables, including inventory,
  packages, restock requests, applications, and donations.
- Local admin scoping is implemented with `role=admin` plus `food_bank_id`.
- Demo/bootstrap code still contains compatibility cleanup for older unscoped
  seed data; that logic is not proof that null-scoped data is part of the
  target design.

## Historical Docs Warning

The following files are historical exports or reports and may contain obsolete
contract details such as refresh tokens, `/api/v1/restock`, or
`FoodBankHourOut`:

- `docs/archive/API_Docs_CN_Slim.html`
- `docs/archive/API_Docs_Export.html`
- older dated reports under `docs/` and `docs/reports/`

For current behavior, prefer the backend code and live OpenAPI output.
