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


class RestockRequestOut(RestockRequestBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    inventory_item_name: str | None = None
    inventory_item_unit: str | None = None
    stock_deficit: int = Field(default=0, ge=0)


class RestockRequestListResponse(BaseModel):
    items: list[RestockRequestOut]
    total: int
    page: int
    size: int
    pages: int

