import uuid
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session
from backend.app.core.errors import (
    InsufficientInventoryError,
    NotFoundError,
    ValidationError,
)
from backend.app.models.audit import AuditLog
from backend.app.models.buyer import Buyer
from backend.app.models.inventory import InventoryBalance
from backend.app.models.lot import Lot
from backend.app.models.material import Material
from backend.app.models.sales import SalesItem, SalesOrder
from backend.app.models.yard import Yard
from backend.app.repositories.inventory_repo import InventoryRepository
from backend.app.schemas.sales import (
    SalesDashboardMetrics,
    SalesOrderCreate,
    SalesOrderUpdate,
)


def round_cur(val: Decimal) -> Decimal:
    return val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class SalesRepository:
    def __init__(self, db: Session):
        self.db = db
        self.inventory_repo = InventoryRepository(db)

    def get_by_id(self, order_id: str) -> Optional[SalesOrder]:
        stmt = select(SalesOrder).where(SalesOrder.id == order_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def list_by_yard(
        self,
        yard_id: str,
        buyer_id: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[SalesOrder]:
        stmt = select(SalesOrder).where(SalesOrder.yard_id == yard_id)
        if buyer_id:
            stmt = stmt.where(SalesOrder.buyer_id == buyer_id)
        if status:
            stmt = stmt.where(SalesOrder.status == status)
        stmt = stmt.order_by(SalesOrder.created_at.desc())
        return list(self.db.execute(stmt).scalars().all())

    def generate_order_number(self, yard_id: str) -> str:
        current_year = datetime.now(timezone.utc).year
        stmt = select(func.count(SalesOrder.id)).where(SalesOrder.yard_id == yard_id)
        count = self.db.execute(stmt).scalar() or 0
        return f"SO-{current_year}-{(count + 1):04d}"

    def create_sales_order(
        self,
        order_data: SalesOrderCreate,
        created_by: str = "system",
    ) -> SalesOrder:
        # 1. Validate Buyer & Yard
        buyer = self.db.execute(select(Buyer).where(Buyer.id == order_data.buyer_id)).scalar_one_or_none()
        if not buyer or not buyer.active:
            raise NotFoundError(f"Buyer with ID {order_data.buyer_id} not found or inactive")
        if buyer.yard_id != order_data.yard_id:
            raise ValidationError("Buyer does not belong to the requested yard")

        yard = self.db.execute(select(Yard).where(Yard.id == order_data.yard_id)).scalar_one_or_none()
        if not yard:
            raise NotFoundError(f"Yard with ID {order_data.yard_id} not found")

        order_id = order_data.id or str(uuid.uuid4())
        order_number = self.generate_order_number(order_data.yard_id)
        now = order_data.order_date or datetime.now(timezone.utc)

        # 2. Server-Side Stock & Pricing Validation
        sales_items: List[SalesItem] = []
        subtotal = Decimal("0.00")
        weighted_tax_rates: List[tuple[Decimal, Decimal]] = []  # (line_amount, tax_rate)

        for item_in in order_data.items:
            weight = Decimal(str(item_in.weight))
            rate = Decimal(str(item_in.rate_per_kg))
            tax_rate = Decimal(str(item_in.tax_rate if item_in.tax_rate is not None else "18.00"))

            if weight <= Decimal("0.000"):
                raise ValidationError(f"Item weight must be greater than zero, got {weight}")
            if rate <= Decimal("0.00"):
                raise ValidationError(f"Item rate must be greater than zero, got {rate}")

            # Fetch Material for immutable B2B snapshot
            mat = self.db.execute(select(Material).where(Material.id == item_in.material_id)).scalar_one_or_none()
            if not mat:
                raise NotFoundError(f"Material with ID {item_in.material_id} not found")

            # Check Stock Availability
            if item_in.lot_id:
                lot = self.db.execute(select(Lot).where(Lot.id == item_in.lot_id)).scalar_one_or_none()
                if not lot:
                    raise NotFoundError(f"Lot with ID {item_in.lot_id} not found")
                if lot.yard_id != order_data.yard_id:
                    raise ValidationError("Lot does not belong to the requested yard")
                if lot.available_weight < weight:
                    raise InsufficientInventoryError(
                        f"Lot {lot.lot_number} only has {lot.available_weight} KG available, cannot sell {weight} KG"
                    )
            else:
                # Check loose inventory
                avail_loose = self.inventory_repo.get_balance(order_data.yard_id, item_in.material_id)
                if avail_loose < weight:
                    raise InsufficientInventoryError(
                        f"Insufficient loose inventory ({avail_loose} KG) for material {mat.standard_name}, cannot sell {weight} KG"
                    )

            line_amount = round_cur(weight * rate)
            subtotal += line_amount
            weighted_tax_rates.append((line_amount, tax_rate))

            # Determine HSN code snapshot based on material master category
            hsn = "7204"  # Default ferrous
            if "copper" in mat.master_category.lower() or "chembu" in mat.standard_name.lower():
                hsn = "7404"
            elif "plastic" in mat.master_category.lower() or "pp" in mat.standard_name.lower():
                hsn = "3915"
            elif "paper" in mat.master_category.lower() or "occ" in mat.standard_name.lower():
                hsn = "4707"

            sales_item = SalesItem(
                id=str(uuid.uuid4()),
                sales_order_id=order_id,
                material_id=mat.id,
                lot_id=item_in.lot_id,
                description_snapshot=mat.standard_name,
                standard_b2b_name_snapshot=mat.standard_name,
                hsn_code_snapshot=hsn,
                weight=weight,
                unit=item_in.unit or "KG",
                rate_per_kg=rate,
                line_amount=line_amount,
                tax_rate=tax_rate,
            )
            sales_items.append(sales_item)

        # 3. Recalculate Charges, Discounts & Taxable Amount
        transport = Decimal(str(order_data.transport_charge or "0.00"))
        loading = Decimal(str(order_data.loading_charge or "0.00"))
        other = Decimal(str(order_data.other_charge or "0.00"))
        discount = Decimal(str(order_data.discount or "0.00"))

        taxable_amount = max(Decimal("0.00"), subtotal + transport + loading + other - discount)

        # 4. GST Computation (Intra-state vs Inter-state)
        # Check seller yard state vs buyer state
        seller_state = (yard.state or "Kerala").strip().lower()
        buyer_state = (buyer.state or "Kerala").strip().lower()
        is_intra_state = (seller_state == buyer_state)

        # Average effective tax rate weighted by line amount
        effective_tax_rate = (
            sum(amt * tr for amt, tr in weighted_tax_rates) / subtotal
            if subtotal > Decimal("0.00")
            else Decimal("18.00")
        )

        cgst = Decimal("0.00")
        sgst = Decimal("0.00")
        igst = Decimal("0.00")

        if is_intra_state:
            half_rate = effective_tax_rate / Decimal("2.0")
            cgst = round_cur(taxable_amount * half_rate / Decimal("100.00"))
            sgst = round_cur(taxable_amount * half_rate / Decimal("100.00"))
        else:
            igst = round_cur(taxable_amount * effective_tax_rate / Decimal("100.00"))

        grand_total = taxable_amount + cgst + sgst + igst
        paid_amount = Decimal("0.00")
        balance_amount = grand_total

        # 5. Create SalesOrder
        order = SalesOrder(
            id=order_id,
            yard_id=order_data.yard_id,
            order_number=order_number,
            buyer_id=order_data.buyer_id,
            order_date=now,
            status="CONFIRMED",
            subtotal=subtotal,
            transport_charge=transport,
            loading_charge=loading,
            other_charge=other,
            discount=discount,
            taxable_amount=taxable_amount,
            cgst=cgst,
            sgst=sgst,
            igst=igst,
            grand_total=grand_total,
            paid_amount=paid_amount,
            balance_amount=balance_amount,
            notes=order_data.notes,
            created_by=created_by,
            created_at=now,
            updated_at=now,
            items=sales_items,
        )
        self.db.add(order)

        # 6. Audit Log
        audit = AuditLog(
            yard_id=order_data.yard_id,
            entity_type="SALES_ORDER",
            entity_id=order.id,
            action="SALE_CREATE",
            user_id=None,
            before_state=None,
            after_state={
                "order_number": order.order_number,
                "buyer_id": order.buyer_id,
                "grand_total": float(grand_total),
                "items_count": len(sales_items),
            },
            created_at=now,
        )
        self.db.add(audit)
        self.db.commit()
        self.db.refresh(order)
        return order

    def update_order(self, order_id: str, update_data: SalesOrderUpdate, user_id: Optional[str] = None) -> SalesOrder:
        order = self.get_by_id(order_id)
        if not order:
            raise NotFoundError(f"Sales order {order_id} not found")

        before_status = order.status
        if update_data.status:
            order.status = update_data.status
        if update_data.notes is not None:
            order.notes = update_data.notes
        order.updated_at = datetime.now(timezone.utc)

        audit = AuditLog(
            yard_id=order.yard_id,
            entity_type="SALES_ORDER",
            entity_id=order.id,
            action="SALE_UPDATE",
            user_id=user_id,
            before_state={"status": before_status},
            after_state={"status": order.status},
            created_at=order.updated_at,
        )
        self.db.add(audit)
        self.db.commit()
        self.db.refresh(order)
        return order

    def get_dashboard_metrics(self, yard_id: str) -> SalesDashboardMetrics:
        now = datetime.now(timezone.utc)
        start_of_today = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
        start_of_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc)

        # 1. Today's Sales
        stmt_today = select(func.coalesce(func.sum(SalesOrder.grand_total), Decimal("0.00"))).where(
            SalesOrder.yard_id == yard_id,
            SalesOrder.status != "CANCELLED",
            SalesOrder.order_date >= start_of_today,
        )
        today_sales = self.db.execute(stmt_today).scalar() or Decimal("0.00")

        # 2. This Month Sales
        stmt_month = select(func.coalesce(func.sum(SalesOrder.grand_total), Decimal("0.00"))).where(
            SalesOrder.yard_id == yard_id,
            SalesOrder.status != "CANCELLED",
            SalesOrder.order_date >= start_of_month,
        )
        this_month_sales = self.db.execute(stmt_month).scalar() or Decimal("0.00")

        # 3. Gross Sales Value
        stmt_gross = select(func.coalesce(func.sum(SalesOrder.grand_total), Decimal("0.00"))).where(
            SalesOrder.yard_id == yard_id,
            SalesOrder.status != "CANCELLED",
        )
        gross_sales = self.db.execute(stmt_gross).scalar() or Decimal("0.00")

        # 4. Buyer Receivables: Sum of balance_amount on all active non-cancelled sales
        stmt_recv = select(func.coalesce(func.sum(SalesOrder.balance_amount), Decimal("0.00"))).where(
            SalesOrder.yard_id == yard_id,
            SalesOrder.status != "CANCELLED",
        )
        buyer_receivables = self.db.execute(stmt_recv).scalar() or Decimal("0.00")

        # 5. Pending Dispatch
        stmt_pending = select(func.count(SalesOrder.id)).where(
            SalesOrder.yard_id == yard_id,
            SalesOrder.status.in_(["CONFIRMED", "READY_FOR_DISPATCH"]),
        )
        pending_dispatch = self.db.execute(stmt_pending).scalar() or 0

        # 6. Ready Lots
        stmt_ready_lots = select(func.count(Lot.id)).where(
            Lot.yard_id == yard_id,
            Lot.status == "READY",
        )
        ready_lots = self.db.execute(stmt_ready_lots).scalar() or 0

        # 7. Top Buyer
        stmt_top_buyer = (
            select(Buyer.company_name, func.sum(SalesOrder.grand_total).label("total"))
            .join(SalesOrder, SalesOrder.buyer_id == Buyer.id)
            .where(SalesOrder.yard_id == yard_id, SalesOrder.status != "CANCELLED")
            .group_by(Buyer.company_name)
            .order_by(func.sum(SalesOrder.grand_total).desc())
            .limit(1)
        )
        top_buyer_row = self.db.execute(stmt_top_buyer).first()
        top_buyer = top_buyer_row[0] if top_buyer_row else "Cochin Paper Mills"

        # 8. Top Selling Material
        stmt_top_mat = (
            select(SalesItem.standard_b2b_name_snapshot, func.sum(SalesItem.weight).label("total_wt"))
            .join(SalesOrder, SalesOrder.id == SalesItem.sales_order_id)
            .where(SalesOrder.yard_id == yard_id, SalesOrder.status != "CANCELLED")
            .group_by(SalesItem.standard_b2b_name_snapshot)
            .order_by(func.sum(SalesItem.weight).desc())
            .limit(1)
        )
        top_mat_row = self.db.execute(stmt_top_mat).first()
        top_mat = top_mat_row[0] if top_mat_row else "OCC — Old Corrugated Containers"

        return SalesDashboardMetrics(
            today_sales=today_sales,
            this_month_sales=this_month_sales,
            gross_sales_value=gross_sales,
            buyer_receivables=buyer_receivables,
            pending_dispatch=pending_dispatch,
            ready_lots=ready_lots,
            top_buyer=top_buyer,
            top_selling_material=top_mat,
        )
