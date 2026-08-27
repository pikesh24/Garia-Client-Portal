from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin
from app.models.enums import ProjectStatus


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[ProjectStatus] = mapped_column(
        Enum(ProjectStatus, name="project_status"), default=ProjectStatus.ACTIVE, nullable=False
    )

    hourly_rate_frontend: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    hourly_rate_backend: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    hourly_rate_production: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    maintenance_price: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    project_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    client: Mapped["User"] = relationship()
