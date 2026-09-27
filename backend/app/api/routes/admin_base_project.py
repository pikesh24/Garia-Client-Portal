from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import require_admin_or_developer
from app.db.session import get_db
from app.models.enums import ChallengeStatus, FeatureRequestStatus
from app.models.feature_request import FeatureRequest
from app.models.project import Project
from app.schemas.feature_request import (
    AdminBaseFeatureCreateRequest,
    AdminFeatureDetailsUpdateRequest,
    FeatureRequestAdminOut,
)
from app.services.pricing import compute_feature_price
from app.services.realtime import manager

router = APIRouter(
    prefix="/api/admin/projects/{project_id}/base-project",
    tags=["admin-base-project"],
    dependencies=[Depends(require_admin_or_developer)],
)


def _get_project_or_404(project_id: int, db: Session) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def _get_entry_or_404(project_id: int, feature_request_id: int, db: Session) -> FeatureRequest:
    fr = db.get(FeatureRequest, feature_request_id)
    if not fr or fr.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feature request not found")
    return fr


@router.get("", response_model=list[FeatureRequestAdminOut])
def list_base_project(project_id: int, db: Session = Depends(get_db)):
    _get_project_or_404(project_id, db)
    return (
        db.query(FeatureRequest)
        .filter(
            FeatureRequest.project_id == project_id,
            or_(FeatureRequest.is_base_feature == True, FeatureRequest.added_by_client == True),  # noqa: E712
        )
        .order_by(FeatureRequest.created_at.desc())
        .all()
    )


@router.post("", response_model=FeatureRequestAdminOut, status_code=status.HTTP_201_CREATED)
def create_base_feature(
    project_id: int, payload: AdminBaseFeatureCreateRequest, db: Session = Depends(get_db)
):
    project = _get_project_or_404(project_id, db)
    fr = FeatureRequest(
        client_id=project.client_id,
        project_id=project.id,
        feature_id=payload.feature_id,
        name=payload.name,
        description=payload.description,
        is_base_feature=payload.is_base_feature,
        quoted_frontend_hours=payload.quoted_frontend_hours,
        quoted_backend_hours=payload.quoted_backend_hours,
        quoted_production_hours=payload.quoted_production_hours,
        price=compute_feature_price(
            project, payload.quoted_frontend_hours, payload.quoted_backend_hours, payload.quoted_production_hours
        ),
        agreement_date=payload.agreement_date,
        added_by_client=not payload.is_base_feature,
    )
    db.add(fr)
    db.commit()
    db.refresh(fr)
    manager.broadcast_change("feature_requests", client_id=fr.client_id)
    return fr


@router.patch("/{feature_request_id}", response_model=FeatureRequestAdminOut)
def update_base_feature_details(
    project_id: int,
    feature_request_id: int,
    payload: AdminFeatureDetailsUpdateRequest,
    db: Session = Depends(get_db),
):
    project = _get_project_or_404(project_id, db)
    fr = _get_entry_or_404(project_id, feature_request_id, db)
    updates = payload.model_dump(exclude_unset=True)
    scope_fields = {"quoted_frontend_hours", "quoted_backend_hours", "quoted_production_hours"}
    scope_changed = any(field in updates and updates[field] != getattr(fr, field) for field in scope_fields)
    details_changed = any(value != getattr(fr, field) for field, value in updates.items())

    for field, value in updates.items():
        setattr(fr, field, value)
    fr.price = compute_feature_price(
        project, fr.quoted_frontend_hours, fr.quoted_backend_hours, fr.quoted_production_hours
    )

    # Base features need the client to sign off again when the admin changes their hours/price,
    # since base_feature_activated represents the client's contractual agreement to that scope.
    # Extra (client-requested) features work differently: "approved" there just means the admin
    # accepted the client's request, which the admin is the one editing here — no need to send
    # it back through that separate approval step for a hours/price tweak they made themselves.
    if scope_changed and fr.is_base_feature:
        fr.base_feature_activated = False
        fr.status = FeatureRequestStatus.UNDER_REVIEW

    # A decided challenge only covers the terms it was raised against. Once the admin revises
    # the feature, the client may have new concerns, so let them challenge it again. The old
    # challenge thread is kept and simply continues when a new challenge is opened.
    if details_changed and fr.challenge_status in (ChallengeStatus.APPROVED, ChallengeStatus.DENIED):
        fr.challenge_status = ChallengeStatus.NONE

    db.commit()
    db.refresh(fr)
    manager.broadcast_change("feature_requests", client_id=fr.client_id)
    return fr
