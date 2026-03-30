"""
Pydantic schemas for RestockRequest entity validation and serialization.

These schemas handle:
- RestockRequestCreate: Specifies item, current stock, threshold, urgency.
  Status defaults to 'open' (pending action).
- RestockRequestUpdate: Allows status changes (open->fulfilled/cancelled), assignments.
- RestockRequestOut: Response with ID, urgency level, and creation timestamp.

Urgency levels enforce business rule: high, medium, or low.
Status lifecycle: open (pending) -> fulfilled (stock replenished) or cancelled (obsolete).
"""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


RestockUrgency = Literal["high", "medium", "low"]


class RestockRequestBase(BaseModel):
    inventory_item_id: int = Field(gt=0)
    current_stock: int = Field(ge=0)
    threshold: int = Field(ge=0)
    urgency: RestockUrgency
    assigned_to_user_id: uuid.UUID | None = None
    status: str = Field(default="open", pattern="^(open|fulfilled|cancelled)$")


class RestockRequestCreate(BaseModel):
    inventory_item_id: int = Field(gt=0)
    current_stock: int = Field(ge=0)
    threshold: int = Field(ge=0)
    urgency: RestockUrgency
    assigned_to_user_id: uuid.UUID | None = None

    @field_validator("urgency", mode="before")
    @classmethod
    def normalize_urgency(cls, value):
        if isinstance(value, str):
            normalized = value.strip().lower()
            mapping = {
                "critical": "high",
                "urgent": "medium",
                "low": "low",
                "high": "high",
                "medium": "medium",
            }
            mapped = mapping.get(normalized)
            if mapped is not None:
                return mapped
        return value


class RestockRequestUpdate(BaseModel):
    current_stock: int | None = Field(default=None, ge=0)
    threshold: int | None = Field(default=None, ge=0)
    urgency: RestockUrgency | None = None
    assigned_to_user_id: uuid.UUID | None = None
    status: str | None = Field(default=None, pattern="^(open|fulfilled|cancelled)$")

    @field_validator("urgency", mode="before")
    @classmethod
    def normalize_optional_urgency(cls, value):
        if value is None:
            return value
        return RestockRequestCreate.normalize_urgency(value)


class RestockRequestOut(RestockRequestBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


class RestockRequestListResponse(BaseModel):
    # Pagination is currently compatibility-only and always returns a single page.
    items: list[RestockRequestOut]
    total: int
    page: int
    size: int
    pages: int


class RestockRequestFulfil(BaseModel):
    """
    Request schema for marking a restock request as fulfilled.

    Used for POST /restock-requests/:id/fulfil.
    """

    notes: str | None = Field(
        default=None,
        max_length=500,
        description="Optional fulfillment notes",
    )
