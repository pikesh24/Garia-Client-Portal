from sqlalchemy import Boolean, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin
from app.models.enums import FeatureRequestStatus, InitiatedBy


class FeatureRequest(Base, TimestampMixin):
    __tablename__ = "feature_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[FeatureRequestStatus] = mapped_column(
        Enum(FeatureRequestStatus, name="feature_request_status"),
        default=FeatureRequestStatus.INITIATED,
        nullable=False,
    )
    initiated_by: Mapped[InitiatedBy] = mapped_column(Enum(InitiatedBy, name="initiated_by"), nullable=False)
    # True once a client has explicitly added this (admin-proposed or self-initiated) feature to their active scope
    added_by_client: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_base_feature: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    base_feature_activated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    quoted_frontend_hours: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    quoted_backend_hours: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    quoted_production_hours: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)

    accepted_terms: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    actual_hours_taken: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)

    client: Mapped["User"] = relationship()
    clarifications: Mapped[list["FeatureRequestClarification"]] = relationship(
        back_populates="feature_request", cascade="all, delete-orphan", order_by="FeatureRequestClarification.created_at"
    )


class FeatureRequestClarification(Base, TimestampMixin):
    """Enforces the one-way modification rule: an admin technical query can only be
    answered by the client submitting a full description override, not free-form chat."""

    __tablename__ = "feature_request_clarifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    feature_request_id: Mapped[int] = mapped_column(
        ForeignKey("feature_requests.id"), nullable=False, index=True
    )
    admin_query: Mapped[str] = mapped_column(Text, nullable=False)
    client_description_override: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    feature_request: Mapped["FeatureRequest"] = relationship(back_populates="clarifications")
