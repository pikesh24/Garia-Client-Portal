from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.enums import MeetingStatus, MeetingType


class MeetingCreateRequest(BaseModel):
    meeting_type: MeetingType
    proposed_datetime: datetime
    agenda: str

    @field_validator("agenda")
    @classmethod
    def agenda_min_length(cls, value: str) -> str:
        if len(value.strip()) < 15:
            raise ValueError("agenda must be at least 15 characters")
        return value


class MeetingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    meeting_type: MeetingType
    proposed_datetime: datetime
    agenda: str
    status: MeetingStatus
    meeting_link: str | None
    rescheduled_datetime: datetime | None
    reschedule_reason: str | None
    created_at: datetime


class MeetingCounterProposeRequest(BaseModel):
    proposed_datetime: datetime


class AdminMeetingUpdateRequest(BaseModel):
    meeting_link: str | None = None
    new_proposed_datetime: datetime | None = None
    reason: str | None = None
