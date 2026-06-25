from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.security import hash_password
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.user import ClientCreateRequest, ClientPatchRequest, ClientPutRequest, UserOut

router = APIRouter(prefix="/api/admin/users", tags=["admin-users"], dependencies=[Depends(require_admin)])


@router.get("", response_model=list[UserOut])
def list_clients(db: Session = Depends(get_db)):
    return db.query(User).filter(User.role == UserRole.CLIENT).order_by(User.created_at.desc()).all()


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_client(payload: ClientCreateRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already in use")

    client = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role=UserRole.CLIENT,
        can_book_offline_meeting=payload.can_book_offline_meeting,
        hourly_rate_frontend=payload.hourly_rate_frontend,
        hourly_rate_backend=payload.hourly_rate_backend,
        hourly_rate_production=payload.hourly_rate_production,
        maintenance_price=payload.maintenance_price,
        project_start_date=payload.project_start_date,
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


def _get_client_or_404(client_id: int, db: Session) -> User:
    client = db.get(User, client_id)
    if not client or client.role != UserRole.CLIENT:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return client


@router.get("/{client_id}", response_model=UserOut)
def get_client(client_id: int, db: Session = Depends(get_db)):
    return _get_client_or_404(client_id, db)


@router.patch("/{client_id}", response_model=UserOut)
def patch_client(client_id: int, payload: ClientPatchRequest, db: Session = Depends(get_db)):
    client = _get_client_or_404(client_id, db)
    updates = payload.model_dump(exclude_unset=True)
    if "email" in updates and updates["email"] != client.email:
        if db.query(User).filter(User.email == updates["email"]).first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already in use")
    for field, value in updates.items():
        setattr(client, field, value)
    db.commit()
    db.refresh(client)
    return client


@router.put("/{client_id}", response_model=UserOut)
def put_client(client_id: int, payload: ClientPutRequest, db: Session = Depends(get_db)):
    client = _get_client_or_404(client_id, db)
    if payload.email != client.email and db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already in use")
    for field, value in payload.model_dump().items():
        setattr(client, field, value)
    db.commit()
    db.refresh(client)
    return client


@router.post("/{client_id}/deactivate", response_model=UserOut)
def deactivate_client(client_id: int, db: Session = Depends(get_db)):
    client = _get_client_or_404(client_id, db)
    client.is_active = False
    db.commit()
    db.refresh(client)
    return client


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(client_id: int, db: Session = Depends(get_db)):
    client = _get_client_or_404(client_id, db)
    db.delete(client)
    db.commit()
