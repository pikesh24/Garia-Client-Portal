from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.exceptions import IrreversibleActionConflict
from app.db.session import get_db
from app.models.discount import Discount
from app.models.feature_request import FeatureRequest
from app.models.invoice import Invoice
from app.models.maintenance import InfrastructureCostEntry, MaintenanceRecord
from app.models.meeting import Meeting
from app.models.project import Project
from app.models.ticket import SupportTicket
from app.schemas.project import ProjectCreateRequest, ProjectOut, ProjectUpdateRequest

router = APIRouter(
    prefix="/api/admin/users/{client_id}/projects",
    tags=["admin-projects"],
    dependencies=[Depends(require_admin)],
)

_DEPENDENT_MODELS = [
    FeatureRequest,
    SupportTicket,
    Meeting,
    Invoice,
    Discount,
    MaintenanceRecord,
    InfrastructureCostEntry,
]


def _get_project_or_404(client_id: int, project_id: int, db: Session) -> Project:
    project = db.get(Project, project_id)
    if not project or project.client_id != client_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.get("", response_model=list[ProjectOut])
def list_client_projects(client_id: int, db: Session = Depends(get_db)):
    return (
        db.query(Project)
        .filter(Project.client_id == client_id)
        .order_by(Project.created_at.desc())
        .all()
    )


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(client_id: int, payload: ProjectCreateRequest, db: Session = Depends(get_db)):
    project = Project(client_id=client_id, name=payload.name)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(client_id: int, project_id: int, db: Session = Depends(get_db)):
    return _get_project_or_404(client_id, project_id, db)


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    client_id: int, project_id: int, payload: ProjectUpdateRequest, db: Session = Depends(get_db)
):
    project = _get_project_or_404(client_id, project_id, db)
    if payload.name is not None:
        project.name = payload.name
    if payload.status is not None:
        project.status = payload.status
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(client_id: int, project_id: int, db: Session = Depends(get_db)):
    project = _get_project_or_404(client_id, project_id, db)
    for model in _DEPENDENT_MODELS:
        has_rows = db.query(model).filter(model.project_id == project_id).first() is not None
        if has_rows:
            raise IrreversibleActionConflict(
                "This project has dependent records and cannot be deleted. Deactivate it instead."
            )
    db.delete(project)
    db.commit()
