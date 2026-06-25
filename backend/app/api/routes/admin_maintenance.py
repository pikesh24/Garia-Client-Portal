from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.exceptions import BusinessRuleViolation, IrreversibleActionConflict
from app.db.session import get_db
from app.models.enums import MaintenanceStatus
from app.models.maintenance import InfrastructureCostEntry, MaintenanceRecord
from app.models.user import User
from app.schemas.maintenance import (
    InfrastructureCostEntryCreateRequest,
    InfrastructureCostEntryOut,
    MaintenanceCycleCreateRequest,
    MaintenanceRecordOut,
    MaintenanceRejectRequest,
)
from app.services.email import notify_maintenance_proof_rejected

router = APIRouter(prefix="/api/admin/maintenance", tags=["admin-maintenance"], dependencies=[Depends(require_admin)])


@router.get("/records", response_model=list[MaintenanceRecordOut])
def list_maintenance_records(db: Session = Depends(get_db)):
    return db.query(MaintenanceRecord).order_by(MaintenanceRecord.due_date.desc()).all()


@router.post("/records", response_model=MaintenanceRecordOut, status_code=status.HTTP_201_CREATED)
def create_maintenance_cycle(payload: MaintenanceCycleCreateRequest, db: Session = Depends(get_db)):
    client = db.get(User, payload.client_id)
    if not client or client.maintenance_price is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Client has no maintenance_price configured"
        )

    record = MaintenanceRecord(
        client_id=client.id,
        cycle_year=payload.cycle_year,
        due_date=payload.due_date,
        amount=client.maintenance_price,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def _get_record_or_404(record_id: int, db: Session) -> MaintenanceRecord:
    record = db.get(MaintenanceRecord, record_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Maintenance record not found")
    return record


@router.post("/records/{record_id}/approve", response_model=MaintenanceRecordOut)
def approve_proof(record_id: int, db: Session = Depends(get_db)):
    record = _get_record_or_404(record_id, db)
    if record.status != MaintenanceStatus.PROOF_SUBMITTED:
        raise BusinessRuleViolation("No submitted proof is pending review")
    if record.status == MaintenanceStatus.APPROVED:
        raise IrreversibleActionConflict("This maintenance cycle is already approved")

    record.status = MaintenanceStatus.APPROVED
    record.rejection_reason = None
    db.commit()
    db.refresh(record)
    return record


@router.post("/records/{record_id}/reject", response_model=MaintenanceRecordOut)
def reject_proof(record_id: int, payload: MaintenanceRejectRequest, db: Session = Depends(get_db)):
    record = _get_record_or_404(record_id, db)
    if record.status != MaintenanceStatus.PROOF_SUBMITTED:
        raise BusinessRuleViolation("No submitted proof is pending review")

    now = datetime.now(timezone.utc)
    record.status = MaintenanceStatus.REJECTED
    record.rejection_reason = payload.rejection_reason
    record.rejected_at = now
    record.penalty_deadline = now + timedelta(days=7)
    db.commit()
    db.refresh(record)

    client = db.get(User, record.client_id)
    if client:
        notify_maintenance_proof_rejected(
            client.email, record.id, payload.rejection_reason, record.penalty_deadline.isoformat()
        )
    return record


@router.get("/infrastructure-costs", response_model=list[InfrastructureCostEntryOut])
def list_infra_costs(client_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(InfrastructureCostEntry)
    if client_id is not None:
        query = query.filter(InfrastructureCostEntry.client_id == client_id)
    return query.all()


@router.post("/infrastructure-costs", response_model=InfrastructureCostEntryOut, status_code=status.HTTP_201_CREATED)
def create_infra_cost(payload: InfrastructureCostEntryCreateRequest, db: Session = Depends(get_db)):
    entry = InfrastructureCostEntry(**payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/infrastructure-costs/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_infra_cost(entry_id: int, db: Session = Depends(get_db)):
    entry = db.get(InfrastructureCostEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
    db.delete(entry)
    db.commit()
