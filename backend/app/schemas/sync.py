from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field
from backend.app.schemas.material import MaterialResponse, MaterialAliasResponse, MaterialRateResponse
from backend.app.schemas.seller import SellerResponse
from backend.app.schemas.purchase import PurchaseResponse
from backend.app.schemas.payment import PaymentResponse
from backend.app.schemas.inventory import InventoryBalanceResponse


class SyncOperationItem(BaseModel):
    operation_id: str = Field(..., description="Unique client operation UUID")
    entity_type: str = Field(..., description="PURCHASE, PAYMENT, INVENTORY_MOVEMENT, RATE_UPDATE, SELLER, ALIAS")
    entity_id: str = Field(..., description="Entity UUID")
    operation: str = Field(default="INSERT", description="INSERT, UPDATE, DELETE")
    payload: Dict[str, Any]
    local_created_at: Optional[datetime] = None
    device_id: str
    client_version: int = 1


class SyncOperationResult(BaseModel):
    operation_id: str
    entity_type: str
    entity_id: str
    status: Literal["SYNCED", "DUPLICATE", "CONFLICT", "REJECTED"]
    message: Optional[str] = None
    server_version: int = 1


class SyncPushRequest(BaseModel):
    yard_id: str
    device_id: str
    operations: List[SyncOperationItem]


class SyncPushResponse(BaseModel):
    synced_count: int
    duplicate_count: int
    conflict_count: int
    rejected_count: int
    results: List[SyncOperationResult]


class SyncPullRequest(BaseModel):
    yard_id: str
    device_id: str
    last_sync_cursor: Optional[str] = None  # ISO timestamp or cursor
    entity_types: Optional[List[str]] = None


class SyncPullResponse(BaseModel):
    next_sync_cursor: str
    materials: List[MaterialResponse] = []
    aliases: List[MaterialAliasResponse] = []
    rates: List[MaterialRateResponse] = []
    sellers: List[SellerResponse] = []
    purchases: List[PurchaseResponse] = []
    payments: List[PaymentResponse] = []
    inventory_balances: List[InventoryBalanceResponse] = []


class SyncStatusResponse(BaseModel):
    yard_id: str
    server_time: datetime
    database_status: str
    pending_sync_count: int = 0
