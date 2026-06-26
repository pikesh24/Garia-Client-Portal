from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base, TimestampMixin


class MeetingAvailability(Base, TimestampMixin):
    """Singleton row (id=1) controlling which meeting types the business currently accepts."""

    __tablename__ = "meeting_availability"

    id: Mapped[int] = mapped_column(primary_key=True)
    accepts_online: Mapped[bool] = mapped_column(default=True, nullable=False)
    accepts_offline: Mapped[bool] = mapped_column(default=True, nullable=False)
