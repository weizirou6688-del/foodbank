"""
Pydantic schemas for FoodPackage entity validation and serialization.

These schemas handle:
- FoodPackageCreate: Name, category, stock, thresholds, optional description/image.
- FoodPackageUpdate: Allows updates to all fields (all optional).
- FoodPackageOut: Response with ID, creation timestamp, and status.
- FoodPackageDetailOut: Detailed response including package composition items.

Packages can be food-bank specific (food_bank_id set) or system-wide (NULL).
is_active flag enables soft deletion for historical tracking.
applied_count tracks popularity/demand metrics.
"""

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


# Common fields for food package creation and responses.
class FoodPackageBase(BaseModel):
    # From spec: name: VARCHAR(200), NOT NULL
    # Human-readable package name (e.g., "Family Nutrition Pack").
    # Validation: 1-200 characters.
    name: str = Field(min_length=1, max_length=200)

    # From spec: category: VARCHAR(100), NOT NULL
    # Package category (e.g., "Basic", "Premium", "Children").
    # Validation: 1-100 characters.
    category: FoodPackageCategory

    # From spec: description: TEXT
    # Detailed description of package contents and eligibility criteria.
    description: str | None = None

    # From spec: stock: INTEGER, NOT NULL, DEFAULT 0
    # Pre-assembled packages available. Validation: ge=0 (non-negative).
    stock: int = Field(default=0, ge=0)

    # From spec: threshold: INTEGER, NOT NULL, DEFAULT 5
    # Stock level triggering restock alert. Validation: ge=0.
    threshold: int = Field(default=5, ge=0)

    # From spec: applied_count: INTEGER, NOT NULL, DEFAULT 0
    # Cumulative deployments of this package (analytics). Validation: ge=0.
    applied_count: int = Field(default=0, ge=0)

    # From spec: image_url: TEXT
    # Optional URL to package image for UI display.
    image_url: str | None = None

    # From spec: food_bank_id: INTEGER, FK -> food_banks.id (nullable)
    # If set, package specific to that food bank; if NULL, system-wide.
    # Validation: gt=0 (positive ID) when supplied.
    food_bank_id: int | None = Field(default=None, gt=0)

    # From spec: is_active: BOOLEAN, NOT NULL, DEFAULT TRUE
    # Soft-deletion flag: true=active, false=archived.
    is_active: bool = True


# Schema for creating new food packages.
class FoodPackageCreate(FoodPackageBase):
    # Inherits all fields from FoodPackageBase.
    # ID and created_at auto-generated server-side.
    pass


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


class FoodPackageCreateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: FoodPackageCategory
    description: str | None
    stock: int
    threshold: int
    applied_count: int
    image_url: str | None
    food_bank_id: int | None
    is_active: bool
    created_at: datetime
    contents: list[PackageContentOut]


# Schema for updating food packages.
class FoodPackageUpdate(BaseModel):
    # All fields optional for granular updates.
    # E.g., can update is_active without touching stock levels.

    name: str | None = Field(default=None, min_length=1, max_length=200)
    category: FoodPackageCategory | None = None
    description: str | None = None
    stock: int | None = Field(default=None, ge=0)
    threshold: int | None = Field(default=None, ge=0)
    applied_count: int | None = Field(default=None, ge=0)
    image_url: str | None = None
    food_bank_id: int | None = Field(default=None, gt=0)
    is_active: bool | None = None


# Schema for API responses (reading package data).
class FoodPackageOut(FoodPackageBase):
    # ConfigDict(from_attributes=True) enables conversion from ORM FoodPackage model.
    model_config = ConfigDict(from_attributes=True)

    # From spec: id: SERIAL (PK)
    # Included in response so client knows the package's system ID.
    id: int

    # From spec: created_at: TIMESTAMP, NOT NULL, DEFAULT NOW()
    # Audit field: when package was created in system.
    created_at: datetime


# Detailed food package response with composition items (for GET /packages/:id).
class PackageItemDetail(BaseModel):
    """Simplified package item for response (includes inventory details)."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    quantity: int
    # Note: inventory_item details populated by service layer (name, category, unit, etc.)
    inventory_item_name: str = Field(description="Name of physical item in package")
    inventory_item_unit: str = Field(description="Unit of measure (cans, kg, etc.)")


class FoodPackageDetailOut(FoodPackageOut):
    # Extends FoodPackageOut with package composition (items + quantities).
    # From spec § 2.3: package/:id returns package details including contents.
    
    package_items: list["PackageItemDetail"] = Field(
        default_factory=list,
        description="List of inventory items in this package with quantities"
    )
    
    model_config = ConfigDict(from_attributes=True)


# Resolve forward reference
def _init_models() -> None:
    """Bind forward references after module loads."""
    try:
        FoodPackageDetailOut.model_rebuild()
    except Exception:
        pass


_init_models()
