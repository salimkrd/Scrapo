import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from backend.app.core.errors import ConflictError, NotFoundError, ValidationError
from backend.app.models.audit import AuditLog
from backend.app.models.buyer import Buyer
from backend.app.models.buyer_payment import BuyerPayment
from backend.app.models.invoice import Invoice
from backend.app.models.sales import InvoiceSequence, SalesOrder
from backend.app.repositories.business_profile_repo import BusinessProfileRepository
from backend.app.schemas.invoice import InvoiceCreate


def get_financial_year(dt: datetime) -> str:
    # In India, financial year runs April 1 to March 31
    year = dt.year
    if dt.month >= 4:
        y1 = year % 100
        y2 = (year + 1) % 100
    else:
        y1 = (year - 1) % 100
        y2 = year % 100
    return f"{y1:02d}-{y2:02d}"


class InvoiceRepository:
    def __init__(self, db: Session):
        self.db = db
        self.profile_repo = BusinessProfileRepository(db)

    def get_by_id(self, invoice_id: str) -> Optional[Invoice]:
        stmt = select(Invoice).where(Invoice.id == invoice_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_invoice_number(self, invoice_number: str) -> Optional[Invoice]:
        stmt = select(Invoice).where(Invoice.invoice_number == invoice_number)
        return self.db.execute(stmt).scalar_one_or_none()

    def list_by_yard(
        self,
        yard_id: str,
        buyer_id: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[Invoice]:
        stmt = select(Invoice).where(Invoice.yard_id == yard_id)
        if buyer_id:
            stmt = stmt.where(Invoice.buyer_id == buyer_id)
        if status:
            stmt = stmt.where(Invoice.status == status)
        stmt = stmt.order_by(Invoice.invoice_date.desc())
        return list(self.db.execute(stmt).scalars().all())

    def get_next_invoice_number(self, yard_id: str, dt: datetime) -> str:
        fy = get_financial_year(dt)
        stmt = select(InvoiceSequence).where(
            InvoiceSequence.yard_id == yard_id,
            InvoiceSequence.financial_year == fy,
        ).with_for_update()
        seq = self.db.execute(stmt).scalar_one_or_none()
        if not seq:
            seq = InvoiceSequence(
                id=str(uuid.uuid4()),
                yard_id=yard_id,
                financial_year=fy,
                last_number=1,
            )
            self.db.add(seq)
            self.db.flush()
            next_num = 1
        else:
            seq.last_number += 1
            next_num = seq.last_number
            self.db.add(seq)
            self.db.flush()

        return f"SCR/{fy}/{next_num:06d}"

    def create_invoice(
        self,
        invoice_in: InvoiceCreate,
        created_by: str = "system",
    ) -> Invoice:
        # 1. Fetch sales order
        stmt_order = select(SalesOrder).where(SalesOrder.id == invoice_in.sales_order_id)
        sales_order = self.db.execute(stmt_order).scalar_one_or_none()
        if not sales_order:
            raise NotFoundError(f"Sales order {invoice_in.sales_order_id} not found")
        if sales_order.status == "CANCELLED":
            raise ValidationError("Cannot generate invoice for a cancelled sales order")

        # Check existing active invoice
        stmt_existing = select(Invoice).where(
            Invoice.sales_order_id == sales_order.id,
            Invoice.status != "CANCELLED",
        )
        existing = self.db.execute(stmt_existing).scalar_one_or_none()
        if existing:
            return existing

        now = datetime.now(timezone.utc)

        # 2. Fetch Buyer & Yard Profile
        buyer = self.db.execute(select(Buyer).where(Buyer.id == sales_order.buyer_id)).scalar_one_or_none()
        if not buyer:
            raise NotFoundError(f"Buyer {sales_order.buyer_id} not found")

        profile = self.profile_repo.get_by_yard(sales_order.yard_id)

        # 3. Freeze Snapshots
        seller_snapshot: Dict[str, Any] = {
            "legal_name": profile.legal_name,
            "trade_name": profile.trade_name,
            "address": profile.address,
            "state": profile.state,
            "pincode": profile.pincode,
            "phone": profile.phone,
            "email": profile.email,
            "gstin": profile.gstin,
            "pan": profile.pan,
            "bank_name": profile.bank_name,
            "account_number": profile.account_number,
            "ifsc": profile.ifsc,
            "upi_id": profile.upi_id,
            "logo_url": profile.logo_url,
            "is_gst_registered": profile.is_gst_registered,
        }

        buyer_snapshot: Dict[str, Any] = {
            "id": buyer.id,
            "company_name": buyer.company_name,
            "contact_person": buyer.contact_person,
            "phone": buyer.phone,
            "email": buyer.email,
            "gstin": buyer.gstin,
            "billing_address": buyer.billing_address,
            "shipping_address": buyer.shipping_address,
            "state": buyer.state,
            "pincode": buyer.pincode,
            "payment_terms_days": buyer.payment_terms_days,
        }

        items_snapshot: List[Dict[str, Any]] = []
        for item in sales_order.items:
            items_snapshot.append({
                "id": item.id,
                "material_id": item.material_id,
                "lot_id": item.lot_id,
                "description": item.standard_b2b_name_snapshot,
                "standard_b2b_name": item.standard_b2b_name_snapshot,
                "hsn_code": item.hsn_code_snapshot,
                "weight": float(item.weight),
                "unit": item.unit,
                "rate_per_kg": float(item.rate_per_kg),
                "line_amount": float(item.line_amount),
                "tax_rate": float(item.tax_rate),
            })

        # 4. Generate Professional Sequential Invoice Number
        invoice_number = self.get_next_invoice_number(sales_order.yard_id, now)

        # Due Date
        due_days = invoice_in.due_days or buyer.payment_terms_days or 30
        due_date = now + timedelta(days=due_days)

        invoice = Invoice(
            id=str(uuid.uuid4()),
            yard_id=sales_order.yard_id,
            invoice_number=invoice_number,
            sales_order_id=sales_order.id,
            buyer_id=buyer.id,
            invoice_date=now,
            due_date=due_date,
            status="ISSUED",
            seller_profile_snapshot=seller_snapshot,
            buyer_snapshot=buyer_snapshot,
            items_snapshot=items_snapshot,
            subtotal=sales_order.subtotal,
            loading_charge=sales_order.loading_charge,
            transport_charge=sales_order.transport_charge,
            other_charge=sales_order.other_charge,
            discount=sales_order.discount,
            taxable_amount=sales_order.taxable_amount,
            cgst=sales_order.cgst,
            sgst=sales_order.sgst,
            igst=sales_order.igst,
            grand_total=sales_order.grand_total,
            paid_amount=sales_order.paid_amount,
            balance_amount=sales_order.balance_amount,
            notes=invoice_in.notes or sales_order.notes,
            created_by=created_by,
            created_at=now,
            updated_at=now,
        )
        self.db.add(invoice)

        # Audit Log
        audit = AuditLog(
            yard_id=sales_order.yard_id,
            entity_type="INVOICE",
            entity_id=invoice.id,
            action="INVOICE_GENERATE",
            user_id=None,
            before_state=None,
            after_state={
                "invoice_number": invoice.invoice_number,
                "grand_total": float(invoice.grand_total),
                "buyer_name": buyer.company_name,
            },
            created_at=now,
        )
        self.db.add(audit)
        self.db.commit()
        self.db.refresh(invoice)
        return invoice

    def cancel_invoice(self, invoice_id: str, reason: Optional[str] = None, user_id: Optional[str] = None) -> Invoice:
        invoice = self.get_by_id(invoice_id)
        if not invoice:
            raise NotFoundError(f"Invoice {invoice_id} not found")
        if invoice.status == "PAID":
            raise ValidationError("Cannot cancel an invoice that is already fully paid")

        before_status = invoice.status
        invoice.status = "CANCELLED"
        invoice.notes = f"CANCELLED: {reason}" if reason else "CANCELLED"
        invoice.updated_at = datetime.now(timezone.utc)

        audit = AuditLog(
            yard_id=invoice.yard_id,
            entity_type="INVOICE",
            entity_id=invoice.id,
            action="INVOICE_CANCEL",
            user_id=user_id,
            before_state={"status": before_status},
            after_state={"status": "CANCELLED", "reason": reason},
            created_at=invoice.updated_at,
        )
        self.db.add(audit)
        self.db.commit()
        self.db.refresh(invoice)
        return invoice
