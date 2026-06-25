from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import require_client
from app.core.exceptions import BusinessRuleViolation
from app.db.session import get_db
from app.models.enums import MaintenanceStatus
from app.models.maintenance import InfrastructureCostEntry, MaintenanceRecord
from app.models.user import User
from app.schemas.maintenance import InfrastructureCostEntryOut, MaintenanceRecordOut
from app.services.file_storage import save_upload

router = APIRouter(prefix="/api/maintenance", tags=["maintenance"], dependencies=[Depends(require_client)])


@router.get("/infrastructure-costs", response_model=list[InfrastructureCostEntryOut])
def get_my_infra_costs(current_user: User = Depends(require_client), db: Session = Depends(get_db)):
    return db.query(InfrastructureCostEntry).filter(InfrastructureCostEntry.client_id == current_user.id).all()


@router.get("/records", response_model=list[MaintenanceRecordOut])
def get_my_maintenance_records(current_user: User = Depends(require_client), db: Session = Depends(get_db)):
    return (
        db.query(MaintenanceRecord)
        .filter(MaintenanceRecord.client_id == current_user.id)
        .order_by(MaintenanceRecord.due_date.desc())
        .all()
    )


@router.post("/records/{record_id}/submit-proof", response_model=MaintenanceRecordOut)
def submit_payment_proof(
    record_id: int,
    voucher: UploadFile = File(...),
    current_user: User = Depends(require_client),
    db: Session = Depends(get_db),
):
    record = db.get(MaintenanceRecord, record_id)
    if not record or record.client_id != current_user.id:
        raise BusinessRuleViolation("Maintenance record not found")
    if record.status == MaintenanceStatus.APPROVED:
        raise BusinessRuleViolation("This maintenance cycle has already been approved")

    relative_path, _ = save_upload(voucher, subfolder=f"maintenance/{record.id}")
    record.proof_file_path = relative_path
    record.status = MaintenanceStatus.PROOF_SUBMITTED
    db.commit()
    db.refresh(record)
    return record
