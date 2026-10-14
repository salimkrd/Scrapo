import React, { useRef } from 'react';
import { Invoice } from '../types';
import { invoiceRepository } from '../repositories/invoiceRepository';

interface InvoiceModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  onRecordPaymentClick?: (invoice: Invoice) => void;
  onInvoiceUpdated?: (invoice: Invoice) => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  invoice,
  isOpen,
  onClose,
  onRecordPaymentClick,
  onInvoiceUpdated,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !invoice) return null;

  const seller = invoice.sellerProfileSnapshot;
  const buyer = invoice.buyerSnapshot;

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Invoice ${invoice.invoiceNumber} - ${seller.tradeName}`,
          text: `Tax Invoice ${invoice.invoiceNumber} for ${buyer.companyName}. Grand Total: ₹${invoice.grandTotal.toLocaleString('en-IN')}`,
          url: window.location.href,
        });
      } catch {
        // User cancelled share
      }
    } else {
      alert(`Invoice Link Copied: ${invoice.invoiceNumber}`);
    }
  };

  const handleCancel = async () => {
    const confirmCancel = window.confirm(
      `Are you sure you want to cancel Invoice ${invoice.invoiceNumber}? This action is permanent.`
    );
    if (!confirmCancel) return;

    try {
      const updated = await invoiceRepository.cancelInvoice(invoice.id);
      if (onInvoiceUpdated) {
        onInvoiceUpdated(updated);
      }
      onClose();
    } catch (err: any) {
      alert('Failed to cancel invoice: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white text-slate-900 w-full max-w-3xl max-h-[95vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Top Action Toolbar (Hidden during print) */}
        <div className="print:hidden px-4 sm:px-6 py-3 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-400 text-[20px]">verified</span>
            <div>
              <span className="font-mono font-bold text-sm tracking-wider text-emerald-400">
                {invoice.invoiceNumber}
              </span>
              <span
                className={`ml-2 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                  invoice.status === 'PAID'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : invoice.status === 'PARTIALLY_PAID'
                    ? 'bg-amber-500/20 text-amber-400'
                    : invoice.status === 'CANCELLED'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-blue-500/20 text-blue-400'
                }`}
              >
                {invoice.status}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              <span className="hidden sm:inline">Print / A4 PDF</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">share</span>
              <span className="hidden sm:inline">Share</span>
            </button>

            {invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && onRecordPaymentClick && (
              <button
                type="button"
                onClick={() => onRecordPaymentClick(invoice)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">payments</span>
                <span>Record Payment</span>
              </button>
            )}

            {invoice.status !== 'CANCELLED' && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-2.5 py-1.5 bg-red-950/60 hover:bg-red-900 text-red-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                title="Cancel Invoice"
              >
                <span className="material-symbols-outlined text-[16px]">block</span>
              </button>
            )}

            <button
              onClick={onClose}
              type="button"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors ml-1"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Professional A4 Invoice Document */}
        <div ref={printRef} className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-slate-800 bg-white">
          {/* Header & Logo */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl font-black tracking-tight text-slate-900">SCRAPO</span>
                <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                  B2B Tax Invoice
                </span>
              </div>
              <h1 className="text-lg font-bold text-slate-900">{seller.legalName}</h1>
              <p className="text-xs font-medium text-slate-600">{seller.tradeName}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {seller.address}, {seller.state} - {seller.pincode}
              </p>
              <p className="text-xs text-slate-500">
                Phone: {seller.phone} • Email: {seller.email}
              </p>
              <p className="text-xs font-mono font-bold text-slate-900 mt-1">
                GSTIN: {seller.gstin}
              </p>
            </div>

            <div className="text-right">
              <div className="text-2xl font-black font-mono tracking-tight text-slate-900">
                {invoice.invoiceNumber}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Invoice Date:{' '}
                <strong className="text-slate-800 font-medium">
                  {new Date(invoice.invoiceDate).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </strong>
              </div>
              <div className="text-xs text-slate-500">
                Due Date:{' '}
                <strong className="text-slate-800 font-medium">
                  {new Date(invoice.dueDate).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </strong>
              </div>
              <div className="mt-2">
                <span
                  className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded border uppercase ${
                    invoice.status === 'PAID'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                      : invoice.status === 'PARTIALLY_PAID'
                      ? 'border-amber-600 bg-amber-50 text-amber-700'
                      : invoice.status === 'CANCELLED'
                      ? 'border-red-600 bg-red-50 text-red-700'
                      : 'border-blue-600 bg-blue-50 text-blue-700'
                  }`}
                >
                  Status: {invoice.status}
                </span>
              </div>
            </div>
          </div>

          {/* Bill To & Dispatch Details */}
          <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                Billed To (Buyer)
              </span>
              <h2 className="font-bold text-sm text-slate-900 mt-0.5">{buyer.companyName}</h2>
              <p className="text-slate-600">Attn: {buyer.contactPerson}</p>
              <p className="text-slate-600 mt-0.5">{buyer.billingAddress}</p>
              <p className="text-slate-600">
                {buyer.state} - {buyer.pincode}
              </p>
              <p className="font-mono font-bold text-slate-900 mt-1">
                GSTIN: {buyer.gstin || 'UNREGISTERED'}
              </p>
            </div>

            <div>
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                Consignee / Shipped To
              </span>
              <p className="text-slate-700 mt-0.5 font-medium">{buyer.shippingAddress || buyer.billingAddress}</p>
              <div className="mt-2 text-slate-500">
                Payment Terms: <strong className="text-slate-800">{buyer.paymentTermsDays} Days</strong>
              </div>
              <div className="text-slate-500">
                Place of Supply: <strong className="text-slate-800">{buyer.state}</strong>
              </div>
            </div>
          </div>

          {/* Line Items Table (Frozen Snapshot with standardB2BNameSnapshot) */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Description of Goods</th>
                  <th className="py-2.5 px-3">HSN</th>
                  <th className="py-2.5 px-3 text-right">Quantity</th>
                  <th className="py-2.5 px-3 text-right">Rate (₹/Unit)</th>
                  <th className="py-2.5 px-3 text-right">Tax Rate</th>
                  <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.itemsSnapshot.map((it, idx) => (
                  <tr key={it.id || idx}>
                    <td className="py-2.5 px-3 text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-3">
                      {/* Section 8 & 19: Use standardB2BNameSnapshot */}
                      <div className="font-bold text-slate-900">
                        {it.standardB2BNameSnapshot || it.descriptionSnapshot}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {it.lotId ? `Lot Ref: ${it.lotId}` : 'Bulk Scrap Dispatch'}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{it.hsnCodeSnapshot || '7204'}</td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-900 font-numeric">
                      {it.weight.toLocaleString('en-IN')} {it.unit}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-900 font-numeric">
                      ₹{it.ratePerKg.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600">{it.taxRate}%</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-numeric">
                      ₹{it.lineAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals & GST Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            {/* Bank Details & Notes */}
            <div className="space-y-3">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                  Bank Remittance Details
                </span>
                <div className="mt-1 space-y-0.5 text-slate-700">
                  <div>
                    Bank: <strong className="text-slate-900">{seller.bankName}</strong>
                  </div>
                  <div>
                    Account Number: <strong className="font-mono text-slate-900">{seller.accountNumber}</strong>
                  </div>
                  <div>
                    IFSC Code: <strong className="font-mono text-slate-900">{seller.ifsc}</strong>
                  </div>
                  <div>
                    UPI ID: <strong className="font-mono text-slate-900">{seller.upiId}</strong>
                  </div>
                </div>
              </div>

              {invoice.notes && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600">
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                    Remarks / Terms
                  </span>
                  <p className="mt-0.5">{invoice.notes}</p>
                </div>
              )}
            </div>

            {/* Financial Breakdown */}
            <div className="space-y-1.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-600">Subtotal:</span>
                <span className="font-bold text-slate-900 font-numeric">
                  ₹{invoice.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {invoice.loadingCharge > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600">Loading Charges:</span>
                  <span className="font-bold text-slate-900 font-numeric">
                    ₹{invoice.loadingCharge.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {invoice.transportCharge > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600">Transportation:</span>
                  <span className="font-bold text-slate-900 font-numeric">
                    ₹{invoice.transportCharge.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {invoice.discount > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-200 text-emerald-700">
                  <span>Discount:</span>
                  <span className="font-bold font-numeric">
                    −₹{invoice.discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-600">Taxable Value:</span>
                <span className="font-bold text-slate-900 font-numeric">
                  ₹{invoice.taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Tax Details */}
              {invoice.cgst > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600">CGST (9%):</span>
                  <span className="font-bold text-slate-900 font-numeric">
                    ₹{invoice.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {invoice.sgst > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600">SGST (9%):</span>
                  <span className="font-bold text-slate-900 font-numeric">
                    ₹{invoice.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {invoice.igst > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600">IGST (18%):</span>
                  <span className="font-bold text-slate-900 font-numeric">
                    ₹{invoice.igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              <div className="flex justify-between py-2 text-base font-black text-slate-900 border-b-2 border-slate-900">
                <span>Grand Total:</span>
                <span className="font-numeric">
                  ₹{invoice.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between py-1 text-emerald-700 font-medium">
                <span>Paid Amount:</span>
                <span className="font-numeric">
                  ₹{invoice.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between py-1 text-amber-700 font-bold text-sm">
                <span>Balance Due:</span>
                <span className="font-numeric">
                  ₹{invoice.balanceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Signatory Area */}
          <div className="pt-8 border-t border-slate-200 flex justify-between items-end text-xs text-slate-500">
            <div>
              <p>Certified that particulars given above are true and correct.</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                System generated by Scrapo B2B Yard Management System • Digital Record Verified
              </p>
            </div>
            <div className="text-center">
              <div className="w-48 border-b border-slate-400 pb-8 text-slate-400 italic">
                Authorized Signatory
              </div>
              <span className="text-[11px] font-bold text-slate-800 mt-1 block">
                For {seller.tradeName}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
