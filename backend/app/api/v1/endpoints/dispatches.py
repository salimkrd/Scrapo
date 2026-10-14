from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from backend.app.auth.deps import get_current_user, require_roles, verify_yard_access
from backend.app.core.errors import NotFoundError
from backend.app.db.session import get_db
from backend.app.models.user import User
from backend.app.repositories.dispatch_repo import DispatchRepository
from backend.app.schemas.dispatch import DispatchCreate, DispatchResponse, DispatchUpdate

router = APIRouter()


@router.get("", response_model=List[DispatchResponse], dependencies=[require_roles("OWNER", "MANAGER", "ACCOUNTANT", "FLOOR_WORKER")])
def list_dispatches(
    yard_id: str = Query(...),
    sales_order_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_yard_access(yard_id, current_user, db)
    repo = DispatchRepository(db)
    dispatches = repo.list_by_yard(yard_id, sales_order_id=sales_order_id, status=status)
    return [DispatchResponse.model_validate(d) for d in dispatches]


@router.post("", response_model=DispatchResponse, status_code=status.HTTP_201_CREATED, dependencies=[require_roles("OWNER", "MANAGER")])
def create_dispatch(
    data: DispatchCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_yard_access(data.yard_id, current_user, db)
    repo = DispatchRepository(db)
    dispatch = repo.create_dispatch(data, created_by=current_user.name)
    return DispatchResponse.model_validate(dispatch)


@router.get("/{dispatch_id}", response_model=DispatchResponse, dependencies=[require_roles("OWNER", "MANAGER", "ACCOUNTANT", "FLOOR_WORKER")])
def get_dispatch(
    dispatch_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = DispatchRepository(db)
    dispatch = repo.get_by_id(dispatch_id)
    if not dispatch:
        raise NotFoundError(f"Dispatch with ID {dispatch_id} not found")
    verify_yard_access(dispatch.yard_id, current_user, db)
    return DispatchResponse.model_validate(dispatch)


@router.post("/{dispatch_id}/confirm", response_model=DispatchResponse, dependencies=[require_roles("OWNER", "MANAGER")])
def confirm_dispatch(
    dispatch_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = DispatchRepository(db)
    dispatch = repo.get_by_id(dispatch_id)
    if not dispatch:
        raise NotFoundError(f"Dispatch with ID {dispatch_id} not found")
    verify_yard_access(dispatch.yard_id, current_user, db)
    confirmed = repo.confirm_dispatch(dispatch_id, user_id=current_user.id)
    return DispatchResponse.model_validate(confirmed)
