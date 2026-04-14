from fastapi import APIRouter, status

from app.routers.food_banks_admin import (
    create_food_bank,
    delete_food_bank,
    update_food_bank,
)
from app.routers.food_banks_public import (
    geocode_postcode,
    get_external_food_banks_feed,
    get_food_bank,
    list_food_bank_inventory_items,
    list_food_banks,
)
from app.schemas.food_bank import FoodBankListResponse, FoodBankOut
from app.schemas.inventory_item import InventoryItemListResponse


router = APIRouter(tags=["Food Banks"])
router.add_api_route(
    "/{food_bank_id}/inventory-items",
    list_food_bank_inventory_items,
    methods=["GET"],
    response_model=InventoryItemListResponse,
)
router.add_api_route("/geocode", geocode_postcode, methods=["GET"])
router.add_api_route("/external-feed", get_external_food_banks_feed, methods=["GET"])
router.add_api_route(
    "",
    list_food_banks,
    methods=["GET"],
    response_model=FoodBankListResponse,
)
router.add_api_route("/{food_bank_id}", get_food_bank, methods=["GET"], response_model=FoodBankOut)
router.add_api_route(
    "",
    create_food_bank,
    methods=["POST"],
    response_model=FoodBankOut,
    status_code=status.HTTP_201_CREATED,
)
router.add_api_route(
    "/{food_bank_id}",
    update_food_bank,
    methods=["PATCH"],
    response_model=FoodBankOut,
)
router.add_api_route(
    "/{food_bank_id}",
    delete_food_bank,
    methods=["DELETE"],
    status_code=status.HTTP_204_NO_CONTENT,
)
