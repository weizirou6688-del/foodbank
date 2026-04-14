from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


InventoryCategory = Literal[
    "Proteins & Meat",
    "Vegetables",
    "Fruits",
    "Dairy",
    "Canned Goods",
    "Grains & Pasta",
    "Snacks",
    "Beverages",
    "Baby Food",
]


class InventoryItemBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    category: InventoryCategory
    unit: str = Field(min_length=1, max_length=50)
    threshold: int = Field(default=10, ge=0)


class InventoryItemCreateRequest(BaseModel):
    food_bank_id: int | None = Field(default=None, gt=0)
    name: str = Field(min_length=1, max_length=200)
    category: InventoryCategory
    initial_stock: int = Field(ge=0)
    unit: str = Field(default="units", min_length=1, max_length=50)
    threshold: int = Field(default=10, ge=0)


class InventoryItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    category: InventoryCategory | None = None
    unit: str | None = Field(default=None, min_length=1, max_length=50)
    threshold: int | None = Field(default=None, ge=0)


class InventoryItemOut(InventoryItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    stock: int = 0

    food_bank_id: int | None = None

    total_stock: int = 0

    updated_at: datetime


class InventoryItemListResponse(BaseModel):
    items: list[InventoryItemOut]
    total: int
    page: int
    size: int
    pages: int


class StockAdjustment(BaseModel):
    quantity: int = Field(gt=0, description="Positive integer quantity to add or remove")
    reason: str = Field(min_length=1, max_length=500, description="Reason for stock adjustment")
    expiry_date: date | None = Field(default=None, description="Optional expiry date for stock-in lots")


class LowStockItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: InventoryCategory
    unit: str
    current_stock: int = Field(description="Total quantity from active lots")
    threshold: int = Field(description="Stock level threshold")
    stock_deficit: int = Field(description="Amount below threshold")
