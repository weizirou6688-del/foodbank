"""
Compatibility stub: food_banks router has been moved to app.modules.food_banks

All functions and router are re-exported from the new location for backward compatibility.
"""

from app.modules.food_banks.router import (
    router,
    list_food_bank_inventory_items,
    list_food_banks,
    get_food_bank,
    create_food_bank,
    update_food_bank,
    delete_food_bank,
)

__all__ = [
    "router",
    "list_food_bank_inventory_items",
    "list_food_banks",
    "get_food_bank",
    "create_food_bank",
    "update_food_bank",
    "delete_food_bank",
]

