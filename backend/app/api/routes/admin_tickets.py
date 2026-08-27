from fastapi import APIRouter, Depends, Form, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin, require_admin_or_developer
from app.db.session import get_db
from app.models.enums import TicketStatus, UserRole
from app.models.project import Project
from app.models.ticket import SupportTicket, TicketStatusHistory
from app.models.ticket_assignment import TicketAssignment
from app.models.user import User
from app.schemas.ticket import AdminTicketOut
from app.schemas.ticket_assignment import AssignDevelopersRequest
from app.services.email import notify_ticket_status_change
from app.services.realtime import manager

router = APIRouter(prefix="/api/admin/tickets", tags=["admin-tickets"])

project_scoped_router = APIRouter(
    prefix="/api/admin/projects/{project_id}/tickets",
    tags=["admin-tickets"],
)


def _get_project_or_404(project_id: int, db: Session) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.get("", response_model=list[AdminTicketOut], dependencies=[Depends(require_admin_or_developer)])
def list_all_tickets(db: Session = Depends(get_db)):
    return db.query(SupportTicket).order_by(SupportTicket.created_at.desc()).all()


@project_scoped_router.get("", response_model=list[AdminTicketOut], dependencies=[Depends(require_admin_or_developer)])
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


@router.patch("/{ticket_id}/status", response_model=AdminTicketOut)
def update_ticket_status(
    ticket_id: int,
    status_toggle: TicketStatus | None = Form(None),
    note: str | None = Form(None),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    ticket = _get_ticket_or_404(ticket_id, db)
    if status_toggle:
        ticket.status = status_toggle
        db.add(TicketStatusHistory(ticket_id=ticket.id, status=status_toggle, note=note, changed_by_id=admin.id))

    db.commit()
    db.refresh(ticket)

    if status_toggle:
        client = db.get(User, ticket.client_id)
        if client:
            notify_ticket_status_change(client.email, ticket.id, status_toggle.value)
    manager.broadcast_change("tickets", client_id=ticket.client_id)
    return ticket


@router.post("/{ticket_id}/assignments", response_model=AdminTicketOut)
def assign_developers(
    ticket_id: int,
    payload: AssignDevelopersRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    ticket = _get_ticket_or_404(ticket_id, db)

    already_assigned = {
        a.developer_id
        for a in db.query(TicketAssignment).filter(TicketAssignment.ticket_id == ticket.id).all()
    }
    new_ids = [d for d in payload.developer_ids if d not in already_assigned]

    added = False
    for developer_id in new_ids:
        developer = db.get(User, developer_id)
        if not developer or developer.role != UserRole.DEVELOPER or not developer.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid developer id {developer_id}")
        queue_size = db.query(TicketAssignment).filter(TicketAssignment.developer_id == developer_id).count()
        db.add(TicketAssignment(ticket_id=ticket.id, developer_id=developer_id, queue_position=queue_size))
        added = True

    if added and ticket.status == TicketStatus.OPEN:
        ticket.status = TicketStatus.IN_PROGRESS
        db.add(
            TicketStatusHistory(
                ticket_id=ticket.id, status=TicketStatus.IN_PROGRESS, note="Assigned to developer(s)", changed_by_id=admin.id
            )
        )

    db.commit()
    db.refresh(ticket)
    manager.broadcast_change("tickets", client_id=ticket.client_id)
    return ticket


@router.delete("/{ticket_id}/assignments/{developer_id}", response_model=AdminTicketOut)
def unassign_developer(
    ticket_id: int,
    developer_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    ticket = _get_ticket_or_404(ticket_id, db)
    assignment = (
        db.query(TicketAssignment)
        .filter(TicketAssignment.ticket_id == ticket.id, TicketAssignment.developer_id == developer_id)
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    db.delete(assignment)
    db.flush()

    remaining = db.query(TicketAssignment).filter(TicketAssignment.ticket_id == ticket.id).count()
    if remaining == 0 and ticket.status == TicketStatus.IN_PROGRESS:
        ticket.status = TicketStatus.OPEN
        db.add(
            TicketStatusHistory(
                ticket_id=ticket.id, status=TicketStatus.OPEN, note="Auto-reopened: no developers assigned", changed_by_id=admin.id
            )
        )

    db.commit()
    db.refresh(ticket)
    manager.broadcast_change("tickets", client_id=ticket.client_id)
    return ticket
