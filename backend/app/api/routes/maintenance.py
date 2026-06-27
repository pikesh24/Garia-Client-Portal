from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_owned_project, require_client
from app.core.exceptions import BusinessRuleViolation
from app.db.session import get_db
from app.models.enums import MaintenanceStatus
from app.models.maintenance import InfrastructureCostEntry, MaintenanceRecord
from app.models.project import Project
from app.schemas.maintenance import InfrastructureCostEntryOut, MaintenanceRecordOut
from app.services.file_storage import save_upload

router = APIRouter(
    prefix="/api/projects/{project_id}/maintenance", tags=["maintenance"], dependencies=[Depends(require_client)]
)


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
    return record
