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


# Common fields for inventory item creation and responses.
class InventoryItemBase(BaseModel):
    # From spec: name: VARCHAR(200), NOT NULL
    # Validation: 1-200 characters (non-empty, max 200).
    name: str = Field(min_length=1, max_length=200)

    # From spec: category: VARCHAR(100), NOT NULL
    # Food category (e.g., "Vegetables", "Grains", "Dairy").
    # Validation: 1-100 characters (non-empty, max 100).
    category: InventoryCategory

    # From spec: stock: INTEGER, NOT NULL, DEFAULT 0
    # Current quantity in stock. Validation: ge=0 (non-negative).
    stock: int = Field(default=0, ge=0)

    # From spec: unit: VARCHAR(50), NOT NULL
    # Unit of measure (e.g., "cans", "kg", "boxes", "liters").
    # Validation: 1-50 characters.
    unit: str = Field(min_length=1, max_length=50)

    # From spec: threshold: INTEGER, NOT NULL, DEFAULT 10
    # Stock level triggering restock alerts. Validation: ge=0.
    threshold: int = Field(default=10, ge=0)


# Schema for creating new inventory items.
class InventoryItemCreate(InventoryItemBase):
    # Inherits all fields from InventoryItemBase.
    # ID and updated_at auto-generated server-side.
    pass


class InventoryItemCreateRequest(BaseModel):
    food_bank_id: int | None = Field(default=None, gt=0)
    name: str = Field(min_length=1, max_length=200)
    category: InventoryCategory
    initial_stock: int = Field(ge=0)
    unit: str = Field(default="units", min_length=1, max_length=50)
    threshold: int = Field(default=10, ge=0)


# Schema for updating inventory item details.
class InventoryItemUpdate(BaseModel):
    # All fields optional for granular updates.
    # E.g., can update stock without changing category or threshold.

    name: str | None = Field(default=None, min_length=1, max_length=200)
    category: InventoryCategory | None = None
    stock: int | None = Field(default=None, ge=0)
    unit: str | None = Field(default=None, min_length=1, max_length=50)
    threshold: int | None = Field(default=None, ge=0)


# Schema for API responses (reading inventory data).
class InventoryItemOut(InventoryItemBase):
    # ConfigDict(from_attributes=True) enables conversion from ORM InventoryItem model.
    model_config = ConfigDict(from_attributes=True)

    # From spec: id: SERIAL (PK)
    # Included in response so client knows the item's system ID.
    id: int

    food_bank_id: int | None = None

    # TODO: 从活跃批次实时计算（未过期、未废弃）。
    total_stock: int = 0

    # From spec: updated_at: TIMESTAMP, NOT NULL, DEFAULT NOW()
    # Audit field: last modification time (updated on every change).
    updated_at: datetime


class InventoryItemListResponse(BaseModel):
    # TODO: 实现真实分页
    items: list[InventoryItemOut]
    total: int
    page: int
    size: int
    pages: int


# Schema for stock adjustment (stock-in/stock-out operations).
class StockAdjustment(BaseModel):
    """
    Request schema for adjusting inventory quantity.
    
    Used for POST /inventory/:id/stock-in and POST /inventory/:id/stock-out.
    """
    # Quantity to add or remove
    quantity: int = Field(gt=0, description="Positive integer quantity to add or remove")
    
    # Reason/notes for the adjustment
    reason: str = Field(min_length=1, max_length=500, description="Reason for stock adjustment")


# Schema for low-stock alert response.
class LowStockItem(BaseModel):
    """
    Response schema for low-stock items in GET /inventory/low-stock.
    
    Represents an inventory item with current total stock that is below
    the specified threshold.
    """
    model_config = ConfigDict(from_attributes=True)
    
    # Inventory item ID
    id: int
    
    # Item name
    name: str
    
    # Item category
    category: InventoryCategory
    
    # Unit of measure
    unit: str
    
    # Current total stock (sum of active lots)
    current_stock: int = Field(description="Total quantity from active lots")
    
    # Stock threshold level
    threshold: int = Field(description="Stock level threshold")
    
    # Difference: how much below threshold
    stock_deficit: int = Field(description="Amount below threshold")
