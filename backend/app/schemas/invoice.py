from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import InvoiceStatus


class InvoiceCreateRequest(BaseModel):
    client_id: int
    feature_ids: list[int]
    tax_amount: float = 0
    notes: str | None = None


class ProjectInvoiceCreateRequest(BaseModel):
    """Same as InvoiceCreateRequest but without client_id -- the client is derived from the
    project on the path (a project has exactly one client)."""

    feature_ids: list[int]
    tax_amount: float = 0
    notes: str | None = None


class InvoiceLineItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    feature_request_id: int | None
    description: str
    frontend_hours: float
    backend_hours: float
    production_hours: float
    amount: float


class InvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    project_id: int
    status: InvoiceStatus
    subtotal: float
    discount_amount: float
    tax_amount: float
    total: float
    notes: str | None
    signed_document_path: str | None
    finalized_at: datetime | None
    line_items: list[InvoiceLineItemOut] = []
    created_at: datetime


class InvoiceUpdateRequest(BaseModel):
    tax_amount: float
    notes: str | None = None
