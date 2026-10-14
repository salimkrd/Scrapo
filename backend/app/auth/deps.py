from typing import List, Optional
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from backend.app.core.errors import AuthenticationError, PermissionDeniedError
from backend.app.core.security import decode_token
from backend.app.db.session import get_db
from backend.app.models.user import User
from backend.app.repositories.user_repo import UserRepository

security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if not credentials or not credentials.credentials:
        raise AuthenticationError("Authorization header missing or invalid")

    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise AuthenticationError("Invalid token payload")

    user_repo = UserRepository(db)
    user = user_repo.get_by_id(user_id)
    if not user or not user.active:
        raise AuthenticationError("User not found or account is deactivated")

    return user


class RoleChecker:
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        # OWNER has universal authority across all endpoints
        if current_user.role == "OWNER":
            return current_user

        if current_user.role not in self.allowed_roles:
            raise PermissionDeniedError(
                f"Role '{current_user.role}' is not authorized. Required: {', '.join(self.allowed_roles)}"
            )
        return current_user


def require_roles(*roles: str):
    return Depends(RoleChecker(list(roles)))


def verify_yard_access(yard_id: str, current_user: User, db: Session) -> bool:
    """
    Verifies that the user has authorization for the specified yard.
    OWNER role has access to all yards.
    """
    if current_user.role == "OWNER":
        return True

    user_repo = UserRepository(db)
    user_yards = user_repo.get_yards_for_user(current_user.id)
    if yard_id not in user_yards:
        raise PermissionDeniedError(f"User is not authorized for yard {yard_id}")
    return True
