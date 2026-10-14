from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class LotCreate(BaseModel):
    id: Optional[str] = None
    yard_id: str
    lot_number: Optional[str] = None
    material_id: str
    gross_weight: Decimal = Field(..., gt=0)
    tare_weight: Decimal = Field(default=Decimal("0.000"), ge=0)
    net_weight: Optional[Decimal] = None
    warehouse_location: str = "Main Yard"
    notes: Optional[str] = None


class LotUpdate(BaseModel):
    status: Optional[str] = None
    warehouse_location: Optional[str] = None
    notes: Optional[str] = None


class LotResponse(BaseModel):
    id: str
    yard_id: str
    lot_number: str
    material_id: str
    standard_b2b_name: str
    gross_weight: Decimal
    tare_weight: Decimal
    net_weight: Decimal
    available_weight: Decimal
    status: str
    warehouse_location: str
    notes: Optional[str]
    created_at: datetime
    created_by: str
    version: int

    model_config = ConfigDict(from_attributes=True)


class LotStockSummaryResponse(BaseModel):
    material_id: str
    standard_name: str
    total_stock: Decimal
    loose_stock: Decimal
    lot_stock: Decimal
    reserved_stock: Decimal
    available_stock: Decimal
