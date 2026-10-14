import React, { useState, useEffect } from 'react';
import { Buyer, Invoice, BuyerPayment, BuyerPaymentMethod } from '../types';
import { DEFAULT_YARD_ID } from '../services/seedService';
import { invoiceRepository } from '../repositories/invoiceRepository';
import { buyerRepository } from '../repositories/buyerRepository';

interface RecordPaymentModalProps {
  buyer?: Buyer | null;
  invoice?: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  onPaymentRecorded: (payment: BuyerPayment) => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  buyer,
  invoice,
  isOpen,
  onClose,
  onPaymentRecorded,
}) => {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [selectedBuyerId, setSelectedBuyerId] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<BuyerPaymentMethod>('BANK_TRANSFER');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      buyerRepository.getAllBuyers(DEFAULT_YARD_ID).then((bList) => {
        setBuyers(bList);
        if (buyer) {
          setSelectedBuyerId(buyer.id);
        } else if (invoice) {
          setSelectedBuyerId(invoice.buyerId);
        } else if (bList.length > 0) {
          setSelectedBuyerId(bList[0].id);
        }
      });

      if (invoice) {
        setAmount(invoice.balanceAmount > 0 ? invoice.balanceAmount : invoice.grandTotal);
        setReferenceNumber(`UTR-${Math.floor(10000000 + Math.random() * 90000000)}`);
        setNotes(`Payment against invoice ${invoice.invoiceNumber}`);
      } else {
        setAmount(50000);
        setReferenceNumber('');
        setNotes('General ledger credit payment');
      }
      setError(null);
    }
  }, [isOpen, buyer, invoice]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBuyerId) {
      setError('Please select a buyer');
      return;
    }
    if (amount <= 0) {
      setError('Payment amount must be greater than zero');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payment = await invoiceRepository.recordPayment({
        yardId: DEFAULT_YARD_ID,
        buyerId: selectedBuyerId,
        invoiceId: invoice?.id,
        salesOrderId: invoice?.salesOrderId,
        amount,
        paymentMethod,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        createdBy: 'accountant',
      });

      onPaymentRecorded(payment);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface text-on-surface w-full max-w-md max-h-[90vh] rounded-2xl shadow-2xl border border-surface-container flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-surface-container-low border-b border-surface-container flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-[22px]">payments</span>
            <div>
              <h3 className="font-bold text-base text-on-surface">Record Buyer Payment</h3>
              <p className="text-xs text-on-surface-variant">
                {invoice ? `Against Invoice ${invoice.invoiceNumber}` : 'General Account Payment'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Buyer Display / Select */}
          {!invoice && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                Select Buyer *
              </label>
              <select
                value={selectedBuyerId}
                onChange={(e) => setSelectedBuyerId(e.target.value)}
                className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container rounded-xl text-sm font-medium focus:outline-none focus:border-primary"
              >
                {buyers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.companyName} ({b.state})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Invoice Summary Banner if linked */}
          {invoice && (
            <div className="p-3.5 bg-surface-container-low rounded-xl border border-surface-container flex items-center justify-between text-xs">
              <div>
                <span className="text-on-surface-variant">Buyer: </span>
                <span className="font-bold text-on-surface">{invoice.buyerSnapshot?.companyName}</span>
                <div className="text-[10px] text-on-surface-variant mt-0.5">
                  Grand Total: ₹{invoice.grandTotal.toLocaleString('en-IN')} • Paid: ₹{invoice.paidAmount.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="text-right">
                <span className="text-on-surface-variant">Balance Due:</span>
                <div className="font-bold text-amber-800 dark:text-amber-300 text-sm">
                  ₹{invoice.balanceAmount.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          )}

          {/* Amount */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              Payment Amount (₹) *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-base font-bold text-on-surface-variant">₹</span>
              <input
                type="number"
                step="1"
                min="1"
                required
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full pl-8 pr-3 py-2.5 bg-surface-container-lowest border border-surface-container rounded-xl text-xl font-bold font-numeric focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              Payment Method *
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as BuyerPaymentMethod)}
              className="w-full px-3 py-2.5 bg-surface-container-lowest border border-surface-container rounded-xl text-sm font-medium focus:outline-none focus:border-primary"
            >
              <option value="BANK_TRANSFER">Bank Transfer (NEFT / RTGS / IMPS)</option>
              <option value="UPI">UPI Digital Payment</option>
              <option value="CHEQUE">Bank Cheque / DD</option>
              <option value="CASH">Cash Deposit</option>
              <option value="CREDIT_ADJUSTMENT">Credit Adjustment / Debit Note</option>
            </select>
          </div>

          {/* Reference Number */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              Reference / UTR / Cheque #
            </label>
            <input
              type="text"
              placeholder="e.g. UTR-982187212 or CHQ-00124"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container rounded-xl text-sm font-mono focus:outline-none focus:border-primary"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              Remarks & Notes
            </label>
            <input
              type="text"
              placeholder="e.g. Advance settlement for next consignment"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container rounded-xl text-sm focus:outline-none focus:border-primary"
            />
          </div>

          {/* Automatic ledger notice */}
          <div className="text-[11px] text-on-surface-variant bg-surface-container-low p-2.5 rounded-lg flex items-start gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-emerald-800 dark:text-emerald-300 shrink-0">verified</span>
            <span>
              This payment will be recorded immediately into the dynamic buyer ledger, reducing outstanding receivables.
            </span>
          </div>

          {/* Actions */}
          <div className="pt-4 flex items-center justify-end gap-2 border-t border-surface-container">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || amount <= 0}
              className="px-5 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              <span>{saving ? 'Recording...' : 'Record Payment'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
