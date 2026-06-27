from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.exceptions import BusinessRuleViolation
from app.db.session import get_db
from app.models.enums import TicketStatus
from app.models.project import Project
from app.models.ticket import SupportTicket, TicketAttachment, TicketStatusHistory
from app.models.user import User
from app.schemas.ticket import TicketOut
from app.services.email import notify_ticket_status_change
from app.services.file_storage import save_upload

router = APIRouter(prefix="/api/admin/tickets", tags=["admin-tickets"], dependencies=[Depends(require_admin)])

project_scoped_router = APIRouter(
    prefix="/api/admin/projects/{project_id}/tickets",
    tags=["admin-tickets"],
    dependencies=[Depends(require_admin)],
)


def _get_project_or_404(project_id: int, db: Session) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.get("", response_model=list[TicketOut])
def list_all_tickets(db: Session = Depends(get_db)):
    return db.query(SupportTicket).order_by(SupportTicket.created_at.desc()).all()


@project_scoped_router.get("", response_model=list[TicketOut])
def list_project_tickets(project_id: int, db: Session = Depends(get_db)):
    _get_project_or_404(project_id, db)
    return (
        db.query(SupportTicket)
        .filter(SupportTicket.project_id == project_id)
        .order_by(SupportTicket.created_at.desc())
        .all()
    )


def _get_ticket_or_404(ticket_id: int, db: Session) -> SupportTicket:
    ticket = db.get(SupportTicket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    return ticket


from app.models.enums import TicketPriority, TicketStatus


@router.patch("/{ticket_id}/status", response_model=TicketOut)
def update_ticket_status(
    ticket_id: int,
    status_toggle: TicketStatus | None = Form(None),
    priority: TicketPriority | None = Form(None),
    note: str | None = Form(None),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    ticket = _get_ticket_or_404(ticket_id, db)
    if status_toggle:
        ticket.status = status_toggle
        db.add(TicketStatusHistory(ticket_id=ticket.id, status=status_toggle, note=note, changed_by_id=admin.id))
    if priority:
        ticket.priority = priority
        
    db.commit()
    db.refresh(ticket)

    if status_toggle:
        client = db.get(User, ticket.client_id)
        if client:
            notify_ticket_status_change(client.email, ticket.id, status_toggle.value)
    return ticket


@router.post("/{ticket_id}/process", response_model=TicketOut)
def process_ticket(
    ticket_id: int,
    status: TicketStatus = Form(...),
    resolution_text: str = Form(...),
    proof_attachments: list[UploadFile] = File(default=[]),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if status not in [TicketStatus.RESOLVED, TicketStatus.OUT_OF_SCOPE]:
        raise BusinessRuleViolation("Process endpoint only accepts resolved or out_of_scope status")
        
    ticket = _get_ticket_or_404(ticket_id, db)
    ticket.resolution_text = resolution_text
    ticket.status = status

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
            ticket_id=ticket.id, status=status, note=resolution_text, changed_by_id=admin.id
        )
    )
    db.commit()
    db.refresh(ticket)

    client = db.get(User, ticket.client_id)
    if client:
        notify_ticket_status_change(client.email, ticket.id, status.value)
    return ticket


@router.delete("/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ticket(ticket_id: int, db: Session = Depends(get_db)):
    ticket = _get_ticket_or_404(ticket_id, db)
    db.delete(ticket)
    db.commit()
