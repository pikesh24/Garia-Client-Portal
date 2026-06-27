from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import DiscountType


class DiscountCreateRequest(BaseModel):
    client_id: int
    name: str
    discount_type: DiscountType
    value: float
    is_active: bool = True


class ProjectDiscountCreateRequest(BaseModel):
    """Same as DiscountCreateRequest but without client_id -- the client is derived from the
    project on the path (a project has exactly one client)."""

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
    project_id: int
    name: str
    discount_type: DiscountType
    value: float
    is_active: bool
    created_at: datetime
