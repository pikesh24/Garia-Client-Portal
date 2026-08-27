from datetime import date as date_type
from datetime import datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_owned_project, require_client
from app.core.exceptions import BusinessRuleViolation, IrreversibleActionConflict
from app.db.session import get_db
from app.models.enums import MeetingStatus, MeetingType, ProposedBy
from app.models.meeting import Meeting
from app.models.meeting_block import MeetingBlock
from app.models.project import Project
from app.models.user import User
from app.schemas.meeting import (
    BlockedDateOut,
    BusyRangeOut,
    MeetingBlockOut,
    MeetingCreateRequest,
    MeetingDenyRequest,
    MeetingOut,
    MeetingReschedulePropose,
)
from app.services.email import notify_meeting_event
from app.services.realtime import manager
from app.services.meeting_conflicts import (
    blocked_dates_in_range,
    ensure_business_hours,
    find_conflict_reason,
    list_busy_ranges,
)

router = APIRouter(
    prefix="/api/projects/{project_id}/meetings", tags=["meetings"], dependencies=[Depends(require_client)]
)


def _as_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _ensure_future_window(start: datetime) -> None:
    if _as_aware(start) < datetime.now(timezone.utc) + timedelta(hours=36):
        raise BusinessRuleViolation("Meetings must be requested at least 36 hours in advance")


def _ensure_after_confirmed(start: datetime, anchor: datetime) -> None:
    if _as_aware(start) <= _as_aware(anchor):
        raise BusinessRuleViolation("A reschedule must be proposed for a time after the currently confirmed appointment")


@router.get("/busy", response_model=list[BusyRangeOut])
def get_busy_ranges(
    date: date_type = Query(...), exclude_meeting_id: int | None = Query(default=None), db: Session = Depends(get_db)
):
    day_start = datetime.combine(date, time.min, tzinfo=timezone.utc)
    day_end = datetime.combine(date, time.max, tzinfo=timezone.utc)
    ranges = list_busy_ranges(db, day_start, day_end, exclude_meeting_id=exclude_meeting_id, check_date=date)
    return [BusyRangeOut(start_datetime=s, end_datetime=e) for s, e in ranges]


@router.get("/blocked-dates", response_model=list[BlockedDateOut])
def get_blocked_dates(
    range_start: date_type = Query(...), range_end: date_type = Query(...), db: Session = Depends(get_db)
):
    if range_end < range_start:
        raise BusinessRuleViolation("range_end must not be before range_start")
    if (range_end - range_start).days > 400:
        raise BusinessRuleViolation("Range too large")
    return [BlockedDateOut(date=d, reason=r) for d, r in blocked_dates_in_range(db, range_start, range_end)]


@router.get("/blocks", response_model=list[MeetingBlockOut])
def list_blocks(db: Session = Depends(get_db)):
    return db.query(MeetingBlock).order_by(MeetingBlock.start_datetime.asc()).all()


@router.get("", response_model=list[MeetingOut])
def list_my_meetings(project: Project = Depends(get_owned_project), db: Session = Depends(get_db)):
    return (
        db.query(Meeting)
        .filter(Meeting.project_id == project.id)
        .order_by(Meeting.pending_start_datetime.desc())
        .all()
    )


@router.post("", response_model=MeetingOut, status_code=201)
def request_meeting(
    payload: MeetingCreateRequest,
    current_user: User = Depends(require_client),
    project: Project = Depends(get_owned_project),
    db: Session = Depends(get_db),
):
    if payload.meeting_type == MeetingType.OFFLINE and not current_user.can_book_offline_meeting:
        raise BusinessRuleViolation("This account is not authorized to book offline meetings")

    _ensure_future_window(payload.pending_start_datetime)
    ensure_business_hours(payload.pending_start_datetime, payload.pending_end_datetime)

    conflict = find_conflict_reason(db, payload.pending_start_datetime, payload.pending_end_datetime)
    if conflict:
        raise BusinessRuleViolation(conflict)

    meeting = Meeting(
        client_id=project.client_id,
        project_id=project.id,
        meeting_type=payload.meeting_type,
        pending_start_datetime=payload.pending_start_datetime,
        pending_end_datetime=payload.pending_end_datetime,
        agenda=payload.agenda,
        status=MeetingStatus.REQUESTED,
        pending_proposed_by=ProposedBy.CLIENT,
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    manager.broadcast_change("meetings", client_id=meeting.client_id)
    return meeting


def _get_own_meeting(project_id: int, meeting_id: int, db: Session) -> Meeting:
    meeting = db.get(Meeting, meeting_id)
    if not meeting or meeting.project_id != project_id:
        raise IrreversibleActionConflict("Meeting not found")
    return meeting


@router.post("/{meeting_id}/cancel", response_model=MeetingOut)
def cancel_meeting(
    meeting_id: int,
    current_user: User = Depends(require_client),
    project: Project = Depends(get_owned_project),
    db: Session = Depends(get_db),
):
    meeting = _get_own_meeting(project.id, meeting_id, db)
    if meeting.status in (MeetingStatus.CANCELLED, MeetingStatus.COMPLETED, MeetingStatus.DENIED):
        raise IrreversibleActionConflict("Meeting is already finalized and cannot be cancelled")
    meeting.status = MeetingStatus.CANCELLED
    meeting.cancelled_by_client = True
    db.commit()
    db.refresh(meeting)
    notify_meeting_event(current_user.email, meeting.id, "cancelled")
    manager.broadcast_change("meetings", client_id=meeting.client_id)
    return meeting


@router.post("/{meeting_id}/propose-reschedule", response_model=MeetingOut)
def propose_reschedule(
    meeting_id: int,
    payload: MeetingReschedulePropose,
    current_user: User = Depends(require_client),
    project: Project = Depends(get_owned_project),
    db: Session = Depends(get_db),
):
    meeting = _get_own_meeting(project.id, meeting_id, db)
    if meeting.status != MeetingStatus.CONFIRMED:
        raise BusinessRuleViolation("Only a confirmed meeting can have a reschedule proposed")
    _ensure_after_confirmed(payload.pending_start_datetime, meeting.confirmed_end_datetime)
    ensure_business_hours(payload.pending_start_datetime, payload.pending_end_datetime)

    conflict = find_conflict_reason(db, payload.pending_start_datetime, payload.pending_end_datetime, exclude_meeting_id=meeting.id)
    if conflict:
        raise BusinessRuleViolation(conflict)

    meeting.pending_start_datetime = payload.pending_start_datetime
    meeting.pending_end_datetime = payload.pending_end_datetime
    meeting.pending_proposed_by = ProposedBy.CLIENT
    meeting.denial_reason = None
    meeting.status = MeetingStatus.RESCHEDULE_PENDING
    db.commit()
    db.refresh(meeting)
    manager.broadcast_change("meetings", client_id=meeting.client_id)
    return meeting


@router.post("/{meeting_id}/accept-reschedule", response_model=MeetingOut)
def accept_reschedule(
    meeting_id: int,
    current_user: User = Depends(require_client),
    project: Project = Depends(get_owned_project),
    db: Session = Depends(get_db),
):
    meeting = _get_own_meeting(project.id, meeting_id, db)
    if meeting.status != MeetingStatus.RESCHEDULE_PENDING or meeting.pending_proposed_by != ProposedBy.ADMIN:
        raise BusinessRuleViolation("This meeting has no pending admin reschedule proposal")
    meeting.confirmed_start_datetime = meeting.pending_start_datetime
    meeting.confirmed_end_datetime = meeting.pending_end_datetime
    meeting.pending_proposed_by = None
    meeting.denial_reason = None
    meeting.status = MeetingStatus.CONFIRMED
    db.commit()
    db.refresh(meeting)
    notify_meeting_event(current_user.email, meeting.id, "confirmed")
    manager.broadcast_change("meetings", client_id=meeting.client_id)
    return meeting


@router.post("/{meeting_id}/deny-reschedule", response_model=MeetingOut)
def deny_reschedule(
    meeting_id: int,
    payload: MeetingDenyRequest,
    current_user: User = Depends(require_client),
    project: Project = Depends(get_owned_project),
    db: Session = Depends(get_db),
):
    meeting = _get_own_meeting(project.id, meeting_id, db)
    if meeting.status != MeetingStatus.RESCHEDULE_PENDING or meeting.pending_proposed_by != ProposedBy.ADMIN:
        raise BusinessRuleViolation("This meeting has no pending admin reschedule proposal")
    meeting.pending_start_datetime = meeting.confirmed_start_datetime
    meeting.pending_end_datetime = meeting.confirmed_end_datetime
    meeting.pending_proposed_by = None
    meeting.denial_reason = payload.reason
    meeting.status = MeetingStatus.CONFIRMED
    db.commit()
    db.refresh(meeting)
    manager.broadcast_change("meetings", client_id=meeting.client_id)
    return meeting
