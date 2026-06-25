from datetime import date

from sqlalchemy import Boolean, Date, Enum, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin
from app.models.enums import UserRole


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, name="user_role"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Client-only configuration fields (null for admin users)
    can_book_offline_meeting: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    hourly_rate_frontend: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    hourly_rate_backend: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    hourly_rate_production: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    maintenance_price: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    project_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    @property
    def is_admin(self) -> bool:
        return self.role == UserRole.ADMIN
