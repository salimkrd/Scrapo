import uuid
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional
from sqlalchemy.orm import Session
from backend.app.core.errors import DuplicateRequestError, ValidationError
from backend.app.models.inventory import InventoryMovement
from backend.app.models.payment import Payment
from backend.app.models.purchase import Purchase, PurchaseItem
from backend.app.repositories.purchase_repo import PurchaseRepository
from backend.app.repositories.seller_repo import SellerRepository
from backend.app.schemas.purchase import PurchaseCreate


def quantize_money(val: Decimal) -> Decimal:
    return val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def quantize_weight(val: Decimal) -> Decimal:
    return val.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)


class ProcurementService:
    def __init__(self, db: Session):
        self.db = db
        self.purchase_repo = PurchaseRepository(db)
        self.seller_repo = SellerRepository(db)

    def process_purchase(self, data: PurchaseCreate, created_by: str = "system") -> Purchase:
        # 1. Idempotency Check: Check if this purchase UUID has already been committed
        existing = self.purchase_repo.get_by_id(data.id)
        if existing:
            # Already created, return idempotently without duplicating
            return existing

        seller = self.seller_repo.get_by_id(data.seller_id)
        if not seller or seller.yard_id != data.yard_id:
            raise ValidationError(f"Seller {data.seller_id} does not belong to yard {data.yard_id}")

        now = datetime.now(timezone.utc)
        slip_number = data.slip_number or self.purchase_repo.get_next_slip_number(data.yard_id)

        # 2. Server-side Recalculation and Validation of Weights and Moneys
        calc_total_gross = Decimal("0.000")
        calc_total_tare = Decimal("0.000")
        calc_total_net = Decimal("0.000")
        calc_subtotal = Decimal("0.00")

        purchase_items: List[PurchaseItem] = []
        inventory_movements: List[InventoryMovement] = []

        for it in data.items:
            # Recompute net weight: gross - tare
            gross = quantize_weight(Decimal(str(it.gross_weight)))
            tare = quantize_weight(Decimal(str(it.tare_weight)))
            if gross < tare:
                raise ValidationError(f"Gross weight ({gross} kg) cannot be less than tare weight ({tare} kg)")

            net = gross - tare
            rate = quantize_money(Decimal(str(it.rate_per_kg)))
            if rate <= Decimal("0.00"):
                raise ValidationError("Rate per kg must be greater than zero")

            line_amount = quantize_money(net * rate)

            calc_total_gross += gross
            calc_total_tare += tare
            calc_total_net += net
            calc_subtotal += line_amount

            item_id = it.id or str(uuid.uuid4())
            p_item = PurchaseItem(
                id=item_id,
                purchase_id=data.id,
                material_id=it.material_id,
                material_alias_id=it.material_alias_id,
                material_name_snapshot=it.material_name_snapshot,
                material_ml_snapshot=it.material_ml_snapshot,
                standard_b2b_term_snapshot=it.standard_b2b_term_snapshot,
                gross_weight=gross,
                tare_weight=tare,
                net_weight=net,
                rate_per_kg=rate,
                line_amount=line_amount,
                weight_source=it.weight_source,
                scale_device_id=it.scale_device_id,
                tare_active=it.tare_active,
                created_at=now,
            )
            purchase_items.append(p_item)

            # Generate corresponding InventoryMovement (journal entry)
            if not data.is_draft:
                mov = InventoryMovement(
                    id=str(uuid.uuid4()),
                    yard_id=data.yard_id,
                    material_id=it.material_id,
                    reference_type="PURCHASE",
                    reference_id=data.id,
                    movement_type="PURCHASE",
                    quantity=net,  # Positive incoming stock
                    unit="KG",
                    unit_cost=rate,
                    created_by=created_by,
                    created_at=now,
                )
                inventory_movements.append(mov)

        # Total amount with proper rounding
        calc_total_amount = quantize_money(Decimal(str(round(float(calc_subtotal)))))
        round_off = calc_total_amount - calc_subtotal

        # 3. Payments Validation & Creation
        payments: List[Payment] = []
        payment_status = "DRAFT" if data.is_draft else "PAID"

        if not data.is_draft:
            if data.primary_payment_mode == "SPLIT" and data.split_breakdown:
                split_sum = sum(quantize_money(Decimal(str(s.amount))) for s in data.split_breakdown)
                if split_sum != calc_total_amount:
                    raise ValidationError(
                        f"Split payment total (₹{split_sum}) does not equal purchase total (₹{calc_total_amount})"
                    )

                for split in data.split_breakdown:
                    amt = quantize_money(Decimal(str(split.amount)))
                    p_mode = split.mode.upper()
                    st = "PENDING" if p_mode == "CREDIT" else "COMPLETED"
                    pay = Payment(
                        id=str(uuid.uuid4()),
                        purchase_id=data.id,
                        yard_id=data.yard_id,
                        seller_id=data.seller_id,
                        payment_mode=p_mode,
                        amount=amt,
                        status=st,
                        created_by=created_by,
                        created_at=now,
                    )
                    payments.append(pay)
            else:
                p_mode = data.primary_payment_mode.upper()
                st = "PENDING" if p_mode == "CREDIT" else "COMPLETED"
                if p_mode == "CREDIT":
                    payment_status = "PENDING"

                pay = Payment(
                    id=str(uuid.uuid4()),
                    purchase_id=data.id,
                    yard_id=data.yard_id,
                    seller_id=data.seller_id,
                    payment_mode=p_mode,
                    amount=calc_total_amount,
                    status=st,
                    created_by=created_by,
                    created_at=now,
                )
                payments.append(pay)

        # 4. Construct Purchase Header
        seller_snapshot = data.seller_snapshot or {
            "id": seller.id,
            "name": seller.name,
            "name_ml": seller.name_ml,
            "phone": seller.phone,
            "vehicle_number": seller.vehicle_number,
            "badge": seller.badge,
        }

        purchase = Purchase(
            id=data.id,
            yard_id=data.yard_id,
            slip_number=slip_number,
            seller_id=data.seller_id,
            seller_snapshot=seller_snapshot,
            total_gross_weight=calc_total_gross,
            total_tare_weight=calc_total_tare,
            total_net_weight=calc_total_net,
            subtotal_amount=calc_subtotal,
            round_off=round_off,
            total_amount=calc_total_amount,
            payment_status=payment_status,
            primary_payment_mode=data.primary_payment_mode.upper(),
            notes=data.notes,
            version=1,
            created_by=created_by,
            created_at=now,
            updated_at=now,
        )

        # 5. Commit Atomically: Purchase + Items + Payments + Movements + Balances
        committed = self.purchase_repo.create_atomic_purchase(
            purchase=purchase,
            items=purchase_items,
            payments=payments,
            inventory_movements=inventory_movements,
        )
        return committed
