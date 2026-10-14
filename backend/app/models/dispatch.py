import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from sqlalchemy import DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.db.base import Base


class Dispatch(Base):
    __tablename__ = "dispatches"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    yard_id: Mapped[str] = mapped_column(String(36), ForeignKey("yards.id", ondelete="CASCADE"), nullable=False, index=True)
    dispatch_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    sales_order_id: Mapped[str] = mapped_column(String(36), ForeignKey("sales_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    buyer_id: Mapped[str] = mapped_column(String(36), ForeignKey("buyers.id", ondelete="RESTRICT"), nullable=False, index=True)

    vehicle_number: Mapped[str] = mapped_column(String(50), nullable=False)
    driver_name: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    driver_phone: Mapped[str] = mapped_column(String(30), default="", nullable=False)
    transport_company: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    dispatch_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    gross_vehicle_weight: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=Decimal("0.000"), nullable=False)
    tare_vehicle_weight: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=Decimal("0.000"), nullable=False)
    net_dispatch_weight: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    weighbridge_slip_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # PLANNED, LOADING, WEIGHED, DISPATCHED, DELIVERED, CANCELLED
    status: Mapped[str] = mapped_column(String(30), default="DISPATCHED", nullable=False, index=True)

    created_by: Mapped[str] = mapped_column(String(100), default="system", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    yard: Mapped["Yard"] = relationship("Yard", back_populates="dispatches")
    sales_order: Mapped["SalesOrder"] = relationship("SalesOrder", back_populates="dispatches")
    buyer: Mapped["Buyer"] = relationship("Buyer")
