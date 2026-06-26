from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.db.session import get_db
from app.models.enums import FeatureRequestStatus, UserRole
from app.models.feature_request import FeatureRequest
from app.models.user import User
from app.schemas.feature_request import (
    AdminBaseFeatureCreateRequest,
    AdminFeatureDetailsUpdateRequest,
    FeatureRequestAdminOut,
)
from app.services.pricing import compute_feature_price

router = APIRouter(
    prefix="/api/admin/users/{client_id}/base-project",
    tags=["admin-base-project"],
    dependencies=[Depends(require_admin)],
)


def _get_client_or_404(client_id: int, db: Session) -> User:
    client = db.get(User, client_id)
    if not client or client.role != UserRole.CLIENT:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return client


def _get_entry_or_404(client_id: int, feature_request_id: int, db: Session) -> FeatureRequest:
    fr = db.get(FeatureRequest, feature_request_id)
    if not fr or fr.client_id != client_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feature request not found")
    return fr


@router.get("", response_model=list[FeatureRequestAdminOut])
def list_base_project(client_id: int, db: Session = Depends(get_db)):
    _get_client_or_404(client_id, db)
    return (
        db.query(FeatureRequest)
        .filter(
            FeatureRequest.client_id == client_id,
            or_(FeatureRequest.is_base_feature == True, FeatureRequest.added_by_client == True),  # noqa: E712
        )
        .order_by(FeatureRequest.created_at.desc())
        .all()
    )


@router.post("", response_model=FeatureRequestAdminOut, status_code=status.HTTP_201_CREATED)
def create_base_feature(
    client_id: int, payload: AdminBaseFeatureCreateRequest, db: Session = Depends(get_db)
):
    client = _get_client_or_404(client_id, db)
    fr = FeatureRequest(
        client_id=client_id,
        feature_id=payload.feature_id,
        name=payload.name,
        description=payload.description,
        is_base_feature=payload.is_base_feature,
        quoted_frontend_hours=payload.quoted_frontend_hours,
        quoted_backend_hours=payload.quoted_backend_hours,
        quoted_production_hours=payload.quoted_production_hours,
        price=compute_feature_price(
            client, payload.quoted_frontend_hours, payload.quoted_backend_hours, payload.quoted_production_hours
        ),
        agreement_date=payload.agreement_date,
        added_by_client=not payload.is_base_feature,
    )
    db.add(fr)
    db.commit()
    db.refresh(fr)
    return fr


@router.patch("/{feature_request_id}", response_model=FeatureRequestAdminOut)
def update_base_feature_details(
    client_id: int,
    feature_request_id: int,
    payload: AdminFeatureDetailsUpdateRequest,
    db: Session = Depends(get_db),
):
    client = _get_client_or_404(client_id, db)
    fr = _get_entry_or_404(client_id, feature_request_id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(fr, field, value)
    fr.price = compute_feature_price(
        client, fr.quoted_frontend_hours, fr.quoted_backend_hours, fr.quoted_production_hours
    )

    # The admin changed the scope of an already-approved feature — the client must sign off again.
    if fr.is_base_feature:
        if fr.base_feature_activated:
            fr.base_feature_activated = False
        fr.status = FeatureRequestStatus.UNDER_REVIEW
    elif fr.status == FeatureRequestStatus.APPROVED:
        fr.status = FeatureRequestStatus.UNDER_REVIEW

    db.commit()
    db.refresh(fr)
    return fr
