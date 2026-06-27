from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.exceptions import BusinessRuleViolation
from app.db.session import get_db
from app.models.enums import ChallengeStatus, FeatureRequestStatus
from app.models.feature_request import FeatureRequest, FeatureRequestMessage
from app.models.project import Project
from app.models.user import User
from app.schemas.feature_request import (
    AdminBaseFeatureCreateRequest,
    ChallengeDecisionRequest,
    CompleteFeatureRequest,
    FeatureRequestAdminOut,
    FeatureRequestMessageCreateRequest,
    FeatureRequestMessageOut,
    FeatureRequestStatusUpdateRequest,
)
from app.services.email import notify_feature_request_event
from app.services.pricing import compute_feature_price

router = APIRouter(
    prefix="/api/admin/feature-requests", tags=["admin-feature-requests"], dependencies=[Depends(require_admin)]
)

project_scoped_router = APIRouter(
    prefix="/api/admin/projects/{project_id}/feature-requests",
    tags=["admin-feature-requests"],
    dependencies=[Depends(require_admin)],
)


def _get_project_or_404(project_id: int, db: Session) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.get("", response_model=list[FeatureRequestAdminOut])
def list_all_feature_requests(include_base_features: bool = False, db: Session = Depends(get_db)):
    """Extra features only by default — base features are managed from the client's base
    project page. Callers that need the full billable set (e.g. invoice generation) can
    pass include_base_features=true."""
    query = db.query(FeatureRequest)
    if not include_base_features:
        query = query.filter(FeatureRequest.is_base_feature.is_(False))
    return query.order_by(FeatureRequest.created_at.desc()).all()


@project_scoped_router.get("", response_model=list[FeatureRequestAdminOut])
def list_project_feature_requests(
    project_id: int, include_base_features: bool = False, db: Session = Depends(get_db)
):
    _get_project_or_404(project_id, db)
    query = db.query(FeatureRequest).filter(FeatureRequest.project_id == project_id)
    if not include_base_features:
        query = query.filter(FeatureRequest.is_base_feature.is_(False))
    return query.order_by(FeatureRequest.created_at.desc()).all()


@project_scoped_router.post("", response_model=FeatureRequestAdminOut, status_code=status.HTTP_201_CREATED)
def create_project_feature_request(
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
            project.client,
            payload.quoted_frontend_hours,
            payload.quoted_backend_hours,
            payload.quoted_production_hours,
        ),
        agreement_date=payload.agreement_date,
        added_by_client=not payload.is_base_feature,
    )
    db.add(fr)
    db.commit()
    db.refresh(fr)
    return fr


def _get_fr_or_404(feature_request_id: int, db: Session) -> FeatureRequest:
    fr = db.get(FeatureRequest, feature_request_id)
    if not fr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feature request not found")
    return fr


@router.get("/{feature_request_id}/messages", response_model=list[FeatureRequestMessageOut])
def list_messages(feature_request_id: int, db: Session = Depends(get_db)):
    fr = _get_fr_or_404(feature_request_id, db)
    return fr.messages


@router.post("/{feature_request_id}/messages", response_model=FeatureRequestMessageOut, status_code=201)
def create_message(
    feature_request_id: int,
    payload: FeatureRequestMessageCreateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    fr = _get_fr_or_404(feature_request_id, db)
    message = FeatureRequestMessage(
        feature_request_id=fr.id, sender_id=current_user.id, sender_role=current_user.role, body=payload.body
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    client = db.get(User, fr.client_id)
    if client:
        notify_feature_request_event(client.email, fr.id, "needs clarification")
    return message


@router.get("/{feature_request_id}/challenge-messages", response_model=list[FeatureRequestMessageOut])
def list_challenge_messages(feature_request_id: int, db: Session = Depends(get_db)):
    fr = _get_fr_or_404(feature_request_id, db)
    return [m for m in fr.messages if m.is_challenge]


@router.post("/{feature_request_id}/challenge-messages", response_model=FeatureRequestMessageOut, status_code=201)
def create_challenge_message(
    feature_request_id: int,
    payload: FeatureRequestMessageCreateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    fr = _get_fr_or_404(feature_request_id, db)
    if fr.challenge_status != ChallengeStatus.OPEN:
        raise BusinessRuleViolation("There is no open challenge for this feature")
    message = FeatureRequestMessage(
        feature_request_id=fr.id,
        sender_id=current_user.id,
        sender_role=current_user.role,
        body=payload.body,
        is_challenge=True,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


@router.patch("/{feature_request_id}/challenge-decision", response_model=FeatureRequestAdminOut)
def decide_challenge(
    feature_request_id: int,
    payload: ChallengeDecisionRequest,
    db: Session = Depends(get_db),
):
    fr = _get_fr_or_404(feature_request_id, db)
    if fr.challenge_status != ChallengeStatus.OPEN:
        raise BusinessRuleViolation("There is no open challenge for this feature")
    fr.challenge_status = ChallengeStatus.APPROVED if payload.decision == "approved" else ChallengeStatus.DENIED
    db.commit()
    db.refresh(fr)
    return fr


@router.patch("/{feature_request_id}/status", response_model=FeatureRequestAdminOut)
def update_status(
    feature_request_id: int, payload: FeatureRequestStatusUpdateRequest, db: Session = Depends(get_db)
):
    fr = _get_fr_or_404(feature_request_id, db)
    fr.status = FeatureRequestStatus(payload.status)
    if fr.status == FeatureRequestStatus.APPROVED:
        fr.added_by_client = True
    db.commit()
    db.refresh(fr)

    client = db.get(User, fr.client_id)
    if client:
        notify_feature_request_event(client.email, fr.id, payload.status)
    return fr


@router.patch("/{feature_request_id}/start", response_model=FeatureRequestAdminOut)
def start_feature(feature_request_id: int, db: Session = Depends(get_db)):
    fr = _get_fr_or_404(feature_request_id, db)
    if fr.status != FeatureRequestStatus.APPROVED:
        raise BusinessRuleViolation("Only approved feature requests can be started")
    fr.status = FeatureRequestStatus.IN_PROGRESS
    db.commit()
    db.refresh(fr)
    return fr


@router.patch("/{feature_request_id}/complete", response_model=FeatureRequestAdminOut)
def complete_feature(
    feature_request_id: int, payload: CompleteFeatureRequest, db: Session = Depends(get_db)
):
    fr = _get_fr_or_404(feature_request_id, db)
    if fr.status != FeatureRequestStatus.IN_PROGRESS:
        raise BusinessRuleViolation("Only in-progress feature requests can be marked completed")
    if payload.actual_hours_taken is None:
        raise BusinessRuleViolation("actual_hours_taken is required to mark a feature request as completed")

    fr.actual_hours_taken = payload.actual_hours_taken
    fr.status = FeatureRequestStatus.COMPLETED
    db.commit()
    db.refresh(fr)
    return fr


@router.patch("/{feature_request_id}/mark-out-of-scope", response_model=FeatureRequestAdminOut)
def mark_out_of_scope(feature_request_id: int, db: Session = Depends(get_db)):
    fr = _get_fr_or_404(feature_request_id, db)
    fr.status = FeatureRequestStatus.OUT_OF_SCOPE
    db.commit()
    db.refresh(fr)
    return fr


@router.delete("/{feature_request_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_feature_request(feature_request_id: int, db: Session = Depends(get_db)):
    fr = _get_fr_or_404(feature_request_id, db)
    db.delete(fr)
    db.commit()
