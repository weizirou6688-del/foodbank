from app.core.bootstrap_demo import (
    ensure_demo_food_banks,
    ensure_demo_inventory_and_packages,
    ensure_demo_users,
)
from app.core.bootstrap_redemption import ensure_canonical_redemption_codes
from app.core.bootstrap_seed import DEMO_PACKAGES
from app.core.bootstrap_scope import ensure_demo_admin_scope_records


async def ensure_base_demo_data() -> None:
    for step in (
        ensure_demo_food_banks,
        ensure_demo_users,
        ensure_demo_inventory_and_packages,
    ):
        await step()


async def ensure_full_demo_data() -> None:
    await ensure_base_demo_data()
    await ensure_demo_admin_scope_records()
