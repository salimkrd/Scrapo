import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from backend.app.core.errors import (
    InsufficientInventoryError,
    NotFoundError,
    ValidationError,
)
from backend.app.models.audit import AuditLog
from backend.app.models.inventory import InventoryBalance
from backend.app.models.lot import Lot
from backend.app.models.material import Material
from backend.app.repositories.inventory_repo import InventoryRepository
from backend.app.schemas.lot import LotCreate, LotStockSummaryResponse, LotUpdate


class LotRepository:
    def __init__(self, db: Session):
        self.db = db
        self.inventory_repo = InventoryRepository(db)

    def get_by_id(self, lot_id: str) -> Optional[Lot]:
        stmt = select(Lot).where(Lot.id == lot_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def list_by_yard(
        self,
        yard_id: str,
        material_id: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[Lot]:
        stmt = select(Lot).where(Lot.yard_id == yard_id)
        if material_id:
            stmt = stmt.where(Lot.material_id == material_id)
        if status:
            stmt = stmt.where(Lot.status == status)
        stmt = stmt.order_by(Lot.created_at.desc())
        return list(self.db.execute(stmt).scalars().all())

    def generate_lot_number(self, yard_id: str) -> str:
        current_year = datetime.now(timezone.utc).year
        stmt = (
            select(func.count(Lot.id))
            .where(Lot.yard_id == yard_id)
        )
        count = self.db.execute(stmt).scalar() or 0
        return f"LOT-{current_year}-{(count + 1):04d}"

    def create_lot(
        self,
        lot_data: LotCreate,
        created_by: str = "system",
    ) -> Lot:
        # 1. Fetch material to ensure it exists and get standard B2B name
        stmt_mat = select(Material).where(Material.id == lot_data.material_id)
        material = self.db.execute(stmt_mat).scalar_one_or_none()
        if not material:
            raise NotFoundError(f"Material with ID {lot_data.material_id} not found")

        # 2. Calculate net weight: gross - tare
        net_weight = (
            Decimal(str(lot_data.net_weight))
            if lot_data.net_weight is not None
            else Decimal(str(lot_data.gross_weight)) - Decimal(str(lot_data.tare_weight))
        )
        if net_weight <= Decimal("0.000"):
            raise ValidationError("Net lot weight must be greater than zero")

        # 3. Check loose inventory availability
        loose_stock = self.inventory_repo.get_balance(lot_data.yard_id, lot_data.material_id)
        if loose_stock < net_weight:
            raise InsufficientInventoryError(
                f"Insufficient loose inventory ({loose_stock} KG) to create lot of {net_weight} KG"
            )

        # 4. Generate lot number if not provided
        lot_number = lot_data.lot_number or self.generate_lot_number(lot_data.yard_id)
        lot_id = lot_data.id or str(uuid.uuid4())

        now = datetime.now(timezone.utc)
        lot = Lot(
            id=lot_id,
            yard_id=lot_data.yard_id,
            lot_number=lot_number,
            material_id=lot_data.material_id,
            standard_b2b_name=material.standard_name,
            gross_weight=Decimal(str(lot_data.gross_weight)),
            tare_weight=Decimal(str(lot_data.tare_weight)),
            net_weight=net_weight,
            available_weight=net_weight,
            status="READY",
            warehouse_location=lot_data.warehouse_location or "Main Yard",
            notes=lot_data.notes,
            created_at=now,
            created_by=created_by,
            version=1,
        )
        self.db.add(lot)
        self.db.flush()

        # 5. Record auditable movement: LOT_CREATE_OUT
        # Decreases loose inventory by net_weight
        self.inventory_repo.record_movement(
            yard_id=lot_data.yard_id,
            material_id=lot_data.material_id,
            reference_type="LOT",
            reference_id=lot.id,
            movement_type="LOT_CREATE_OUT",
            quantity=-net_weight,
            unit="KG",
            unit_cost=Decimal("0.00"),
            created_by=created_by,
        )

        # 6. Audit logging
        audit = AuditLog(
            yard_id=lot_data.yard_id,
            entity_type="LOT",
            entity_id=lot.id,
            action="LOT_CREATE",
            user_id=None,
            before_state={"loose_stock": float(loose_stock)},
            after_state={
                "lot_number": lot.lot_number,
                "net_weight": float(net_weight),
                "remaining_loose_stock": float(loose_stock - net_weight),
            },
            created_at=now,
        )
        self.db.add(audit)
        self.db.commit()
        self.db.refresh(lot)
        return lot

    def update_lot(self, lot_id: str, update_data: LotUpdate, user_id: Optional[str] = None) -> Lot:
        lot = self.get_by_id(lot_id)
        if not lot:
            raise NotFoundError(f"Lot with ID {lot_id} not found")

        before_state = {
            "status": lot.status,
            "warehouse_location": lot.warehouse_location,
            "available_weight": float(lot.available_weight),
        }

        if update_data.status:
            lot.status = update_data.status
        if update_data.warehouse_location:
            lot.warehouse_location = update_data.warehouse_location
        if update_data.notes is not None:
            lot.notes = update_data.notes

        lot.version += 1
        now = datetime.now(timezone.utc)

        audit = AuditLog(
            yard_id=lot.yard_id,
            entity_type="LOT",
            entity_id=lot.id,
            action="LOT_UPDATE",
            user_id=user_id,
            before_state=before_state,
            after_state={
                "status": lot.status,
                "warehouse_location": lot.warehouse_location,
            },
            created_at=now,
        )
        self.db.add(audit)
        self.db.commit()
        self.db.refresh(lot)
        return lot

    def get_stock_summary(self, yard_id: str, material_id: str) -> LotStockSummaryResponse:
        stmt_mat = select(Material).where(Material.id == material_id)
        material = self.db.execute(stmt_mat).scalar_one_or_none()
        if not material:
            raise NotFoundError(f"Material with ID {material_id} not found")

        # 1. Loose stock
        loose_stock = self.inventory_repo.get_balance(yard_id, material_id)

        # 2. Lot stock: lots that are READY or PARTIALLY_DISPATCHED or PREPARING
        stmt_lots = select(func.coalesce(func.sum(Lot.available_weight), Decimal("0.000"))).where(
            Lot.yard_id == yard_id,
            Lot.material_id == material_id,
            Lot.status.in_(["READY", "PARTIALLY_DISPATCHED", "PREPARING"]),
        )
        lot_stock = self.db.execute(stmt_lots).scalar() or Decimal("0.000")

        # 3. Reserved stock: lots with RESERVED status
        stmt_reserved = select(func.coalesce(func.sum(Lot.available_weight), Decimal("0.000"))).where(
            Lot.yard_id == yard_id,
            Lot.material_id == material_id,
            Lot.status == "RESERVED",
        )
        reserved_stock = self.db.execute(stmt_reserved).scalar() or Decimal("0.000")

        total_stock = loose_stock + lot_stock + reserved_stock
        available_stock = loose_stock + lot_stock

        return LotStockSummaryResponse(
            material_id=material_id,
            standard_name=material.standard_name,
            total_stock=total_stock,
            loose_stock=loose_stock,
            lot_stock=lot_stock,
            reserved_stock=reserved_stock,
            available_stock=available_stock,
        )
