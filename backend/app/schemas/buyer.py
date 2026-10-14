from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class BuyerBase(BaseModel):
    company_name: str = Field(..., max_length=150)
    contact_person: str = Field(default="", max_length=100)
    phone: str = Field(..., max_length=30)
    email: Optional[str] = None
    gstin: Optional[str] = None
    billing_address: str = Field(default="", max_length=255)
    shipping_address: str = Field(default="", max_length=255)
    state: str = Field(default="Kerala", max_length=60)
    pincode: str = Field(default="682001", max_length=10)
    payment_terms_days: int = Field(default=30)
    credit_limit: Decimal = Field(default=Decimal("0.00"))
    active: bool = True


class BuyerCreate(BuyerBase):
    id: Optional[str] = None
    yard_id: str


class BuyerUpdate(BaseModel):
    company_name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    gstin: Optional[str] = None
    billing_address: Optional[str] = None
    shipping_address: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    payment_terms_days: Optional[int] = None
    credit_limit: Optional[Decimal] = None
    active: Optional[bool] = None
    version: Optional[int] = None


class BuyerResponse(BuyerBase):
    id: str
    yard_id: str
    version: int
    created_by: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BuyerLedgerTransaction(BaseModel):
    date: datetime
    type: str  # INVOICE, PAYMENT, CREDIT_NOTE
    reference_id: str
    reference_number: str
    debit: Decimal = Decimal("0.00")
    credit: Decimal = Decimal("0.00")
    running_balance: Decimal = Decimal("0.00")
    notes: Optional[str] = None


class BuyerLedgerResponse(BaseModel):
    buyer_id: str
    company_name: str
    credit_limit: Decimal
    total_sales: Decimal
    total_received: Decimal
    outstanding_balance: Decimal
    overdue_amount: Decimal
    transaction_history: List[BuyerLedgerTransaction]

    # CamelCase aliases for frontend compatibility
    @property
    def buyerId(self) -> str:
        return self.buyer_id

    @property
    def totalSales(self) -> Decimal:
        return self.total_sales

    @property
    def totalReceived(self) -> Decimal:
        return self.total_received

    @property
    def outstandingBalance(self) -> Decimal:
        return self.outstanding_balance

    @property
    def overdueAmount(self) -> Decimal:
        return self.overdue_amount
