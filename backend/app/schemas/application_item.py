"""
Pydantic schemas for ApplicationItem junction validation and serialization.

These schemas handle:
- ApplicationItemCreate: Specifies which packages are in application and quantities.
- ApplicationItemUpdate: Adjust quantity for a package in application.
- ApplicationItemOut: Response with junction record ID.

ApplicationItem details packages included in an application (many-to-many).
"""

import uuid

from pydantic import BaseModel, ConfigDict, Field


# Common fields for application item creation and responses.
class ApplicationItemBase(BaseModel):
    # From spec: application_id: UUID, NOT NULL, FK -> applications.id
    # Which application contains this package request.
    application_id: uuid.UUID

    # From spec: package_id: INTEGER, NOT NULL, FK -> food_packages.id
    # Which food package is being requested. Validation: gt=0.
    package_id: int = Field(gt=0)

    # From spec: quantity: INTEGER, NOT NULL
    # Number of this package requested. Validation: ge=1 (at least 1).
    quantity: int = Field(ge=1)


# Schema for adding items to applications.
class ApplicationItemCreate(ApplicationItemBase):
    # Inherits all fields from ApplicationItemBase.
    # ID auto-generated server-side.
    pass


# Schema for updating application items.
class ApplicationItemUpdate(BaseModel):
    # Typically only quantity changes (adjustment before redemption).
    
    quantity: int | None = Field(default=None, ge=1)


# Schema for API responses (reading application item data).
class ApplicationItemOut(ApplicationItemBase):
    # ConfigDict(from_attributes=True) enables conversion from ORM ApplicationItem model.
    model_config = ConfigDict(from_attributes=True)

    # From spec: id: SERIAL (PK)
    # Included in response so client knows this item's system ID.
    id: int
