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

from pydantic import BaseModel, ConfigDict, Field


RestockUrgency = Literal["high", "medium", "low"]


# Common fields for restock request creation and responses.
class RestockRequestBase(BaseModel):
    # From spec: inventory_item_id: INTEGER, NOT NULL, FK -> inventory_items.id
    # Which inventory item needs restocking. Validation: gt=0.
    inventory_item_id: int = Field(gt=0)

    # From spec: current_stock: INTEGER, NOT NULL
    # Stock level AT REQUEST CREATION (snapshot for context). Validation: ge=0.
    current_stock: int = Field(ge=0)

    # From spec: threshold: INTEGER, NOT NULL
    # Threshold value AT REQUEST CREATION (may differ from current item threshold).
    # Stored for historical context. Validation: ge=0.
    threshold: int = Field(ge=0)

    # From spec: urgency: VARCHAR(20), NOT NULL
    # Business priority level.
    urgency: RestockUrgency

    # From spec: assigned_to_user_id: UUID, FK -> users.id, NULLABLE
    # Optional: if set, this user is responsible for fulfilling request.
    assigned_to_user_id: uuid.UUID | None = None

    # From spec: status: VARCHAR(20), NOT NULL, DEFAULT 'open'
    # Processing state: open (pending action), fulfilled (completed), cancelled (obsolete).
    # Regex enforces one of three allowed values.
    status: str = Field(default="open", pattern="^(open|fulfilled|cancelled)$")


# Schema for creating restock requests.
class RestockRequestCreate(BaseModel):
    # Typically created by stock monitoring service or manual admin submission.

    # From spec: inventory_item_id: INTEGER, NOT NULL
    # Which item to restock.
    inventory_item_id: int = Field(gt=0)

    # From spec: current_stock: INTEGER, NOT NULL
    # Stock level when request created (snapshot).
    current_stock: int = Field(ge=0)

    # From spec: threshold: INTEGER, NOT NULL
    # Threshold that triggered the request.
    threshold: int = Field(ge=0)

    # From spec: urgency: VARCHAR(20), NOT NULL
    # Priority level assigned at creation time.
    urgency: RestockUrgency

    # From spec: assigned_to_user_id: UUID, NULLABLE
    # Optional: can assign to staff member at creation or leave NULL.
    assigned_to_user_id: uuid.UUID | None = None

    # Note: status intentionally omitted; defaults to 'open' server-side.


# Schema for updating restock requests.
class RestockRequestUpdate(BaseModel):
    # Used by admins: updating urgency, assigning staff, marking fulfilled/cancelled.
    # All fields optional for flexibility.

    # From spec: current_stock: INTEGER
    # Can update if stock changes before fulfillment.
    current_stock: int | None = Field(default=None, ge=0)

    # From spec: threshold: INTEGER
    # Can update if threshold policy changes.
    threshold: int | None = Field(default=None, ge=0)

    # From spec: urgency: VARCHAR(20)
    # Admin can reprioritize request based on supply constraints.
    urgency: RestockUrgency | None = None

    # From spec: assigned_to_user_id: UUID, NULLABLE
    # Admin assigns/reassigns request to staff; NULL to unassign.
    assigned_to_user_id: uuid.UUID | None = None

    # From spec: status: VARCHAR(20)
    # Admin marks as fulfilled (stock ordered/received) or cancelled (no longer needed).
    status: str | None = Field(default=None, pattern="^(open|fulfilled|cancelled)$")


# Schema for API responses (reading restock request data).
class RestockRequestOut(RestockRequestBase):
    # ConfigDict(from_attributes=True) enables conversion from ORM RestockRequest model.
    model_config = ConfigDict(from_attributes=True)

    # From spec: id: SERIAL (PK)
    # Included in response so admin/API can reference this request uniquely.
    id: int

    # From spec: created_at: TIMESTAMP, NOT NULL, DEFAULT NOW()
    # Audit field: when request was created (tracks age for priority).
    created_at: datetime


class RestockRequestListResponse(BaseModel):
    # TODO: 实现真实分页
    items: list[RestockRequestOut]
    total: int
    page: int
    size: int
    pages: int


# Schema for fulfilling a restock request.
class RestockRequestFulfil(BaseModel):
    """
    Request schema for marking a restock request as fulfilled.
    
    Used for POST /restock-requests/:id/fulfil.
    """
    # Optional notes about how the request was fulfilled
    notes: str | None = Field(default=None, max_length=500, description="Optional fulfillment notes")
