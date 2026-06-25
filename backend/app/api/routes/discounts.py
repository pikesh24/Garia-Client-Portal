from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_client
from app.db.session import get_db
from app.models.user import User
from app.schemas.discount import DiscountOut
from app.services.pricing import get_active_discount

router = APIRouter(prefix="/api/discounts", tags=["discounts"], dependencies=[Depends(require_client)])


@router.get("/active", response_model=DiscountOut | None)
def get_my_active_discount(current_user: User = Depends(require_client), db: Session = Depends(get_db)):
    return get_active_discount(current_user.id, db)
