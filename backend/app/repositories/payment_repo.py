from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from backend.app.models.payment import Payment


class PaymentRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, payment_id: str) -> Optional[Payment]:
        return self.db.get(Payment, payment_id)

    def list_by_purchase(self, purchase_id: str) -> List[Payment]:
        stmt = select(Payment).where(Payment.purchase_id == purchase_id)
        return list(self.db.execute(stmt).scalars().all())

    def list_by_seller(self, seller_id: str) -> List[Payment]:
        stmt = select(Payment).where(Payment.seller_id == seller_id).order_by(Payment.created_at.desc())
        return list(self.db.execute(stmt).scalars().all())

    def record_payment(self, payment: Payment) -> Payment:
        self.db.add(payment)
        self.db.commit()
        self.db.refresh(payment)
        return payment
