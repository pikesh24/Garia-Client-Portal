from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import TicketStatus


class TicketAttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    file_path: str
    original_filename: str
    is_proof: bool


class TicketStatusHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: TicketStatus
    note: str | None
    changed_by_id: int
    created_at: datetime


class TicketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    description: str
    status: TicketStatus
    resolution_text: str | None
    attachments: list[TicketAttachmentOut] = []
    status_history: list[TicketStatusHistoryOut] = []
    created_at: datetime


class TicketStatusUpdateRequest(BaseModel):
    status_toggle: TicketStatus
    note: str | None = None
    resolution_text: str | None = None
