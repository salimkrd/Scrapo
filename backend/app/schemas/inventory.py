from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field


class InventoryMovementCreate(BaseModel):
    id: Optional[str] = None
    yard_id: str
    material_id: str
    reference_type: str = "PURCHASE"
    reference_id: str
    movement_type: str = "PURCHASE"
    quantity: Decimal = Field(..., description="Signed quantity: positive for in, negative for out")
    unit: str = "KG"
    unit_cost: Decimal = Decimal("0.00")


class InventoryMovementResponse(BaseModel):
    id: str
    yard_id: str
    material_id: str
    reference_type: str
    reference_id: str
    movement_type: str
    quantity: Decimal
    unit: str
    unit_cost: Decimal
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True


class InventoryBalanceResponse(BaseModel):
    id: str
    yard_id: str
    material_id: str
    current_stock: Decimal
    last_movement_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StockReconciliation(BaseModel):
    material_id: str
    recorded_balance: Decimal
    calculated_balance_from_movements: Decimal
    is_balanced: bool
    discrepancy: Decimal
