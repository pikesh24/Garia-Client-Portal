from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_owned_project, require_client
from app.core.exceptions import BusinessRuleViolation, IrreversibleActionConflict
from app.db.session import get_db
from app.models.enums import ChallengeStatus, FeatureRequestStatus
from app.models.feature_request import FeatureRequest, FeatureRequestMessage
from app.models.project import Project
from app.models.user import User
from app.schemas.feature_request import (
    BaseFeatureActivationRequest,
    FeatureRequestCreateRequest,
    FeatureRequestMessageCreateRequest,
    FeatureRequestMessageOut,
    FeatureRequestOut,
    FeatureRequestUpdateRequest,
)

router = APIRouter(
    prefix="/api/projects/{project_id}/feature-requests",
    tags=["feature-requests"],
    dependencies=[Depends(require_client)],
)


def _get_own_feature_request(project_id: int, feature_request_id: int, db: Session) -> FeatureRequest:
    fr = db.get(FeatureRequest, feature_request_id)
    if not fr or fr.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feature request not found")
    return fr


@router.get("", response_model=list[FeatureRequestOut])
def list_my_feature_requests(project: Project = Depends(get_owned_project), db: Session = Depends(get_db)):
    return (
        db.query(FeatureRequest)
        .filter(FeatureRequest.project_id == project.id, FeatureRequest.is_base_feature == False)  # noqa: E712
        .order_by(FeatureRequest.created_at.desc())
        .all()
    )


@router.post("", response_model=FeatureRequestOut, status_code=201)
def create_feature_request(
    payload: FeatureRequestCreateRequest,
    project: Project = Depends(get_owned_project),
    db: Session = Depends(get_db),
):
    fr = FeatureRequest(
        client_id=project.client_id, project_id=project.id, name=payload.name, description=payload.description
    )
    db.add(fr)
    db.commit()
    db.refresh(fr)
    return fr


@router.put("/{feature_request_id}", response_model=FeatureRequestOut)
def update_feature_request(
    feature_request_id: int,
    payload: FeatureRequestUpdateRequest,
    project: Project = Depends(get_owned_project),
    db: Session = Depends(get_db),
):
    """The client edits their own request's name/description and resubmits it for review."""
    fr = _get_own_feature_request(project.id, feature_request_id, db)
    fr.name = payload.name
    fr.description = payload.description
    fr.status = FeatureRequestStatus.UNDER_REVIEW
    db.commit()
    db.refresh(fr)
    return fr


@router.get("/{feature_request_id}/messages", response_model=list[FeatureRequestMessageOut])
def list_messages(
    feature_request_id: int, project: Project = Depends(get_owned_project), db: Session = Depends(get_db)
):
    fr = _get_own_feature_request(project.id, feature_request_id, db)
    return fr.messages


@router.post("/{feature_request_id}/messages", response_model=FeatureRequestMessageOut, status_code=201)
def create_message(
    feature_request_id: int,
    payload: FeatureRequestMessageCreateRequest,
    current_user: User = Depends(require_client),
    project: Project = Depends(get_owned_project),
    db: Session = Depends(get_db),
):
    fr = _get_own_feature_request(project.id, feature_request_id, db)
    message = FeatureRequestMessage(
        feature_request_id=fr.id, sender_id=current_user.id, sender_role=current_user.role, body=payload.body
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


@router.post("/{feature_request_id}/activate-base-feature", response_model=FeatureRequestOut)
def activate_base_feature(
    feature_request_id: int,
    payload: BaseFeatureActivationRequest,
    project: Project = Depends(get_owned_project),
    db: Session = Depends(get_db),
):
    fr = _get_own_feature_request(project.id, feature_request_id, db)
    if not fr.is_base_feature:
        raise BusinessRuleViolation("This is not a base feature")
    if fr.base_feature_activated:
        raise IrreversibleActionConflict("This base feature has already been activated")

    fr.base_feature_activated = payload.verified
    fr.added_by_client = True
    db.commit()
    db.refresh(fr)
    return fr


@router.post("/{feature_request_id}/decline-base-feature", response_model=FeatureRequestOut)
def decline_base_feature(
    feature_request_id: int,
    project: Project = Depends(get_owned_project),
    db: Session = Depends(get_db),
):
    fr = _get_own_feature_request(project.id, feature_request_id, db)
    if not fr.is_base_feature:
        raise BusinessRuleViolation("This is not a base feature")
    if fr.base_feature_activated:
        raise IrreversibleActionConflict("This base feature has already been activated")

    fr.status = FeatureRequestStatus.DECLINED
    db.commit()
    db.refresh(fr)
    return fr


@router.post("/{feature_request_id}/challenge", response_model=FeatureRequestOut)
def open_challenge(
    feature_request_id: int,
    project: Project = Depends(get_owned_project),
    db: Session = Depends(get_db),
):
    fr = _get_own_feature_request(project.id, feature_request_id, db)
    if not fr.is_base_feature:
        raise BusinessRuleViolation("Only base features can be challenged")
    if fr.base_feature_activated:
        raise IrreversibleActionConflict("This base feature has already been activated")
    if fr.challenge_status == ChallengeStatus.OPEN:
        raise BusinessRuleViolation("A challenge is already open for this feature")

    fr.challenge_status = ChallengeStatus.OPEN
    db.commit()
    db.refresh(fr)
    return fr


@router.get("/{feature_request_id}/challenge-messages", response_model=list[FeatureRequestMessageOut])
def list_challenge_messages(
    feature_request_id: int, project: Project = Depends(get_owned_project), db: Session = Depends(get_db)
):
    fr = _get_own_feature_request(project.id, feature_request_id, db)
    return [m for m in fr.messages if m.is_challenge]


@router.post("/{feature_request_id}/challenge-messages", response_model=FeatureRequestMessageOut, status_code=201)
def create_challenge_message(
    feature_request_id: int,
    payload: FeatureRequestMessageCreateRequest,
    current_user: User = Depends(require_client),
    project: Project = Depends(get_owned_project),
    db: Session = Depends(get_db),
):
    fr = _get_own_feature_request(project.id, feature_request_id, db)
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


@router.post("/{feature_request_id}/request-cancellation-review", response_model=FeatureRequestOut)
def request_cancellation_review(
    feature_request_id: int,
    project: Project = Depends(get_owned_project),
    db: Session = Depends(get_db),
):
    fr = _get_own_feature_request(project.id, feature_request_id, db)
    if fr.is_base_feature and fr.base_feature_activated:
        raise IrreversibleActionConflict("This base feature has already been activated and cannot be cancelled")
    fr.status = FeatureRequestStatus.OUT_OF_SCOPE
    db.commit()
    db.refresh(fr)
    return fr


@router.post("/{feature_request_id}/approve", response_model=FeatureRequestOut)
def approve_feature_request(
    feature_request_id: int,
    project: Project = Depends(get_owned_project),
    db: Session = Depends(get_db),
):
    from datetime import date
    fr = _get_own_feature_request(project.id, feature_request_id, db)

    fr.accepted_terms = True
    fr.status = FeatureRequestStatus.APPROVED

    if fr.is_base_feature:
        fr.base_feature_activated = True
        fr.added_by_client = True

    if not fr.agreement_date:
        fr.agreement_date = date.today().isoformat()

    db.commit()
    db.refresh(fr)
    return fr
