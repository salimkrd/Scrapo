import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from sqlalchemy import DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.db.base import Base


class BuyerPayment(Base):
    __tablename__ = "buyer_payments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    yard_id: Mapped[str] = mapped_column(String(36), ForeignKey("yards.id", ondelete="CASCADE"), nullable=False, index=True)
    buyer_id: Mapped[str] = mapped_column(String(36), ForeignKey("buyers.id", ondelete="CASCADE"), nullable=False, index=True)
    sales_order_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("sales_orders.id", ondelete="SET NULL"), nullable=True, index=True)
    invoice_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True, index=True)

    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    # CASH, UPI, BANK_TRANSFER, CHEQUE, CREDIT_ADJUSTMENT
    payment_method: Mapped[str] = mapped_column(String(30), default="BANK_TRANSFER", nullable=False)
    reference_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    payment_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_by: Mapped[str] = mapped_column(String(100), default="system", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    yard: Mapped["Yard"] = relationship("Yard", back_populates="buyer_payments")
    buyer: Mapped["Buyer"] = relationship("Buyer", back_populates="payments")
    sales_order: Mapped[Optional["SalesOrder"]] = relationship("SalesOrder", back_populates="payments")
    invoice: Mapped[Optional["Invoice"]] = relationship("Invoice", back_populates="payments")
