from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import DiscountType


class DiscountCreateRequest(BaseModel):
    client_id: int
    name: str
    discount_type: DiscountType
    value: float
    is_active: bool = True


class DiscountUpdateRequest(BaseModel):
    name: str
    discount_type: DiscountType
    value: float
    is_active: bool


class DiscountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    name: str
    discount_type: DiscountType
    value: float
    is_active: bool
    created_at: datetime
