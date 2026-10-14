import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional
from sqlalchemy import or_, select
from sqlalchemy.orm import Session
from backend.app.core.errors import NotFoundError, ValidationError
from backend.app.models.buyer import Buyer
from backend.app.models.buyer_payment import BuyerPayment
from backend.app.models.invoice import Invoice
from backend.app.schemas.buyer import (
    BuyerCreate,
    BuyerLedgerResponse,
    BuyerLedgerTransaction,
    BuyerUpdate,
)


class BuyerRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, buyer_id: str) -> Optional[Buyer]:
        stmt = select(Buyer).where(Buyer.id == buyer_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def list_by_yard(
        self,
        yard_id: str,
        search: Optional[str] = None,
        active_only: bool = False,
    ) -> List[Buyer]:
        stmt = select(Buyer).where(Buyer.yard_id == yard_id)
        if active_only:
            stmt = stmt.where(Buyer.active == True)
        if search:
            term = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    Buyer.company_name.ilike(term),
                    Buyer.contact_person.ilike(term),
                    Buyer.phone.ilike(term),
                    Buyer.gstin.ilike(term),
                )
            )
        stmt = stmt.order_by(Buyer.company_name.asc())
        return list(self.db.execute(stmt).scalars().all())

    def create(self, buyer_data: BuyerCreate, created_by: str = "system") -> Buyer:
        now = datetime.now(timezone.utc)
        buyer = Buyer(
            id=buyer_data.id or str(uuid.uuid4()),

            yard_id=buyer_data.yard_id,
            company_name=buyer_data.company_name.strip(),
            contact_person=buyer_data.contact_person.strip(),
            phone=buyer_data.phone.strip(),
            email=buyer_data.email.strip() if buyer_data.email else None,
            gstin=buyer_data.gstin.strip().upper() if buyer_data.gstin else None,
            billing_address=buyer_data.billing_address.strip(),
            shipping_address=buyer_data.shipping_address.strip() or buyer_data.billing_address.strip(),
            state=buyer_data.state.strip(),
            pincode=buyer_data.pincode.strip(),
            payment_terms_days=buyer_data.payment_terms_days,
            credit_limit=Decimal(str(buyer_data.credit_limit or 0)),
            active=buyer_data.active,
            created_by=created_by,
            created_at=now,
            updated_at=now,
        )
        self.db.add(buyer)
        self.db.commit()
        self.db.refresh(buyer)
        return buyer

    def update(self, buyer_id: str, buyer_data: BuyerUpdate) -> Buyer:
        buyer = self.get_by_id(buyer_id)
        if not buyer:
            raise NotFoundError(f"Buyer with ID {buyer_id} not found")

        update_dict = buyer_data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            if key == "credit_limit" and value is not None:
                value = Decimal(str(value))
            if hasattr(buyer, key) and value is not None:
                setattr(buyer, key, value)

        buyer.version += 1
        buyer.updated_at = datetime.now(timezone.utc)
        self.db.add(buyer)
        self.db.commit()
        self.db.refresh(buyer)
        return buyer

    def get_ledger(self, buyer_id: str) -> BuyerLedgerResponse:
        buyer = self.get_by_id(buyer_id)
        if not buyer:
            raise NotFoundError(f"Buyer with ID {buyer_id} not found")

        # 1. Fetch all invoices (excluding CANCELLED)
        stmt_invoices = (
            select(Invoice)
            .where(Invoice.buyer_id == buyer_id)
            .where(Invoice.status != "CANCELLED")
            .order_by(Invoice.invoice_date.asc())
        )
        invoices = list(self.db.execute(stmt_invoices).scalars().all())

        # 2. Fetch all payments
        stmt_payments = (
            select(BuyerPayment)
            .where(BuyerPayment.buyer_id == buyer_id)
            .order_by(BuyerPayment.payment_date.asc())
        )
        payments = list(self.db.execute(stmt_payments).scalars().all())

        # 3. Calculate total sales & total received
        total_sales = sum((inv.grand_total for inv in invoices), Decimal("0.00"))
        total_received = sum((p.amount for p in payments), Decimal("0.00"))
        outstanding_balance = total_sales - total_received

        # 4. Calculate overdue amount
        # Invoices with balance > 0 and due_date < now
        now = datetime.now(timezone.utc)
        overdue_amount = Decimal("0.00")
        for inv in invoices:
            # Check overdue: due_date < now and balance > 0
            inv_due = inv.due_date
            if inv_due.tzinfo is None:
                inv_due = inv_due.replace(tzinfo=timezone.utc)
            if inv_due < now and inv.balance_amount > Decimal("0.00"):
                overdue_amount += inv.balance_amount

        # 5. Build chronological transaction history
        transactions_raw: List[Dict[str, Any]] = []
        for inv in invoices:
            inv_date = inv.invoice_date
            if inv_date.tzinfo is None:
                inv_date = inv_date.replace(tzinfo=timezone.utc)
            transactions_raw.append({
                "date": inv_date,
                "type": "INVOICE",
                "reference_id": inv.id,
                "reference_number": inv.invoice_number,
                "debit": inv.grand_total,
                "credit": Decimal("0.00"),
                "notes": inv.notes or f"Invoice {inv.invoice_number}",
            })

        for p in payments:
            p_date = p.payment_date
            if p_date.tzinfo is None:
                p_date = p_date.replace(tzinfo=timezone.utc)
            p_type = "CREDIT_NOTE" if p.payment_method == "CREDIT_ADJUSTMENT" else "PAYMENT"
            transactions_raw.append({
                "date": p_date,
                "type": p_type,
                "reference_id": p.id,
                "reference_number": p.reference_number or p.id[:8].upper(),
                "debit": Decimal("0.00"),
                "credit": p.amount,
                "notes": p.notes or f"Payment received via {p.payment_method}",
            })

        # Sort chronologically
        transactions_raw.sort(key=lambda x: x["date"])

        # Compute running balance
        running_bal = Decimal("0.00")
        history: List[BuyerLedgerTransaction] = []
        for t in transactions_raw:
            running_bal += (t["debit"] - t["credit"])
            history.append(
                BuyerLedgerTransaction(
                    date=t["date"],
                    type=t["type"],
                    reference_id=t["reference_id"],
                    reference_number=t["reference_number"],
                    debit=t["debit"],
                    credit=t["credit"],
                    running_balance=running_bal,
                    notes=t["notes"],
                )
            )

        return BuyerLedgerResponse(
            buyer_id=buyer.id,
            company_name=buyer.company_name,
            credit_limit=buyer.credit_limit,
            total_sales=total_sales,
            total_received=total_received,
            outstanding_balance=outstanding_balance,
            overdue_amount=overdue_amount,
            transaction_history=history,
        )
