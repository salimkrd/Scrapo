from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from backend.app.auth.deps import get_current_user, require_roles, verify_yard_access
from backend.app.core.errors import NotFoundError
from backend.app.db.session import get_db
from backend.app.models.user import User
from backend.app.repositories.buyer_payment_repo import BuyerPaymentRepository
from backend.app.schemas.buyer_payment import BuyerPaymentCreate, BuyerPaymentResponse

router = APIRouter()


@router.get("", response_model=List[BuyerPaymentResponse], dependencies=[require_roles("OWNER", "MANAGER", "ACCOUNTANT")])
def list_buyer_payments(
    yard_id: str = Query(...),
    buyer_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_yard_access(yard_id, current_user, db)
    repo = BuyerPaymentRepository(db)
    payments = repo.list_by_yard(yard_id, buyer_id=buyer_id)
    return [BuyerPaymentResponse.model_validate(p) for p in payments]


@router.post("", response_model=BuyerPaymentResponse, status_code=status.HTTP_201_CREATED, dependencies=[require_roles("OWNER", "ACCOUNTANT", "MANAGER")])
def record_buyer_payment(
    data: BuyerPaymentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_yard_access(data.yard_id, current_user, db)
    repo = BuyerPaymentRepository(db)
    payment = repo.record_payment(data, created_by=current_user.name)
    return BuyerPaymentResponse.model_validate(payment)


@router.get("/{payment_id}", response_model=BuyerPaymentResponse, dependencies=[require_roles("OWNER", "MANAGER", "ACCOUNTANT")])
def get_buyer_payment(
    payment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = BuyerPaymentRepository(db)
    payment = repo.get_by_id(payment_id)
    if not payment:
        raise NotFoundError(f"Payment with ID {payment_id} not found")
    verify_yard_access(payment.yard_id, current_user, db)
    return BuyerPaymentResponse.model_validate(payment)
