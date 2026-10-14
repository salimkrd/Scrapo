from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from backend.app.auth.deps import get_current_user, require_roles, verify_yard_access
from backend.app.core.errors import NotFoundError
from backend.app.db.session import get_db
from backend.app.models.user import User
from backend.app.repositories.purchase_repo import PurchaseRepository
from backend.app.schemas.purchase import (
    PurchaseCreate,
    PurchaseItemResponse,
    PurchaseResponse,
)
from backend.app.services.procurement_service import ProcurementService

router = APIRouter()


@router.get("", response_model=List[PurchaseResponse])
def list_purchases(
    yard_id: str = Query(...),
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_yard_access(yard_id, current_user, db)

    purchase_repo = PurchaseRepository(db)
    purchases = purchase_repo.list_by_yard(yard_id, limit=limit, offset=offset)

    response = []
    for p in purchases:
        p_resp = PurchaseResponse.model_validate(p)
        p_resp.items = [PurchaseItemResponse.model_validate(it) for it in p.items]
        response.append(p_resp)
    return response


@router.get("/{purchase_id}", response_model=PurchaseResponse)
def get_purchase(
    purchase_id: str,
    yard_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_yard_access(yard_id, current_user, db)

    purchase_repo = PurchaseRepository(db)
    p = purchase_repo.get_by_id(purchase_id)
    if not p or p.yard_id != yard_id:
        raise NotFoundError(f"Purchase {purchase_id} not found in yard {yard_id}")

    p_resp = PurchaseResponse.model_validate(p)
    p_resp.items = [PurchaseItemResponse.model_validate(it) for it in p.items]
    return p_resp


@router.post("", response_model=PurchaseResponse, dependencies=[require_roles("OWNER", "MANAGER", "FLOOR_WORKER")])
def create_purchase(
    data: PurchaseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_yard_access(data.yard_id, current_user, db)

    procurement_service = ProcurementService(db)
    committed = procurement_service.process_purchase(data, created_by=current_user.name)

    p_resp = PurchaseResponse.model_validate(committed)
    p_resp.items = [PurchaseItemResponse.model_validate(it) for it in committed.items]
    return p_resp
