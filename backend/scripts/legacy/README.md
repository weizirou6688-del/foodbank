# Legacy Backend Scripts

This directory contains backend scripts that are kept for historical data
maintenance, not for normal day-to-day project operation.

## Current Contents

- `cleanup_legacy_bankless_inventory.py`
  - previews or removes legacy `food_bank_id = NULL` inventory shell items
  - should only be used when explicitly auditing old null-scope inventory data

## Rules

- Prefer active scripts under `backend/scripts/` for normal local development.
- Keep compatibility shims at former paths until all docs and local habits have
  migrated.
- Do not move analytics cleanup, runtime test cleanup, or demo seed scripts
  here unless they have clearly become historical-only tooling.

## Latest Preview

- 2026-04-14 local preview:
  - historical compatibility layer: `1`
  - migrate before archive: `7`
  - safe cleanup candidates: `0`

This means the script is still needed for historical-data assessment and should
not be removed yet.
