import uuid
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.app.auth.deps import get_current_user, require_roles
from backend.app.core.errors import NotFoundError
from backend.app.db.session import get_db
from backend.app.models.user import User
from backend.app.models.yard import Yard
from backend.app.repositories.yard_repo import YardRepository
from backend.app.schemas.yard import YardCreate, YardResponse

router = APIRouter()


@router.get("", response_model=List[YardResponse])
def list_yards(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    yard_repo = YardRepository(db)
    all_yards = yard_repo.list_all()

    # Multi-yard isolation: OWNER sees all yards, others see only yards they belong to
    if current_user.role == "OWNER":
        return all_yards

    from backend.app.repositories.user_repo import UserRepository
    user_repo = UserRepository(db)
    user_yard_ids = set(user_repo.get_yards_for_user(current_user.id))

    return [y for y in all_yards if y.id in user_yard_ids]


@router.get("/{yard_id}", response_model=YardResponse)
def get_yard(
    yard_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from backend.app.auth.deps import verify_yard_access
    verify_yard_access(yard_id, current_user, db)

    yard_repo = YardRepository(db)
    yard = yard_repo.get_by_id(yard_id)
    if not yard:
        raise NotFoundError(f"Yard {yard_id} not found")
    return yard


@router.post("", response_model=YardResponse, dependencies=[require_roles("OWNER")])
def create_yard(
    data: YardCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    yard_repo = YardRepository(db)
    new_yard = Yard(
        id=data.id or str(uuid.uuid4()),
        name=data.name,
        name_ml=data.name_ml,
        code=data.code,
        address=data.address,
        district=data.district,
        state=data.state,
        timezone=data.timezone,
        scale_identifier=data.scale_identifier,
        active=data.active,
    )
    return yard_repo.create(new_yard)
