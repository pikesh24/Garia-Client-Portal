from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import ProfileUpdateRequest, UserOut

router = APIRouter(prefix="/api/profile", tags=["profile"])


@router.get("", response_model=UserOut)
def get_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("", response_model=UserOut)
def update_profile(
    payload: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # email is intentionally not editable here (hard-locked to prevent reference drift)
    current_user.full_name = payload.full_name
    db.commit()
    db.refresh(current_user)
    return current_user
