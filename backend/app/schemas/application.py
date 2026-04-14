import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.redemption_codes import (
    SUPPORTED_REDEMPTION_CODE_PATTERN,
    normalize_redemption_code,
)


ApplicationStatus = Literal["pending", "collected", "expired"]
APPLICATION_REDEMPTION_CODE_PATTERN = SUPPORTED_REDEMPTION_CODE_PATTERN


class ApplicationItemCreatePayload(BaseModel):
    package_id: int | None = Field(default=None, gt=0, description="Package ID to apply for")
    inventory_item_id: int | None = Field(default=None, gt=0, description="Inventory item ID to apply for directly")
    quantity: int = Field(ge=1, description="Number of this package requested")

    @model_validator(mode="after")
    def validate_target(self) -> "ApplicationItemCreatePayload":
        has_package = self.package_id is not None
        has_inventory_item = self.inventory_item_id is not None

        if has_package == has_inventory_item:
            raise ValueError("Exactly one of package_id or inventory_item_id must be provided")

        return self


class ApplicationBase(BaseModel):
    user_id: uuid.UUID
    food_bank_id: int = Field(gt=0)
    redemption_code: str = Field(
        pattern=APPLICATION_REDEMPTION_CODE_PATTERN,
        max_length=20,
    )

    @field_validator("redemption_code", mode="before")
    @classmethod
    def normalize_redemption_code(cls, value: object) -> object:
        if isinstance(value, str):
            return normalize_redemption_code(value)
        return value

    status: ApplicationStatus = "pending"
    week_start: date = Field(description="Week start date in YYYY-MM-DD format")
    total_quantity: int = Field(ge=0)


class ApplicationCreate(BaseModel):
    food_bank_id: int = Field(gt=0)
    week_start: date | None = Field(
        default=None,
        description="Week start date in YYYY-MM-DD format (e.g., 2026-03-17). If not provided, uses Monday of current week",
    )
    items: list[ApplicationItemCreatePayload] = Field(
        min_length=1,
        description="List of requested packages or individual inventory items",
    )


class ApplicationUpdate(BaseModel):
    status: ApplicationStatus | None = None

    redemption_code: str | None = Field(
        default=None,
        pattern=APPLICATION_REDEMPTION_CODE_PATTERN,
        max_length=20,
    )

    @field_validator("redemption_code", mode="before")
    @classmethod
    def normalize_redemption_code(cls, value: object) -> object:
        if isinstance(value, str):
            return normalize_redemption_code(value)
        return value


class ApplicationOut(ApplicationBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    redeemed_at: datetime | None = None
    deleted_at: datetime | None = None


class ApplicationAdminItemOut(BaseModel):
    id: int
    package_id: int | None = None
    inventory_item_id: int | None = None
    name: str
    quantity: int


class ApplicationAdminRecordOut(ApplicationOut):
    items: list[ApplicationAdminItemOut] = Field(default_factory=list)
    package_name: str | None = None
    is_voided: bool = False
    voided_at: datetime | None = None


class ApplicationListResponse(BaseModel):
    items: list[ApplicationOut]
    total: int
    page: int
    size: int
    pages: int


class ApplicationAdminListResponse(BaseModel):
    items: list[ApplicationAdminRecordOut]
    total: int
    page: int
    size: int
    pages: int
