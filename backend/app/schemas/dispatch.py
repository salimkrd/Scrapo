from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class DispatchCreate(BaseModel):
    id: Optional[str] = None
    yard_id: str
    sales_order_id: str
    vehicle_number: str = Field(..., max_length=50)
    driver_name: str = Field(default="", max_length=100)
    driver_phone: str = Field(default="", max_length=30)
    transport_company: Optional[str] = None
    gross_vehicle_weight: Decimal = Field(default=Decimal("0.000"), ge=0)
    tare_vehicle_weight: Decimal = Field(default=Decimal("0.000"), ge=0)
    net_dispatch_weight: Optional[Decimal] = None
    weighbridge_slip_number: Optional[str] = None
    notes: Optional[str] = None


class DispatchUpdate(BaseModel):
    status: Optional[str] = None
    weighbridge_slip_number: Optional[str] = None
    notes: Optional[str] = None


class DispatchResponse(BaseModel):
    id: str
    yard_id: str
    dispatch_number: str
    sales_order_id: str
    buyer_id: str
    vehicle_number: str
    driver_name: str
    driver_phone: str
    transport_company: Optional[str]
    dispatch_date: datetime
    gross_vehicle_weight: Decimal
    tare_vehicle_weight: Decimal
    net_dispatch_weight: Decimal
    weighbridge_slip_number: Optional[str]
    notes: Optional[str]
    status: str
    created_by: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
