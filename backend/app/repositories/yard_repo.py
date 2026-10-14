from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from backend.app.models.yard import Yard


class YardRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, yard_id: str) -> Optional[Yard]:
        return self.db.get(Yard, yard_id)

    def get_by_code(self, code: str) -> Optional[Yard]:
        stmt = select(Yard).where(Yard.code == code)
        return self.db.execute(stmt).scalar_one_or_none()

    def list_all(self, active_only: bool = True) -> List[Yard]:
        stmt = select(Yard)
        if active_only:
            stmt = stmt.where(Yard.active == True)
        return list(self.db.execute(stmt).scalars().all())

    def create(self, yard: Yard) -> Yard:
        self.db.add(yard)
        self.db.commit()
        self.db.refresh(yard)
        return yard
