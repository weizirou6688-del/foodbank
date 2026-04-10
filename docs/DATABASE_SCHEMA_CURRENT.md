# Current Database Schema

Snapshot date: 2026-04-08
Source of truth: live local PostgreSQL database `foodbank`
Alembic revision in database: `20260407_0021`
Configured connection: `postgresql+asyncpg://foodbank:***@localhost:5432/foodbank`

This document is a practical schema snapshot of the database that is actually
running locally. It is based on live PostgreSQL introspection, then cross-checked
against the SQLAlchemy models and Alembic migration files.

## Stack

- Database engine: PostgreSQL
- ORM/runtime access: SQLAlchemy async engine
- Migration tool: Alembic
- Runtime config source: `backend/.env`

## Important Rule

Treat the live PostgreSQL schema and Alembic history as the current source of
truth. The ORM models under `backend/app/models` do not fully match the live
schema right now.

## Snapshot Summary

| Domain | Table | Primary key | Rows | Notes |
| --- | --- | --- | ---: | --- |
| Meta | `alembic_version` | `version_num` | 1 | Current migration version |
| Auth | `users` | `id` UUID | 36 | All application users |
| Auth | `password_reset_tokens` | `id` UUID | 1 | Live table, not represented in current ORM models |
| Network | `food_banks` | `id` int | 3 | Food bank locations |
| Network | `food_bank_hours` | `id` int | 0 | Opening hours with temporal validity columns |
| Inventory | `inventory_items` | `id` int | 22 | Item master data |
| Inventory | `inventory_lots` | `id` int | 24 | Batch-level stock tracking |
| Inventory | `inventory_waste_events` | `id` int | 8 | Waste and deletion audit events |
| Inventory | `restock_requests` | `id` int | 0 | Low-stock workflow |
| Packages | `food_packages` | `id` int | 7 | Package definitions |
| Packages | `package_items` | `id` int | 25 | Package recipe lines |
| Applications | `applications` | `id` UUID | 29 | Public requests/redemptions |
| Applications | `application_items` | `id` int | 17 | Requested package or direct inventory item lines |
| Applications | `application_distribution_snapshots` | `id` int | 61 | Distribution audit snapshots |
| Donations | `donations_cash` | `id` UUID | 14 | Monetary donations |
| Donations | `donations_goods` | `id` UUID | 21 | Goods donation headers |
| Donations | `donation_goods_items` | `id` int | 22 | Goods donation line items |

## Domain Relationships

```mermaid
erDiagram
    FOOD_BANKS ||--o{ USERS : "admin scope"
    FOOD_BANKS ||--o{ FOOD_BANK_HOURS : has
    FOOD_BANKS ||--o{ FOOD_PACKAGES : owns
    FOOD_BANKS ||--o{ APPLICATIONS : serves
    FOOD_BANKS ||--o{ DONATIONS_CASH : receives
    FOOD_BANKS ||--o{ DONATIONS_GOODS : receives

    USERS ||--o{ APPLICATIONS : submits
    USERS ||--o{ DONATIONS_GOODS : donates
    USERS ||--o{ RESTOCK_REQUESTS : assigned
    USERS ||--o{ PASSWORD_RESET_TOKENS : has

    FOOD_PACKAGES ||--o{ PACKAGE_ITEMS : contains
    INVENTORY_ITEMS ||--o{ PACKAGE_ITEMS : included_in

    INVENTORY_ITEMS ||--o{ INVENTORY_LOTS : stocked_as
    INVENTORY_ITEMS ||--o{ RESTOCK_REQUESTS : triggers
    INVENTORY_ITEMS ||--o{ INVENTORY_WASTE_EVENTS : referenced_by

    APPLICATIONS ||--o{ APPLICATION_ITEMS : has
    FOOD_PACKAGES ||--o{ APPLICATION_ITEMS : requested_as_package
    INVENTORY_ITEMS ||--o{ APPLICATION_ITEMS : requested_as_direct_item

    APPLICATIONS ||--o{ APPLICATION_DISTRIBUTION_SNAPSHOTS : audited_by
    FOOD_PACKAGES ||--o{ APPLICATION_DISTRIBUTION_SNAPSHOTS : package_snapshot
    INVENTORY_ITEMS ||--o{ APPLICATION_DISTRIBUTION_SNAPSHOTS : item_snapshot

    DONATIONS_GOODS ||--o{ DONATION_GOODS_ITEMS : contains
```

## Table Details

### `users`

Purpose: user accounts for public users, supermarkets, and admins.

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | no | PK, default `gen_random_uuid()` |
| `name` | `varchar` | no | Display name |
| `email` | `varchar` | no | Unique |
| `password_hash` | `varchar` | no | Hashed password |
| `role` | `varchar` | no | Check: `public`, `supermarket`, `admin` |
| `created_at` | `timestamp` | no | Default `now()` |
| `updated_at` | `timestamp` | no | Default `now()` |
| `food_bank_id` | `int` | yes | FK to `food_banks.id` |

### `password_reset_tokens`

Purpose: password reset token storage in the live database.

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | no | PK, default `gen_random_uuid()` |
| `user_id` | `uuid` | no | FK to `users.id` |
| `token_hash` | `varchar` | no | Unique |
| `expires_at` | `timestamp` | no | Expiration time |
| `used_at` | `timestamp` | yes | Mark consumed tokens |
| `created_at` | `timestamp` | no | Default `now()` |

### `food_banks`

Purpose: food bank location directory.

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | `int` | no | PK |
| `name` | `varchar` | no | Location name |
| `address` | `text` | no | Full address |
| `lat` | `numeric(9,6)` | no | Latitude |
| `lng` | `numeric(9,6)` | no | Longitude |
| `created_at` | `timestamp` | no | Default `now()` |
| `notification_email` | `varchar` | yes | Operational contact |

### `food_bank_hours`

Purpose: opening hours for each food bank.

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | `int` | no | PK |
| `food_bank_id` | `int` | no | FK to `food_banks.id` |
| `day_of_week` | `varchar` | no | Unique with `food_bank_id` |
| `open_time` | `time` | no | Opening time |
| `close_time` | `time` | no | Closing time |
| `created_at` | `timestamptz` | yes | Added later by migration |
| `updated_at` | `timestamptz` | yes | Added later by migration |
| `deleted_at` | `timestamptz` | yes | Soft delete |
| `valid_from` | `date` | no | Default `CURRENT_DATE` |
| `valid_to` | `date` | yes | Temporal validity end |

Notable constraints:

- Unique: `(food_bank_id, day_of_week)`
- Check: `ck_fh_valid_date_range`

### `inventory_items`

Purpose: inventory item master records.

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | `int` | no | PK |
| `name` | `varchar` | no | Item name |
| `category` | `varchar` | no | Checked category list |
| `unit` | `varchar` | no | Unit label |
| `threshold` | `int` | no | Default `10` |
| `updated_at` | `timestamp` | no | Default `now()` |
| `created_at` | `timestamptz` | yes | Added later by migration |
| `deleted_at` | `timestamptz` | yes | Soft delete |

### `inventory_lots`

Purpose: batch-level inventory tracking. This is the operational stock source.

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | `int` | no | PK |
| `inventory_item_id` | `int` | no | FK to `inventory_items.id` |
| `quantity` | `int` | no | Positive quantity |
| `expiry_date` | `date` | no | Indexed |
| `received_date` | `date` | no | Default `CURRENT_DATE` |
| `batch_reference` | `varchar` | yes | Batch or donation reference |
| `created_at` | `timestamptz` | no | Default `now()` |
| `updated_at` | `timestamptz` | no | Default `now()` |
| `deleted_at` | `timestamptz` | yes | Soft delete |

Notable constraints:

- Check: `quantity > 0`
- Check: `received_date <= expiry_date`

### `inventory_waste_events`

Purpose: audit trail for waste, expiry, manual deletion, or damaged stock.

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | `int` | no | PK |
| `inventory_lot_id` | `int` | yes | FK to `inventory_lots.id` |
| `inventory_item_id` | `int` | yes | FK to `inventory_items.id` |
| `item_name` | `varchar` | no | Snapshot field |
| `item_category` | `varchar` | no | Snapshot field |
| `item_unit` | `varchar` | yes | Snapshot field |
| `quantity` | `int` | no | Positive quantity |
| `reason` | `varchar` | no | Check: `manual_waste`, `damaged`, `expired`, `deleted` |
| `batch_reference` | `varchar` | yes | Snapshot field |
| `expiry_date` | `date` | yes | Snapshot field |
| `occurred_at` | `timestamptz` | no | Default `now()` |

### `restock_requests`

Purpose: low-stock workflow records for inventory replenishment.

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | `int` | no | PK |
| `inventory_item_id` | `int` | no | FK to `inventory_items.id` |
| `current_stock` | `int` | no | Snapshot value |
| `threshold` | `int` | no | Snapshot value |
| `urgency` | `varchar` | no | Check: `high`, `medium`, `low` |
| `assigned_to_user_id` | `uuid` | yes | FK to `users.id` |
| `status` | `varchar` | no | Check: `open`, `fulfilled`, `cancelled` |
| `created_at` | `timestamp` | no | Default `now()` |
| `updated_at` | `timestamptz` | yes | Added later by migration |
| `deleted_at` | `timestamptz` | yes | Soft delete |

### `food_packages`

Purpose: distributable package definitions.

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | `int` | no | PK |
| `name` | `varchar` | no | Package name |
| `category` | `varchar` | no | Checked category list |
| `description` | `text` | yes | Optional description |
| `stock` | `int` | no | Compatibility field retained in table |
| `threshold` | `int` | no | Default `5` |
| `applied_count` | `int` | no | Default `0` |
| `image_url` | `text` | yes | Optional image |
| `food_bank_id` | `int` | yes | FK to `food_banks.id` |
| `is_active` | `boolean` | no | Default `true` |
| `created_at` | `timestamp` | no | Default `now()` |
| `updated_at` | `timestamptz` | yes | Added later by migration |
| `deleted_at` | `timestamptz` | yes | Soft delete |

### `package_items`

Purpose: package composition lines.

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | `int` | no | PK |
| `package_id` | `int` | no | FK to `food_packages.id` |
| `inventory_item_id` | `int` | no | FK to `inventory_items.id` |
| `quantity` | `int` | no | Default `1` |

### `applications`

Purpose: public assistance requests, redemption, and soft-delete lifecycle.

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | no | PK, default `gen_random_uuid()` |
| `user_id` | `uuid` | no | FK to `users.id` |
| `food_bank_id` | `int` | no | FK to `food_banks.id` |
| `redemption_code` | `varchar` | no | Unique |
| `status` | `varchar` | no | Check: `pending`, `collected`, `expired` |
| `total_quantity` | `int` | no | Requested total |
| `created_at` | `timestamp` | no | Default `now()` |
| `updated_at` | `timestamptz` | yes | Default `now()` |
| `deleted_at` | `timestamptz` | yes | Soft delete |
| `week_start` | `date` | no | Weekly limit anchor |
| `redeemed_at` | `timestamptz` | yes | Collection timestamp |

### `application_items`

Purpose: line items within an application.

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | `int` | no | PK |
| `application_id` | `uuid` | no | FK to `applications.id` |
| `package_id` | `int` | yes | FK to `food_packages.id` |
| `quantity` | `int` | no | Requested quantity |
| `inventory_item_id` | `int` | yes | FK to `inventory_items.id` |

Notable constraints:

- Check: exactly one of `package_id` or `inventory_item_id` must be present

### `application_distribution_snapshots`

Purpose: frozen audit records of how an application was distributed.

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | `int` | no | PK |
| `application_id` | `uuid` | no | FK to `applications.id` |
| `snapshot_type` | `varchar` | no | Check: `package`, `package_component`, `direct_item` |
| `package_id` | `int` | yes | FK to `food_packages.id` |
| `package_name` | `varchar` | yes | Snapshot field |
| `package_category` | `varchar` | yes | Snapshot field |
| `inventory_item_id` | `int` | yes | FK to `inventory_items.id` |
| `inventory_item_name` | `varchar` | yes | Snapshot field |
| `inventory_item_category` | `varchar` | yes | Snapshot field |
| `inventory_item_unit` | `varchar` | yes | Snapshot field |
| `requested_quantity` | `int` | no | Positive |
| `quantity_per_package` | `int` | yes | Recipe quantity |
| `distributed_quantity` | `int` | no | Non-negative |
| `recipe_unit_total` | `int` | yes | Expanded recipe total |
| `created_at` | `timestamptz` | no | Default `now()` |

### `donations_cash`

Purpose: monetary donations and their payment state.

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | no | PK, default `gen_random_uuid()` |
| `donor_email` | `varchar` | no | Indexed |
| `amount_pence` | `int` | no | Stored in pence |
| `payment_reference` | `varchar` | yes | Payment processor reference |
| `status` | `varchar` | no | Check: `completed`, `failed`, `refunded` |
| `created_at` | `timestamp` | no | Default `now()` |
| `updated_at` | `timestamptz` | yes | Added later by migration |
| `deleted_at` | `timestamptz` | yes | Soft delete |
| `donor_name` | `varchar` | yes | Added later by migration |
| `donor_type` | `varchar` | yes | Added later by migration |
| `food_bank_id` | `int` | yes | FK to `food_banks.id` |

### `donations_goods`

Purpose: goods donation headers and donor/contact metadata.

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | no | PK, default `gen_random_uuid()` |
| `donor_user_id` | `uuid` | yes | FK to `users.id` |
| `donor_name` | `varchar` | no | Donor name |
| `donor_email` | `varchar` | no | Indexed |
| `donor_phone` | `varchar` | no | Check: 11 digits |
| `notes` | `text` | yes | Optional notes |
| `status` | `varchar` | no | Check: `pending`, `received`, `rejected` |
| `created_at` | `timestamp` | no | Default `now()` |
| `updated_at` | `timestamptz` | yes | Added later by migration |
| `deleted_at` | `timestamptz` | yes | Soft delete |
| `food_bank_id` | `int` | yes | FK to `food_banks.id` |
| `postcode` | `varchar` | yes | Donor postcode |
| `pickup_date` | `varchar` | yes | Check: `DD/MM/YYYY` format |
| `item_condition` | `varchar` | yes | Condition label |
| `estimated_quantity` | `varchar` | yes | Free-form quantity |
| `food_bank_name` | `varchar` | yes | Snapshot field |
| `food_bank_address` | `text` | yes | Snapshot field |
| `donor_type` | `varchar` | yes | Added later by migration |

### `donation_goods_items`

Purpose: free-form line items within a goods donation.

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | `int` | no | PK |
| `donation_id` | `uuid` | no | FK to `donations_goods.id` |
| `item_name` | `varchar` | no | Free-form item name |
| `quantity` | `int` | no | Quantity |
| `expiry_date` | `date` | yes | Optional expiry |

## Key Indexes And Constraints

- `users.email` is unique.
- `applications.redemption_code` is unique.
- `food_bank_hours(food_bank_id, day_of_week)` is unique.
- `password_reset_tokens.token_hash` is unique.
- Soft-delete partial indexes exist on `applications`, `food_packages`,
  `inventory_items`, `food_bank_hours`, `restock_requests`, `donations_cash`,
  and `donations_goods`.
- `applications` has weekly access indexes on `(user_id, week_start)`.
- `inventory_lots` has an active-lot index on
  `(inventory_item_id, expiry_date, received_date)` with `deleted_at IS NULL`.

## Operational Notes

- Package stock still exists as `food_packages.stock`, but real item-level stock is
  lot-based in `inventory_lots`.
- `application_distribution_snapshots` acts as an audit table, preserving what was
  actually distributed even if package recipes later change.
- `food_bank_hours` is designed for temporal history through `valid_from` and
  `valid_to`, but the current ORM model does not include those columns.

## Schema Drift To Fix

The live database, ORM models, and migration history are not perfectly aligned.

1. `password_reset_tokens` exists in the live database, but there is no current
   SQLAlchemy model or Alembic migration for it in this repository search.
2. Several live columns are missing from the current ORM models, including:
   `food_bank_hours.valid_from`, `food_bank_hours.valid_to`,
   `food_packages.updated_at`, `food_packages.deleted_at`,
   `inventory_items.created_at`, `inventory_items.deleted_at`,
   `restock_requests.updated_at`, `restock_requests.deleted_at`,
   `donations_cash.updated_at`, `donations_cash.deleted_at`,
   `donations_goods.updated_at`, and `donations_goods.deleted_at`.
3. The application still calls `Base.metadata.create_all()` on startup, which means
   a fresh database created from models alone can drift from the schema produced by
   migrations and from the schema already running locally.

## Recommended Next Cleanup

1. Decide whether `password_reset_tokens` is active design or legacy residue.
2. Bring `backend/app/models` in line with the live schema, or remove the drift by
   adding a corrective Alembic migration.
3. Stop relying on `create_all()` for schema shape in non-test environments once
   migrations are the single authoritative path.
