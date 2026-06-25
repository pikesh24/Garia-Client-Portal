from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.db.session import get_db
from app.models.enums import TicketStatus
from app.models.ticket import SupportTicket, TicketAttachment, TicketStatusHistory
from app.models.user import User
from app.schemas.ticket import TicketOut
from app.services.email import notify_ticket_status_change
from app.services.file_storage import save_upload

router = APIRouter(prefix="/api/admin/tickets", tags=["admin-tickets"], dependencies=[Depends(require_admin)])


@router.get("", response_model=list[TicketOut])
def list_all_tickets(db: Session = Depends(get_db)):
    return db.query(SupportTicket).order_by(SupportTicket.created_at.desc()).all()


def _get_ticket_or_404(ticket_id: int, db: Session) -> SupportTicket:
    ticket = db.get(SupportTicket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    return ticket


@router.patch("/{ticket_id}/status", response_model=TicketOut)
def update_ticket_status(
    ticket_id: int,
    status_toggle: TicketStatus = Form(...),
    note: str | None = Form(None),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    ticket = _get_ticket_or_404(ticket_id, db)
    ticket.status = status_toggle
    db.add(TicketStatusHistory(ticket_id=ticket.id, status=status_toggle, note=note, changed_by_id=admin.id))
    db.commit()
    db.refresh(ticket)

    client = db.get(User, ticket.client_id)
    if client:
        notify_ticket_status_change(client.email, ticket.id, status_toggle.value)
    return ticket


@router.post("/{ticket_id}/resolve", response_model=TicketOut)
def resolve_ticket(
    ticket_id: int,
    resolution_text: str = Form(...),
    proof_attachments: list[UploadFile] = File(default=[]),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    ticket = _get_ticket_or_404(ticket_id, db)
    ticket.resolution_text = resolution_text
    ticket.status = TicketStatus.RESOLVED

    for proof_file in proof_attachments:
        relative_path, original_name = save_upload(proof_file, subfolder=f"tickets/{ticket.id}/proof")
        db.add(
            TicketAttachment(
                ticket_id=ticket.id, file_path=relative_path, original_filename=original_name, is_proof=True
            )
        )

    db.add(
        TicketStatusHistory(
            ticket_id=ticket.id, status=TicketStatus.RESOLVED, note="Resolved", changed_by_id=admin.id
        )
    )
    db.commit()
    db.refresh(ticket)

    client = db.get(User, ticket.client_id)
    if client:
        notify_ticket_status_change(client.email, ticket.id, TicketStatus.RESOLVED.value)
    return ticket


@router.delete("/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ticket(ticket_id: int, db: Session = Depends(get_db)):
    ticket = _get_ticket_or_404(ticket_id, db)
    db.delete(ticket)
    db.commit()
