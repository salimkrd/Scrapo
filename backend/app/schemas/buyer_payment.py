from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class BuyerPaymentCreate(BaseModel):
    id: Optional[str] = None
    yard_id: str
    buyer_id: str
    sales_order_id: Optional[str] = None
    invoice_id: Optional[str] = None
    amount: Decimal = Field(..., gt=0)
    # CASH, UPI, BANK_TRANSFER, CHEQUE, CREDIT_ADJUSTMENT
    payment_method: str = Field(default="BANK_TRANSFER")
    reference_number: Optional[str] = None
    payment_date: Optional[datetime] = None
    notes: Optional[str] = None


class BuyerPaymentResponse(BaseModel):
    id: str
    yard_id: str
    buyer_id: str
    sales_order_id: Optional[str]
    invoice_id: Optional[str]
    amount: Decimal
    payment_method: str
    reference_number: Optional[str]
    payment_date: datetime
    notes: Optional[str]
    created_by: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
