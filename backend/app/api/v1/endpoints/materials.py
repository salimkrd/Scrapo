from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from backend.app.auth.deps import get_current_user, require_roles, verify_yard_access
from backend.app.core.errors import NotFoundError
from backend.app.db.session import get_db
from backend.app.models.user import User
from backend.app.repositories.material_repo import MaterialRepository
from backend.app.repositories.rate_repo import RateRepository
from backend.app.schemas.material import (
    MaterialAliasResponse,
    MaterialAliasUpdate,
    MaterialRateResponse,
    MaterialRateUpdate,
    MaterialResponse,
)

router = APIRouter()


@router.get("", response_model=List[MaterialResponse])
def list_materials(
    yard_id: str = Query(..., description="Target yard UUID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_yard_access(yard_id, current_user, db)

    material_repo = MaterialRepository(db)
    rate_repo = RateRepository(db)

    materials = material_repo.list_by_yard(yard_id)
    response: List[MaterialResponse] = []

    for mat in materials:
        mat_resp = MaterialResponse.model_validate(mat)
        mat_resp.aliases = [MaterialAliasResponse.model_validate(a) for a in mat.aliases]
        active_rate = rate_repo.get_active_rate(mat.id, yard_id)
        if active_rate:
            mat_resp.current_rate = MaterialRateResponse.model_validate(active_rate)
        response.append(mat_resp)

    return response


@router.get("/{material_id}", response_model=MaterialResponse)
def get_material(
    material_id: str,
    yard_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_yard_access(yard_id, current_user, db)

    material_repo = MaterialRepository(db)
    rate_repo = RateRepository(db)

    mat = material_repo.get_by_id(material_id)
    if not mat or mat.yard_id != yard_id:
        raise NotFoundError(f"Material {material_id} not found in yard {yard_id}")

    mat_resp = MaterialResponse.model_validate(mat)
    mat_resp.aliases = [MaterialAliasResponse.model_validate(a) for a in mat.aliases]
    active_rate = rate_repo.get_active_rate(mat.id, yard_id)
    if active_rate:
        mat_resp.current_rate = MaterialRateResponse.model_validate(active_rate)
    return mat_resp


@router.put("/aliases/{alias_id}", response_model=MaterialAliasResponse, dependencies=[require_roles("OWNER", "MANAGER", "FLOOR_WORKER")])
def update_alias(
    alias_id: str,
    data: MaterialAliasUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    material_repo = MaterialRepository(db)
    alias = material_repo.get_alias_by_id(alias_id)
    if not alias:
        raise NotFoundError(f"Alias {alias_id} not found")

    verify_yard_access(alias.yard_id, current_user, db)

    updated = material_repo.update_alias(
        alias_id=alias_id,
        display_name_english=data.display_name_english,
        display_name_malayalam=data.display_name_malayalam,
        local_subtitle=data.local_subtitle,
        version=data.version,
    )
    return MaterialAliasResponse.model_validate(updated)


@router.post("/{material_id}/rates", response_model=MaterialRateResponse, dependencies=[require_roles("OWNER", "MANAGER")])
def update_rate(
    material_id: str,
    yard_id: str = Query(...),
    data: MaterialRateUpdate = ...,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_yard_access(yard_id, current_user, db)

    material_repo = MaterialRepository(db)
    mat = material_repo.get_by_id(material_id)
    if not mat or mat.yard_id != yard_id:
        raise NotFoundError(f"Material {material_id} not found in yard {yard_id}")

    rate_repo = RateRepository(db)
    new_rate = rate_repo.set_new_rate(
        material_id=material_id,
        yard_id=yard_id,
        purchase_rate=data.purchase_rate,
        selling_rate=data.selling_rate,
        created_by=current_user.name,
        client_version=data.version,
    )
    return MaterialRateResponse.model_validate(new_rate)


@router.get("/{material_id}/rates/history", response_model=List[MaterialRateResponse])
def get_rate_history(
    material_id: str,
    yard_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_yard_access(yard_id, current_user, db)

    rate_repo = RateRepository(db)
    history = rate_repo.get_rate_history(material_id, yard_id)
    return [MaterialRateResponse.model_validate(r) for r in history]
