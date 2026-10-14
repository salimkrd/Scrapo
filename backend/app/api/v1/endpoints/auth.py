from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.app.auth.deps import get_current_user
from backend.app.db.session import get_db
from backend.app.models.user import User
from backend.app.schemas.auth import LoginRequest, RefreshTokenRequest, TokenResponse, UserProfile
from backend.app.services.auth_service import AuthService

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    auth_service = AuthService(db)
    return auth_service.authenticate_user(request.login, request.password)


@router.post("/refresh", response_model=TokenResponse)
def refresh(request: RefreshTokenRequest, db: Session = Depends(get_db)):
    auth_service = AuthService(db)
    return auth_service.refresh_access_token(request.refresh_token)


@router.get("/me", response_model=UserProfile)
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from backend.app.repositories.user_repo import UserRepository
    user_repo = UserRepository(db)
    yard_ids = user_repo.get_yards_for_user(current_user.id)

    return UserProfile(
        id=current_user.id,
        name=current_user.name,
        phone=current_user.phone,
        email=current_user.email,
        role=current_user.role,
        yard_ids=yard_ids,
        active=current_user.active,
    )
