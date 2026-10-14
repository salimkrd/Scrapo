from decimal import Decimal
from typing import Any, Dict, List, Optional
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from backend.app.core.errors import ConflictError
from backend.app.models.payment import Payment
from backend.app.models.purchase import Purchase
from backend.app.models.seller import Seller


class SellerRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, seller_id: str) -> Optional[Seller]:
        return self.db.get(Seller, seller_id)

    def get_by_phone(self, phone: str, yard_id: str) -> Optional[Seller]:
        stmt = select(Seller).where(Seller.phone == phone, Seller.yard_id == yard_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def list_by_yard(self, yard_id: str, active_only: bool = True) -> List[Seller]:
        stmt = select(Seller).where(Seller.yard_id == yard_id)
        if active_only:
            stmt = stmt.where(Seller.active == True)
        return list(self.db.execute(stmt).scalars().all())

    def create(self, seller: Seller) -> Seller:
        self.db.add(seller)
        self.db.commit()
        self.db.refresh(seller)
        return seller

    def update(self, seller_id: str, update_data: Dict[str, Any], client_version: Optional[int] = None) -> Seller:
        seller = self.get_by_id(seller_id)
        if not seller:
            raise ValueError(f"Seller {seller_id} not found")

        if client_version is not None and seller.version != client_version:
            raise ConflictError(
                f"Seller record modified elsewhere. Client version: {client_version}, Server version: {seller.version}"
            )

        for key, val in update_data.items():
            if hasattr(seller, key) and val is not None:
                setattr(seller, key, val)

        seller.version += 1
        self.db.commit()
        self.db.refresh(seller)
        return seller

    def get_ledger_summary(self, seller_id: str) -> Dict[str, Any]:
        seller = self.get_by_id(seller_id)
        if not seller:
            raise ValueError(f"Seller {seller_id} not found")

        # 1. Total purchases (non-draft)
        p_stmt = select(
            func.coalesce(func.sum(Purchase.total_amount), Decimal("0.00")),
            func.count(Purchase.id),
            func.max(Purchase.created_at),
        ).where(
            Purchase.seller_id == seller_id,
            Purchase.payment_status != "DRAFT",
        )
        p_res = self.db.execute(p_stmt).one()
        total_procured = Decimal(str(p_res[0]))
        tx_count = int(p_res[1])
        last_tx = p_res[2]

        # 2. Total completed payments actually disbursed (cash, upi, bank)
        pay_stmt = select(
            func.coalesce(func.sum(Payment.amount), Decimal("0.00"))
        ).where(
            Payment.seller_id == seller_id,
            Payment.status == "COMPLETED",
            Payment.payment_mode != "CREDIT",
        )
        total_paid = Decimal(str(self.db.execute(pay_stmt).scalar_one()))

        # 3. Dynamic derived outstanding balance: Total Procured - Total Disbursed
        outstanding_balance = max(Decimal("0.00"), total_procured - total_paid)

        return {
            "seller_id": seller.id,
            "seller_name": seller.name,
            "total_procured": total_procured,
            "total_paid": total_paid,
            "outstanding_balance": outstanding_balance,
            "transactions_count": tx_count,
            "last_transaction_at": last_tx,
        }
