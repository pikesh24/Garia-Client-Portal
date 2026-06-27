from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.db.session import get_db
from app.models.discount import Discount
from app.models.project import Project
from app.schemas.discount import DiscountCreateRequest, DiscountOut, DiscountUpdateRequest, ProjectDiscountCreateRequest

router = APIRouter(prefix="/api/admin/discounts", tags=["admin-discounts"], dependencies=[Depends(require_admin)])

project_scoped_router = APIRouter(
    prefix="/api/admin/projects/{project_id}/discounts",
    tags=["admin-discounts"],
    dependencies=[Depends(require_admin)],
)


def _get_project_or_404(project_id: int, db: Session) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def _deactivate_other_active_discounts(client_id: int, db: Session, except_id: int | None = None) -> None:
    query = db.query(Discount).filter(Discount.client_id == client_id, Discount.is_active == True)  # noqa: E712
    if except_id is not None:
        query = query.filter(Discount.id != except_id)
    query.update({Discount.is_active: False})


def _deactivate_other_active_project_discounts(project_id: int, db: Session, except_id: int | None = None) -> None:
    query = db.query(Discount).filter(Discount.project_id == project_id, Discount.is_active == True)  # noqa: E712
    if except_id is not None:
        query = query.filter(Discount.id != except_id)
    query.update({Discount.is_active: False})


@router.get("", response_model=list[DiscountOut])
def list_discounts(client_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(Discount)
    if client_id is not None:
        query = query.filter(Discount.client_id == client_id)
    return query.order_by(Discount.created_at.desc()).all()


@router.post("", response_model=DiscountOut, status_code=status.HTTP_201_CREATED)
def create_discount(payload: DiscountCreateRequest, db: Session = Depends(get_db)):
    # Flat legacy endpoint: no project_id is supplied, so we default to the client's
    # most-recently-created project (every client has at least a "Default Project").
    project = (
        db.query(Project)
        .filter(Project.client_id == payload.client_id)
        .order_by(Project.created_at.desc())
        .first()
    )
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client has no project")
    discount = Discount(
        client_id=payload.client_id,
        project_id=project.id,
        name=payload.name,
        discount_type=payload.discount_type,
        value=payload.value,
        is_active=payload.is_active,
    )
    db.add(discount)
    db.flush()
    if discount.is_active:
        # Enforce: only one active discount per client at a time
        _deactivate_other_active_discounts(payload.client_id, db, except_id=discount.id)
    db.commit()
    db.refresh(discount)
    return discount


def _get_discount_or_404(discount_id: int, db: Session) -> Discount:
    discount = db.get(Discount, discount_id)
    if not discount:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discount not found")
    return discount


@router.put("/{discount_id}", response_model=DiscountOut)
def overwrite_discount(discount_id: int, payload: DiscountUpdateRequest, db: Session = Depends(get_db)):
    discount = _get_discount_or_404(discount_id, db)
    discount.name = payload.name
    discount.discount_type = payload.discount_type
    discount.value = payload.value
    discount.is_active = payload.is_active
    db.flush()
    if discount.is_active:
        _deactivate_other_active_discounts(discount.client_id, db, except_id=discount.id)
    db.commit()
    db.refresh(discount)
    return discount


@router.delete("/{discount_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_discount(discount_id: int, db: Session = Depends(get_db)):
    discount = _get_discount_or_404(discount_id, db)
    db.delete(discount)
    db.commit()


@project_scoped_router.get("", response_model=list[DiscountOut])
def list_project_discounts(project_id: int, db: Session = Depends(get_db)):
    _get_project_or_404(project_id, db)
    return db.query(Discount).filter(Discount.project_id == project_id).order_by(Discount.created_at.desc()).all()


@project_scoped_router.post("", response_model=DiscountOut, status_code=status.HTTP_201_CREATED)
def create_project_discount(project_id: int, payload: ProjectDiscountCreateRequest, db: Session = Depends(get_db)):
    project = _get_project_or_404(project_id, db)
    discount = Discount(
        client_id=project.client_id,
        project_id=project.id,
        name=payload.name,
        discount_type=payload.discount_type,
        value=payload.value,
        is_active=payload.is_active,
    )
    db.add(discount)
    db.flush()
    if discount.is_active:
        _deactivate_other_active_project_discounts(project.id, db, except_id=discount.id)
    db.commit()
    db.refresh(discount)
    return discount
