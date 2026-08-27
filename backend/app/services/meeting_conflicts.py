import calendar
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.exceptions import BusinessRuleViolation
from app.models.enums import MeetingStatus, RecurrenceFrequency
from app.models.meeting import Meeting
from app.models.meeting_block import MeetingBlock
from app.models.recurring_meeting_block import RecurringMeetingBlock

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


def _sunday_indexed_weekday(d: date) -> int:
    """Python's date.weekday() is Monday=0..Sunday=6; convert to Sunday=0..Saturday=6 (JS Date.getDay())."""
    return (d.weekday() + 1) % 7


def _days_in_month(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]


def rule_matches_date(rule: RecurringMeetingBlock, candidate: date) -> bool:
    if rule.until is not None and candidate > rule.until:
        return False
    if rule.frequency == RecurrenceFrequency.WEEKLY:
        return _sunday_indexed_weekday(candidate) == rule.day_of_week
    if rule.frequency == RecurrenceFrequency.MONTHLY:
        effective_day = min(rule.day_of_month, _days_in_month(candidate.year, candidate.month))
        return candidate.day == effective_day
    if rule.frequency == RecurrenceFrequency.YEARLY:
        effective_day = min(rule.day_of_month, _days_in_month(candidate.year, rule.month))
        return candidate.month == rule.month and candidate.day == effective_day
    return False


def find_matching_rule(
    db: Session, candidate: date, rules: list[RecurringMeetingBlock] | None = None
) -> RecurringMeetingBlock | None:
    rules = rules if rules is not None else db.query(RecurringMeetingBlock).all()
    return next((rule for rule in rules if rule_matches_date(rule, candidate)), None)


def blocked_dates_in_range(db: Session, range_start: date, range_end: date) -> list[tuple[date, str | None]]:
    """All dates in [range_start, range_end] (inclusive) that a recurring rule fully blocks."""
    rules = db.query(RecurringMeetingBlock).all()
    if not rules:
        return []
    out: list[tuple[date, str | None]] = []
    current = range_start
    while current <= range_end:
        rule = find_matching_rule(db, current, rules=rules)
        if rule:
            out.append((current, rule.reason))
        current += timedelta(days=1)
    return out


def find_future_meetings_matching_rule(db: Session, rule: RecurringMeetingBlock) -> list[Meeting]:
    """Active future meetings that would fall on a day matched by `rule` — used only for the
    create-time warning preview; does not gate creation (existing meetings are grandfathered)."""
    today_ist = (datetime.now(timezone.utc) + IST_OFFSET).date()
    matches: list[Meeting] = []
    for meeting in db.query(Meeting).filter(Meeting.status.in_(ACTIVE_STATUSES)).all():
        start, _ = _meeting_range(meeting)
        candidate = (_as_aware(start) + IST_OFFSET).date()
        if candidate >= today_ist and rule_matches_date(rule, candidate):
            matches.append(meeting)
    return matches


def find_conflict_reason(db: Session, start: datetime, end: datetime, exclude_meeting_id: int | None = None) -> str | None:
    """Returns a human-readable reason if [start, end) overlaps an active meeting, admin block,
    or a recurring block's day, else None."""
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

    candidate_date = (start + IST_OFFSET).date()
    rule = find_matching_rule(db, candidate_date)
    if rule:
        return "This day is blocked by the admin" + (f" ({rule.reason})" if rule.reason else "")

    return None


def list_busy_ranges(
    db: Session,
    day_start: datetime,
    day_end: datetime,
    exclude_meeting_id: int | None = None,
    check_date: date | None = None,
) -> list[tuple[datetime, datetime]]:
    """Anonymized busy windows (no client/meeting identity) for a given day, for greying out a date picker.

    `check_date` is the plain calendar date the caller is asking about (as received from the request's
    `date` query param) — passed through separately rather than re-derived from day_start/day_end, since
    those are UTC-midnight boundaries and shifting each independently by IST_OFFSET can land them on two
    different calendar dates.
    """
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

    if check_date is not None and find_matching_rule(db, check_date):
        ranges.append((day_start, day_end))

    return ranges
