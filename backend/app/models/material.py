import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.db.base import Base, TimestampMixin, VersionedMixin


class MaterialCategory(Base):
    __tablename__ = "material_categories"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # Iron/Steel, Copper, etc.
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    name_ml: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class Material(Base, TimestampMixin, VersionedMixin):
    __tablename__ = "materials"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    yard_id: Mapped[str] = mapped_column(String(36), ForeignKey("yards.id", ondelete="CASCADE"), nullable=False, index=True)
    master_category: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    standard_name: Mapped[str] = mapped_column(String(150), nullable=False)  # Immutable B2B standard
    standard_code: Mapped[str] = mapped_column(String(50), default="", nullable=False)
    unit: Mapped[str] = mapped_column(String(10), default="KG", nullable=False)
    expected_selling_rate: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    icon: Mapped[str] = mapped_column(String(50), default="recycling", nullable=False)
    accent_color: Mapped[str] = mapped_column(String(30), default="primary", nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    yard: Mapped["Yard"] = relationship("Yard", back_populates="materials")
    aliases: Mapped[List["MaterialAlias"]] = relationship("MaterialAlias", back_populates="material", cascade="all, delete-orphan")
    rates: Mapped[List["MaterialRate"]] = relationship("MaterialRate", back_populates="material", cascade="all, delete-orphan")


class MaterialAlias(Base, TimestampMixin, VersionedMixin):
    __tablename__ = "material_aliases"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    material_id: Mapped[str] = mapped_column(String(36), ForeignKey("materials.id", ondelete="CASCADE"), nullable=False, index=True)
    yard_id: Mapped[str] = mapped_column(String(36), ForeignKey("yards.id", ondelete="CASCADE"), nullable=False, index=True)
    display_name_english: Mapped[str] = mapped_column(String(100), nullable=False)  # Worker facing local alias (e.g. Irumbu, Petti)
    display_name_malayalam: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. ഇരുമ്പ്, പെട്ടി
    local_subtitle: Mapped[str] = mapped_column(String(150), default="", nullable=False)
    district: Mapped[str] = mapped_column(String(60), default="Ernakulam", nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    default_tare: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=Decimal("0.000"), nullable=False)
    badge: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    badge_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    material: Mapped["Material"] = relationship("Material", back_populates="aliases")


class MaterialRate(Base):
    __tablename__ = "material_rates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    material_id: Mapped[str] = mapped_column(String(36), ForeignKey("materials.id", ondelete="CASCADE"), nullable=False, index=True)
    yard_id: Mapped[str] = mapped_column(String(36), ForeignKey("yards.id", ondelete="CASCADE"), nullable=False, index=True)
    purchase_rate: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    selling_rate: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    effective_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    effective_to: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_by: Mapped[str] = mapped_column(String(100), default="system", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    material: Mapped["Material"] = relationship("Material", back_populates="rates")
