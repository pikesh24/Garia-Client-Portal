from pydantic import BaseModel, ConfigDict, EmailStr


class DeveloperSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: EmailStr


class TicketAssignmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    developer: DeveloperSummaryOut


class AssignDevelopersRequest(BaseModel):
    developer_ids: list[int]


class ReorderQueueRequest(BaseModel):
    ordered_ticket_ids: list[int]
