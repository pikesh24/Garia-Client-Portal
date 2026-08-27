from datetime import date

from sqlalchemy import Date, Enum, SmallInteger, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base, TimestampMixin
from app.models.enums import RecurrenceFrequency


class RecurringMeetingBlock(Base, TimestampMixin):
    """An admin-defined recurrence rule (weekly/monthly/yearly) that blocks an entire day."""

    __tablename__ = "recurring_meeting_blocks"

    id: Mapped[int] = mapped_column(primary_key=True)
    frequency: Mapped[RecurrenceFrequency] = mapped_column(
        Enum(RecurrenceFrequency, name="recurrence_frequency"), nullable=False
    )
    # 0=Sunday..6=Saturday (JS Date.getDay() convention) — weekly only.
    day_of_week: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    # 1-31 — monthly and yearly. Clamped to the target month's last day when it's shorter.
    day_of_month: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    # 1-12 — yearly only.
    month: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    until: Mapped[date | None] = mapped_column(Date, nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
