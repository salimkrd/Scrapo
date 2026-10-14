from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from backend.app.auth.deps import get_current_user, require_roles, verify_yard_access
from backend.app.core.errors import NotFoundError
from backend.app.db.session import get_db
from backend.app.models.seller import Seller
from backend.app.models.user import User
from backend.app.repositories.seller_repo import SellerRepository
from backend.app.schemas.payment import SettlementCreate
from backend.app.schemas.seller import (
    SellerCreate,
    SellerLedgerSummary,
    SellerResponse,
    SellerUpdate,
)
from backend.app.services.seller_service import SellerService

router = APIRouter()


@router.get("", response_model=List[SellerResponse])
def list_sellers(
    yard_id: str = Query(...),
    active_only: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_yard_access(yard_id, current_user, db)

    seller_repo = SellerRepository(db)
    sellers = seller_repo.list_by_yard(yard_id, active_only=active_only)
    return [SellerResponse.model_validate(s) for s in sellers]


@router.get("/{seller_id}", response_model=SellerResponse)
def get_seller(
    seller_id: str,
    yard_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_yard_access(yard_id, current_user, db)

    seller_repo = SellerRepository(db)
    seller = seller_repo.get_by_id(seller_id)
    if not seller or seller.yard_id != yard_id:
        raise NotFoundError(f"Seller {seller_id} not found in yard {yard_id}")
    return SellerResponse.model_validate(seller)


@router.post("", response_model=SellerResponse, dependencies=[require_roles("OWNER", "MANAGER", "FLOOR_WORKER")])
def create_seller(
    data: SellerCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    import uuid
    verify_yard_access(data.yard_id, current_user, db)

    seller_repo = SellerRepository(db)

    # Compute initials
    initials = "".join([w[0] for w in data.name.split() if w])[:2].upper() or "SE"

    new_seller = Seller(
        id=data.id or str(uuid.uuid4()),
        yard_id=data.yard_id,
        initials=initials,
        name=data.name.strip(),
        name_ml=data.name_ml.strip() or data.name.strip(),
        type=data.type,
        phone=data.phone.strip(),
        badge=data.badge,
        vehicle_number=data.vehicle_number,
        upi_id=data.upi_id or f"{data.phone.replace(' ', '')}@upi",
        bank_name=data.bank_name,
        bank_account=data.bank_account,
        ifsc=data.ifsc,
        active=data.active,
        version=1,
        created_by=current_user.name,
    )
    created = seller_repo.create(new_seller)
    return SellerResponse.model_validate(created)


@router.put("/{seller_id}", response_model=SellerResponse, dependencies=[require_roles("OWNER", "MANAGER")])
def update_seller(
    seller_id: str,
    data: SellerUpdate,
    yard_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_yard_access(yard_id, current_user, db)

    seller_repo = SellerRepository(db)
    seller = seller_repo.get_by_id(seller_id)
    if not seller or seller.yard_id != yard_id:
        raise NotFoundError(f"Seller {seller_id} not found in yard {yard_id}")

    updated = seller_repo.update(
        seller_id=seller_id,
        update_data=data.model_dump(exclude_unset=True),
        client_version=data.version,
    )
    return SellerResponse.model_validate(updated)


@router.get("/{seller_id}/ledger", response_model=SellerLedgerSummary)
def get_seller_ledger(
    seller_id: str,
    yard_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_yard_access(yard_id, current_user, db)

    seller_service = SellerService(db)
    summary = seller_service.get_ledger(seller_id)
    return SellerLedgerSummary(**summary)


@router.post("/{seller_id}/settle", dependencies=[require_roles("OWNER", "MANAGER", "ACCOUNTANT")])
def settle_balance(
    seller_id: str,
    data: SettlementCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_yard_access(data.yard_id, current_user, db)

    seller_service = SellerService(db)
    result = seller_service.record_settlement(
        seller_id=seller_id,
        yard_id=data.yard_id,
        amount=data.amount,
        payment_mode=data.payment_mode,
        reference_number=data.reference_number,
        notes=data.notes,
        created_by=current_user.name,
    )
    return result
