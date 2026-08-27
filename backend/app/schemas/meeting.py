import re
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from app.models.enums import MeetingStatus, MeetingType, ProposedBy, RecurrenceFrequency

MEETING_LINK_PATTERN = re.compile(r"^https://(meet\.google\.com/|teams\.microsoft\.com/)")


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
    project_id: int
    meeting_type: MeetingType
    agenda: str
    status: MeetingStatus
    meeting_link: str | None
    meeting_code: str | None
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
    meeting_link: str | None = None
    meeting_code: str | None = None

    @field_validator("meeting_link")
    @classmethod
    def validate_link(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        value = value.strip()
        if not MEETING_LINK_PATTERN.match(value):
            raise ValueError("Meeting link must start with https://meet.google.com/ or https://teams.microsoft.com/")
        return value

    @field_validator("meeting_code")
    @classmethod
    def validate_code(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


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


class RecurringMeetingBlockCreateRequest(BaseModel):
    frequency: RecurrenceFrequency
    day_of_week: int | None = None
    day_of_month: int | None = None
    month: int | None = None
    until: date | None = None
    reason: str | None = None

    @field_validator("day_of_week")
    @classmethod
    def day_of_week_range(cls, value: int | None) -> int | None:
        if value is not None and not (0 <= value <= 6):
            raise ValueError("day_of_week must be between 0 (Sunday) and 6 (Saturday)")
        return value

    @field_validator("day_of_month")
    @classmethod
    def day_of_month_range(cls, value: int | None) -> int | None:
        if value is not None and not (1 <= value <= 31):
            raise ValueError("day_of_month must be between 1 and 31")
        return value

    @field_validator("month")
    @classmethod
    def month_range(cls, value: int | None) -> int | None:
        if value is not None and not (1 <= value <= 12):
            raise ValueError("month must be between 1 and 12")
        return value

    @model_validator(mode="after")
    def fields_match_frequency(self) -> "RecurringMeetingBlockCreateRequest":
        if self.frequency == RecurrenceFrequency.WEEKLY:
            if self.day_of_week is None:
                raise ValueError("day_of_week is required for a weekly rule")
            if self.day_of_month is not None or self.month is not None:
                raise ValueError("day_of_month and month must not be set for a weekly rule")
        elif self.frequency == RecurrenceFrequency.MONTHLY:
            if self.day_of_month is None:
                raise ValueError("day_of_month is required for a monthly rule")
            if self.day_of_week is not None or self.month is not None:
                raise ValueError("day_of_week and month must not be set for a monthly rule")
        elif self.frequency == RecurrenceFrequency.YEARLY:
            if self.day_of_month is None or self.month is None:
                raise ValueError("day_of_month and month are required for a yearly rule")
            if self.day_of_week is not None:
                raise ValueError("day_of_week must not be set for a yearly rule")
        return self


class RecurringMeetingBlockOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    frequency: RecurrenceFrequency
    day_of_week: int | None
    day_of_month: int | None
    month: int | None
    until: date | None
    reason: str | None


class BlockedDateOut(BaseModel):
    date: date
    reason: str | None
