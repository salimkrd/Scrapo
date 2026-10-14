import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.db.base import Base


class BusinessProfile(Base):
    __tablename__ = "business_profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    yard_id: Mapped[str] = mapped_column(String(36), ForeignKey("yards.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    legal_name: Mapped[str] = mapped_column(String(150), default="Scrapo Recycling Enterprises Pvt Ltd", nullable=False)
    trade_name: Mapped[str] = mapped_column(String(150), default="Scrapo Industrial Yard", nullable=False)
    address: Mapped[str] = mapped_column(String(255), default="Marine Drive Industrial Zone, Ernakulam", nullable=False)
    state: Mapped[str] = mapped_column(String(60), default="Kerala", nullable=False)
    pincode: Mapped[str] = mapped_column(String(10), default="682031", nullable=False)
    phone: Mapped[str] = mapped_column(String(30), default="+91 98470 00001", nullable=False)
    email: Mapped[str] = mapped_column(String(100), default="billing@scrapo.in", nullable=False)

    gstin: Mapped[str] = mapped_column(String(20), default="32AAACS1234F1Z5", nullable=False)
    pan: Mapped[Optional[str]] = mapped_column(String(20), default="AAACS1234F", nullable=True)

    bank_name: Mapped[str] = mapped_column(String(100), default="State Bank of India", nullable=False)
    account_number: Mapped[str] = mapped_column(String(50), default="389920194829", nullable=False)
    ifsc: Mapped[str] = mapped_column(String(30), default="SBIN0001234", nullable=False)
    upi_id: Mapped[str] = mapped_column(String(100), default="scrapo@sbi", nullable=False)
    logo_url: Mapped[str] = mapped_column(String(255), default="/assets/logo.png", nullable=False)

    is_gst_registered: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    default_tax_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("18.00"), nullable=False)

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

    yard: Mapped["Yard"] = relationship("Yard", back_populates="business_profile")
