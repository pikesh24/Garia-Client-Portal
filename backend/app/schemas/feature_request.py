from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.enums import FeatureRequestStatus, InitiatedBy


class FeatureRequestCreateRequest(BaseModel):
    name: str
    description: str


class AdminProposeFeatureRequest(BaseModel):
    client_id: int
    name: str
    description: str


class ClarificationCreateRequest(BaseModel):
    admin_query: str


class ClarificationResponseRequest(BaseModel):
    client_description_override: str


class QuoteRequest(BaseModel):
    quoted_frontend_hours: float
    quoted_backend_hours: float
    quoted_production_hours: float


class AuthorizeFeatureRequest(BaseModel):
    accepted_terms: bool

    @field_validator("accepted_terms")
    @classmethod
    def must_accept(cls, value: bool) -> bool:
        if not value:
            raise ValueError("accepted_terms must be true to authorize this feature")
        return value


class BaseFeatureActivationRequest(BaseModel):
    verified: bool

    @field_validator("verified")
    @classmethod
    def must_verify(cls, value: bool) -> bool:
        if not value:
            raise ValueError("You must verify that this baseline feature implementation is required")
        return value


class CompleteFeatureRequest(BaseModel):
    actual_hours_taken: float


class ClarificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    admin_query: str
    client_description_override: str | None
    resolved: bool
    created_at: datetime


class QuoteBreakdown(BaseModel):
    frontend_amount: float
    backend_amount: float
    production_amount: float
    subtotal: float
    discount_amount: float
    total: float


class FeatureRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    name: str
    description: str
    status: FeatureRequestStatus
    initiated_by: InitiatedBy
    added_by_client: bool
    is_base_feature: bool
    base_feature_activated: bool
    quoted_frontend_hours: float | None
    quoted_backend_hours: float | None
    quoted_production_hours: float | None
    accepted_terms: bool
    actual_hours_taken: float | None
    clarifications: list[ClarificationOut] = []
    created_at: datetime
