from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from backend.app.auth.deps import get_current_user, require_roles, verify_yard_access
from backend.app.core.errors import NotFoundError
from backend.app.db.session import get_db
from backend.app.models.user import User
from backend.app.repositories.lot_repo import LotRepository
from backend.app.schemas.lot import LotCreate, LotResponse, LotStockSummaryResponse, LotUpdate

router = APIRouter()


@router.get("", response_model=List[LotResponse])
def list_lots(
    yard_id: str = Query(...),
    material_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_yard_access(yard_id, current_user, db)
    repo = LotRepository(db)
    lots = repo.list_by_yard(yard_id, material_id=material_id, status=status)
    return [LotResponse.model_validate(lt) for lt in lots]


@router.get("/summary/stock", response_model=LotStockSummaryResponse)
def get_stock_summary(
    yard_id: str = Query(...),
    material_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_yard_access(yard_id, current_user, db)
    repo = LotRepository(db)
    return repo.get_stock_summary(yard_id, material_id)


@router.post("", response_model=LotResponse, status_code=status.HTTP_201_CREATED, dependencies=[require_roles("OWNER", "MANAGER")])
def create_lot(
    data: LotCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_yard_access(data.yard_id, current_user, db)
    repo = LotRepository(db)
    lot = repo.create_lot(data, created_by=current_user.name)
    return LotResponse.model_validate(lot)


@router.get("/{lot_id}", response_model=LotResponse)
def get_lot(
    lot_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = LotRepository(db)
    lot = repo.get_by_id(lot_id)
    if not lot:
        raise NotFoundError(f"Lot with ID {lot_id} not found")
    verify_yard_access(lot.yard_id, current_user, db)
    return LotResponse.model_validate(lot)


@router.patch("/{lot_id}", response_model=LotResponse, dependencies=[require_roles("OWNER", "MANAGER")])
def update_lot(
    lot_id: str,
    data: LotUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = LotRepository(db)
    lot = repo.get_by_id(lot_id)
    if not lot:
        raise NotFoundError(f"Lot with ID {lot_id} not found")
    verify_yard_access(lot.yard_id, current_user, db)
    updated = repo.update_lot(lot_id, data, user_id=current_user.id)
    return LotResponse.model_validate(updated)
