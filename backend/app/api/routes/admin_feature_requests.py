from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.exceptions import BusinessRuleViolation
from app.db.session import get_db
from app.models.enums import FeatureRequestStatus, InitiatedBy
from app.models.feature_request import FeatureRequest, FeatureRequestClarification
from app.models.user import User
from app.schemas.feature_request import (
    AdminProposeFeatureRequest,
    ClarificationCreateRequest,
    CompleteFeatureRequest,
    FeatureRequestOut,
    QuoteBreakdown,
    QuoteRequest,
)
from app.services.email import notify_feature_request_event
from app.services.pricing import quote_feature_request

router = APIRouter(
    prefix="/api/admin/feature-requests", tags=["admin-feature-requests"], dependencies=[Depends(require_admin)]
)


@router.get("", response_model=list[FeatureRequestOut])
def list_all_feature_requests(db: Session = Depends(get_db)):
    return db.query(FeatureRequest).order_by(FeatureRequest.created_at.desc()).all()


def _get_fr_or_404(feature_request_id: int, db: Session) -> FeatureRequest:
    fr = db.get(FeatureRequest, feature_request_id)
    if not fr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feature request not found")
    return fr


@router.post("/admin-propose", response_model=FeatureRequestOut, status_code=201)
def propose_feature(payload: AdminProposeFeatureRequest, db: Session = Depends(get_db)):
    client = db.get(User, payload.client_id)
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

    fr = FeatureRequest(
        client_id=client.id,
        name=payload.name,
        description=payload.description,
        initiated_by=InitiatedBy.GARIA,
        added_by_client=False,
    )
    db.add(fr)
    db.commit()
    db.refresh(fr)
    notify_feature_request_event(client.email, fr.id, "proposed")
    return fr


@router.post("/inject-base-feature", response_model=FeatureRequestOut, status_code=201)
def inject_base_feature(payload: AdminProposeFeatureRequest, db: Session = Depends(get_db)):
    """Admin injects a base feature directly into a client's dashboard. It renders
    unactivated until the client confirms the irreversible activation checkbox."""
    client = db.get(User, payload.client_id)
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

    fr = FeatureRequest(
        client_id=client.id,
        name=payload.name,
        description=payload.description,
        initiated_by=InitiatedBy.GARIA,
        added_by_client=False,
        is_base_feature=True,
        status=FeatureRequestStatus.ACCEPTED,
    )
    db.add(fr)
    db.commit()
    db.refresh(fr)
    notify_feature_request_event(client.email, fr.id, "added as a base feature")
    return fr


@router.post("/{feature_request_id}/clarify", response_model=FeatureRequestOut)
def raise_clarification(
    feature_request_id: int, payload: ClarificationCreateRequest, db: Session = Depends(get_db)
):
    fr = _get_fr_or_404(feature_request_id, db)
    db.add(FeatureRequestClarification(feature_request_id=fr.id, admin_query=payload.admin_query))
    fr.status = FeatureRequestStatus.CLARIFICATION_REQUESTED
    db.commit()
    db.refresh(fr)

    client = db.get(User, fr.client_id)
    if client:
        notify_feature_request_event(client.email, fr.id, "needs clarification")
    return fr


@router.post("/{feature_request_id}/quote", response_model=QuoteBreakdown)
def quote_feature(feature_request_id: int, payload: QuoteRequest, db: Session = Depends(get_db)):
    fr = _get_fr_or_404(feature_request_id, db)
    client = db.get(User, fr.client_id)
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

    fr.quoted_frontend_hours = payload.quoted_frontend_hours
    fr.quoted_backend_hours = payload.quoted_backend_hours
    fr.quoted_production_hours = payload.quoted_production_hours
    fr.status = FeatureRequestStatus.QUOTED
    db.commit()
    db.refresh(fr)

    notify_feature_request_event(client.email, fr.id, "quoted")
    breakdown = quote_feature_request(fr, client, db)
    return QuoteBreakdown(**breakdown)


@router.patch("/{feature_request_id}/start", response_model=FeatureRequestOut)
def start_feature(feature_request_id: int, db: Session = Depends(get_db)):
    fr = _get_fr_or_404(feature_request_id, db)
    if fr.status != FeatureRequestStatus.ACCEPTED:
        raise BusinessRuleViolation("Only client-authorized feature requests can be started")
    fr.status = FeatureRequestStatus.IN_PROGRESS
    db.commit()
    db.refresh(fr)
    return fr


@router.patch("/{feature_request_id}/complete", response_model=FeatureRequestOut)
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


@router.patch("/{feature_request_id}/mark-out-of-scope", response_model=FeatureRequestOut)
def mark_out_of_scope(feature_request_id: int, db: Session = Depends(get_db)):
    fr = _get_fr_or_404(feature_request_id, db)
    fr.status = FeatureRequestStatus.OUT_OF_SCOPE
    db.commit()
    db.refresh(fr)
    return fr


@router.put("/{feature_request_id}", response_model=FeatureRequestOut)
def overwrite_feature_request(
    feature_request_id: int, payload: AdminProposeFeatureRequest, db: Session = Depends(get_db)
):
    fr = _get_fr_or_404(feature_request_id, db)
    fr.name = payload.name
    fr.description = payload.description
    db.commit()
    db.refresh(fr)
    return fr


@router.delete("/{feature_request_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_feature_request(feature_request_id: int, db: Session = Depends(get_db)):
    fr = _get_fr_or_404(feature_request_id, db)
    db.delete(fr)
    db.commit()
