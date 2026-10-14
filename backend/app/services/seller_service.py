import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session
from backend.app.core.errors import ValidationError
from backend.app.models.payment import Payment
from backend.app.repositories.payment_repo import PaymentRepository
from backend.app.repositories.seller_repo import SellerRepository


class SellerService:
    def __init__(self, db: Session):
        self.db = db
        self.seller_repo = SellerRepository(db)
        self.payment_repo = PaymentRepository(db)

    def get_ledger(self, seller_id: str) -> Dict[str, Any]:
        return self.seller_repo.get_ledger_summary(seller_id)

    def record_settlement(
        self,
        seller_id: str,
        yard_id: str,
        amount: Decimal,
        payment_mode: str = "CASH",
        reference_number: Optional[str] = None,
        notes: Optional[str] = None,
        created_by: str = "system",
    ) -> Dict[str, Any]:
        seller = self.seller_repo.get_by_id(seller_id)
        if not seller or seller.yard_id != yard_id:
            raise ValidationError(f"Seller {seller_id} does not belong to yard {yard_id}")

        if amount <= Decimal("0.00"):
            raise ValidationError("Settlement payout amount must be greater than zero")

        ledger = self.seller_repo.get_ledger_summary(seller_id)
        if amount > ledger["outstanding_balance"]:
            raise ValidationError(
                f"Settlement amount (₹{amount}) cannot exceed current outstanding balance (₹{ledger['outstanding_balance']})"
            )

        now = datetime.now(timezone.utc)
        payment = Payment(
            id=str(uuid.uuid4()),
            purchase_id=None,
            yard_id=yard_id,
            seller_id=seller_id,
            payment_mode=payment_mode.upper(),
            amount=amount,
            status="COMPLETED",
            reference_number=reference_number or f"SETTLE-{int(now.timestamp())}",
            notes=notes or "Ledger credit settlement payout",
            created_by=created_by,
            created_at=now,
        )

        self.payment_repo.record_payment(payment)
        updated_ledger = self.seller_repo.get_ledger_summary(seller_id)

        return {
            "payment_id": payment.id,
            "settled_amount": amount,
            "payment_mode": payment.payment_mode,
            "new_outstanding_balance": updated_ledger["outstanding_balance"],
            "ledger": updated_ledger,
        }
