"""共享 demo 种子数据的入口,可选叠加范围内的扩展数据。"""

from app.core.bootstrap_demo import (
    ensure_demo_food_banks,
    ensure_demo_inventory_and_packages,
    ensure_demo_users,
)
from app.core.bootstrap_scope import ensure_demo_admin_scope_records


async def ensure_base_demo_data() -> None:
    await ensure_demo_food_banks()
    await ensure_demo_users()
    await ensure_demo_inventory_and_packages()


async def ensure_full_demo_data() -> None:
    # 范围内的种子数据要求共享的 food bank、用户和商品目录已经存在
    await ensure_base_demo_data()
    await ensure_demo_admin_scope_records()
