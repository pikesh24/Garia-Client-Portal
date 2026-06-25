from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin
from app.models.enums import MeetingStatus, MeetingType


class Meeting(Base, TimestampMixin):
    __tablename__ = "meetings"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    meeting_type: Mapped[MeetingType] = mapped_column(Enum(MeetingType, name="meeting_type"), nullable=False)
    proposed_datetime: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    agenda: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[MeetingStatus] = mapped_column(
        Enum(MeetingStatus, name="meeting_status"), default=MeetingStatus.REQUESTED, nullable=False
    )

    meeting_link: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Populated when an admin reschedules the meeting
    rescheduled_datetime: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reschedule_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    cancelled_by_client: Mapped[bool] = mapped_column(default=False, nullable=False)

    client: Mapped["User"] = relationship()
