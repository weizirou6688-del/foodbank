from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class FoodBankBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    address: str = Field(min_length=1)
    notification_email: EmailStr | None = None
    lat: float
    lng: float


class FoodBankOut(FoodBankBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    has_local_admin_account: bool = False


class FoodBankListResponse(BaseModel):
    items: list[FoodBankOut]
    total: int
    page: int
    size: int
    pages: int
