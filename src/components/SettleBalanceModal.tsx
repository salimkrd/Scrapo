import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Seller, PaymentMode } from '../types';

interface SettleBalanceModalProps {
  seller: Seller | null;
  outstandingBalance: number;
  isOpen: boolean;
  onClose: () => void;
}

export const SettleBalanceModal: React.FC<SettleBalanceModalProps> = ({
  seller,
  outstandingBalance,
  isOpen,
  onClose,
}) => {
  const { settleSellerBalance } = useApp();
  const [amount, setAmount] = useState<number>(outstandingBalance);
  const [mode, setMode] = useState<PaymentMode>('CASH');
  const [notes, setNotes] = useState<string>('Evening ledger clearance');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAmount(outstandingBalance);
  }, [outstandingBalance, isOpen]);

  if (!isOpen || !seller) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      setError('Enter an amount greater than zero');
      return;
    }
    if (amount > outstandingBalance) {
      setError(`Amount cannot exceed outstanding balance of ₹${outstandingBalance.toLocaleString('en-IN')}`);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await settleSellerBalance(seller.id, amount, mode, notes);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to settle balance');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-surface rounded-t-2xl sm:rounded-2xl max-w-md w-full shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
        {/* Header */}
        <div className="p-4 bg-primary text-on-primary flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px]">payments</span>
            <div>
              <h3 className="font-title-md text-title-md font-bold">
                Settle Credit / പണം നൽകുക
              </h3>
              <p className="text-xs text-primary-fixed-dim">
                Record payment payout against seller ledger
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3 overflow-y-auto">
          {error && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Seller Snapshot Card */}
          <div className="bg-surface-container-low p-3 rounded-xl border border-surface-container flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center font-bold text-on-primary-fixed">
                {seller.initials}
              </div>
              <div>
                <div className="flex items-center gap-1.5 font-bold text-sm text-on-surface">
                  <span>{seller.name}</span>
                  <span className="text-xs text-on-surface-variant font-normal">({seller.nameMl})</span>
                </div>
                <div className="text-xs text-on-surface-variant">{seller.phone}</div>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-on-surface-variant">Outstanding</span>
              <div className="font-label-bold text-label-bold text-secondary text-base">
                ₹{outstandingBalance.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Settlement Amount */}
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Payout Amount / നൽകുന്ന തുക (INR)
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-sm font-bold text-on-surface-variant">₹</span>
              <input
                type="number"
                min="1"
                max={outstandingBalance}
                value={amount || ''}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                className="w-full h-11 pl-8 pr-3 rounded-lg bg-surface-container-low text-on-surface font-semibold text-base focus:outline-none focus:ring-2 focus:ring-primary/20 border border-surface-container"
                required
              />
            </div>

            {/* Quick Amount Chips */}
            <div className="flex gap-1.5 mt-2">
              <button
                type="button"
                onClick={() => setAmount(outstandingBalance)}
                className="px-2.5 py-1 bg-surface-container text-primary font-bold text-xs rounded-lg hover:bg-surface-container-high cursor-pointer"
              >
                Full (₹{outstandingBalance.toLocaleString('en-IN')})
              </button>
              {outstandingBalance > 1000 && (
                <button
                  type="button"
                  onClick={() => setAmount(1000)}
                  className="px-2.5 py-1 bg-surface-container text-on-surface text-xs rounded-lg hover:bg-surface-container-high cursor-pointer"
                >
                  ₹1,000
                </button>
              )}
              {outstandingBalance > 2000 && (
                <button
                  type="button"
                  onClick={() => setAmount(2000)}
                  className="px-2.5 py-1 bg-surface-container text-on-surface text-xs rounded-lg hover:bg-surface-container-high cursor-pointer"
                >
                  ₹2,000
                </button>
              )}
              {outstandingBalance > 5000 && (
                <button
                  type="button"
                  onClick={() => setAmount(5000)}
                  className="px-2.5 py-1 bg-surface-container text-on-surface text-xs rounded-lg hover:bg-surface-container-high cursor-pointer"
                >
                  ₹5,000
                </button>
              )}
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
              Disbursement Method / പണം നൽകിയ വഴി
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'CASH', label: 'Cash', icon: 'point_of_sale' },
                { id: 'UPI', label: 'UPI / GPay', icon: 'qr_code_scanner' },
                { id: 'BANK_TRANSFER', label: 'Bank', icon: 'account_balance' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id as PaymentMode)}
                  className={`h-11 rounded-lg text-xs font-bold flex flex-col items-center justify-center transition-all border cursor-pointer ${
                    mode === m.id
                      ? 'bg-primary text-on-primary border-primary shadow-sm'
                      : 'bg-surface-container-low text-on-surface border-surface-container hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{m.icon}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Notes / കുറിപ്പ്
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Cleared pending balance"
              className="w-full h-10 px-3 rounded-lg bg-surface-container-low text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 border border-surface-container"
            />
          </div>

          {/* Remaining After Payout */}
          <div className="bg-surface-container-low p-2.5 rounded-lg flex items-center justify-between text-xs text-on-surface-variant">
            <span>Remaining balance after payout:</span>
            <span className="font-bold text-on-surface">
              ₹{Math.max(0, outstandingBalance - amount).toLocaleString('en-IN')}
            </span>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-primary text-on-primary rounded-xl font-label-bold text-label-bold flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">check</span>
              <span>
                {isSubmitting
                  ? 'RECORDING PAYOUT...'
                  : `CONFIRM PAYOUT OF ₹${amount.toLocaleString('en-IN')}`}
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full h-9 text-xs text-on-surface-variant hover:text-on-surface font-semibold cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
