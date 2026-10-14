from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class SplitPaymentItem(BaseModel):
    mode: str = Field(..., description="CASH, UPI, BANK_TRANSFER, CREDIT")
    amount: Decimal = Field(..., gt=0)


class PurchaseItemCreate(BaseModel):
    id: Optional[str] = None  # Client UUID
    material_id: str
    material_alias_id: Optional[str] = None
    material_name_snapshot: str
    material_ml_snapshot: str = ""
    standard_b2b_term_snapshot: str
    gross_weight: Decimal = Field(..., ge=0)
    tare_weight: Decimal = Field(default=Decimal("0.000"), ge=0)
    net_weight: Optional[Decimal] = None  # Server recalculates gross - tare
    rate_per_kg: Decimal = Field(..., gt=0)
    line_amount: Optional[Decimal] = None  # Server recalculates net * rate
    weight_source: str = "SIMULATED_SCALE"
    scale_device_id: Optional[str] = None
    tare_active: bool = True


class PurchaseItemResponse(BaseModel):
    id: str
    purchase_id: str
    material_id: str
    material_alias_id: Optional[str] = None
    material_name_snapshot: str
    material_ml_snapshot: str
    standard_b2b_term_snapshot: str
    gross_weight: Decimal
    tare_weight: Decimal
    net_weight: Decimal
    rate_per_kg: Decimal
    line_amount: Decimal
    weight_source: str
    scale_device_id: Optional[str] = None
    tare_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class PurchaseCreate(BaseModel):
    id: str = Field(..., description="Canonical client-generated UUID")
    yard_id: str
    slip_number: Optional[str] = None  # Generated if omitted
    seller_id: str
    seller_snapshot: Optional[Dict[str, Any]] = None
    items: List[PurchaseItemCreate] = Field(..., min_length=1)
    primary_payment_mode: str = Field(default="CASH")
    split_breakdown: Optional[List[SplitPaymentItem]] = None
    is_draft: bool = False
    notes: Optional[str] = None


class PurchaseResponse(BaseModel):
    id: str
    yard_id: str
    slip_number: str
    seller_id: str
    seller_snapshot: Dict[str, Any]
    total_gross_weight: Decimal
    total_tare_weight: Decimal
    total_net_weight: Decimal
    subtotal_amount: Decimal
    round_off: Decimal
    total_amount: Decimal
    payment_status: str
    primary_payment_mode: str
    notes: Optional[str] = None
    version: int
    created_by: str
    created_at: datetime
    updated_at: datetime
    items: List[PurchaseItemResponse] = []

    class Config:
        from_attributes = True
