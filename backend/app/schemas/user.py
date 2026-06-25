from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.enums import UserRole


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str
    role: UserRole
    is_active: bool
    can_book_offline_meeting: bool
    hourly_rate_frontend: float | None
    hourly_rate_backend: float | None
    hourly_rate_production: float | None
    maintenance_price: float | None
    project_start_date: date | None
    created_at: datetime


class ProfileUpdateRequest(BaseModel):
    full_name: str


class ClientCreateRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    can_book_offline_meeting: bool = False
    hourly_rate_frontend: float | None = None
    hourly_rate_backend: float | None = None
    hourly_rate_production: float | None = None
    maintenance_price: float | None = None
    project_start_date: date | None = None


class ClientPatchRequest(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None
    can_book_offline_meeting: bool | None = None
    hourly_rate_frontend: float | None = None
    hourly_rate_backend: float | None = None
    hourly_rate_production: float | None = None
    maintenance_price: float | None = None
    project_start_date: date | None = None


class ClientPutRequest(BaseModel):
    full_name: str
    email: EmailStr
    can_book_offline_meeting: bool
    hourly_rate_frontend: float | None = None
    hourly_rate_backend: float | None = None
    hourly_rate_production: float | None = None
    maintenance_price: float | None = None
    project_start_date: date | None = None
