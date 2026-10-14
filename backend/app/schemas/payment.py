from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field


class PaymentCreate(BaseModel):
    id: Optional[str] = None  # Client UUID
    purchase_id: Optional[str] = None
    yard_id: str
    seller_id: str
    payment_mode: str = Field(..., description="CASH, UPI, BANK_TRANSFER, CREDIT, SPLIT")
    amount: Decimal = Field(..., gt=0)
    status: str = "COMPLETED"
    reference_number: Optional[str] = None
    notes: Optional[str] = None


class SettlementCreate(BaseModel):
    seller_id: Optional[str] = None
    yard_id: str
    amount: Decimal = Field(..., gt=0)
    payment_mode: str = Field(default="CASH")
    reference_number: Optional[str] = None
    notes: Optional[str] = "Ledger credit settlement"


class PaymentResponse(BaseModel):
    id: str
    purchase_id: Optional[str] = None
    yard_id: str
    seller_id: str
    payment_mode: str
    amount: Decimal
    status: str
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True
