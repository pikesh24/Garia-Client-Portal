from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.exceptions import BusinessRuleViolation
from app.db.session import get_db
from app.models.enums import MeetingStatus
from app.models.meeting import Meeting
from app.models.user import User
from app.schemas.meeting import AdminMeetingUpdateRequest, MeetingOut
from app.services.email import notify_meeting_event

router = APIRouter(prefix="/api/admin/meetings", tags=["admin-meetings"], dependencies=[Depends(require_admin)])


@router.get("", response_model=list[MeetingOut])
def list_all_meetings(db: Session = Depends(get_db)):
    return db.query(Meeting).order_by(Meeting.proposed_datetime.desc()).all()


def _get_meeting_or_404(meeting_id: int, db: Session) -> Meeting:
    meeting = db.get(Meeting, meeting_id)
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    return meeting


@router.patch("/{meeting_id}/confirm", response_model=MeetingOut)
def confirm_meeting_slot(
    meeting_id: int, payload: AdminMeetingUpdateRequest, db: Session = Depends(get_db)
):
    meeting = _get_meeting_or_404(meeting_id, db)
    if payload.meeting_link:
        meeting.meeting_link = payload.meeting_link
    meeting.status = MeetingStatus.CONFIRMED
    db.commit()
    db.refresh(meeting)
    client = db.get(User, meeting.client_id)
    if client:
        notify_meeting_event(client.email, meeting.id, "confirmed")
    return meeting


@router.patch("/{meeting_id}/reschedule", response_model=MeetingOut)
def reschedule_meeting(
    meeting_id: int, payload: AdminMeetingUpdateRequest, db: Session = Depends(get_db)
):
    meeting = _get_meeting_or_404(meeting_id, db)
    if not payload.new_proposed_datetime:
        raise BusinessRuleViolation("new_proposed_datetime is required to reschedule")

    meeting.rescheduled_datetime = payload.new_proposed_datetime
    meeting.reschedule_reason = payload.reason
    meeting.status = MeetingStatus.RESCHEDULED
    db.commit()
    db.refresh(meeting)
    client = db.get(User, meeting.client_id)
    if client:
        notify_meeting_event(client.email, meeting.id, "rescheduled")
    return meeting


@router.put("/{meeting_id}", response_model=MeetingOut)
def overwrite_meeting(
    meeting_id: int, payload: AdminMeetingUpdateRequest, db: Session = Depends(get_db)
):
    meeting = _get_meeting_or_404(meeting_id, db)
    meeting.meeting_link = payload.meeting_link
    meeting.rescheduled_datetime = payload.new_proposed_datetime
    meeting.reschedule_reason = payload.reason
    db.commit()
    db.refresh(meeting)
    return meeting


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meeting(meeting_id: int, db: Session = Depends(get_db)):
    meeting = _get_meeting_or_404(meeting_id, db)
    db.delete(meeting)
    db.commit()
