from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import ProjectStatus


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    name: str
    status: ProjectStatus
    created_at: datetime


class ProjectCreateRequest(BaseModel):
    name: str


class ProjectUpdateRequest(BaseModel):
    name: str | None = None
    status: ProjectStatus | None = None


class ProjectListResponse(BaseModel):
    projects: list[ProjectOut]
    default_project_id: int | None
