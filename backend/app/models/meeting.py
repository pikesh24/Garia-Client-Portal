from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin
from app.models.enums import MeetingStatus, MeetingType, ProposedBy


class Meeting(Base, TimestampMixin):
    __tablename__ = "meetings"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)

    meeting_type: Mapped[MeetingType] = mapped_column(Enum(MeetingType, name="meeting_type"), nullable=False)
    agenda: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[MeetingStatus] = mapped_column(
        Enum(MeetingStatus, name="meeting_status"), default=MeetingStatus.REQUESTED, nullable=False
    )

    meeting_link: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # The currently agreed/locked-in range. Set once the admin confirms a slot;
    # acts as the anchor that any future reschedule proposal must land strictly after.
    confirmed_start_datetime: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    confirmed_end_datetime: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Whatever range is currently awaiting a decision: the initial request, or an active
    # reschedule proposal from either side.
    pending_start_datetime: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    pending_end_datetime: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    pending_proposed_by: Mapped[ProposedBy | None] = mapped_column(
        Enum(ProposedBy, name="meeting_proposed_by"), nullable=True
    )

    # Reason shown to the other party the last time a request/reschedule was denied.
    denial_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    cancelled_by_client: Mapped[bool] = mapped_column(default=False, nullable=False)

    client: Mapped["User"] = relationship()
    project: Mapped["Project"] = relationship()
