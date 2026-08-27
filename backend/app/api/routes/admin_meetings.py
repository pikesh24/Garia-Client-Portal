from datetime import date as date_type
from datetime import datetime, time, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin_or_developer
from app.core.exceptions import BusinessRuleViolation
from app.db.session import get_db
from app.models.enums import MeetingStatus, MeetingType, ProposedBy
from app.models.meeting import Meeting
from app.models.meeting_block import MeetingBlock
from app.models.recurring_meeting_block import RecurringMeetingBlock
from app.models.project import Project
from app.models.user import User
from app.schemas.meeting import (
    BlockedDateOut,
    BusyRangeOut,
    MeetingBlockCreateRequest,
    MeetingBlockOut,
    MeetingConfirmRequest,
    MeetingDenyRequest,
    MeetingOut,
    MeetingReschedulePropose,
    RecurringMeetingBlockCreateRequest,
    RecurringMeetingBlockOut,
)
from app.services.email import notify_meeting_event
from app.services.realtime import manager
from app.services.meeting_conflicts import (
    blocked_dates_in_range,
    ensure_business_hours,
    find_conflict_reason,
    find_future_meetings_matching_rule,
    list_busy_ranges,
)

router = APIRouter(prefix="/api/admin/meetings", tags=["admin-meetings"], dependencies=[Depends(require_admin_or_developer)])

project_scoped_router = APIRouter(
    prefix="/api/admin/projects/{project_id}/meetings",
    tags=["admin-meetings"],
    dependencies=[Depends(require_admin_or_developer)],
)


def _get_project_or_404(project_id: int, db: Session) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def _as_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


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


@router.get("/recurring-blocks", response_model=list[RecurringMeetingBlockOut])
def list_recurring_blocks(db: Session = Depends(get_db)):
    return db.query(RecurringMeetingBlock).order_by(RecurringMeetingBlock.created_at.desc()).all()


@router.post("/recurring-blocks/preview-conflicts", response_model=list[MeetingOut])
def preview_recurring_block_conflicts(payload: RecurringMeetingBlockCreateRequest, db: Session = Depends(get_db)):
    rule = RecurringMeetingBlock(**payload.model_dump())
    return find_future_meetings_matching_rule(db, rule)


@router.post("/recurring-blocks", response_model=RecurringMeetingBlockOut, status_code=201)
def create_recurring_block(payload: RecurringMeetingBlockCreateRequest, db: Session = Depends(get_db)):
    rule = RecurringMeetingBlock(**payload.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    manager.broadcast_change("meetings")
    return rule


@router.delete("/recurring-blocks/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recurring_block(rule_id: int, db: Session = Depends(get_db)):
    rule = db.get(RecurringMeetingBlock, rule_id)
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurring block not found")
    db.delete(rule)
    db.commit()
    manager.broadcast_change("meetings")


@router.get("/blocks", response_model=list[MeetingBlockOut])
def list_blocks(db: Session = Depends(get_db)):
    return db.query(MeetingBlock).order_by(MeetingBlock.start_datetime.asc()).all()


@router.post("/blocks", response_model=MeetingBlockOut, status_code=201)
def create_block(payload: MeetingBlockCreateRequest, db: Session = Depends(get_db)):
    conflict = find_conflict_reason(db, payload.start_datetime, payload.end_datetime)
    if conflict:
        raise BusinessRuleViolation(f"Cannot create block — {conflict}")
    block = MeetingBlock(start_datetime=payload.start_datetime, end_datetime=payload.end_datetime, reason=payload.reason)
    db.add(block)
    db.commit()
    db.refresh(block)
    manager.broadcast_change("meetings")
    return block


@router.delete("/blocks/{block_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_block(block_id: int, db: Session = Depends(get_db)):
    block = db.get(MeetingBlock, block_id)
    if not block:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Block not found")
    db.delete(block)
    db.commit()
    manager.broadcast_change("meetings")


@router.get("", response_model=list[MeetingOut])
def list_all_meetings(db: Session = Depends(get_db)):
    return db.query(Meeting).order_by(Meeting.pending_start_datetime.desc()).all()


@project_scoped_router.get("", response_model=list[MeetingOut])
def list_project_meetings(project_id: int, db: Session = Depends(get_db)):
    _get_project_or_404(project_id, db)
    return (
        db.query(Meeting)
        .filter(Meeting.project_id == project_id)
        .order_by(Meeting.pending_start_datetime.desc())
        .all()
    )


def _get_meeting_or_404(meeting_id: int, db: Session) -> Meeting:
    meeting = db.get(Meeting, meeting_id)
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    return meeting


def _get_project_meeting_or_404(project_id: int, meeting_id: int, db: Session) -> Meeting:
    meeting = db.get(Meeting, meeting_id)
    if not meeting or meeting.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    return meeting


def _notify_client(db: Session, meeting: Meeting, event: str) -> None:
    client = db.get(User, meeting.client_id)
    if client:
        notify_meeting_event(client.email, meeting.id, event)
    manager.broadcast_change("meetings", client_id=meeting.client_id)


@router.patch("/{meeting_id}/confirm", response_model=MeetingOut)
def confirm_meeting(
    meeting_id: int,
    payload: MeetingConfirmRequest,
    db: Session = Depends(get_db),
):
    meeting = _get_meeting_or_404(meeting_id, db)
    is_initial_request = meeting.status == MeetingStatus.REQUESTED
    is_client_reschedule = (
        meeting.status == MeetingStatus.RESCHEDULE_PENDING and meeting.pending_proposed_by == ProposedBy.CLIENT
    )
    if not (is_initial_request or is_client_reschedule):
        raise BusinessRuleViolation("There is no pending client request to confirm")

    if meeting.meeting_type == MeetingType.ONLINE:
        if not payload.meeting_link:
            raise BusinessRuleViolation("A meeting link is required to confirm an online meeting")
        if not payload.meeting_code:
            raise BusinessRuleViolation("A meeting code is required to confirm an online meeting")
        meeting.meeting_link = payload.meeting_link
        meeting.meeting_code = payload.meeting_code
    else:
        meeting.meeting_link = None
        meeting.meeting_code = None
    meeting.confirmed_start_datetime = meeting.pending_start_datetime
    meeting.confirmed_end_datetime = meeting.pending_end_datetime
    meeting.pending_proposed_by = None
    meeting.denial_reason = None
    meeting.status = MeetingStatus.CONFIRMED
    db.commit()
    db.refresh(meeting)
    _notify_client(db, meeting, "confirmed")
    return meeting


@router.patch("/{meeting_id}/deny", response_model=MeetingOut)
def deny_meeting(
    meeting_id: int,
    payload: MeetingDenyRequest,
    db: Session = Depends(get_db),
):
    meeting = _get_meeting_or_404(meeting_id, db)
    if meeting.status == MeetingStatus.REQUESTED:
        meeting.status = MeetingStatus.DENIED
        meeting.pending_proposed_by = None
        meeting.denial_reason = payload.reason
        db.commit()
        db.refresh(meeting)
        _notify_client(db, meeting, "denied")
        return meeting

    if meeting.status == MeetingStatus.RESCHEDULE_PENDING and meeting.pending_proposed_by == ProposedBy.CLIENT:
        meeting.pending_start_datetime = meeting.confirmed_start_datetime
        meeting.pending_end_datetime = meeting.confirmed_end_datetime
        meeting.pending_proposed_by = None
        meeting.denial_reason = payload.reason
        meeting.status = MeetingStatus.CONFIRMED
        db.commit()
        db.refresh(meeting)
        _notify_client(db, meeting, "reschedule denied")
        return meeting

    raise BusinessRuleViolation("There is no pending client request to deny")


@router.post("/{meeting_id}/propose-reschedule", response_model=MeetingOut)
def propose_reschedule(
    meeting_id: int,
    payload: MeetingReschedulePropose,
    db: Session = Depends(get_db),
):
    meeting = _get_meeting_or_404(meeting_id, db)
    if meeting.status != MeetingStatus.CONFIRMED:
        raise BusinessRuleViolation("Only a confirmed meeting can have a reschedule proposed")
    if _as_aware(payload.pending_start_datetime) <= _as_aware(meeting.confirmed_end_datetime):
        raise BusinessRuleViolation("A reschedule must be proposed for a time after the currently confirmed appointment")
    ensure_business_hours(payload.pending_start_datetime, payload.pending_end_datetime)

    conflict = find_conflict_reason(db, payload.pending_start_datetime, payload.pending_end_datetime, exclude_meeting_id=meeting.id)
    if conflict:
        raise BusinessRuleViolation(conflict)

    meeting.pending_start_datetime = payload.pending_start_datetime
    meeting.pending_end_datetime = payload.pending_end_datetime
    meeting.pending_proposed_by = ProposedBy.ADMIN
    meeting.denial_reason = None
    meeting.status = MeetingStatus.RESCHEDULE_PENDING
    db.commit()
    db.refresh(meeting)
    _notify_client(db, meeting, "rescheduled")
    return meeting


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meeting(meeting_id: int, db: Session = Depends(get_db)):
    meeting = _get_meeting_or_404(meeting_id, db)
    client_id = meeting.client_id
    db.delete(meeting)
    db.commit()
    manager.broadcast_change("meetings", client_id=client_id)


@project_scoped_router.patch("/{meeting_id}/confirm", response_model=MeetingOut)
def confirm_project_meeting(
    project_id: int,
    meeting_id: int,
    payload: MeetingConfirmRequest,
    db: Session = Depends(get_db),
):
    meeting = _get_project_meeting_or_404(project_id, meeting_id, db)
    is_initial_request = meeting.status == MeetingStatus.REQUESTED
    is_client_reschedule = (
        meeting.status == MeetingStatus.RESCHEDULE_PENDING and meeting.pending_proposed_by == ProposedBy.CLIENT
    )
    if not (is_initial_request or is_client_reschedule):
        raise BusinessRuleViolation("There is no pending client request to confirm")

    if meeting.meeting_type == MeetingType.ONLINE:
        if not payload.meeting_link:
            raise BusinessRuleViolation("A meeting link is required to confirm an online meeting")
        if not payload.meeting_code:
            raise BusinessRuleViolation("A meeting code is required to confirm an online meeting")
        meeting.meeting_link = payload.meeting_link
        meeting.meeting_code = payload.meeting_code
    else:
        meeting.meeting_link = None
        meeting.meeting_code = None
    meeting.confirmed_start_datetime = meeting.pending_start_datetime
    meeting.confirmed_end_datetime = meeting.pending_end_datetime
    meeting.pending_proposed_by = None
    meeting.denial_reason = None
    meeting.status = MeetingStatus.CONFIRMED
    db.commit()
    db.refresh(meeting)
    _notify_client(db, meeting, "confirmed")
    return meeting


@project_scoped_router.patch("/{meeting_id}/deny", response_model=MeetingOut)
def deny_project_meeting(
    project_id: int,
    meeting_id: int,
    payload: MeetingDenyRequest,
    db: Session = Depends(get_db),
):
    meeting = _get_project_meeting_or_404(project_id, meeting_id, db)
    if meeting.status == MeetingStatus.REQUESTED:
        meeting.status = MeetingStatus.DENIED
        meeting.pending_proposed_by = None
        meeting.denial_reason = payload.reason
        db.commit()
        db.refresh(meeting)
        _notify_client(db, meeting, "denied")
        return meeting

    if meeting.status == MeetingStatus.RESCHEDULE_PENDING and meeting.pending_proposed_by == ProposedBy.CLIENT:
        meeting.pending_start_datetime = meeting.confirmed_start_datetime
        meeting.pending_end_datetime = meeting.confirmed_end_datetime
        meeting.pending_proposed_by = None
        meeting.denial_reason = payload.reason
        meeting.status = MeetingStatus.CONFIRMED
        db.commit()
        db.refresh(meeting)
        _notify_client(db, meeting, "reschedule denied")
        return meeting

    raise BusinessRuleViolation("There is no pending client request to deny")


@project_scoped_router.post("/{meeting_id}/propose-reschedule", response_model=MeetingOut)
def propose_project_reschedule(
    project_id: int,
    meeting_id: int,
    payload: MeetingReschedulePropose,
    db: Session = Depends(get_db),
):
    meeting = _get_project_meeting_or_404(project_id, meeting_id, db)
    if meeting.status != MeetingStatus.CONFIRMED:
        raise BusinessRuleViolation("Only a confirmed meeting can have a reschedule proposed")
    if _as_aware(payload.pending_start_datetime) <= _as_aware(meeting.confirmed_end_datetime):
        raise BusinessRuleViolation("A reschedule must be proposed for a time after the currently confirmed appointment")
    ensure_business_hours(payload.pending_start_datetime, payload.pending_end_datetime)

    conflict = find_conflict_reason(db, payload.pending_start_datetime, payload.pending_end_datetime, exclude_meeting_id=meeting.id)
    if conflict:
        raise BusinessRuleViolation(conflict)

    meeting.pending_start_datetime = payload.pending_start_datetime
    meeting.pending_end_datetime = payload.pending_end_datetime
    meeting.pending_proposed_by = ProposedBy.ADMIN
    meeting.denial_reason = None
    meeting.status = MeetingStatus.RESCHEDULE_PENDING
    db.commit()
    db.refresh(meeting)
    _notify_client(db, meeting, "rescheduled")
    return meeting


@project_scoped_router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project_meeting(project_id: int, meeting_id: int, db: Session = Depends(get_db)):
    meeting = _get_project_meeting_or_404(project_id, meeting_id, db)
    client_id = meeting.client_id
    db.delete(meeting)
    db.commit()
    manager.broadcast_change("meetings", client_id=client_id)
