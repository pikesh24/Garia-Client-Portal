from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.enums import ChallengeStatus, FeatureRequestStatus, UserRole


class FeatureRequestCreateRequest(BaseModel):
    name: str
    description: str


class FeatureRequestUpdateRequest(BaseModel):
    name: str
    description: str


class FeatureRequestStatusUpdateRequest(BaseModel):
    status: Literal["under_review", "approved", "declined"]


class FeatureRequestMessageCreateRequest(BaseModel):
    body: str


class FeatureRequestMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sender_role: UserRole
    body: str
    created_at: datetime


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


class ChallengeDecisionRequest(BaseModel):
    decision: Literal["approved", "denied"]


class FeatureRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    feature_id: str | None
    name: str
    description: str
    status: FeatureRequestStatus
    added_by_client: bool
    is_base_feature: bool
    base_feature_activated: bool
    challenge_status: ChallengeStatus
    quoted_frontend_hours: float | None
    quoted_backend_hours: float | None
    quoted_production_hours: float | None
    accepted_terms: bool
    actual_hours_taken: float | None
    agreement_date: date | None
    messages: list[FeatureRequestMessageOut] = []
    created_at: datetime


class FeatureRequestAdminOut(FeatureRequestOut):
    """Admin-facing view of a feature request — adds the price, which clients never see."""

    price: float | None


class AdminBaseFeatureCreateRequest(BaseModel):
    feature_id: str | None = None
    name: str
    description: str
    is_base_feature: bool = True
    quoted_frontend_hours: float | None = None
    quoted_backend_hours: float | None = None
    quoted_production_hours: float | None = None
    agreement_date: date | None = None


class AdminFeatureDetailsUpdateRequest(BaseModel):
    feature_id: str | None = None
    name: str | None = None
    description: str | None = None
    quoted_frontend_hours: float | None = None
    quoted_backend_hours: float | None = None
    quoted_production_hours: float | None = None
    agreement_date: date | None = None
