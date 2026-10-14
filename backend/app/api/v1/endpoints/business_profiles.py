from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.app.auth.deps import get_current_user, require_roles, verify_yard_access
from backend.app.db.session import get_db
from backend.app.models.user import User
from backend.app.repositories.business_profile_repo import BusinessProfileRepository
from backend.app.schemas.business_profile import BusinessProfileResponse, BusinessProfileUpdate

router = APIRouter()


@router.get("/{yard_id}", response_model=BusinessProfileResponse, dependencies=[require_roles("OWNER", "MANAGER", "ACCOUNTANT")])
def get_business_profile(
    yard_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_yard_access(yard_id, current_user, db)
    repo = BusinessProfileRepository(db)
    profile = repo.get_by_yard(yard_id)
    return BusinessProfileResponse.model_validate(profile)


@router.put("/{yard_id}", response_model=BusinessProfileResponse, dependencies=[require_roles("OWNER", "MANAGER", "ACCOUNTANT")])
def update_business_profile(
    yard_id: str,
    data: BusinessProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_yard_access(yard_id, current_user, db)
    repo = BusinessProfileRepository(db)
    updated = repo.update(yard_id, data)
    return BusinessProfileResponse.model_validate(updated)
