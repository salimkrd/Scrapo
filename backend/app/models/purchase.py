import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.db.base import Base, TimestampMixin, VersionedMixin


class Purchase(Base, TimestampMixin, VersionedMixin):
    __tablename__ = "purchases"

    # Preserves exact client-generated UUID for idempotency
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    yard_id: Mapped[str] = mapped_column(String(36), ForeignKey("yards.id", ondelete="CASCADE"), nullable=False, index=True)
    slip_number: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    seller_id: Mapped[str] = mapped_column(String(36), ForeignKey("sellers.id", ondelete="RESTRICT"), nullable=False, index=True)
    seller_snapshot: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    total_gross_weight: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    total_tare_weight: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    total_net_weight: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    subtotal_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    round_off: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)

    payment_status: Mapped[str] = mapped_column(String(20), default="PAID", nullable=False)  # PAID, PARTIAL, PENDING, DRAFT
    primary_payment_mode: Mapped[str] = mapped_column(String(30), default="CASH", nullable=False)  # CASH, UPI, BANK_TRANSFER, CREDIT, SPLIT
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    yard: Mapped["Yard"] = relationship("Yard", back_populates="purchases")
    seller: Mapped["Seller"] = relationship("Seller", back_populates="purchases")
    items: Mapped[List["PurchaseItem"]] = relationship("PurchaseItem", back_populates="purchase", cascade="all, delete-orphan")
    payments: Mapped[List["Payment"]] = relationship("Payment", back_populates="purchase", cascade="all, delete-orphan")

    @property
    def status(self) -> str:
        return self.payment_status


class PurchaseItem(Base):
    __tablename__ = "purchase_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    purchase_id: Mapped[str] = mapped_column(String(36), ForeignKey("purchases.id", ondelete="CASCADE"), nullable=False, index=True)
    material_id: Mapped[str] = mapped_column(String(36), ForeignKey("materials.id", ondelete="RESTRICT"), nullable=False, index=True)
    material_alias_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)

    # Immutability snapshots locked at time of weighment
    material_name_snapshot: Mapped[str] = mapped_column(String(100), nullable=False)
    material_ml_snapshot: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    standard_b2b_term_snapshot: Mapped[str] = mapped_column(String(150), nullable=False)

    gross_weight: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    tare_weight: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=Decimal("0.000"), nullable=False)
    net_weight: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    rate_per_kg: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)  # Price snapshot
    line_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)

    weight_source: Mapped[str] = mapped_column(String(30), default="SIMULATED_SCALE", nullable=False)
    scale_device_id: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    tare_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    purchase: Mapped["Purchase"] = relationship("Purchase", back_populates="items")
