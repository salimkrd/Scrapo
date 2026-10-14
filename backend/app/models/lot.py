import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.db.base import Base, VersionedMixin


class Lot(Base, VersionedMixin):
    __tablename__ = "lots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    yard_id: Mapped[str] = mapped_column(String(36), ForeignKey("yards.id", ondelete="CASCADE"), nullable=False, index=True)
    lot_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    material_id: Mapped[str] = mapped_column(String(36), ForeignKey("materials.id", ondelete="RESTRICT"), nullable=False, index=True)

    standard_b2b_name: Mapped[str] = mapped_column(String(150), nullable=False)
    gross_weight: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    tare_weight: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=Decimal("0.000"), nullable=False)
    net_weight: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    available_weight: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)

    # PREPARING, READY, RESERVED, PARTIALLY_DISPATCHED, DISPATCHED, CLOSED, CANCELLED
    status: Mapped[str] = mapped_column(String(30), default="READY", nullable=False, index=True)
    warehouse_location: Mapped[str] = mapped_column(String(100), default="Main Yard", nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    yard: Mapped["Yard"] = relationship("Yard", back_populates="lots")
    material: Mapped["Material"] = relationship("Material")
