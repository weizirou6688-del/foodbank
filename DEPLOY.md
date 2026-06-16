# Deploying ABC Community Food Bank (live demo)

Stack: **Neon** (free Postgres, permanent) + **Render** (free FastAPI web service) + **Vercel** (free React frontend). All sign in with GitHub; none need a credit card.

> Heads-up: Render's free web service **sleeps after ~15 min idle**, so the first visit after a gap takes ~30–50s to wake. Normal for a free demo.

---

## 1. Database — Neon
1. Sign up at https://neon.tech with GitHub.
2. Create a project (region: EU / Frankfurt). It creates a database.
3. Copy the connection string. It looks like:
   `postgresql://USER:PASS@ep-xxxx.eu-central-1.aws.neon.tech/dbname?sslmode=require`
4. **Convert it for this app** (async driver, no query string):
   `postgresql+asyncpg://USER:PASS@ep-xxxx.eu-central-1.aws.neon.tech/dbname`
   (drop `?sslmode=require` — SSL is handled by the `DB_SSL` env var instead.)
   Keep this string for step 2.

## 2. Backend — Render
1. Sign up at https://render.com with GitHub; allow access to the `foodbank` repo.
2. New → **Blueprint** → pick the `foodbank` repo, branch `deploy`. Render reads `render.yaml`.
3. When prompted for the two `sync:false` vars:
   - `DATABASE_URL` = the `postgresql+asyncpg://…` string from step 1.
   - `CORS_ORIGINS` = leave as a placeholder for now (e.g. `https://localhost`); we fix it in step 4.
4. Deploy. First build runs migrations + seeds demo data. When live you'll have:
   - API base: `https://foodbank-api-XXXX.onrender.com`
   - **API docs (Swagger):** `https://foodbank-api-XXXX.onrender.com/docs`  ← great link for a backend CV.

## 3. Frontend — Vercel
1. Sign up at https://vercel.com with GitHub; import the `foodbank` repo.
2. Settings: **Root Directory = `frontend`** (Vercel auto-detects Vite + `vercel.json`).
3. Add an Environment Variable:
   - `VITE_API_URL` = your Render API base from step 2 (no trailing slash), e.g. `https://foodbank-api-XXXX.onrender.com`
4. Deploy. You'll get a URL like `https://foodbank-ava.vercel.app` ← the **live app** link.

## 4. Wire CORS (connect the two)
1. Back in Render → the service → Environment → set `CORS_ORIGINS` = your Vercel URL (exact, no trailing slash), e.g. `https://foodbank-ava.vercel.app`.
2. Save → Render redeploys. The frontend can now call the backend.

## 5. Demo login
The seed script (`backend/scripts/seed_demo_data.py`) creates demo accounts — check its output / `app/core/bootstrap_seed_data.json` for the demo admin email + password, and put them on the site or share with reviewers so they can log in.

## 6. Put the links on the CV
- **Live app:** the Vercel URL
- **API docs:** the Render `…/onrender.com/docs` URL (strongest signal for a backend role)

---

### Local dev is unaffected
The only code changes are SSL handling gated behind `DB_SSL` (unset locally → no change) in `backend/app/core/database.py` and `backend/alembic/env.py`.
