from datetime import datetime
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from backend.app.models.sync import SyncOperation


class SyncRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_operation_id(self, operation_id: str) -> Optional[SyncOperation]:
        stmt = select(SyncOperation).where(SyncOperation.operation_id == operation_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def record_operation(self, op: SyncOperation) -> SyncOperation:
        self.db.add(op)
        self.db.commit()
        self.db.refresh(op)
        return op

    def list_operations_since(
        self,
        yard_id: str,
        since_time: Optional[datetime] = None,
        limit: int = 200,
    ) -> List[SyncOperation]:
        stmt = select(SyncOperation).where(SyncOperation.yard_id == yard_id)
        if since_time:
            stmt = stmt.where(SyncOperation.created_at > since_time)
        stmt = stmt.order_by(SyncOperation.created_at.asc()).limit(limit)
        return list(self.db.execute(stmt).scalars().all())
