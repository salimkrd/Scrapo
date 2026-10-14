import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.db.base import Base


class SalesOrder(Base):
    __tablename__ = "sales_orders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    yard_id: Mapped[str] = mapped_column(String(36), ForeignKey("yards.id", ondelete="CASCADE"), nullable=False, index=True)
    order_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    buyer_id: Mapped[str] = mapped_column(String(36), ForeignKey("buyers.id", ondelete="RESTRICT"), nullable=False, index=True)

    order_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    # DRAFT, CONFIRMED, READY_FOR_DISPATCH, DISPATCHED, PARTIALLY_PAID, PAID, CANCELLED
    status: Mapped[str] = mapped_column(String(30), default="CONFIRMED", nullable=False, index=True)

    subtotal: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    transport_charge: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    loading_charge: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    other_charge: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    discount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    taxable_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)

    cgst: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    sgst: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    igst: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    grand_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    balance_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)

    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_by: Mapped[str] = mapped_column(String(100), default="system", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    yard: Mapped["Yard"] = relationship("Yard", back_populates="sales_orders")
    buyer: Mapped["Buyer"] = relationship("Buyer", back_populates="sales_orders")
    items: Mapped[List["SalesItem"]] = relationship("SalesItem", back_populates="sales_order", cascade="all, delete-orphan")
    dispatches: Mapped[List["Dispatch"]] = relationship("Dispatch", back_populates="sales_order")
    invoices: Mapped[List["Invoice"]] = relationship("Invoice", back_populates="sales_order")
    payments: Mapped[List["BuyerPayment"]] = relationship("BuyerPayment", back_populates="sales_order")


class SalesItem(Base):
    __tablename__ = "sales_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sales_order_id: Mapped[str] = mapped_column(String(36), ForeignKey("sales_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    material_id: Mapped[str] = mapped_column(String(36), ForeignKey("materials.id", ondelete="RESTRICT"), nullable=False, index=True)
    lot_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("lots.id", ondelete="SET NULL"), nullable=True, index=True)

    # Immutability snapshots
    description_snapshot: Mapped[str] = mapped_column(String(150), nullable=False)
    standard_b2b_name_snapshot: Mapped[str] = mapped_column(String(150), nullable=False)
    hsn_code_snapshot: Mapped[str] = mapped_column(String(20), default="7204", nullable=False)

    weight: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    unit: Mapped[str] = mapped_column(String(10), default="KG", nullable=False)
    rate_per_kg: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    line_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.00"), nullable=False)

    sales_order: Mapped["SalesOrder"] = relationship("SalesOrder", back_populates="items")
    material: Mapped["Material"] = relationship("Material")
    lot: Mapped[Optional["Lot"]] = relationship("Lot")


class InvoiceSequence(Base):
    __tablename__ = "invoice_sequences"
    __table_args__ = (
        UniqueConstraint("yard_id", "financial_year", name="uq_yard_financial_year_seq"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    yard_id: Mapped[str] = mapped_column(String(36), ForeignKey("yards.id", ondelete="CASCADE"), nullable=False, index=True)
    financial_year: Mapped[str] = mapped_column(String(10), nullable=False, index=True)  # e.g. "26-27"
    last_number: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
