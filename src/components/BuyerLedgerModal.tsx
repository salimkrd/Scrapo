import React, { useState, useEffect } from 'react';
import { Buyer, BuyerLedgerSummary } from '../types';
import { buyerRepository } from '../repositories/buyerRepository';

interface BuyerLedgerModalProps {
  buyer: Buyer | null;
  isOpen: boolean;
  onClose: () => void;
  onRecordPaymentClick?: (buyer: Buyer) => void;
}

export const BuyerLedgerModal: React.FC<BuyerLedgerModalProps> = ({
  buyer,
  isOpen,
  onClose,
  onRecordPaymentClick,
}) => {
  const [ledger, setLedger] = useState<BuyerLedgerSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && buyer) {
      setLoading(true);
      buyerRepository
        .getBuyerLedger(buyer.id)
        .then((l) => setLedger(l))
        .finally(() => setLoading(false));
    }
  }, [isOpen, buyer]);

  if (!isOpen || !buyer) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface text-on-surface w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl border border-surface-container flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-surface-container-low border-b border-surface-container flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
              {buyer.companyName.charAt(0)}
            </div>
            <div>
              <h3 className="font-bold text-base text-on-surface flex items-center gap-2">
                <span>{buyer.companyName}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-mono">
                  {buyer.gstin || 'NO GSTIN'}
                </span>
              </h3>
              <p className="text-xs text-on-surface-variant">
                Contact: {buyer.contactPerson} • {buyer.phone} • Terms: {buyer.paymentTermsDays} days
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container cursor-pointer transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-surface-container-lowest rounded-xl border border-surface-container">
              <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
                Total Invoiced
              </span>
              <div className="text-lg font-bold text-on-surface mt-1">
                ₹{ledger ? ledger.totalSales.toLocaleString('en-IN') : '0'}
              </div>
            </div>

            <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
              <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                Total Received
              </span>
              <div className="text-lg font-bold text-emerald-800 dark:text-emerald-300 mt-1">
                ₹{ledger ? ledger.totalReceived.toLocaleString('en-IN') : '0'}
              </div>
            </div>

            <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
              <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                Outstanding Balance
              </span>
              <div className="text-lg font-bold text-amber-800 dark:text-amber-300 mt-1">
                ₹{ledger ? ledger.outstandingBalance.toLocaleString('en-IN') : '0'}
              </div>
            </div>

            <div className="p-3 bg-surface-container-lowest rounded-xl border border-surface-container">
              <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
                Credit Limit
              </span>
              <div className="text-lg font-bold text-on-surface mt-1">
                ₹{buyer.creditLimit.toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-on-surface-variant mt-0.5">
                {ledger && ledger.outstandingBalance > buyer.creditLimit
                  ? '⚠️ Exceeding limit'
                  : '✓ Within safe limit'}
              </div>
            </div>
          </div>

          {/* Ledger Statement Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-sm text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-primary">receipt_long</span>
                <span>Dynamic Ledger Transactions</span>
              </h4>
              <span className="text-xs text-on-surface-variant">
                Auto-calculated (Invoices − Payments − Credits)
              </span>
            </div>

            {loading ? (
              <div className="py-12 text-center text-on-surface-variant text-sm">
                Loading buyer ledger transactions...
              </div>
            ) : !ledger || ledger.transactionHistory.length === 0 ? (
              <div className="py-12 text-center text-on-surface-variant bg-surface-container-lowest rounded-xl border border-dashed border-surface-container">
                <span className="material-symbols-outlined text-[32px] text-on-surface-variant/50 mb-1">
                  history_edu
                </span>
                <p className="text-sm font-medium">No ledger transactions recorded yet</p>
                <p className="text-xs text-on-surface-variant/70 mt-1">
                  Sales invoices and buyer payments will appear here in chronological order.
                </p>
              </div>
            ) : (
              <div className="border border-surface-container rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-container-low text-on-surface-variant uppercase font-semibold text-[10px] border-b border-surface-container">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Ref #</th>
                      <th className="py-2.5 px-3 text-right">Debit (+)</th>
                      <th className="py-2.5 px-3 text-right">Credit (−)</th>
                      <th className="py-2.5 px-3 text-right">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container bg-surface-container-lowest">
                    {ledger.transactionHistory.map((tx, idx) => (
                      <tr key={idx} className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-on-surface-variant whitespace-nowrap">
                          {new Date(tx.date).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              tx.type === 'INVOICE'
                                ? 'bg-primary/10 text-primary'
                                : tx.type === 'PAYMENT'
                                ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                                : 'bg-purple-500/10 text-purple-800 dark:text-purple-300'
                            }`}
                          >
                            {tx.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-medium text-on-surface">
                          {tx.referenceNumber}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-amber-800 dark:text-amber-300">
                          {tx.debit > 0 ? `₹${tx.debit.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-emerald-800 dark:text-emerald-300">
                          {tx.credit > 0 ? `₹${tx.credit.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-on-surface font-mono">
                          ₹{tx.runningBalance.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-surface-container-low border-t border-surface-container flex items-center justify-between">
          <div className="text-xs text-on-surface-variant">
            State: <span className="font-semibold text-on-surface">{buyer.state}</span> • PIN:{' '}
            <span className="font-semibold text-on-surface">{buyer.pincode}</span>
          </div>
          <div className="flex items-center gap-2">
            {onRecordPaymentClick && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRecordPaymentClick(buyer);
                }}
                className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">payments</span>
                <span>Record Buyer Payment</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
