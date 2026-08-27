from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.security import hash_password
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.user import DeveloperCreateRequest, DeveloperPatchRequest, UserOut
from app.services.realtime import manager

router = APIRouter(prefix="/api/admin/developers", tags=["admin-developers"], dependencies=[Depends(require_admin)])


@router.get("", response_model=list[UserOut])
def list_developers(db: Session = Depends(get_db)):
    return db.query(User).filter(User.role == UserRole.DEVELOPER).order_by(User.created_at.desc()).all()


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_developer(payload: DeveloperCreateRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already in use")

    developer = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role=UserRole.DEVELOPER,
    )
    db.add(developer)
    db.commit()
    db.refresh(developer)
    manager.broadcast_change("users")
    return developer


def _get_developer_or_404(developer_id: int, db: Session) -> User:
    developer = db.get(User, developer_id)
    if not developer or developer.role != UserRole.DEVELOPER:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Developer not found")
    return developer


@router.get("/{developer_id}", response_model=UserOut)
def get_developer(developer_id: int, db: Session = Depends(get_db)):
    return _get_developer_or_404(developer_id, db)


@router.patch("/{developer_id}", response_model=UserOut)
def patch_developer(developer_id: int, payload: DeveloperPatchRequest, db: Session = Depends(get_db)):
    developer = _get_developer_or_404(developer_id, db)
    updates = payload.model_dump(exclude_unset=True)
    if "email" in updates and updates["email"] != developer.email:
        if db.query(User).filter(User.email == updates["email"]).first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already in use")
    for field, value in updates.items():
        setattr(developer, field, value)
    db.commit()
    db.refresh(developer)
    manager.broadcast_change("users")
    manager.notify_user("users", developer.id)
    return developer


@router.post("/{developer_id}/deactivate", response_model=UserOut)
def deactivate_developer(developer_id: int, db: Session = Depends(get_db)):
    developer = _get_developer_or_404(developer_id, db)
    developer.is_active = False
    db.commit()
    db.refresh(developer)
    manager.broadcast_change("users")
    manager.notify_user("users", developer.id)
    return developer


@router.delete("/{developer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_developer(developer_id: int, db: Session = Depends(get_db)):
    developer = _get_developer_or_404(developer_id, db)
    db.delete(developer)
    db.commit()
    manager.broadcast_change("users")
