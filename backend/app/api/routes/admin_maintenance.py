from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin_or_developer
from app.core.exceptions import BusinessRuleViolation, IrreversibleActionConflict
from app.db.session import get_db
from app.models.enums import MaintenanceStatus
from app.models.maintenance import InfrastructureCostEntry, MaintenanceRecord
from app.models.project import Project
from app.models.user import User
from app.schemas.maintenance import (
    InfrastructureCostEntryCreateRequest,
    InfrastructureCostEntryOut,
    InfrastructureCostEntryUpdateRequest,
    MaintenanceCycleCreateRequest,
    MaintenanceRecordOut,
    MaintenanceRejectRequest,
    ProjectInfrastructureCostEntryCreateRequest,
    ProjectMaintenanceCycleCreateRequest,
)
from app.services.email import notify_maintenance_proof_rejected
from app.services.realtime import manager

router = APIRouter(prefix="/api/admin/maintenance", tags=["admin-maintenance"], dependencies=[Depends(require_admin_or_developer)])

records_project_scoped_router = APIRouter(
    prefix="/api/admin/projects/{project_id}/maintenance/records",
    tags=["admin-maintenance"],
    dependencies=[Depends(require_admin_or_developer)],
)

infra_costs_project_scoped_router = APIRouter(
    prefix="/api/admin/projects/{project_id}/maintenance/infrastructure-costs",
    tags=["admin-maintenance"],
    dependencies=[Depends(require_admin_or_developer)],
)


def _get_project_or_404(project_id: int, db: Session) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.get("/records", response_model=list[MaintenanceRecordOut])
def list_maintenance_records(db: Session = Depends(get_db)):
    return db.query(MaintenanceRecord).order_by(MaintenanceRecord.due_date.desc()).all()


@router.post("/records", response_model=MaintenanceRecordOut, status_code=status.HTTP_201_CREATED)
def create_maintenance_cycle(payload: MaintenanceCycleCreateRequest, db: Session = Depends(get_db)):
    client = db.get(User, payload.client_id)
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    project = db.query(Project).filter(Project.client_id == client.id).order_by(Project.created_at.desc()).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client has no project")
    if project.maintenance_price is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Project has no maintenance_price configured"
        )

    record = MaintenanceRecord(
        client_id=client.id,
        project_id=project.id,
        cycle_year=payload.cycle_year,
        due_date=payload.due_date,
        amount=payload.amount if payload.amount is not None else project.maintenance_price,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    manager.broadcast_change("maintenance", client_id=record.client_id)
    return record


@records_project_scoped_router.get("", response_model=list[MaintenanceRecordOut])
def list_project_maintenance_records(project_id: int, db: Session = Depends(get_db)):
    _get_project_or_404(project_id, db)
    return (
        db.query(MaintenanceRecord)
        .filter(MaintenanceRecord.project_id == project_id)
        .order_by(MaintenanceRecord.due_date.desc())
        .all()
    )


@records_project_scoped_router.post("", response_model=MaintenanceRecordOut, status_code=status.HTTP_201_CREATED)
def create_project_maintenance_cycle(
    project_id: int, payload: ProjectMaintenanceCycleCreateRequest, db: Session = Depends(get_db)
):
    project = _get_project_or_404(project_id, db)
    client = project.client
    if project.maintenance_price is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Project has no maintenance_price configured"
        )

    record = MaintenanceRecord(
        client_id=client.id,
        project_id=project.id,
        cycle_year=payload.cycle_year,
        due_date=payload.due_date,
        amount=payload.amount if payload.amount is not None else project.maintenance_price,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    manager.broadcast_change("maintenance", client_id=record.client_id)
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
    manager.broadcast_change("maintenance", client_id=record.client_id)
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
    manager.broadcast_change("maintenance", client_id=record.client_id)
    return record


@router.get("/infrastructure-costs", response_model=list[InfrastructureCostEntryOut])
def list_infra_costs(client_id: int | None = None, feature_request_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(InfrastructureCostEntry)
    if client_id is not None:
        query = query.filter(InfrastructureCostEntry.client_id == client_id)
    if feature_request_id is not None:
        query = query.filter(InfrastructureCostEntry.feature_request_id == feature_request_id)
    return query.all()


@router.post("/infrastructure-costs", response_model=InfrastructureCostEntryOut, status_code=status.HTTP_201_CREATED)
def create_infra_cost(payload: InfrastructureCostEntryCreateRequest, db: Session = Depends(get_db)):
    project = (
        db.query(Project)
        .filter(Project.client_id == payload.client_id)
        .order_by(Project.created_at.desc())
        .first()
    )
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client has no project")
    entry = InfrastructureCostEntry(**payload.model_dump(), project_id=project.id)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    manager.broadcast_change("maintenance", client_id=entry.client_id)
    return entry


@router.patch("/infrastructure-costs/{entry_id}", response_model=InfrastructureCostEntryOut)
def update_infra_cost(entry_id: int, payload: InfrastructureCostEntryUpdateRequest, db: Session = Depends(get_db)):
    entry = db.get(InfrastructureCostEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
    entry.module = payload.module
    entry.description = payload.description
    entry.billing_type = payload.billing_type
    entry.monthly_overhead_price = payload.monthly_overhead_price
    db.commit()
    db.refresh(entry)
    manager.broadcast_change("maintenance", client_id=entry.client_id)
    return entry


@router.delete("/infrastructure-costs/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_infra_cost(entry_id: int, db: Session = Depends(get_db)):
    entry = db.get(InfrastructureCostEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
    client_id = entry.client_id
    db.delete(entry)
    db.commit()
    manager.broadcast_change("maintenance", client_id=client_id)


@infra_costs_project_scoped_router.get("", response_model=list[InfrastructureCostEntryOut])
def list_project_infra_costs(
    project_id: int, feature_request_id: int | None = None, db: Session = Depends(get_db)
):
    _get_project_or_404(project_id, db)
    query = db.query(InfrastructureCostEntry).filter(InfrastructureCostEntry.project_id == project_id)
    if feature_request_id is not None:
        query = query.filter(InfrastructureCostEntry.feature_request_id == feature_request_id)
    return query.all()


@infra_costs_project_scoped_router.post(
    "", response_model=InfrastructureCostEntryOut, status_code=status.HTTP_201_CREATED
)
def create_project_infra_cost(
    project_id: int, payload: ProjectInfrastructureCostEntryCreateRequest, db: Session = Depends(get_db)
):
    project = _get_project_or_404(project_id, db)
    entry = InfrastructureCostEntry(
        client_id=project.client_id, project_id=project.id, **payload.model_dump()
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    manager.broadcast_change("maintenance", client_id=entry.client_id)
    return entry
