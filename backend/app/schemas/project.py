from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import ProjectStatus


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    name: str
    status: ProjectStatus
    hourly_rate_frontend: float | None
    hourly_rate_backend: float | None
    hourly_rate_production: float | None
    maintenance_price: float | None
    project_start_date: date | None
    created_at: datetime


class ProjectCreateRequest(BaseModel):
    name: str
    hourly_rate_frontend: float | None = None
    hourly_rate_backend: float | None = None
    hourly_rate_production: float | None = None
    maintenance_price: float | None = None
    project_start_date: date | None = None


class ProjectUpdateRequest(BaseModel):
    name: str | None = None
    status: ProjectStatus | None = None
    hourly_rate_frontend: float | None = None
    hourly_rate_backend: float | None = None
    hourly_rate_production: float | None = None
    maintenance_price: float | None = None
    project_start_date: date | None = None


class ProjectListResponse(BaseModel):
    projects: list[ProjectOut]
    default_project_id: int | None
