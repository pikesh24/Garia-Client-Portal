from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin
from app.models.enums import MaintenanceStatus


class MaintenanceRecord(Base, TimestampMixin):
    """One row per client per annual maintenance cycle. `amount` is a snapshot of the
    client's maintenance_price at the time the cycle was created, since that price can
    change later without rewriting history."""

    __tablename__ = "maintenance_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    cycle_year: Mapped[int] = mapped_column(Integer, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[MaintenanceStatus] = mapped_column(
        Enum(MaintenanceStatus, name="maintenance_status"), default=MaintenanceStatus.PENDING, nullable=False
    )

    proof_file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    penalty_deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    client: Mapped["User"] = relationship()


class InfrastructureCostEntry(Base, TimestampMixin):
    """Informational, admin-maintained registry. Not directly billed -- the annual
    maintenance fee is an independent flat amount on the client's profile."""

    __tablename__ = "infrastructure_cost_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    feature_request_id: Mapped[int | None] = mapped_column(ForeignKey("feature_requests.id"), nullable=True)

    module: Mapped[str] = mapped_column(String(255), nullable=False)
    billing_type: Mapped[str] = mapped_column(String(100), nullable=False)
    monthly_overhead_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    client: Mapped["User"] = relationship()
    feature_request: Mapped["FeatureRequest | None"] = relationship()
