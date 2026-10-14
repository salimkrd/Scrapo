import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from backend.app.core.errors import NotFoundError, ValidationError
from backend.app.models.audit import AuditLog
from backend.app.models.buyer import Buyer
from backend.app.models.buyer_payment import BuyerPayment
from backend.app.models.invoice import Invoice
from backend.app.models.sales import SalesOrder
from backend.app.schemas.buyer_payment import BuyerPaymentCreate


class BuyerPaymentRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, payment_id: str) -> Optional[BuyerPayment]:
        stmt = select(BuyerPayment).where(BuyerPayment.id == payment_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def list_by_yard(
        self,
        yard_id: str,
        buyer_id: Optional[str] = None,
    ) -> List[BuyerPayment]:
        stmt = select(BuyerPayment).where(BuyerPayment.yard_id == yard_id)
        if buyer_id:
            stmt = stmt.where(BuyerPayment.buyer_id == buyer_id)
        stmt = stmt.order_by(BuyerPayment.payment_date.desc())
        return list(self.db.execute(stmt).scalars().all())

    def record_payment(
        self,
        payment_data: BuyerPaymentCreate,
        created_by: str = "system",
    ) -> BuyerPayment:
        # 1. Fetch Buyer
        stmt_buyer = select(Buyer).where(Buyer.id == payment_data.buyer_id)
        buyer = self.db.execute(stmt_buyer).scalar_one_or_none()
        if not buyer:
            raise NotFoundError(f"Buyer with ID {payment_data.buyer_id} not found")

        amount = Decimal(str(payment_data.amount))
        if amount <= Decimal("0.00"):
            raise ValidationError("Payment amount must be greater than zero")

        now = payment_data.payment_date or datetime.now(timezone.utc)
        payment_id = payment_data.id or str(uuid.uuid4())

        # 2. Check if linked to an Invoice
        target_invoice: Optional[Invoice] = None
        target_sales_order: Optional[SalesOrder] = None

        if payment_data.invoice_id:
            stmt_inv = select(Invoice).where(Invoice.id == payment_data.invoice_id)
            target_invoice = self.db.execute(stmt_inv).scalar_one_or_none()
            if not target_invoice:
                raise NotFoundError(f"Invoice with ID {payment_data.invoice_id} not found")
            sales_order_id = target_invoice.sales_order_id
        else:
            sales_order_id = payment_data.sales_order_id

        if sales_order_id:
            stmt_order = select(SalesOrder).where(SalesOrder.id == sales_order_id)
            target_sales_order = self.db.execute(stmt_order).scalar_one_or_none()

        # 3. Create payment record
        payment = BuyerPayment(
            id=payment_id,
            yard_id=payment_data.yard_id,
            buyer_id=payment_data.buyer_id,
            sales_order_id=sales_order_id,
            invoice_id=payment_data.invoice_id,
            amount=amount,
            payment_method=payment_data.payment_method,
            reference_number=payment_data.reference_number,
            payment_date=now,
            notes=payment_data.notes,
            created_by=created_by,
            created_at=now,
        )
        self.db.add(payment)

        # 4. If linked to an Invoice, update invoice paid_amount, balance_amount and status
        if target_invoice:
            new_paid = target_invoice.paid_amount + amount
            target_invoice.paid_amount = new_paid
            new_balance = max(Decimal("0.00"), target_invoice.grand_total - new_paid)
            target_invoice.balance_amount = new_balance

            if new_balance == Decimal("0.00"):
                target_invoice.status = "PAID"
            else:
                target_invoice.status = "PARTIALLY_PAID"

            target_invoice.updated_at = now
            self.db.add(target_invoice)

        # 5. If linked to a SalesOrder, update order paid_amount, balance_amount and status
        if target_sales_order:
            new_order_paid = target_sales_order.paid_amount + amount
            target_sales_order.paid_amount = new_order_paid
            new_order_bal = max(Decimal("0.00"), target_sales_order.grand_total - new_order_paid)
            target_sales_order.balance_amount = new_order_bal

            if new_order_bal == Decimal("0.00"):
                target_sales_order.status = "PAID"
            elif target_sales_order.status != "DISPATCHED":
                target_sales_order.status = "PARTIALLY_PAID"

            target_sales_order.updated_at = now
            self.db.add(target_sales_order)

        # 6. Audit Log
        audit = AuditLog(
            yard_id=payment_data.yard_id,
            entity_type="BUYER_PAYMENT",
            entity_id=payment.id,
            action="BUYER_PAYMENT",
            user_id=None,
            before_state=None,
            after_state={
                "amount": float(amount),
                "payment_method": payment.payment_method,
                "buyer_name": buyer.company_name,
                "invoice_id": payment_data.invoice_id,
            },
            created_at=now,
        )
        self.db.add(audit)
        self.db.commit()
        self.db.refresh(payment)
        return payment
