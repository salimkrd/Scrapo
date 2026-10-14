import uuid
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import DateTime, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.db.base import Base


class InventoryMovement(Base):
    __tablename__ = "inventory_movements"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    yard_id: Mapped[str] = mapped_column(String(36), ForeignKey("yards.id", ondelete="CASCADE"), nullable=False, index=True)
    material_id: Mapped[str] = mapped_column(String(36), ForeignKey("materials.id", ondelete="CASCADE"), nullable=False, index=True)

    reference_type: Mapped[str] = mapped_column(String(30), nullable=False)  # PURCHASE, SALE, ADJUSTMENT
    reference_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    movement_type: Mapped[str] = mapped_column(String(30), nullable=False)  # PURCHASE, SALE, ADJUSTMENT_IN, etc.

    # Signed quantity: positive for incoming, negative for outgoing
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    unit: Mapped[str] = mapped_column(String(10), default="KG", nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)

    created_by: Mapped[str] = mapped_column(String(100), default="system", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)


class InventoryBalance(Base):
    __tablename__ = "inventory_balances"
    __table_args__ = (
        UniqueConstraint("yard_id", "material_id", name="uq_yard_material_balance"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    yard_id: Mapped[str] = mapped_column(String(36), ForeignKey("yards.id", ondelete="CASCADE"), nullable=False, index=True)
    material_id: Mapped[str] = mapped_column(String(36), ForeignKey("materials.id", ondelete="CASCADE"), nullable=False, index=True)

    current_stock: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=Decimal("0.000"), nullable=False)
    last_movement_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
