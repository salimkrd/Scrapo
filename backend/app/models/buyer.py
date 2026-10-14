import uuid
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.db.base import Base, TimestampMixin, VersionedMixin


class Buyer(Base, TimestampMixin, VersionedMixin):
    __tablename__ = "buyers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    yard_id: Mapped[str] = mapped_column(String(36), ForeignKey("yards.id", ondelete="CASCADE"), nullable=False, index=True)

    company_name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    contact_person: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    phone: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    gstin: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, index=True)

    billing_address: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    shipping_address: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    state: Mapped[str] = mapped_column(String(60), default="Kerala", nullable=False)
    pincode: Mapped[str] = mapped_column(String(10), default="682001", nullable=False)

    payment_terms_days: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    credit_limit: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    yard: Mapped["Yard"] = relationship("Yard", back_populates="buyers")
    sales_orders: Mapped[List["SalesOrder"]] = relationship("SalesOrder", back_populates="buyer")
    invoices: Mapped[List["Invoice"]] = relationship("Invoice", back_populates="buyer")
    payments: Mapped[List["BuyerPayment"]] = relationship("BuyerPayment", back_populates="buyer")
