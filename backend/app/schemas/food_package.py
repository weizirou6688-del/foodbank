from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


FoodPackageCategory = Literal[
    "Pantry & Spices",
    "Breakfast",
    "Lunchbox",
    "Family Bundle",
    "Emergency Pack",
]


class FoodPackageBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    category: FoodPackageCategory
    description: str | None = None
    stock: int = Field(default=0, ge=0)
    threshold: int = Field(default=5, ge=0)
    applied_count: int = Field(default=0, ge=0)
    image_url: str | None = None
    food_bank_id: int | None = Field(default=None, gt=0)
    is_active: bool = True


class PackageContentCreate(BaseModel):
    item_id: int = Field(gt=0)
    quantity: int = Field(gt=0)


class FoodPackageCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    category: FoodPackageCategory
    threshold: int = Field(ge=0)
    contents: list[PackageContentCreate] = Field(min_length=1)
    description: str | None = None
    image_url: str | None = None
    food_bank_id: int | None = Field(default=None, gt=0)


class PackageContentOut(BaseModel):
    item_id: int
    quantity: int


class FoodPackageUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    category: FoodPackageCategory | None = None
    description: str | None = None
    stock: int | None = Field(default=None, ge=0)
    threshold: int | None = Field(default=None, ge=0)
    applied_count: int | None = Field(default=None, ge=0)
    image_url: str | None = None
    food_bank_id: int | None = Field(default=None, gt=0)
    is_active: bool | None = None
    contents: list[PackageContentCreate] | None = Field(default=None, min_length=1)


class FoodPackageOut(FoodPackageBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


class FoodPackageCreateResponse(FoodPackageOut):
    contents: list[PackageContentOut]


class PackageItemDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    inventory_item_id: int = Field(description="Inventory item ID")
    quantity: int
    inventory_item_name: str = Field(description="Name of physical item in package")
    inventory_item_unit: str = Field(description="Unit of measure (cans, kg, etc.)")


class FoodPackageDetailOut(FoodPackageOut):
    package_items: list[PackageItemDetail] = Field(
        default_factory=list,
        description="List of inventory items in this package with quantities",
    )

    model_config = ConfigDict(from_attributes=True)


class PackRequest(BaseModel):
    quantity: int = Field(
        gt=0,
        description="Number of packages to pack (deduct ingredients from inventory lots)",
    )


class ConsumedLotDetail(BaseModel):
    item_id: int = Field(description="Inventory item ID")
    lot_id: int = Field(description="Inventory lot ID")
    quantity_used: int = Field(description="Quantity deducted from this lot")
    remaining_in_lot: int = Field(description="Remaining quantity in lot after deduction")
    expiry_date: str = Field(description="Expiry date of the lot")
    batch_reference: str | None = Field(default=None, description="Batch reference code")


class PackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    package_id: int = Field(description="Package ID")
    package_name: str = Field(description="Package name")
    quantity: int = Field(description="Number of packages packed")
    new_stock: int = Field(description="Updated stock after packing")
    consumed_lots: list[ConsumedLotDetail] = Field(
        description="Details of inventory lots consumed during packing"
    )
    timestamp: str = Field(description="Operation timestamp (ISO format)")

