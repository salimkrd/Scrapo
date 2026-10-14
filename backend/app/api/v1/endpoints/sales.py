from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from backend.app.auth.deps import get_current_user, require_roles, verify_yard_access
from backend.app.core.errors import NotFoundError
from backend.app.db.session import get_db
from backend.app.models.user import User
from backend.app.repositories.sales_repo import SalesRepository
from backend.app.schemas.sales import (
    SalesDashboardMetrics,
    SalesItemResponse,
    SalesOrderCreate,
    SalesOrderResponse,
    SalesOrderUpdate,
)

router = APIRouter()


@router.get("/metrics", response_model=SalesDashboardMetrics, dependencies=[require_roles("OWNER", "MANAGER", "ACCOUNTANT")])
def get_sales_metrics(
    yard_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_yard_access(yard_id, current_user, db)
    repo = SalesRepository(db)
    return repo.get_dashboard_metrics(yard_id)


@router.get("", response_model=List[SalesOrderResponse], dependencies=[require_roles("OWNER", "MANAGER", "ACCOUNTANT")])
def list_sales(
    yard_id: str = Query(...),
    buyer_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_yard_access(yard_id, current_user, db)
    repo = SalesRepository(db)
    orders = repo.list_by_yard(yard_id, buyer_id=buyer_id, status=status)
    res = []
    for o in orders:
        o_resp = SalesOrderResponse.model_validate(o)
        o_resp.items = [SalesItemResponse.model_validate(it) for it in o.items]
        res.append(o_resp)
    return res


@router.post("", response_model=SalesOrderResponse, status_code=status.HTTP_201_CREATED, dependencies=[require_roles("OWNER", "MANAGER")])
def create_sales_order(
    data: SalesOrderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_yard_access(data.yard_id, current_user, db)
    repo = SalesRepository(db)
    order = repo.create_sales_order(data, created_by=current_user.name)
    o_resp = SalesOrderResponse.model_validate(order)
    o_resp.items = [SalesItemResponse.model_validate(it) for it in order.items]
    return o_resp


@router.get("/{sales_id}", response_model=SalesOrderResponse, dependencies=[require_roles("OWNER", "MANAGER", "ACCOUNTANT")])
def get_sales_order(
    sales_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = SalesRepository(db)
    order = repo.get_by_id(sales_id)
    if not order:
        raise NotFoundError(f"Sales order {sales_id} not found")
    verify_yard_access(order.yard_id, current_user, db)
    o_resp = SalesOrderResponse.model_validate(order)
    o_resp.items = [SalesItemResponse.model_validate(it) for it in order.items]
    return o_resp


@router.patch("/{sales_id}", response_model=SalesOrderResponse, dependencies=[require_roles("OWNER", "MANAGER")])
def update_sales_order(
    sales_id: str,
    data: SalesOrderUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = SalesRepository(db)
    order = repo.get_by_id(sales_id)
    if not order:
        raise NotFoundError(f"Sales order {sales_id} not found")
    verify_yard_access(order.yard_id, current_user, db)
    updated = repo.update_order(sales_id, data, user_id=current_user.id)
    o_resp = SalesOrderResponse.model_validate(updated)
    o_resp.items = [SalesItemResponse.model_validate(it) for it in updated.items]
    return o_resp


@router.post("/{sales_id}/cancel", response_model=SalesOrderResponse, dependencies=[require_roles("OWNER", "MANAGER")])
def cancel_sales_order(
    sales_id: str,
    reason: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = SalesRepository(db)
    order = repo.get_by_id(sales_id)
    if not order:
        raise NotFoundError(f"Sales order {sales_id} not found")
    verify_yard_access(order.yard_id, current_user, db)
    updated = repo.update_order(sales_id, SalesOrderUpdate(status="CANCELLED", notes=reason), user_id=current_user.id)
    o_resp = SalesOrderResponse.model_validate(updated)
    o_resp.items = [SalesItemResponse.model_validate(it) for it in updated.items]
    return o_resp
