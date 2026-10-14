from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from backend.app.core.errors import RateConflictError
from backend.app.models.material import MaterialRate


class RateRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_active_rate(self, material_id: str, yard_id: str) -> Optional[MaterialRate]:
        stmt = (
            select(MaterialRate)
            .where(
                MaterialRate.material_id == material_id,
                MaterialRate.yard_id == yard_id,
                MaterialRate.effective_to.is_(None),
            )
            .order_by(MaterialRate.effective_from.desc())
        )
        return self.db.execute(stmt).scalars().first()

    def get_rate_history(self, material_id: str, yard_id: str) -> List[MaterialRate]:
        stmt = (
            select(MaterialRate)
            .where(
                MaterialRate.material_id == material_id,
                MaterialRate.yard_id == yard_id,
            )
            .order_by(MaterialRate.effective_from.desc())
        )
        return list(self.db.execute(stmt).scalars().all())

    def set_new_rate(
        self,
        material_id: str,
        yard_id: str,
        purchase_rate: Decimal,
        selling_rate: Optional[Decimal] = None,
        created_by: str = "system",
        client_version: Optional[int] = None,
    ) -> MaterialRate:
        now = datetime.now(timezone.utc)
        current = self.get_active_rate(material_id, yard_id)

        # Detect rate conflict
        if current and client_version is not None:
            if client_version < current.version:
                raise RateConflictError(
                    f"Material rate has been updated by another user. Client version: {client_version}, Server version: {current.version}"
                )

        new_version = (current.version + 1) if current else 1

        # Close out current active rate window to preserve complete audit history
        if current:
            current.effective_to = now
            self.db.add(current)

        if selling_rate is None:
            selling_rate = purchase_rate * Decimal("1.15")

        new_rate = MaterialRate(
            material_id=material_id,
            yard_id=yard_id,
            purchase_rate=purchase_rate,
            selling_rate=selling_rate,
            effective_from=now,
            effective_to=None,
            version=new_version,
            created_by=created_by,
            created_at=now,
        )
        self.db.add(new_rate)
        self.db.commit()
        self.db.refresh(new_rate)
        return new_rate
