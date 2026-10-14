from typing import List, Optional
from sqlalchemy import or_, select
from sqlalchemy.orm import Session
from backend.app.models.user import User, UserYard


class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, user_id: str) -> Optional[User]:
        return self.db.get(User, user_id)

    def get_by_email_or_phone(self, login: str) -> Optional[User]:
        stmt = select(User).where(or_(User.email == login, User.phone == login))
        return self.db.execute(stmt).scalar_one_or_none()

    def get_yards_for_user(self, user_id: str) -> List[str]:
        stmt = select(UserYard.yard_id).where(UserYard.user_id == user_id)
        return list(self.db.execute(stmt).scalars().all())

    def create(self, user: User) -> User:
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def link_yard(self, user_id: str, yard_id: str, role_in_yard: str = "FLOOR_WORKER") -> UserYard:
        link = UserYard(user_id=user_id, yard_id=yard_id, role_in_yard=role_in_yard)
        self.db.add(link)
        self.db.commit()
        return link
