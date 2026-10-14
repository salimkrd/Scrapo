from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from backend.app.auth.deps import get_current_user, require_roles, verify_yard_access
from backend.app.db.session import get_db
from backend.app.models.user import User
from backend.app.repositories.inventory_repo import InventoryRepository
from backend.app.schemas.inventory import (
    InventoryBalanceResponse,
    InventoryMovementResponse,
    StockReconciliation,
)

router = APIRouter()


@router.get("/balances", response_model=List[InventoryBalanceResponse])
def get_inventory_balances(
    yard_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_yard_access(yard_id, current_user, db)

    inventory_repo = InventoryRepository(db)
    balances = inventory_repo.list_balances_by_yard(yard_id)
    return [InventoryBalanceResponse.model_validate(b) for b in balances]


@router.get("/movements", response_model=List[InventoryMovementResponse])
def get_inventory_movements(
    yard_id: str = Query(...),
    material_id: Optional[str] = None,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_yard_access(yard_id, current_user, db)

    inventory_repo = InventoryRepository(db)
    movements = inventory_repo.get_movements(yard_id, material_id=material_id, limit=limit)
    return [InventoryMovementResponse.model_validate(m) for m in movements]


@router.get("/reconcile", response_model=StockReconciliation, dependencies=[require_roles("OWNER", "MANAGER", "ACCOUNTANT")])
def reconcile_inventory(
    yard_id: str = Query(...),
    material_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_yard_access(yard_id, current_user, db)

    inventory_repo = InventoryRepository(db)
    reconciled = inventory_repo.reconcile_stock_from_journal(yard_id, material_id)
    return StockReconciliation(**reconciled)
