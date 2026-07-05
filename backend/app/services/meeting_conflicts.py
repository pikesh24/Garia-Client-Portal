from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.exceptions import BusinessRuleViolation
from app.models.enums import MeetingStatus
from app.models.meeting import Meeting
from app.models.meeting_block import MeetingBlock

ACTIVE_STATUSES = (MeetingStatus.REQUESTED, MeetingStatus.CONFIRMED, MeetingStatus.RESCHEDULE_PENDING)

# The business operates in India — meeting hours are defined in IST (UTC+5:30, no DST),
# but every timestamp on the wire/in the DB is UTC, so we shift before reading wall-clock time.
IST_OFFSET = timedelta(hours=5, minutes=30)
BUSINESS_START_MINUTES = 9 * 60
BUSINESS_END_MINUTES = 21 * 60


def _as_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def ensure_business_hours(start: datetime, end: datetime) -> None:
    """Meetings may only run between 9 AM and 9 PM IST."""
    start_ist = _as_aware(start) + IST_OFFSET
    end_ist = _as_aware(end) + IST_OFFSET
    start_minutes = start_ist.hour * 60 + start_ist.minute
    end_minutes = end_ist.hour * 60 + end_ist.minute
    # An end time exactly at 21:00 lands on minute 0 of the next day-boundary math only if it
    # actually crosses midnight; a same-day end of 21:00 has end_minutes == BUSINESS_END_MINUTES.
    spans_multiple_days = start_ist.date() != end_ist.date()
    if (
        start_minutes < BUSINESS_START_MINUTES
        or end_minutes > BUSINESS_END_MINUTES
        or spans_multiple_days
    ):
        raise BusinessRuleViolation("Meetings must be scheduled between 9 AM and 9 PM")


def _meeting_range(meeting: Meeting) -> tuple[datetime, datetime]:
    if meeting.status == MeetingStatus.CONFIRMED and meeting.confirmed_start_datetime and meeting.confirmed_end_datetime:
        return meeting.confirmed_start_datetime, meeting.confirmed_end_datetime
    return meeting.pending_start_datetime, meeting.pending_end_datetime


def find_conflict_reason(db: Session, start: datetime, end: datetime, exclude_meeting_id: int | None = None) -> str | None:
    """Returns a human-readable reason if [start, end) overlaps an active meeting or admin block, else None."""
    start, end = _as_aware(start), _as_aware(end)

    query = db.query(Meeting).filter(Meeting.status.in_(ACTIVE_STATUSES))
    if exclude_meeting_id is not None:
        query = query.filter(Meeting.id != exclude_meeting_id)

    for meeting in query.all():
        m_start, m_end = _meeting_range(meeting)
        if start < _as_aware(m_end) and end > _as_aware(m_start):
            return "This time slot overlaps with another appointment"

    for block in db.query(MeetingBlock).all():
        if start < _as_aware(block.end_datetime) and end > _as_aware(block.start_datetime):
            return "This time slot is blocked by the admin" + (f" ({block.reason})" if block.reason else "")

    return None


def list_busy_ranges(
    db: Session, day_start: datetime, day_end: datetime, exclude_meeting_id: int | None = None
) -> list[tuple[datetime, datetime]]:
    """Anonymized busy windows (no client/meeting identity) for a given day, for greying out a date picker."""
    day_start, day_end = _as_aware(day_start), _as_aware(day_end)
    ranges: list[tuple[datetime, datetime]] = []

    query = db.query(Meeting).filter(Meeting.status.in_(ACTIVE_STATUSES))
    if exclude_meeting_id is not None:
        query = query.filter(Meeting.id != exclude_meeting_id)
    for meeting in query.all():
        m_start, m_end = _meeting_range(meeting)
        m_start, m_end = _as_aware(m_start), _as_aware(m_end)
        if m_start < day_end and m_end > day_start:
            ranges.append((m_start, m_end))

    for block in db.query(MeetingBlock).all():
        b_start, b_end = _as_aware(block.start_datetime), _as_aware(block.end_datetime)
        if b_start < day_end and b_end > day_start:
            ranges.append((b_start, b_end))

    return ranges
