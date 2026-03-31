"""
Pydantic schemas for InventoryItem entity validation and serialization.

These schemas handle:
- InventoryItemCreate: Specifies name, category, stock, unit, threshold.
- InventoryItemUpdate: Allows updates to any field (all optional).
- InventoryItemOut: Response includes ID and updated_at timestamp.

Stock and threshold are non-negative integers.
Category and name are used for filtering/searching inventory.
"""

from datetime import datetime
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


class InventoryItemCreate(InventoryItemBase):
    stock: int = Field(default=0, ge=0)


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
    stock: int | None = Field(default=None, ge=0)
    unit: str | None = Field(default=None, min_length=1, max_length=50)
    threshold: int | None = Field(default=None, ge=0)


class InventoryItemOut(InventoryItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: int

    # Compatibility field for the existing frontend. Routes should populate
    # this from active lot totals instead of a model column.
    stock: int = 0

    food_bank_id: int | None = None

    # Aggregated from active, non-expired inventory lots.
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


class LowStockItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: InventoryCategory
    unit: str
    current_stock: int = Field(description="Total quantity from active lots")
    threshold: int = Field(description="Stock level threshold")
    stock_deficit: int = Field(description="Amount below threshold")
