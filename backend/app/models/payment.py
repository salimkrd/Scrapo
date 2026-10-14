import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from sqlalchemy import DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.db.base import Base


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    purchase_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("purchases.id", ondelete="CASCADE"), nullable=True, index=True)
    yard_id: Mapped[str] = mapped_column(String(36), ForeignKey("yards.id", ondelete="CASCADE"), nullable=False, index=True)
    seller_id: Mapped[str] = mapped_column(String(36), ForeignKey("sellers.id", ondelete="RESTRICT"), nullable=False, index=True)

    payment_mode: Mapped[str] = mapped_column(String(30), nullable=False)  # CASH, UPI, BANK_TRANSFER, CREDIT, SPLIT
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="COMPLETED", nullable=False)  # COMPLETED, PENDING, FAILED
    reference_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    created_by: Mapped[str] = mapped_column(String(100), default="system", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    purchase: Mapped[Optional["Purchase"]] = relationship("Purchase", back_populates="payments")
    seller: Mapped["Seller"] = relationship("Seller", back_populates="payments")
