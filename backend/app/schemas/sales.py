from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class SalesItemCreate(BaseModel):
    material_id: str
    lot_id: Optional[str] = None
    weight: Decimal = Field(..., gt=0)
    rate_per_kg: Decimal = Field(..., gt=0)
    tax_rate: Decimal = Field(default=Decimal("18.00"), ge=0)
    unit: str = "KG"


class SalesItemResponse(BaseModel):
    id: str
    sales_order_id: str
    material_id: str
    lot_id: Optional[str]
    description_snapshot: str
    standard_b2b_name_snapshot: str
    hsn_code_snapshot: str
    weight: Decimal
    unit: str
    rate_per_kg: Decimal
    line_amount: Decimal
    tax_rate: Decimal

    model_config = ConfigDict(from_attributes=True)


class SalesOrderCreate(BaseModel):
    id: Optional[str] = None
    yard_id: str
    buyer_id: str
    order_date: Optional[datetime] = None
    transport_charge: Decimal = Field(default=Decimal("0.00"), ge=0)
    loading_charge: Decimal = Field(default=Decimal("0.00"), ge=0)
    other_charge: Decimal = Field(default=Decimal("0.00"), ge=0)
    discount: Decimal = Field(default=Decimal("0.00"), ge=0)
    notes: Optional[str] = None
    items: List[SalesItemCreate] = Field(..., min_length=1)


class SalesOrderUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None


class SalesOrderResponse(BaseModel):
    id: str
    yard_id: str
    order_number: str
    buyer_id: str
    order_date: datetime
    status: str
    subtotal: Decimal
    transport_charge: Decimal
    loading_charge: Decimal
    other_charge: Decimal
    discount: Decimal
    taxable_amount: Decimal
    cgst: Decimal
    sgst: Decimal
    igst: Decimal
    grand_total: Decimal
    paid_amount: Decimal
    balance_amount: Decimal
    notes: Optional[str]
    created_by: str
    created_at: datetime
    updated_at: datetime
    items: List[SalesItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


class SalesDashboardMetrics(BaseModel):
    today_sales: Decimal
    this_month_sales: Decimal
    gross_sales_value: Decimal
    buyer_receivables: Decimal
    pending_dispatch: int
    ready_lots: int
    top_buyer: str
    top_selling_material: str
