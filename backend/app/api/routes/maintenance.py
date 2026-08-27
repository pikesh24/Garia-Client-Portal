from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_owned_project, require_client
from app.core.exceptions import BusinessRuleViolation
from app.db.session import get_db
from app.models.enums import MaintenanceStatus
from app.models.maintenance import InfrastructureCostEntry, MaintenanceRecord
from app.models.project import Project
from app.models.user import User
from app.schemas.maintenance import InfrastructureCostEntryOut, MaintenanceRecordOut
from app.services.file_storage import save_upload
from app.services.realtime import manager

router = APIRouter(
    prefix="/api/projects/{project_id}/maintenance", tags=["maintenance"], dependencies=[Depends(require_client)]
)

# Client-wide router: not scoped to a single project, since a client can hold maintenance
# obligations across several projects and needs to settle them together.
client_router = APIRouter(prefix="/api/maintenance", tags=["maintenance"], dependencies=[Depends(require_client)])


@router.get("/infrastructure-costs", response_model=list[InfrastructureCostEntryOut])
def get_my_infra_costs(project: Project = Depends(get_owned_project), db: Session = Depends(get_db)):
    return db.query(InfrastructureCostEntry).filter(InfrastructureCostEntry.project_id == project.id).all()


@router.get("/records", response_model=list[MaintenanceRecordOut])
def get_my_maintenance_records(project: Project = Depends(get_owned_project), db: Session = Depends(get_db)):
    return (
        db.query(MaintenanceRecord)
        .filter(MaintenanceRecord.project_id == project.id)
        .order_by(MaintenanceRecord.due_date.desc())
        .all()
    )


@router.post("/records/{record_id}/submit-proof", response_model=MaintenanceRecordOut)
def submit_payment_proof(
    record_id: int,
    voucher: UploadFile = File(...),
    project: Project = Depends(get_owned_project),
    db: Session = Depends(get_db),
):
    record = db.get(MaintenanceRecord, record_id)
    if not record or record.project_id != project.id:
        raise BusinessRuleViolation("Maintenance record not found")
    if record.status == MaintenanceStatus.APPROVED:
        raise BusinessRuleViolation("This maintenance cycle has already been approved")

    relative_path, _ = save_upload(voucher, subfolder=f"maintenance/{record.id}")
    record.proof_file_path = relative_path
    record.status = MaintenanceStatus.PROOF_SUBMITTED
    db.commit()
    db.refresh(record)
    manager.broadcast_change("maintenance", client_id=record.client_id)
    return record


@client_router.get("/records", response_model=list[MaintenanceRecordOut])
def get_all_my_maintenance_records(current_user: User = Depends(require_client), db: Session = Depends(get_db)):
    """All maintenance cycles for the client, across every project they hold -- lets the
    client settle maintenance fees for multiple projects from a single view."""
    return (
        db.query(MaintenanceRecord)
        .filter(MaintenanceRecord.client_id == current_user.id)
        .order_by(MaintenanceRecord.due_date.desc())
        .all()
    )


@client_router.post("/records/bulk-submit-proof", response_model=list[MaintenanceRecordOut])
def submit_payment_proof_bulk(
    record_ids: str = Form(...),
    voucher: UploadFile = File(...),
    current_user: User = Depends(require_client),
    db: Session = Depends(get_db),
):
    """Attaches a single payment voucher to several maintenance cycles at once, so a client
    can pay for all outstanding project maintenance fees in one transaction/upload."""
    try:
        ids = [int(part) for part in record_ids.split(",") if part.strip()]
    except ValueError:
        raise BusinessRuleViolation("Invalid maintenance record selection")
    if not ids:
        raise BusinessRuleViolation("No maintenance cycles selected")

    records = db.query(MaintenanceRecord).filter(MaintenanceRecord.id.in_(ids)).all()
    if len(records) != len(set(ids)):
        raise BusinessRuleViolation("One or more maintenance cycles not found")
    for record in records:
        if record.client_id != current_user.id:
            raise BusinessRuleViolation("Maintenance record not found")
        if record.status == MaintenanceStatus.APPROVED:
            raise BusinessRuleViolation("One or more selected cycles are already approved")

    relative_path, _ = save_upload(voucher, subfolder=f"maintenance/bulk/{current_user.id}")
    for record in records:
        record.proof_file_path = relative_path
        record.status = MaintenanceStatus.PROOF_SUBMITTED
    db.commit()
    for record in records:
        db.refresh(record)
    manager.broadcast_change("maintenance", client_id=current_user.id)
    return records
