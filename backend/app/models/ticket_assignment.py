from sqlalchemy import ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin


class TicketAssignment(Base, TimestampMixin):
    __tablename__ = "ticket_assignments"
    __table_args__ = (UniqueConstraint("ticket_id", "developer_id", name="uq_ticket_assignment_ticket_developer"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("support_tickets.id"), nullable=False, index=True)
    developer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    queue_position: Mapped[int] = mapped_column(Integer, nullable=False)

    ticket: Mapped["SupportTicket"] = relationship(back_populates="assignments")
    developer: Mapped["User"] = relationship()
