# Alembic Execution Guide

## Purpose

This guide covers the minimum safe Alembic workflow for the local `foodbank` project database.

## Prerequisites

- PostgreSQL is running locally.
- The `foodbank` database and user exist.
- `backend/.env` points at the intended local database.
- Python dependencies from `backend/requirements.txt` are installed.

## Common Commands

### Check Current Revision

```bash
cd backend
alembic current
```

### View Migration History

```bash
cd backend
alembic history
```

### Upgrade to Latest Revision

```bash
cd backend
alembic upgrade head
```

### Downgrade One Revision

```bash
cd backend
alembic downgrade -1
```

### Generate SQL Without Applying

```bash
cd backend
alembic upgrade head --sql
```

## Recommended Local Flow

1. Verify `backend/.env` points to the correct database.
2. Run `alembic current` to inspect the current revision.
3. Run `alembic upgrade head`.
4. Start the backend and confirm `GET /health` succeeds.
5. If needed, review `alembic history` before making further schema changes.

## Notes

- Do not edit old migration files unless the task is a repair task.
- Prefer adding a new migration over rewriting applied history.
- Run migrations against a clean local project database when debugging schema drift.