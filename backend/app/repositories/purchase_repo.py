from decimal import Decimal
from typing import List, Optional
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from backend.app.models.inventory import InventoryBalance, InventoryMovement
from backend.app.models.payment import Payment
from backend.app.models.purchase import Purchase, PurchaseItem


class PurchaseRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, purchase_id: str) -> Optional[Purchase]:
        return self.db.get(Purchase, purchase_id)

    def get_by_slip_number(self, slip_number: str, yard_id: str) -> Optional[Purchase]:
        stmt = select(Purchase).where(
            Purchase.slip_number == slip_number,
            Purchase.yard_id == yard_id,
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list_by_yard(self, yard_id: str, limit: int = 50, offset: int = 0) -> List[Purchase]:
        stmt = (
            select(Purchase)
            .where(Purchase.yard_id == yard_id)
            .order_by(Purchase.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(self.db.execute(stmt).scalars().all())

    def get_next_slip_number(self, yard_id: str) -> str:
        stmt = select(func.count(Purchase.id)).where(Purchase.yard_id == yard_id)
        count = self.db.execute(stmt).scalar_one() or 0
        return f"#SC-{8943 + count}"

    def create_atomic_purchase(
        self,
        purchase: Purchase,
        items: List[PurchaseItem],
        payments: List[Payment],
        inventory_movements: List[InventoryMovement],
    ) -> Purchase:
        """
        Atomically commits the entire procurement bundle:
        Purchase + Items + Payments + Inventory Movements + Balance updates.
        All succeed or all roll back.
        """
        try:
            # 1. Add purchase and line items
            self.db.add(purchase)
            for it in items:
                self.db.add(it)

            # 2. Add payments
            for pay in payments:
                self.db.add(pay)

            # 3. Add inventory movements & update live stock balances
            for mov in inventory_movements:
                self.db.add(mov)

                # Atomically update InventoryBalance
                stmt = select(InventoryBalance).where(
                    InventoryBalance.yard_id == mov.yard_id,
                    InventoryBalance.material_id == mov.material_id,
                )
                balance = self.db.execute(stmt).scalar_one_or_none()
                if balance:
                    balance.current_stock += mov.quantity
                    balance.last_movement_at = mov.created_at
                    self.db.add(balance)
                else:
                    new_balance = InventoryBalance(
                        yard_id=mov.yard_id,
                        material_id=mov.material_id,
                        current_stock=max(Decimal("0.000"), mov.quantity),
                        last_movement_at=mov.created_at,
                    )
                    self.db.add(new_balance)

            self.db.commit()
            self.db.refresh(purchase)
            return purchase
        except Exception:
            self.db.rollback()
            raise
