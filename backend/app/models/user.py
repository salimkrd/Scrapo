import uuid
from typing import List, Optional
from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.db.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(150), unique=True, index=True, nullable=True)
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(30), default="FLOOR_WORKER", nullable=False)  # OWNER, MANAGER, FLOOR_WORKER, ACCOUNTANT
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    user_yards: Mapped[List["UserYard"]] = relationship("UserYard", back_populates="user", cascade="all, delete-orphan")


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[str] = mapped_column(String(30), primary_key=True)  # OWNER, MANAGER, FLOOR_WORKER, ACCOUNTANT
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str] = mapped_column(String(200), nullable=False)


class UserYard(Base, TimestampMixin):
    __tablename__ = "user_yards"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    yard_id: Mapped[str] = mapped_column(String(36), ForeignKey("yards.id", ondelete="CASCADE"), nullable=False, index=True)
    role_in_yard: Mapped[str] = mapped_column(String(30), default="FLOOR_WORKER", nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="user_yards")
    yard: Mapped["Yard"] = relationship("Yard", back_populates="user_yards")
