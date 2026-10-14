from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from backend.app.auth.deps import get_current_user, require_roles, verify_yard_access
from backend.app.core.errors import NotFoundError, PermissionDeniedError
from backend.app.db.session import get_db
from backend.app.models.user import User
from backend.app.repositories.buyer_repo import BuyerRepository
from backend.app.schemas.buyer import (
    BuyerCreate,
    BuyerLedgerResponse,
    BuyerResponse,
    BuyerUpdate,
)

router = APIRouter()


@router.get("", response_model=List[BuyerResponse], dependencies=[require_roles("OWNER", "MANAGER", "ACCOUNTANT")])
def list_buyers(
    yard_id: str = Query(...),
    search: Optional[str] = None,
    active_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_yard_access(yard_id, current_user, db)
    repo = BuyerRepository(db)
    buyers = repo.list_by_yard(yard_id, search=search, active_only=active_only)
    return [BuyerResponse.model_validate(b) for b in buyers]


@router.post("", response_model=BuyerResponse, status_code=status.HTTP_201_CREATED, dependencies=[require_roles("OWNER", "MANAGER", "ACCOUNTANT")])
def create_buyer(
    data: BuyerCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_yard_access(data.yard_id, current_user, db)
    repo = BuyerRepository(db)
    buyer = repo.create(data, created_by=current_user.name)
    return BuyerResponse.model_validate(buyer)


@router.get("/{buyer_id}", response_model=BuyerResponse, dependencies=[require_roles("OWNER", "MANAGER", "ACCOUNTANT")])
def get_buyer(
    buyer_id: str,
    yard_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = BuyerRepository(db)
    buyer = repo.get_by_id(buyer_id)
    if not buyer:
        raise NotFoundError(f"Buyer with ID {buyer_id} not found")
    verify_yard_access(buyer.yard_id, current_user, db)
    return BuyerResponse.model_validate(buyer)


@router.patch("/{buyer_id}", response_model=BuyerResponse, dependencies=[require_roles("OWNER", "MANAGER", "ACCOUNTANT")])
def update_buyer(
    buyer_id: str,
    data: BuyerUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = BuyerRepository(db)
    buyer = repo.get_by_id(buyer_id)
    if not buyer:
        raise NotFoundError(f"Buyer with ID {buyer_id} not found")
    verify_yard_access(buyer.yard_id, current_user, db)

    # Workers/unauthorized users cannot edit credit limit or payment terms
    if current_user.role == "FLOOR_WORKER":
        if data.credit_limit is not None or data.payment_terms_days is not None:
            raise PermissionDeniedError("Floor workers are not authorized to edit buyer credit terms or limits")

    updated = repo.update(buyer_id, data)
    return BuyerResponse.model_validate(updated)


@router.get("/{buyer_id}/ledger", response_model=BuyerLedgerResponse, dependencies=[require_roles("OWNER", "MANAGER", "ACCOUNTANT")])
def get_buyer_ledger(
    buyer_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = BuyerRepository(db)
    buyer = repo.get_by_id(buyer_id)
    if not buyer:
        raise NotFoundError(f"Buyer with ID {buyer_id} not found")
    verify_yard_access(buyer.yard_id, current_user, db)
    return repo.get_ledger(buyer_id)
