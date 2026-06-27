from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_owned_project, require_client
from app.core.exceptions import BusinessRuleViolation, IrreversibleActionConflict
from app.db.session import get_db
from app.models.enums import TicketStatus
from app.models.project import Project
from app.models.ticket import SupportTicket, TicketAttachment
from app.schemas.ticket import TicketOut
from app.services.file_storage import save_upload

router = APIRouter(prefix="/api/projects/{project_id}/tickets", tags=["tickets"], dependencies=[Depends(require_client)])


@router.get("", response_model=list[TicketOut])
def list_my_tickets(project: Project = Depends(get_owned_project), db: Session = Depends(get_db)):
    return (
        db.query(SupportTicket)
        .filter(SupportTicket.project_id == project.id)
        .order_by(SupportTicket.created_at.desc())
        .all()
    )


@router.get("/{ticket_id}", response_model=TicketOut)
def get_my_ticket(ticket_id: int, project: Project = Depends(get_owned_project), db: Session = Depends(get_db)):
    ticket = db.get(SupportTicket, ticket_id)
    if not ticket or ticket.project_id != project.id:
        raise IrreversibleActionConflict("Ticket not found")
    return ticket


@router.post("", response_model=TicketOut, status_code=201)
def file_ticket(
    name: str = Form(...),
    description: str = Form(...),
    file_upload: UploadFile = File(...),
    project: Project = Depends(get_owned_project),
    db: Session = Depends(get_db),
):
    if not file_upload or not file_upload.filename:
        raise BusinessRuleViolation("An attachment is required to file an incident ticket")

    ticket = SupportTicket(
        client_id=project.client_id, project_id=project.id, name=name, description=description, status=TicketStatus.OPEN
    )
    db.add(ticket)
    db.flush()

    relative_path, original_name = save_upload(file_upload, subfolder=f"tickets/{ticket.id}")
    db.add(
        TicketAttachment(
            ticket_id=ticket.id, file_path=relative_path, original_filename=original_name, is_proof=False
        )
    )
    db.commit()
    db.refresh(ticket)
    return ticket
