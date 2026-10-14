import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Header } from './Header';
import { BottomNav } from './BottomNav';

export const PurchasesView: React.FC = () => {
  const { recentSlips, setViewingSlip, navigateTo } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'CREDIT' | 'DRAFT'>('ALL');

  // Filter slips
  const filteredSlips = recentSlips.filter((slip) => {
    // 1. Search filter
    const matchesSearch =
      slip.slipNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      slip.sellerSnapshot?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      slip.sellerSnapshot?.nameMl.includes(searchTerm) ||
      slip.primaryMaterialName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (slip.vehicleNumber && slip.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    // 2. Status filter
    if (statusFilter === 'PAID') {
      return slip.paymentStatus === 'PAID' && slip.primaryPaymentMode !== 'CREDIT';
    }
    if (statusFilter === 'CREDIT') {
      return slip.primaryPaymentMode === 'CREDIT' || slip.paymentStatus === 'PENDING';
    }
    if (statusFilter === 'DRAFT') {
      return slip.paymentStatus === 'DRAFT' || slip.status === 'draft';
    }
    return true;
  });

  const totalDisbursed = recentSlips
    .filter((s) => s.paymentStatus === 'PAID' && s.primaryPaymentMode !== 'CREDIT')
    .reduce((acc, s) => acc + s.totalAmount, 0);

  const totalWeight = recentSlips.reduce((acc, s) => acc + s.totalWeight, 0);

  return (
    <div className="bg-surface font-body-md text-body-md text-on-surface flex flex-col min-h-screen">
      <Header />

      <main className="flex flex-col relative w-full max-w-lg mx-auto px-space-md pt-24 pb-28 bg-surface">
        <div className="flex flex-col w-full gap-3">
          {/* Title & Summary Strip */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <h2 className="font-title-lg text-title-lg font-bold text-on-surface">
                Purchases / ബില്ലുകൾ
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                History of procurement slips and weighments
              </p>
            </div>
            <button
              onClick={() => navigateTo('material_selection')}
              className="px-3 py-1.5 bg-primary text-on-primary rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-transform cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>+ New Slip</span>
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-surface-container-low p-2.5 rounded-xl border border-surface-container flex flex-col">
              <span className="text-[10px] uppercase font-bold text-on-surface-variant">Slips</span>
              <span className="font-bold text-base text-primary">{recentSlips.length}</span>
            </div>
            <div className="bg-surface-container-low p-2.5 rounded-xl border border-surface-container flex flex-col">
              <span className="text-[10px] uppercase font-bold text-on-surface-variant">Total Weight</span>
              <span className="font-bold text-base text-on-surface">{totalWeight.toFixed(1)} KG</span>
            </div>
            <div className="bg-surface-container-low p-2.5 rounded-xl border border-surface-container flex flex-col">
              <span className="text-[10px] uppercase font-bold text-on-surface-variant">Disbursed</span>
              <span className="font-bold text-base text-tertiary">₹{totalDisbursed.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-3 text-outline text-[20px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search slip #, seller, material, vehicle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 pl-10 pr-3 rounded-xl bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 border border-surface-container"
            />
          </div>

          {/* Filter Chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'ALL', label: 'All Slips' },
              { id: 'PAID', label: 'Paid / പണം നൽകിയവ' },
              { id: 'CREDIT', label: 'Credit / കടം' },
              { id: 'DRAFT', label: 'Drafts / ഡ്രാഫ്റ്റ്' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id as any)}
                type="button"
                className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  statusFilter === f.id
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Slips List */}
          <div className="flex flex-col gap-3 mt-1">
            {filteredSlips.length === 0 ? (
              <div className="text-center py-12 bg-surface-container-lowest rounded-xl border border-dashed border-surface-container-high p-6 flex flex-col items-center gap-2">
                <span className="material-symbols-outlined text-[40px] text-outline">receipt_long</span>
                <p className="font-title-md text-title-md font-bold text-on-surface">No purchase slips found</p>
                <p className="text-xs text-on-surface-variant max-w-xs">
                  {searchTerm ? 'Try searching with a different keyword.' : 'Start a new weighment to create the first slip.'}
                </p>
                <button
                  onClick={() => navigateTo('material_selection')}
                  type="button"
                  className="mt-2 px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold cursor-pointer"
                >
                  + Create New Weighment
                </button>
              </div>
            ) : (
              filteredSlips.map((slip) => {
                const isPaid = slip.paymentStatus === 'PAID' && slip.primaryPaymentMode !== 'CREDIT';
                const isCredit = slip.primaryPaymentMode === 'CREDIT' || slip.paymentStatus === 'PENDING';
                const isDraft = slip.paymentStatus === 'DRAFT' || slip.status === 'draft';

                return (
                  <div
                    key={slip.id}
                    className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-surface-container hover:border-outline-variant transition-all flex flex-col gap-3"
                  >
                    {/* Top Row: Slip #, Date, Status */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-primary">
                          {slip.slipNumber}
                        </span>
                        <span className="text-xs text-on-surface-variant">• {slip.timestamp || 'Live'}</span>
                      </div>

                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          isPaid
                            ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                            : isCredit
                            ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                            : isDraft
                            ? 'bg-surface-container text-on-surface-variant font-medium'
                            : 'bg-surface-container text-on-surface-variant'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[13px]">
                          {isPaid ? 'check_circle' : isCredit ? 'menu_book' : 'edit_document'}
                        </span>
                        <span>{slip.primaryPaymentMode || slip.paymentMethod}</span>
                      </span>
                    </div>

                    {/* Middle Row: Seller Snapshot */}
                    <div className="flex items-center justify-between border-t border-b border-surface-container-low py-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center font-bold text-xs text-on-primary-fixed">
                          {slip.sellerSnapshot?.initials || 'SE'}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-on-surface flex items-center gap-1">
                            <span>{slip.sellerSnapshot?.name}</span>
                            <span className="text-xs text-on-surface-variant font-normal">
                              ({slip.sellerSnapshot?.nameMl})
                            </span>
                          </div>
                          <div className="text-[11px] text-on-surface-variant">
                            {slip.vehicleNumber || slip.sellerSnapshot?.vehicleNumber || 'Hand Carry'}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-label-numeric-lg text-lg font-bold text-on-surface">
                          ₹{slip.totalAmount.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[11px] text-on-surface-variant">
                          {slip.totalWeight.toFixed(2)} KG Net
                        </div>
                      </div>
                    </div>

                    {/* Items Snapshot */}
                    <div className="flex flex-col gap-1 text-xs">
                      {slip.items && slip.items.length > 0 ? (
                        slip.items.map((it, idx) => (
                          <div key={it.id || idx} className="flex justify-between text-on-surface-variant">
                            <span className="truncate max-w-[220px]">
                              {it.materialNameSnapshot} ({it.standardB2BTermSnapshot})
                            </span>
                            <span className="font-semibold text-on-surface">
                              {it.netWeight.toFixed(1)}kg @ ₹{it.ratePerKg}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="flex justify-between text-on-surface-variant">
                          <span>{slip.primaryMaterialName}</span>
                          <span className="font-semibold text-on-surface">
                            {slip.totalWeight.toFixed(1)}kg @ ₹{slip.ratePerKg}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center gap-2 pt-1 border-t border-surface-container-low">
                      <button
                        onClick={() => setViewingSlip(slip)}
                        type="button"
                        className="flex-1 h-9 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-primary text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                        <span>View Thermal Receipt</span>
                      </button>
                      <button
                        onClick={() => {
                          setViewingSlip(slip);
                          setTimeout(() => window.print(), 300);
                        }}
                        type="button"
                        className="h-9 px-3 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        title="Print Receipt"
                      >
                        <span className="material-symbols-outlined text-[16px]">print</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
};
