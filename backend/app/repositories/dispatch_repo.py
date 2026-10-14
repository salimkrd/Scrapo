import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from backend.app.core.errors import (
    ConflictError,
    InsufficientInventoryError,
    NotFoundError,
    ValidationError,
)
from backend.app.models.audit import AuditLog
from backend.app.models.dispatch import Dispatch
from backend.app.models.lot import Lot
from backend.app.models.sales import SalesItem, SalesOrder
from backend.app.repositories.inventory_repo import InventoryRepository
from backend.app.schemas.dispatch import DispatchCreate, DispatchUpdate


class DispatchRepository:
    def __init__(self, db: Session):
        self.db = db
        self.inventory_repo = InventoryRepository(db)

    def get_by_id(self, dispatch_id: str) -> Optional[Dispatch]:
        stmt = select(Dispatch).where(Dispatch.id == dispatch_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def list_by_yard(
        self,
        yard_id: str,
        sales_order_id: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[Dispatch]:
        stmt = select(Dispatch).where(Dispatch.yard_id == yard_id)
        if sales_order_id:
            stmt = stmt.where(Dispatch.sales_order_id == sales_order_id)
        if status:
            stmt = stmt.where(Dispatch.status == status)
        stmt = stmt.order_by(Dispatch.dispatch_date.desc())
        return list(self.db.execute(stmt).scalars().all())

    def generate_dispatch_number(self, yard_id: str) -> str:
        current_year = datetime.now(timezone.utc).year
        stmt = select(func.count(Dispatch.id)).where(Dispatch.yard_id == yard_id)
        count = self.db.execute(stmt).scalar() or 0
        return f"DSP-{current_year}-{(count + 1):04d}"

    def create_dispatch(
        self,
        dispatch_data: DispatchCreate,
        created_by: str = "system",
    ) -> Dispatch:
        stmt_order = select(SalesOrder).where(SalesOrder.id == dispatch_data.sales_order_id)
        sales_order = self.db.execute(stmt_order).scalar_one_or_none()
        if not sales_order:
            raise NotFoundError(f"Sales order {dispatch_data.sales_order_id} not found")
        if sales_order.status in ["DISPATCHED", "CANCELLED"]:
            raise ValidationError(f"Cannot dispatch sales order in '{sales_order.status}' status")

        gross = Decimal(str(dispatch_data.gross_vehicle_weight or 0))
        tare = Decimal(str(dispatch_data.tare_vehicle_weight or 0))

        # Sum total expected dispatch weight from order items
        order_total_wt = sum((item.weight for item in sales_order.items), Decimal("0.000"))

        net_weight = (
            Decimal(str(dispatch_data.net_dispatch_weight))
            if dispatch_data.net_dispatch_weight is not None and dispatch_data.net_dispatch_weight > 0
            else (gross - tare if gross > tare else order_total_wt)
        )

        dispatch_number = self.generate_dispatch_number(dispatch_data.yard_id)
        now = datetime.now(timezone.utc)
        dispatch = Dispatch(
            id=dispatch_data.id or str(uuid.uuid4()),
            yard_id=dispatch_data.yard_id,
            dispatch_number=dispatch_number,
            sales_order_id=dispatch_data.sales_order_id,
            buyer_id=sales_order.buyer_id,
            vehicle_number=dispatch_data.vehicle_number.strip().upper(),
            driver_name=dispatch_data.driver_name.strip(),
            driver_phone=dispatch_data.driver_phone.strip(),
            transport_company=dispatch_data.transport_company,
            dispatch_date=now,
            gross_vehicle_weight=gross,
            tare_vehicle_weight=tare,
            net_dispatch_weight=net_weight,
            weighbridge_slip_number=dispatch_data.weighbridge_slip_number,
            notes=dispatch_data.notes,
            status="PLANNED",
            created_by=created_by,
            created_at=now,
        )
        self.db.add(dispatch)
        self.db.commit()
        self.db.refresh(dispatch)
        return dispatch

    def confirm_dispatch(self, dispatch_id: str, user_id: Optional[str] = None) -> Dispatch:
        dispatch = self.get_by_id(dispatch_id)
        if not dispatch:
            raise NotFoundError(f"Dispatch with ID {dispatch_id} not found")

        # Guard against double consumption
        if dispatch.status == "DISPATCHED":
            raise ConflictError("Dispatch has already been confirmed and processed.")
        if dispatch.status == "CANCELLED":
            raise ValidationError("Cannot confirm a cancelled dispatch")

        sales_order = self.db.execute(select(SalesOrder).where(SalesOrder.id == dispatch.sales_order_id)).scalar_one_or_none()
        if not sales_order:
            raise NotFoundError(f"Associated sales order {dispatch.sales_order_id} not found")
        if sales_order.status == "DISPATCHED":
            raise ConflictError("Sales order has already been dispatched. Cannot consume stock twice.")

        now = datetime.now(timezone.utc)

        # Process each item in the sales order: decrement inventory & update lot status
        for item in sales_order.items:
            dispatched_qty = item.weight

            # 1. If item came from a specific lot, reduce lot availableWeight
            if item.lot_id:
                lot = self.db.execute(select(Lot).where(Lot.id == item.lot_id)).scalar_one_or_none()
                if not lot:
                    raise NotFoundError(f"Lot with ID {item.lot_id} not found")

                if lot.available_weight < dispatched_qty:
                    raise InsufficientInventoryError(
                        f"Lot {lot.lot_number} only has {lot.available_weight} KG available, needed {dispatched_qty} KG"
                    )

                new_avail = lot.available_weight - dispatched_qty
                lot.available_weight = new_avail
                lot.version += 1
                if new_avail == Decimal("0.000"):
                    lot.status = "DISPATCHED"
                else:
                    lot.status = "PARTIALLY_DISPATCHED"
                self.db.add(lot)
            else:
                # Deduct loose inventory movement
                self.inventory_repo.record_movement(
                    yard_id=dispatch.yard_id,
                    material_id=item.material_id,
                    reference_type="SALE",
                    reference_id=sales_order.id,
                    movement_type="SALE",
                    quantity=-dispatched_qty,
                    unit=item.unit,
                    unit_cost=item.rate_per_kg,
                    created_by=dispatch.created_by,
                )

        # Mark dispatch and sales order dispatched
        dispatch.status = "DISPATCHED"
        sales_order.status = "DISPATCHED"
        sales_order.updated_at = now

        # Audit log
        audit = AuditLog(
            yard_id=dispatch.yard_id,
            entity_type="DISPATCH",
            entity_id=dispatch.id,
            action="DISPATCH_CONFIRM",
            user_id=user_id,
            before_state={"status": "PLANNED"},
            after_state={
                "status": "DISPATCHED",
                "net_dispatch_weight": float(dispatch.net_dispatch_weight),
                "vehicle_number": dispatch.vehicle_number,
            },
            created_at=now,
        )
        self.db.add(audit)
        self.db.commit()
        self.db.refresh(dispatch)
        return dispatch
