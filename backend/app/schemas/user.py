from datetime import datetime

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
    created_at: datetime


class ProfileUpdateRequest(BaseModel):
    full_name: str


class ClientCreateRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    can_book_offline_meeting: bool = False


class ClientPatchRequest(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None
    can_book_offline_meeting: bool | None = None


class DeveloperCreateRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str


class DeveloperPatchRequest(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None
