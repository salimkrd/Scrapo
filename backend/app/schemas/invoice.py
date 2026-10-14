from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict


class InvoiceCreate(BaseModel):
    sales_order_id: str
    due_days: Optional[int] = None
    notes: Optional[str] = None


class InvoiceResponse(BaseModel):
    id: str
    yard_id: str
    invoice_number: str
    sales_order_id: str
    buyer_id: str
    invoice_date: datetime
    due_date: datetime
    status: str
    seller_profile_snapshot: Dict[str, Any]
    buyer_snapshot: Dict[str, Any]
    items_snapshot: List[Dict[str, Any]]
    subtotal: Decimal
    loading_charge: Decimal
    transport_charge: Decimal
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

    model_config = ConfigDict(from_attributes=True)
