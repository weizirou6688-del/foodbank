## Development Rules

This document records the project-level constraints that help contributors make
safe changes without disrupting the existing structure.

### Repository Structure

- Keep the current backend module layout stable:
  - `backend/app/models/`
  - `backend/app/schemas/`
  - `backend/app/routers/`
  - `backend/app/modules/`
- Keep the current frontend layout stable:
  - `frontend/src/pages/`
  - `frontend/src/app/`
  - `frontend/src/shared/`
- Add new files when needed, but avoid renaming or collapsing established
  directories unless the task explicitly requires a broader refactor.

### Database Changes

- Use Alembic for schema changes.
- Add a new migration for every schema update.
- Do not edit old migration files unless a repair task explicitly targets them.
- Avoid destructive schema changes unless they are required and the impact is
  understood.

### Change Scope

- Prefer small, well-scoped changes over broad rewrites.
- Keep related backend model, schema, and API changes aligned.
- Keep complex frontend business logic in reusable store or shared modules when
  possible instead of duplicating it across pages.

### Protected Files

The following files should only change when the task clearly requires it:

- `README.md`
- `backend/requirements.txt`
- `backend/alembic.ini`
- `backend/app/core/config.py`
- `backend/app/main.py`
- `frontend/package.json`
- `frontend/package-lock.json`
- `frontend/vite.config.ts`
- `frontend/tsconfig.json`
- `frontend/tailwind.config.js`
- `frontend/postcss.config.js`
- environment files such as `.env` and `.env.*`

### Stack

- Backend: Python, FastAPI, SQLAlchemy, Alembic
- Frontend: React, TypeScript, Vite, Tailwind CSS
- State management: Zustand
- Database: PostgreSQL

### Working Style

- Keep public-facing copy concrete and specific.
- Remove outdated TODO comments once the corresponding logic exists.
- Prefer maintainable naming over prototype-era names.
