import uuid
from typing import List, Optional
from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.db.base import Base, TimestampMixin


class Yard(Base, TimestampMixin):
    __tablename__ = "yards"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    name_ml: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    code: Mapped[str] = mapped_column(String(30), unique=True, index=True, nullable=False)
    address: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    district: Mapped[str] = mapped_column(String(60), default="Ernakulam", nullable=False)
    state: Mapped[str] = mapped_column(String(60), default="Kerala", nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), default="Asia/Kolkata", nullable=False)
    scale_identifier: Mapped[str] = mapped_column(String(60), default="CAS-CI-2001-YARD02", nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    user_yards: Mapped[List["UserYard"]] = relationship("UserYard", back_populates="yard")
    materials: Mapped[List["Material"]] = relationship("Material", back_populates="yard")
    sellers: Mapped[List["Seller"]] = relationship("Seller", back_populates="yard")
    purchases: Mapped[List["Purchase"]] = relationship("Purchase", back_populates="yard")

    # Phase 3 relationships
    buyers: Mapped[List["Buyer"]] = relationship("Buyer", back_populates="yard")
    lots: Mapped[List["Lot"]] = relationship("Lot", back_populates="yard")
    sales_orders: Mapped[List["SalesOrder"]] = relationship("SalesOrder", back_populates="yard")
    dispatches: Mapped[List["Dispatch"]] = relationship("Dispatch", back_populates="yard")
    invoices: Mapped[List["Invoice"]] = relationship("Invoice", back_populates="yard")
    buyer_payments: Mapped[List["BuyerPayment"]] = relationship("BuyerPayment", back_populates="yard")
    business_profile: Mapped[Optional["BusinessProfile"]] = relationship("BusinessProfile", back_populates="yard", uselist=False)
