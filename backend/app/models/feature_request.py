from datetime import date

from sqlalchemy import Boolean, Date, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin
from app.models.enums import ChallengeStatus, FeatureRequestStatus, UserRole


class FeatureRequest(Base, TimestampMixin):
    __tablename__ = "feature_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    # Admin-assigned business identifier (e.g. "F-001"), distinct from the internal primary key.
    feature_id: Mapped[str | None] = mapped_column(String(50), nullable=True)

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[FeatureRequestStatus] = mapped_column(
        Enum(FeatureRequestStatus, name="feature_request_status"),
        default=FeatureRequestStatus.UNDER_REVIEW,
        nullable=False,
    )
    # True once a client has explicitly added this feature to their active scope (set on approval)
    added_by_client: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_base_feature: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    base_feature_activated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Only applies to base features: the client may open a challenge to dispute the
    # quoted scope/hours before approving, which the admin resolves separately from approval.
    challenge_status: Mapped[ChallengeStatus] = mapped_column(
        Enum(ChallengeStatus, name="challenge_status"),
        default=ChallengeStatus.NONE,
        nullable=False,
    )

    quoted_frontend_hours: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    quoted_backend_hours: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    quoted_production_hours: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)

    accepted_terms: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    actual_hours_taken: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)

    # INR amount, admin-only — never exposed to the client until invoicing.
    price: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    agreement_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    client: Mapped["User"] = relationship()
    messages: Mapped[list["FeatureRequestMessage"]] = relationship(
        back_populates="feature_request", cascade="all, delete-orphan", order_by="FeatureRequestMessage.created_at"
    )


class FeatureRequestMessage(Base, TimestampMixin):
    """A single message in the back-and-forth chat between client and admin about a feature request."""

    __tablename__ = "feature_request_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    feature_request_id: Mapped[int] = mapped_column(
        ForeignKey("feature_requests.id"), nullable=False, index=True
    )
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    sender_role: Mapped[UserRole] = mapped_column(Enum(UserRole, name="user_role"), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    # Challenge messages are a separate thread from the general feature discussion.
    is_challenge: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    feature_request: Mapped["FeatureRequest"] = relationship(back_populates="messages")
