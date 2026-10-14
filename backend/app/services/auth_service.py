from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from backend.app.core.errors import AuthenticationError
from backend.app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from backend.app.models.user import User
from backend.app.repositories.user_repo import UserRepository
from backend.app.schemas.auth import TokenResponse, UserProfile


class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)

    def authenticate_user(self, login: str, password: str) -> TokenResponse:
        user = self.user_repo.get_by_email_or_phone(login.strip())
        if not user or not user.active:
            raise AuthenticationError("Invalid login credentials")

        if not verify_password(password, user.password_hash):
            raise AuthenticationError("Invalid login credentials")

        yard_ids = self.user_repo.get_yards_for_user(user.id)

        access_token = create_access_token(user.id, user.role, yard_ids)
        refresh_token = create_refresh_token(user.id, user.role, yard_ids)

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=UserProfile(
                id=user.id,
                name=user.name,
                phone=user.phone,
                email=user.email,
                role=user.role,
                yard_ids=yard_ids,
                active=user.active,
            ),
        )

    def refresh_access_token(self, refresh_token_str: str) -> TokenResponse:
        payload = decode_token(refresh_token_str)
        if payload.get("type") != "refresh":
            raise AuthenticationError("Invalid token type")

        user_id = payload.get("sub")
        if not user_id:
            raise AuthenticationError("Invalid token payload")

        user = self.user_repo.get_by_id(user_id)
        if not user or not user.active:
            raise AuthenticationError("User not found or inactive")

        yard_ids = self.user_repo.get_yards_for_user(user.id)
        access_token = create_access_token(user.id, user.role, yard_ids)
        new_refresh_token = create_refresh_token(user.id, user.role, yard_ids)

        return TokenResponse(
            access_token=access_token,
            refresh_token=new_refresh_token,
            user=UserProfile(
                id=user.id,
                name=user.name,
                phone=user.phone,
                email=user.email,
                role=user.role,
                yard_ids=yard_ids,
                active=user.active,
            ),
        )
