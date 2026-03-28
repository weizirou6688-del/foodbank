"""Pydantic schemas for inventory lot management."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


LotStatus = Literal["active", "wasted", "expired"]


class InventoryLotOut(BaseModel):
    """Response schema for inventory lot rows in admin management UI."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    inventory_item_id: int
    item_name: str
    quantity: int = Field(ge=0)
    expiry_date: date
    received_date: date
    batch_reference: str | None = None
    status: LotStatus
    deleted_at: datetime | None = None


class InventoryLotAdjustRequest(BaseModel):
    """Request schema for PATCH /inventory/lots/{lot_id}."""

    quantity: int | None = Field(default=None, gt=0)
    damage_quantity: int | None = Field(default=None, gt=0)
    expiry_date: date | None = None
    status: Literal["active", "wasted"] | None = None
    batch_reference: str | None = Field(default=None, max_length=100)
