from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_client
from app.db.session import get_db
from app.models.enums import ProjectStatus
from app.models.project import Project
from app.models.user import User
from app.schemas.project import ProjectListResponse

router = APIRouter(prefix="/api/projects", tags=["projects"], dependencies=[Depends(require_client)])


@router.get("", response_model=ProjectListResponse)
def list_my_projects(current_user: User = Depends(require_client), db: Session = Depends(get_db)):
    projects = (
        db.query(Project)
        .filter(Project.client_id == current_user.id)
        .order_by(Project.created_at.desc())
        .all()
    )

    default_project_id: int | None = None
    if projects:
        active_projects = [p for p in projects if p.status == ProjectStatus.ACTIVE]
        default_project_id = active_projects[0].id if active_projects else projects[0].id

    return ProjectListResponse(projects=projects, default_project_id=default_project_id)
