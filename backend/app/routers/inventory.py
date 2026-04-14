from fastapi import APIRouter, status

from app.routers.inventory_alerts import get_low_stock_items
from app.routers.inventory_items import list_inventory
from app.routers.inventory_items_admin import (
    create_inventory_item,
    delete_inventory_item,
    stock_in,
    stock_out,
    update_inventory_item,
)
from app.routers.inventory_lots import (
    adjust_inventory_lot,
    delete_inventory_lot,
    list_inventory_lots,
)
from app.schemas.inventory_item import (
    InventoryItemListResponse,
    InventoryItemOut,
    LowStockItem,
)
from app.schemas.inventory_lot import InventoryLotOut


router = APIRouter(tags=["Inventory"])
router.add_api_route("", list_inventory, methods=["GET"], response_model=InventoryItemListResponse)
router.add_api_route("", create_inventory_item, methods=["POST"], response_model=InventoryItemOut, status_code=status.HTTP_201_CREATED)
router.add_api_route("/lots", list_inventory_lots, methods=["GET"], response_model=list[InventoryLotOut])
router.add_api_route("/lots/{lot_id}", adjust_inventory_lot, methods=["PATCH"], response_model=InventoryLotOut)
router.add_api_route("/lots/{lot_id}", delete_inventory_lot, methods=["DELETE"], status_code=status.HTTP_204_NO_CONTENT)
router.add_api_route("/low-stock", get_low_stock_items, methods=["GET"], response_model=list[LowStockItem])
router.add_api_route("/{item_id}", update_inventory_item, methods=["PATCH"], response_model=InventoryItemOut)
router.add_api_route("/{item_id}", delete_inventory_item, methods=["DELETE"], status_code=status.HTTP_204_NO_CONTENT)
router.add_api_route("/{item_id}/stock-in", stock_in, methods=["POST"], response_model=InventoryItemOut)
router.add_api_route("/{item_id}/stock-out", stock_out, methods=["POST"], response_model=InventoryItemOut)
