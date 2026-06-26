from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import MaintenanceStatus


class MaintenanceCycleCreateRequest(BaseModel):
    client_id: int
    cycle_year: int
    due_date: date
    amount: float | None = None


class MaintenanceRejectRequest(BaseModel):
    rejection_reason: str


class MaintenanceRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    cycle_year: int
    due_date: date
    amount: float
    status: MaintenanceStatus
    proof_file_path: str | None
    rejection_reason: str | None
    rejected_at: datetime | None
    penalty_deadline: datetime | None
    created_at: datetime


class InfrastructureCostEntryCreateRequest(BaseModel):
    client_id: int
    feature_request_id: int | None = None
    module: str
    description: str | None = None
    billing_type: str = "recurring"
    monthly_overhead_price: float


class InfrastructureCostEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    feature_request_id: int | None
    module: str
    description: str | None
    billing_type: str
    monthly_overhead_price: float
