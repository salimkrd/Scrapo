import uuid
from typing import List, Optional
from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.db.base import Base, TimestampMixin, VersionedMixin


class Seller(Base, TimestampMixin, VersionedMixin):
    __tablename__ = "sellers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    yard_id: Mapped[str] = mapped_column(String(36), ForeignKey("yards.id", ondelete="CASCADE"), nullable=False, index=True)
    initials: Mapped[str] = mapped_column(String(10), default="SE", nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    name_ml: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    type: Mapped[str] = mapped_column(String(60), default="Local Collector", nullable=False)
    phone: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    badge: Mapped[str] = mapped_column(String(50), default="Regular Seller", nullable=False)
    vehicle_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    upi_id: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    bank_name: Mapped[str] = mapped_column(String(100), default="Federal Bank", nullable=False)
    bank_account: Mapped[str] = mapped_column(String(50), default="•••• 0000", nullable=False)
    ifsc: Mapped[str] = mapped_column(String(30), default="FDRL0001244", nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    yard: Mapped["Yard"] = relationship("Yard", back_populates="sellers")
    purchases: Mapped[List["Purchase"]] = relationship("Purchase", back_populates="seller")
    payments: Mapped[List["Payment"]] = relationship("Payment", back_populates="seller")
