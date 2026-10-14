from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field


class SellerBase(BaseModel):
    name: str = Field(..., max_length=100)
    name_ml: str = Field(default="", max_length=100)
    type: str = Field(default="Local Collector", max_length=60)
    phone: str = Field(..., max_length=30)
    badge: str = Field(default="Regular Seller", max_length=50)
    vehicle_number: Optional[str] = None
    upi_id: str = ""
    bank_name: str = "Federal Bank"
    bank_account: str = "•••• 0000"
    ifsc: str = "FDRL0001244"
    active: bool = True


class SellerCreate(SellerBase):
    id: Optional[str] = None  # Allows client-generated UUID
    yard_id: str


class SellerUpdate(BaseModel):
    name: Optional[str] = None
    name_ml: Optional[str] = None
    type: Optional[str] = None
    phone: Optional[str] = None
    badge: Optional[str] = None
    vehicle_number: Optional[str] = None
    upi_id: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    ifsc: Optional[str] = None
    active: Optional[bool] = None
    version: Optional[int] = None


class SellerResponse(SellerBase):
    id: str
    yard_id: str
    initials: str
    version: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SellerLedgerSummary(BaseModel):
    seller_id: str
    seller_name: str
    total_procured: Decimal
    total_paid: Decimal
    outstanding_balance: Decimal
    transactions_count: int
    last_transaction_at: Optional[datetime] = None
