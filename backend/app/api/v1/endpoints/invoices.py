from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Response, status
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from backend.app.auth.deps import get_current_user, require_roles, verify_yard_access
from backend.app.core.errors import NotFoundError, PermissionDeniedError
from backend.app.db.session import get_db
from backend.app.models.user import User
from backend.app.repositories.invoice_repo import InvoiceRepository
from backend.app.schemas.invoice import InvoiceCreate, InvoiceResponse

router = APIRouter()


@router.get("", response_model=List[InvoiceResponse], dependencies=[require_roles("OWNER", "MANAGER", "ACCOUNTANT")])
def list_invoices(
    yard_id: str = Query(...),
    buyer_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_yard_access(yard_id, current_user, db)
    repo = InvoiceRepository(db)
    invoices = repo.list_by_yard(yard_id, buyer_id=buyer_id, status=status)
    return [InvoiceResponse.model_validate(inv) for inv in invoices]


@router.post("", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED, dependencies=[require_roles("OWNER", "ACCOUNTANT")])
def create_invoice(
    data: InvoiceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = InvoiceRepository(db)
    invoice = repo.create_invoice(data, created_by=current_user.name)
    verify_yard_access(invoice.yard_id, current_user, db)
    return InvoiceResponse.model_validate(invoice)


@router.get("/{invoice_id}", response_model=InvoiceResponse, dependencies=[require_roles("OWNER", "MANAGER", "ACCOUNTANT")])
def get_invoice(
    invoice_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = InvoiceRepository(db)
    invoice = repo.get_by_id(invoice_id)
    if not invoice:
        raise NotFoundError(f"Invoice {invoice_id} not found")
    verify_yard_access(invoice.yard_id, current_user, db)
    return InvoiceResponse.model_validate(invoice)


@router.post("/{invoice_id}/cancel", response_model=InvoiceResponse, dependencies=[require_roles("OWNER", "ACCOUNTANT")])
def cancel_invoice(
    invoice_id: str,
    reason: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = InvoiceRepository(db)
    invoice = repo.get_by_id(invoice_id)
    if not invoice:
        raise NotFoundError(f"Invoice {invoice_id} not found")
    verify_yard_access(invoice.yard_id, current_user, db)
    cancelled = repo.cancel_invoice(invoice_id, reason=reason, user_id=current_user.id)
    return InvoiceResponse.model_validate(cancelled)


@router.get("/{invoice_id}/html", response_class=HTMLResponse, dependencies=[require_roles("OWNER", "MANAGER", "ACCOUNTANT")])
def get_invoice_html(
    invoice_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = InvoiceRepository(db)
    invoice = repo.get_by_id(invoice_id)
    if not invoice:
        raise NotFoundError(f"Invoice {invoice_id} not found")
    verify_yard_access(invoice.yard_id, current_user, db)

    seller = invoice.seller_profile_snapshot
    buyer = invoice.buyer_snapshot
    items = invoice.items_snapshot

    items_rows = "".join([
        f"""
        <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px; text-align: left;">
                <strong>{item.get('standard_b2b_name', 'Scrap Material')}</strong>
            </td>
            <td style="padding: 10px; text-align: center;">{item.get('hsn_code', '7204')}</td>
            <td style="padding: 10px; text-align: right;">{item.get('weight', 0):.2f} {item.get('unit', 'KG')}</td>
            <td style="padding: 10px; text-align: right;">₹{item.get('rate_per_kg', 0):.2f}</td>
            <td style="padding: 10px; text-align: right;">{item.get('tax_rate', 0)}%</td>
            <td style="padding: 10px; text-align: right;">₹{item.get('line_amount', 0):.2f}</td>
        </tr>
        """
        for item in items
    ])

    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Tax Invoice - {invoice.invoice_number}</title>
        <style>
            body {{ font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; color: #1e293b; margin: 0; padding: 24px; background: #fff; }}
            .invoice-box {{ max-width: 800px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; }}
            .header-table, .details-table, .items-table, .totals-table {{ width: 100%; border-collapse: collapse; }}
            .title {{ font-size: 24px; font-weight: bold; color: #0f172a; }}
            .badge {{ display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; background: #e0f2fe; color: #0369a1; }}
        </style>
    </head>
    <body>
        <div class="invoice-box">
            <table class="header-table" style="margin-bottom: 20px;">
                <tr>
                    <td style="vertical-align: top;">
                        <div class="title">{seller.get('legal_name', 'Scrapo Yard')}</div>
                        <div style="font-size: 13px; color: #64748b; margin-top: 4px;">{seller.get('address', '')}</div>
                        <div style="font-size: 13px; color: #64748b;">GSTIN: <strong>{seller.get('gstin', '')}</strong> | PAN: {seller.get('pan', '')}</div>
                        <div style="font-size: 13px; color: #64748b;">Phone: {seller.get('phone', '')} | Email: {seller.get('email', '')}</div>
                    </td>
                    <td style="text-align: right; vertical-align: top;">
                        <span class="badge">TAX INVOICE</span>
                        <h2 style="margin: 8px 0 4px 0; color: #0f172a;">{invoice.invoice_number}</h2>
                        <div style="font-size: 12px; color: #64748b;">Invoice Date: {invoice.invoice_date.strftime('%d-%b-%Y')}</div>
                        <div style="font-size: 12px; color: #64748b;">Due Date: {invoice.due_date.strftime('%d-%b-%Y')}</div>
                    </td>
                </tr>
            </table>

            <hr style="border: 0; border-top: 1px solid #cbd5e1; margin-bottom: 20px;" />

            <table class="details-table" style="margin-bottom: 24px;">
                <tr>
                    <td style="width: 50%; vertical-align: top;">
                        <strong style="font-size: 12px; color: #64748b; text-transform: uppercase;">Billed To (Buyer)</strong>
                        <div style="font-size: 16px; font-weight: bold; margin-top: 4px;">{buyer.get('company_name', '')}</div>
                        <div style="font-size: 13px; color: #475569;">Attn: {buyer.get('contact_person', '')}</div>
                        <div style="font-size: 13px; color: #475569;">{buyer.get('billing_address', '')}</div>
                        <div style="font-size: 13px; color: #475569;">State: {buyer.get('state', '')} ({buyer.get('pincode', '')})</div>
                        <div style="font-size: 13px; color: #0f172a; margin-top: 2px;">GSTIN: <strong>{buyer.get('gstin', 'Unregistered')}</strong></div>
                    </td>
                    <td style="width: 50%; vertical-align: top;">
                        <strong style="font-size: 12px; color: #64748b; text-transform: uppercase;">Bank & Payment Details</strong>
                        <div style="font-size: 13px; margin-top: 4px;">Bank: <strong>{seller.get('bank_name', '')}</strong></div>
                        <div style="font-size: 13px;">A/C No: <strong>{seller.get('account_number', '')}</strong></div>
                        <div style="font-size: 13px;">IFSC: <strong>{seller.get('ifsc', '')}</strong></div>
                        <div style="font-size: 13px;">UPI ID: <strong>{seller.get('upi_id', '')}</strong></div>
                        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Payment Terms: {buyer.get('payment_terms_days', 30)} Days</div>
                    </td>
                </tr>
            </table>

            <table class="items-table" style="margin-bottom: 24px; font-size: 13px;">
                <thead>
                    <tr style="background: #f8fafc; border-bottom: 2px solid #cbd5e1;">
                        <th style="padding: 10px; text-align: left;">Item Description (B2B Standard)</th>
                        <th style="padding: 10px; text-align: center;">HSN</th>
                        <th style="padding: 10px; text-align: right;">Dispatched Qty</th>
                        <th style="padding: 10px; text-align: right;">Rate / Unit</th>
                        <th style="padding: 10px; text-align: right;">GST %</th>
                        <th style="padding: 10px; text-align: right;">Taxable Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {items_rows}
                </tbody>
            </table>

            <table style="width: 100%;">
                <tr>
                    <td style="width: 55%; vertical-align: bottom; font-size: 12px; color: #64748b;">
                        <p>Certified that the particulars given above are true and correct.</p>
                        <div style="margin-top: 40px; border-top: 1px dashed #94a3b8; width: 220px; text-align: center; padding-top: 6px;">
                            Authorized Signatory
                        </div>
                    </td>
                    <td style="width: 45%; vertical-align: top;">
                        <table class="totals-table" style="font-size: 13px; line-height: 1.8;">
                            <tr><td>Subtotal:</td><td style="text-align: right;">₹{invoice.subtotal:.2f}</td></tr>
                            <tr><td>Loading Charges:</td><td style="text-align: right;">₹{invoice.loading_charge:.2f}</td></tr>
                            <tr><td>Transportation:</td><td style="text-align: right;">₹{invoice.transport_charge:.2f}</td></tr>
                            <tr><td>Discount:</td><td style="text-align: right;">-₹{invoice.discount:.2f}</td></tr>
                            <tr><td><strong>Taxable Value:</strong></td><td style="text-align: right;"><strong>₹{invoice.taxable_amount:.2f}</strong></td></tr>
                            <tr><td>CGST:</td><td style="text-align: right;">₹{invoice.cgst:.2f}</td></tr>
                            <tr><td>SGST:</td><td style="text-align: right;">₹{invoice.sgst:.2f}</td></tr>
                            <tr><td>IGST:</td><td style="text-align: right;">₹{invoice.igst:.2f}</td></tr>
                            <tr style="border-top: 2px solid #0f172a; font-size: 15px; font-weight: bold;">
                                <td>Grand Total:</td><td style="text-align: right; color: #0284c7;">₹{invoice.grand_total:.2f}</td>
                            </tr>
                            <tr style="color: #16a34a;"><td>Paid Amount:</td><td style="text-align: right;">₹{invoice.paid_amount:.2f}</td></tr>
                            <tr style="color: #dc2626; font-weight: bold;"><td>Balance Due:</td><td style="text-align: right;">₹{invoice.balance_amount:.2f}</td></tr>
                        </table>
                    </td>
                </tr>
            </table>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)
