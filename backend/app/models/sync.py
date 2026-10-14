import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column
from backend.app.db.base import Base


class SyncOperation(Base):
    __tablename__ = "sync_operations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    operation_id: Mapped[str] = mapped_column(String(36), unique=True, index=True, nullable=False)  # Client idempotency UUID
    yard_id: Mapped[str] = mapped_column(String(36), ForeignKey("yards.id", ondelete="CASCADE"), nullable=False, index=True)

    entity_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)  # PURCHASE, PAYMENT, SELLER, etc.
    entity_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    operation: Mapped[str] = mapped_column(String(20), default="INSERT", nullable=False)  # INSERT, UPDATE, DELETE

    payload: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="SYNCED", nullable=False)  # SYNCED, DUPLICATE, CONFLICT, REJECTED

    device_id: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    client_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    server_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    local_created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
