from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from app.models.enums import MeetingStatus, MeetingType, ProposedBy


class MeetingCreateRequest(BaseModel):
    meeting_type: MeetingType
    pending_start_datetime: datetime
    pending_end_datetime: datetime
    agenda: str

    @field_validator("agenda")
    @classmethod
    def agenda_min_length(cls, value: str) -> str:
        if len(value.strip()) < 15:
            raise ValueError("agenda must be at least 15 characters")
        return value

    @model_validator(mode="after")
    def end_after_start(self) -> "MeetingCreateRequest":
        if self.pending_end_datetime <= self.pending_start_datetime:
            raise ValueError("end time must be after start time")
        return self


class MeetingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    meeting_type: MeetingType
    agenda: str
    status: MeetingStatus
    meeting_link: str | None
    confirmed_start_datetime: datetime | None
    confirmed_end_datetime: datetime | None
    pending_start_datetime: datetime
    pending_end_datetime: datetime
    pending_proposed_by: ProposedBy | None
    denial_reason: str | None
    created_at: datetime


class MeetingDenyRequest(BaseModel):
    reason: str

    @field_validator("reason")
    @classmethod
    def reason_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("a reason is required")
        return value


class MeetingReschedulePropose(BaseModel):
    pending_start_datetime: datetime
    pending_end_datetime: datetime

    @model_validator(mode="after")
    def end_after_start(self) -> "MeetingReschedulePropose":
        if self.pending_end_datetime <= self.pending_start_datetime:
            raise ValueError("end time must be after start time")
        return self


class MeetingConfirmRequest(BaseModel):
    meeting_link: str

    @field_validator("meeting_link")
    @classmethod
    def link_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("a meeting link is required to confirm")
        return value


class MeetingAvailabilityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    accepts_online: bool
    accepts_offline: bool


class MeetingAvailabilityUpdateRequest(BaseModel):
    accepts_online: bool | None = None
    accepts_offline: bool | None = None


class BusyRangeOut(BaseModel):
    start_datetime: datetime
    end_datetime: datetime


class MeetingBlockCreateRequest(BaseModel):
    start_datetime: datetime
    end_datetime: datetime
    reason: str | None = None

    @model_validator(mode="after")
    def end_after_start(self) -> "MeetingBlockCreateRequest":
        if self.end_datetime <= self.start_datetime:
            raise ValueError("end time must be after start time")
        return self


class MeetingBlockOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    start_datetime: datetime
    end_datetime: datetime
    reason: str | None
