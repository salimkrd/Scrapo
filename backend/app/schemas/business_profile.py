from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class BusinessProfileBase(BaseModel):
    legal_name: str = Field(default="Scrapo Recycling Enterprises Pvt Ltd")
    trade_name: str = Field(default="Scrapo Industrial Yard")
    address: str = Field(default="Marine Drive Industrial Zone, Ernakulam")
    state: str = Field(default="Kerala")
    pincode: str = Field(default="682031")
    phone: str = Field(default="+91 98470 00001")
    email: str = Field(default="billing@scrapo.in")
    gstin: str = Field(default="32AAACS1234F1Z5")
    pan: Optional[str] = Field(default="AAACS1234F")
    bank_name: str = Field(default="State Bank of India")
    account_number: str = Field(default="389920194829")
    ifsc: str = Field(default="SBIN0001234")
    upi_id: str = Field(default="scrapo@sbi")
    logo_url: str = Field(default="/assets/logo.png")
    is_gst_registered: bool = True
    default_tax_rate: Decimal = Field(default=Decimal("18.00"))


class BusinessProfileCreate(BusinessProfileBase):
    yard_id: str


class BusinessProfileUpdate(BaseModel):
    legal_name: Optional[str] = None
    trade_name: Optional[str] = None
    address: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc: Optional[str] = None
    upi_id: Optional[str] = None
    logo_url: Optional[str] = None
    is_gst_registered: Optional[bool] = None
    default_tax_rate: Optional[Decimal] = None


class BusinessProfileResponse(BusinessProfileBase):
    id: str
    yard_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
