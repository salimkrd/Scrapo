from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from backend.app.models.audit import AuditLog


class AuditRepository:
    def __init__(self, db: Session):
        self.db = db

    def log_action(
        self,
        yard_id: str,
        entity_type: str,
        entity_id: str,
        action: str,
        user_id: Optional[str] = None,
        before_state: Optional[Dict[str, Any]] = None,
        after_state: Optional[Dict[str, Any]] = None,
        device_id: Optional[str] = None,
    ) -> AuditLog:
        audit = AuditLog(
            yard_id=yard_id,
            user_id=user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            before_state=before_state,
            after_state=after_state,
            device_id=device_id,
            created_at=datetime.now(timezone.utc),
        )
        self.db.add(audit)
        self.db.commit()
        self.db.refresh(audit)
        return audit

    def list_by_yard(self, yard_id: str, limit: int = 100) -> List[AuditLog]:
        stmt = (
            select(AuditLog)
            .where(AuditLog.yard_id == yard_id)
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
        )
        return list(self.db.execute(stmt).scalars().all())
