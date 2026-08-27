from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import require_developer
from app.core.exceptions import BusinessRuleViolation
from app.db.session import get_db
from app.models.enums import TicketStatus
from app.models.ticket import SupportTicket, TicketAttachment, TicketStatusHistory
from app.models.ticket_assignment import TicketAssignment
from app.models.user import User
from app.schemas.ticket import DeveloperTicketOut
from app.schemas.ticket_assignment import ReorderQueueRequest
from app.services.email import notify_ticket_status_change
from app.services.file_storage import save_upload
from app.services.realtime import manager

router = APIRouter(prefix="/api/developer/tickets", tags=["developer-tickets"], dependencies=[Depends(require_developer)])

_CLOSED_STATUSES = (TicketStatus.RESOLVED, TicketStatus.OUT_OF_SCOPE)


def _get_assignment_or_404(ticket_id: int, developer_id: int, db: Session) -> TicketAssignment:
    assignment = (
        db.query(TicketAssignment)
        .filter(TicketAssignment.ticket_id == ticket_id, TicketAssignment.developer_id == developer_id)
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    return assignment


def _my_queue(developer: User, db: Session) -> list[SupportTicket]:
    assignments = db.query(TicketAssignment).filter(TicketAssignment.developer_id == developer.id).all()
    active = [a for a in assignments if a.ticket.status not in _CLOSED_STATUSES]
    done = [a for a in assignments if a.ticket.status in _CLOSED_STATUSES]
    active.sort(key=lambda a: a.queue_position)
    done.sort(key=lambda a: a.ticket.updated_at)

    tickets = []
    for a in active + done:
        a.ticket.queue_position = a.queue_position
        tickets.append(a.ticket)
    return tickets


@router.get("", response_model=list[DeveloperTicketOut])
def list_my_queue(developer: User = Depends(require_developer), db: Session = Depends(get_db)):
    return _my_queue(developer, db)


@router.get("/{ticket_id}", response_model=DeveloperTicketOut)
def get_my_ticket(ticket_id: int, developer: User = Depends(require_developer), db: Session = Depends(get_db)):
    assignment = _get_assignment_or_404(ticket_id, developer.id, db)
    assignment.ticket.queue_position = assignment.queue_position
    return assignment.ticket


@router.patch("/reorder", response_model=list[DeveloperTicketOut])
def reorder_queue(
    payload: ReorderQueueRequest,
    developer: User = Depends(require_developer),
    db: Session = Depends(get_db),
):
    assignments = db.query(TicketAssignment).filter(TicketAssignment.developer_id == developer.id).all()
    active = {a.ticket_id: a for a in assignments if a.ticket.status not in _CLOSED_STATUSES}

    if set(payload.ordered_ticket_ids) != set(active.keys()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reorder list must exactly match your active assigned tickets",
        )

    for position, ticket_id in enumerate(payload.ordered_ticket_ids):
        active[ticket_id].queue_position = position

    db.commit()
    manager.notify_user("tickets", developer.id)
    return _my_queue(developer, db)


@router.post("/{ticket_id}/resolve", response_model=DeveloperTicketOut)
def resolve_ticket(
    ticket_id: int,
    resolution_text: str = Form(...),
    proof_attachments: list[UploadFile] = File(default=[]),
    developer: User = Depends(require_developer),
    db: Session = Depends(get_db),
):
    assignment = _get_assignment_or_404(ticket_id, developer.id, db)
    ticket = assignment.ticket
    if ticket.status in _CLOSED_STATUSES:
        raise BusinessRuleViolation("Ticket is already closed")

    ticket.resolution_text = resolution_text
    ticket.status = TicketStatus.RESOLVED

    for proof_file in proof_attachments:
        if proof_file.filename:
            relative_path, original_name = save_upload(proof_file, subfolder=f"tickets/{ticket.id}/proof")
            db.add(
                TicketAttachment(
                    ticket_id=ticket.id, file_path=relative_path, original_filename=original_name, is_proof=True
                )
            )

    db.add(
        TicketStatusHistory(
            ticket_id=ticket.id, status=TicketStatus.RESOLVED, note=resolution_text, changed_by_id=developer.id
        )
    )
    db.commit()
    db.refresh(ticket)

    client = db.get(User, ticket.client_id)
    if client:
        notify_ticket_status_change(client.email, ticket.id, TicketStatus.RESOLVED.value)
    manager.broadcast_change("tickets", client_id=ticket.client_id)

    ticket.queue_position = assignment.queue_position
    return ticket
