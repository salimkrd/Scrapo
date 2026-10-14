from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from backend.app.models.inventory import InventoryBalance, InventoryMovement


class InventoryRepository:
    def __init__(self, db: Session):
        self.db = db

    def record_movement(
        self,
        yard_id: str,
        material_id: str,
        reference_type: str,
        reference_id: str,
        movement_type: str,
        quantity: Decimal,
        unit: str = "KG",
        unit_cost: Decimal = Decimal("0.00"),
        created_by: str = "system",
    ) -> InventoryMovement:
        now = datetime.now(timezone.utc)
        movement = InventoryMovement(
            yard_id=yard_id,
            material_id=material_id,
            reference_type=reference_type,
            reference_id=reference_id,
            movement_type=movement_type,
            quantity=quantity,
            unit=unit,
            unit_cost=unit_cost,
            created_by=created_by,
            created_at=now,
        )
        self.db.add(movement)

        # Update fast-read InventoryBalance
        stmt = select(InventoryBalance).where(
            InventoryBalance.yard_id == yard_id,
            InventoryBalance.material_id == material_id,
        )
        balance = self.db.execute(stmt).scalar_one_or_none()
        if balance:
            balance.current_stock += quantity
            balance.last_movement_at = now
            self.db.add(balance)
        else:
            new_balance = InventoryBalance(
                yard_id=yard_id,
                material_id=material_id,
                current_stock=max(Decimal("0.000"), quantity),
                last_movement_at=now,
            )
            self.db.add(new_balance)

        self.db.commit()
        self.db.refresh(movement)
        return movement

    def get_balance(self, yard_id: str, material_id: str) -> Decimal:
        stmt = select(InventoryBalance.current_stock).where(
            InventoryBalance.yard_id == yard_id,
            InventoryBalance.material_id == material_id,
        )
        return self.db.execute(stmt).scalar_one_or_none() or Decimal("0.000")

    def list_balances_by_yard(self, yard_id: str) -> List[InventoryBalance]:
        stmt = select(InventoryBalance).where(InventoryBalance.yard_id == yard_id)
        return list(self.db.execute(stmt).scalars().all())

    def get_movements(self, yard_id: str, material_id: Optional[str] = None, limit: int = 100) -> List[InventoryMovement]:
        stmt = select(InventoryMovement).where(InventoryMovement.yard_id == yard_id)
        if material_id:
            stmt = stmt.where(InventoryMovement.material_id == material_id)
        stmt = stmt.order_by(InventoryMovement.created_at.desc()).limit(limit)
        return list(self.db.execute(stmt).scalars().all())

    def reconcile_stock_from_journal(self, yard_id: str, material_id: str) -> Dict[str, Any]:
        """
        Reconciles the material's recorded inventory balance with the sum of movements in the journal.
        """
        stmt = select(
            func.coalesce(func.sum(InventoryMovement.quantity), Decimal("0.000"))
        ).where(
            InventoryMovement.yard_id == yard_id,
            InventoryMovement.material_id == material_id,
        )
        journal_sum = Decimal(str(self.db.execute(stmt).scalar_one()))
        recorded = self.get_balance(yard_id, material_id)

        is_balanced = (journal_sum == recorded)
        discrepancy = recorded - journal_sum

        return {
            "yard_id": yard_id,
            "material_id": material_id,
            "recorded_balance": recorded,
            "calculated_balance_from_movements": journal_sum,
            "is_balanced": is_balanced,
            "discrepancy": discrepancy,
        }
