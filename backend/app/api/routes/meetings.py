from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_client
from app.core.exceptions import BusinessRuleViolation, IrreversibleActionConflict
from app.db.session import get_db
from app.models.enums import MeetingStatus, MeetingType
from app.models.meeting import Meeting
from app.models.user import User
from app.schemas.meeting import MeetingCounterProposeRequest, MeetingCreateRequest, MeetingOut
from app.services.email import notify_meeting_event

router = APIRouter(prefix="/api/meetings", tags=["meetings"], dependencies=[Depends(require_client)])


def _ensure_future_window(proposed_datetime: datetime) -> None:
    if proposed_datetime.tzinfo is None:
        proposed_datetime = proposed_datetime.replace(tzinfo=timezone.utc)
    if proposed_datetime < datetime.now(timezone.utc) + timedelta(hours=24):
        raise BusinessRuleViolation("Meetings must be requested at least 24 hours in advance")


@router.get("", response_model=list[MeetingOut])
def list_my_meetings(current_user: User = Depends(require_client), db: Session = Depends(get_db)):
    return (
        db.query(Meeting)
        .filter(Meeting.client_id == current_user.id)
        .order_by(Meeting.proposed_datetime.desc())
        .all()
    )


@router.post("", response_model=MeetingOut, status_code=201)
def request_meeting(
    payload: MeetingCreateRequest,
    current_user: User = Depends(require_client),
    db: Session = Depends(get_db),
):
    if payload.meeting_type == MeetingType.OFFLINE and not current_user.can_book_offline_meeting:
        raise BusinessRuleViolation("This account is not authorized to book offline meetings")

    _ensure_future_window(payload.proposed_datetime)

    meeting = Meeting(
        client_id=current_user.id,
        meeting_type=payload.meeting_type,
        proposed_datetime=payload.proposed_datetime,
        agenda=payload.agenda,
        status=MeetingStatus.REQUESTED,
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return meeting


def _get_own_meeting(meeting_id: int, current_user: User, db: Session) -> Meeting:
    meeting = db.get(Meeting, meeting_id)
    if not meeting or meeting.client_id != current_user.id:
        raise IrreversibleActionConflict("Meeting not found")
    return meeting


@router.post("/{meeting_id}/cancel", response_model=MeetingOut)
def cancel_meeting(
    meeting_id: int, current_user: User = Depends(require_client), db: Session = Depends(get_db)
):
    meeting = _get_own_meeting(meeting_id, current_user, db)
    if meeting.status in (MeetingStatus.CANCELLED, MeetingStatus.COMPLETED):
        raise IrreversibleActionConflict("Meeting is already finalized and cannot be cancelled")
    meeting.status = MeetingStatus.CANCELLED
    meeting.cancelled_by_client = True
    db.commit()
    db.refresh(meeting)
    notify_meeting_event(current_user.email, meeting.id, "cancelled")
    return meeting


@router.post("/{meeting_id}/accept-reschedule", response_model=MeetingOut)
def accept_reschedule(
    meeting_id: int, current_user: User = Depends(require_client), db: Session = Depends(get_db)
):
    meeting = _get_own_meeting(meeting_id, current_user, db)
    if meeting.status != MeetingStatus.RESCHEDULED:
        raise BusinessRuleViolation("This meeting has no pending reschedule proposal")
    meeting.proposed_datetime = meeting.rescheduled_datetime
    meeting.rescheduled_datetime = None
    meeting.status = MeetingStatus.CONFIRMED
    db.commit()
    db.refresh(meeting)
    notify_meeting_event(current_user.email, meeting.id, "confirmed")
    return meeting


@router.post("/{meeting_id}/counter-propose", response_model=MeetingOut)
def counter_propose(
    meeting_id: int,
    payload: MeetingCounterProposeRequest,
    current_user: User = Depends(require_client),
    db: Session = Depends(get_db),
):
    meeting = _get_own_meeting(meeting_id, current_user, db)
    if meeting.status != MeetingStatus.RESCHEDULED:
        raise BusinessRuleViolation("This meeting has no pending reschedule proposal")
    _ensure_future_window(payload.proposed_datetime)

    meeting.proposed_datetime = payload.proposed_datetime
    meeting.rescheduled_datetime = None
    meeting.reschedule_reason = None
    meeting.status = MeetingStatus.REQUESTED
    db.commit()
    db.refresh(meeting)
    return meeting
