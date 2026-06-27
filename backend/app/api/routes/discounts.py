from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_owned_project, require_client
from app.db.session import get_db
from app.models.project import Project
from app.schemas.discount import DiscountOut
from app.services.pricing import get_active_discount

router = APIRouter(
    prefix="/api/projects/{project_id}/discounts", tags=["discounts"], dependencies=[Depends(require_client)]
)


@router.get("/active", response_model=DiscountOut | None)
def get_my_active_discount(project: Project = Depends(get_owned_project), db: Session = Depends(get_db)):
    return get_active_discount(project.id, db)
