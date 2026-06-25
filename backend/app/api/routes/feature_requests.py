from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_client
from app.core.exceptions import BusinessRuleViolation, IrreversibleActionConflict
from app.db.session import get_db
from app.models.enums import FeatureRequestStatus, InitiatedBy
from app.models.feature_request import FeatureRequest, FeatureRequestClarification
from app.models.user import User
from app.schemas.feature_request import (
    AuthorizeFeatureRequest,
    BaseFeatureActivationRequest,
    ClarificationResponseRequest,
    FeatureRequestCreateRequest,
    FeatureRequestOut,
    QuoteBreakdown,
)
from app.services.pricing import quote_feature_request

router = APIRouter(prefix="/api/feature-requests", tags=["feature-requests"], dependencies=[Depends(require_client)])


def _get_own_feature_request(feature_request_id: int, current_user: User, db: Session) -> FeatureRequest:
    fr = db.get(FeatureRequest, feature_request_id)
    if not fr or fr.client_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feature request not found")
    return fr


@router.get("", response_model=list[FeatureRequestOut])
def list_my_feature_requests(current_user: User = Depends(require_client), db: Session = Depends(get_db)):
    return (
        db.query(FeatureRequest)
        .filter(FeatureRequest.client_id == current_user.id)
        .order_by(FeatureRequest.created_at.desc())
        .all()
    )


@router.post("", response_model=FeatureRequestOut, status_code=201)
def create_feature_request(
    payload: FeatureRequestCreateRequest,
    current_user: User = Depends(require_client),
    db: Session = Depends(get_db),
):
    fr = FeatureRequest(
        client_id=current_user.id,
        name=payload.name,
        description=payload.description,
        initiated_by=InitiatedBy.CLIENT,
        added_by_client=True,
    )
    db.add(fr)
    db.commit()
    db.refresh(fr)
    return fr


@router.get("/{feature_request_id}/quote", response_model=QuoteBreakdown)
def get_quote_breakdown(
    feature_request_id: int, current_user: User = Depends(require_client), db: Session = Depends(get_db)
):
    fr = _get_own_feature_request(feature_request_id, current_user, db)
    if fr.status not in (FeatureRequestStatus.QUOTED, FeatureRequestStatus.ACCEPTED):
        raise BusinessRuleViolation("This feature request has not been quoted yet")
    breakdown = quote_feature_request(fr, current_user, db)
    return QuoteBreakdown(**breakdown)


@router.post("/{feature_request_id}/respond-clarification", response_model=FeatureRequestOut)
def respond_to_clarification(
    feature_request_id: int,
    payload: ClarificationResponseRequest,
    current_user: User = Depends(require_client),
    db: Session = Depends(get_db),
):
    """One-way modification rule: the client cannot free-chat back; submitting this
    fully overrides the feature request description and resolves the open query."""
    fr = _get_own_feature_request(feature_request_id, current_user, db)
    open_clarification = (
        db.query(FeatureRequestClarification)
        .filter(FeatureRequestClarification.feature_request_id == fr.id, FeatureRequestClarification.resolved == False)  # noqa: E712
        .order_by(FeatureRequestClarification.created_at.desc())
        .first()
    )
    if not open_clarification:
        raise BusinessRuleViolation("There is no open clarification request to respond to")

    open_clarification.client_description_override = payload.client_description_override
    open_clarification.resolved = True
    fr.description = payload.client_description_override
    fr.status = FeatureRequestStatus.INITIATED
    db.commit()
    db.refresh(fr)
    return fr


@router.post("/{feature_request_id}/authorize", response_model=FeatureRequestOut)
def authorize_feature(
    feature_request_id: int,
    payload: AuthorizeFeatureRequest,
    current_user: User = Depends(require_client),
    db: Session = Depends(get_db),
):
    fr = _get_own_feature_request(feature_request_id, current_user, db)
    if fr.accepted_terms:
        raise IrreversibleActionConflict("This feature request has already been authorized")
    if fr.status != FeatureRequestStatus.QUOTED:
        raise BusinessRuleViolation("Only quoted feature requests can be authorized")

    fr.accepted_terms = payload.accepted_terms
    fr.status = FeatureRequestStatus.ACCEPTED
    fr.added_by_client = True
    db.commit()
    db.refresh(fr)
    return fr


@router.post("/{feature_request_id}/activate-base-feature", response_model=FeatureRequestOut)
def activate_base_feature(
    feature_request_id: int,
    payload: BaseFeatureActivationRequest,
    current_user: User = Depends(require_client),
    db: Session = Depends(get_db),
):
    fr = _get_own_feature_request(feature_request_id, current_user, db)
    if not fr.is_base_feature:
        raise BusinessRuleViolation("This is not a base feature")
    if fr.base_feature_activated:
        raise IrreversibleActionConflict("This base feature has already been activated")

    fr.base_feature_activated = payload.verified
    fr.added_by_client = True
    db.commit()
    db.refresh(fr)
    return fr


@router.post("/{feature_request_id}/request-cancellation-review", response_model=FeatureRequestOut)
def request_cancellation_review(
    feature_request_id: int,
    current_user: User = Depends(require_client),
    db: Session = Depends(get_db),
):
    fr = _get_own_feature_request(feature_request_id, current_user, db)
    if fr.is_base_feature and fr.base_feature_activated:
        raise IrreversibleActionConflict("This base feature has already been activated and cannot be cancelled")
    fr.status = FeatureRequestStatus.OUT_OF_SCOPE
    db.commit()
    db.refresh(fr)
    return fr
