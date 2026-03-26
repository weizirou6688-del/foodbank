"""
Pydantic schemas for PackageItem junction validation and serialization.

These schemas handle:
- PackageItemCreate/PackageItemUpdate: Manage inventory items in packages.
- PackageItemOut: Response with junction record ID.

PackageItem specifies which inventory items (and quantities) are in each package.
"""

from pydantic import BaseModel, ConfigDict, Field


# Common fields for package item creation and responses.
class PackageItemBase(BaseModel):
    # From spec: package_id: INTEGER, NOT NULL, FK -> food_packages.id
    # Which package contains this item. Validation: gt=0 (positive ID).
    package_id: int = Field(gt=0)

    # From spec: inventory_item_id: INTEGER, NOT NULL, FK -> inventory_items.id
    # Which inventory item is being added. Validation: gt=0.
    inventory_item_id: int = Field(gt=0)

    # From spec: quantity: INTEGER, NOT NULL, DEFAULT 1
    # Number of units of this item in the package. Validation: ge=1 (at least 1).
    quantity: int = Field(ge=1)


# Schema for creating package items.
class PackageItemCreate(PackageItemBase):
    # Inherits all fields from PackageItemBase.
    # ID auto-generated server-side.
    pass


# Schema for updating package items.
class PackageItemUpdate(BaseModel):
    # Typically only quantity changes (composition adjustment).
    # All fields optional for flexibility.

    quantity: int | None = Field(default=None, ge=1)


# Schema for API responses (reading package item data).
class PackageItemOut(PackageItemBase):
    # ConfigDict(from_attributes=True) enables conversion from ORM PackageItem model.
    model_config = ConfigDict(from_attributes=True)

    # From spec: id: SERIAL (PK)
    # Included in response so client knows this junction record's ID.
    id: int
