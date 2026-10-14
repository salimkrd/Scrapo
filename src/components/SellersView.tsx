import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { sellerRepository } from '../repositories/sellerRepository';
import { Seller } from '../types';
import { SettleBalanceModal } from './SettleBalanceModal';

export const SellersView: React.FC = () => {
  const { allSellers, setActiveSeller, navigateTo, setIsSellerPickerOpen } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'CREDIT' | 'REGULAR'>('ALL');
  const [ledgers, setLedgers] = useState<Record<string, { totalPurchaseValue: number; totalPaid: number; outstandingBalance: number }>>({});
  
  // Settle modal state
  const [settleSeller, setSettleSeller] = useState<Seller | null>(null);
  const [isSettleOpen, setIsSettleOpen] = useState(false);

  // Fetch all ledgers dynamically
  useEffect(() => {
    const fetchLedgers = async () => {
      const results: Record<string, { totalPurchaseValue: number; totalPaid: number; outstandingBalance: number }> = {};
      for (const seller of allSellers) {
        const ledger = await sellerRepository.getSellerLedger(seller.id);
        results[seller.id] = ledger;
      }
      setLedgers(results);
    };
    fetchLedgers();
  }, [allSellers]);

  // Compute yard total outstanding credit
  const totalYardCredit = Object.values(ledgers).reduce(
    (acc, l) => acc + (l.outstandingBalance || 0),
    0
  );

  // Filter sellers
  const filteredSellers = allSellers.filter((seller) => {
    const matchesSearch =
      seller.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      seller.nameMl.includes(searchTerm) ||
      seller.phone.includes(searchTerm) ||
      (seller.vehicleNumber && seller.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    const outstanding = ledgers[seller.id]?.outstandingBalance || 0;
    if (filterType === 'CREDIT') {
      return outstanding > 0;
    }
    if (filterType === 'REGULAR') {
      return seller.badge === 'Regular Seller' || seller.type === 'Local Collector';
    }
    return true;
  });

  const handleStartPurchaseWithSeller = (seller: Seller) => {
    setActiveSeller(seller);
    navigateTo('material_selection');
  };

  const handleOpenSettle = (seller: Seller) => {
    setSettleSeller(seller);
    setIsSettleOpen(true);
  };

  return (
    <div className="bg-surface font-body-md text-body-md text-on-surface flex flex-col min-h-screen">
      <Header />

      <main className="flex flex-col relative w-full max-w-lg mx-auto px-space-md pt-24 pb-28 bg-surface">
        <div className="flex flex-col w-full gap-3">
          {/* Header Title */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <h2 className="font-title-lg text-title-lg font-bold text-on-surface">
                Sellers & Ledger / സപ്ലയർമാർ
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Supplier directory and credit balance ledgers
              </p>
            </div>
            <button
              onClick={() => setIsSellerPickerOpen(true)}
              className="px-3 py-1.5 bg-primary text-on-primary rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-transform cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">person_add</span>
              <span>+ New Seller</span>
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-surface-container-low p-3 rounded-xl border border-surface-container flex flex-col">
              <span className="text-[10px] uppercase font-bold text-on-surface-variant">
                Registered Suppliers
              </span>
              <span className="font-bold text-xl text-primary mt-0.5">{allSellers.length}</span>
              <span className="text-[11px] text-on-surface-variant mt-0.5">Active in Yard #2</span>
            </div>
            <div className="bg-surface-container-low p-3 rounded-xl border border-surface-container flex flex-col">
              <span className="text-[10px] uppercase font-bold text-on-surface-variant">
                Total Outstanding Credit
              </span>
              <span className="font-bold text-xl text-secondary mt-0.5">
                ₹{totalYardCredit.toLocaleString('en-IN')}
              </span>
              <span className="text-[11px] text-on-surface-variant mt-0.5">Owed to suppliers</span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-3 text-outline text-[20px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search by name, phone, or vehicle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 pl-10 pr-3 rounded-xl bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 border border-surface-container"
            />
          </div>

          {/* Filter Chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'ALL', label: `All Suppliers (${allSellers.length})` },
              { id: 'CREDIT', label: 'Has Balance / കടമുള്ളവർ' },
              { id: 'REGULAR', label: 'Regulars / സ്ഥിരം' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id as any)}
                type="button"
                className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  filterType === f.id
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Sellers List */}
          <div className="flex flex-col gap-3 mt-1">
            {filteredSellers.length === 0 ? (
              <div className="text-center py-12 bg-surface-container-lowest rounded-xl border border-dashed border-surface-container-high p-6 flex flex-col items-center gap-2">
                <span className="material-symbols-outlined text-[40px] text-outline">groups</span>
                <p className="font-title-md text-title-md font-bold text-on-surface">No suppliers found</p>
                <p className="text-xs text-on-surface-variant max-w-xs">
                  {searchTerm ? 'Try changing your search term.' : 'Register a new supplier to start tracking their balance.'}
                </p>
                <button
                  onClick={() => setIsSellerPickerOpen(true)}
                  type="button"
                  className="mt-2 px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold cursor-pointer"
                >
                  + Add New Supplier
                </button>
              </div>
            ) : (
              filteredSellers.map((seller) => {
                const ledger = ledgers[seller.id] || { totalPurchaseValue: 0, totalPaid: 0, outstandingBalance: 0 };
                const outstanding = ledger.outstandingBalance;

                return (
                  <div
                    key={seller.id}
                    className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-surface-container hover:border-outline-variant transition-all flex flex-col gap-3"
                  >
                    {/* Top Row: Info & Badge */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-primary-fixed flex items-center justify-center font-bold text-on-primary-fixed text-sm shadow-inner">
                          {seller.initials}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 font-bold text-base text-on-surface">
                            <span>{seller.name}</span>
                            <span className="text-xs text-on-surface-variant font-normal">({seller.nameMl})</span>
                          </div>
                          <div className="text-xs text-on-surface-variant flex items-center gap-2 mt-0.5">
                            <a
                              href={`tel:${seller.phone.replace(/\s+/g, '')}`}
                              className="text-primary hover:underline flex items-center gap-0.5"
                            >
                              <span className="material-symbols-outlined text-[13px]">call</span>
                              <span>{seller.phone}</span>
                            </a>
                            {seller.vehicleNumber && (
                              <>
                                <span>•</span>
                                <span className="font-mono">{seller.vehicleNumber}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed uppercase">
                        {seller.badge}
                      </span>
                    </div>

                    {/* Middle Row: Ledger Breakdown */}
                    <div className="bg-surface-container-low p-2.5 rounded-xl border border-surface-container flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-on-surface-variant">Total Procured</span>
                        <span className="font-bold text-xs text-on-surface">
                          ₹{ledger.totalPurchaseValue.toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div className="flex flex-col text-center">
                        <span className="text-[10px] uppercase font-bold text-on-surface-variant">Total Paid</span>
                        <span className="font-bold text-xs text-on-surface">
                          ₹{ledger.totalPaid.toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div className="flex flex-col text-right">
                        <span className="text-[10px] uppercase font-bold text-on-surface-variant">Balance Owed</span>
                        <span
                          className={`font-label-bold text-label-bold text-sm ${
                            outstanding > 0 ? 'text-secondary font-bold' : 'text-emerald-700'
                          }`}
                        >
                          {outstanding > 0 ? `₹${outstanding.toLocaleString('en-IN')}` : '₹0 (Clear)'}
                        </span>
                      </div>
                    </div>

                    {/* Action Row */}
                    <div className="flex items-center gap-2 pt-1 border-t border-surface-container-low">
                      <button
                        onClick={() => handleStartPurchaseWithSeller(seller)}
                        type="button"
                        className="flex-1 h-9 rounded-lg bg-primary text-on-primary text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">add_circle</span>
                        <span>New Weighment</span>
                      </button>

                      {outstanding > 0 && (
                        <button
                          onClick={() => handleOpenSettle(seller)}
                          type="button"
                          className="h-9 px-3 rounded-lg bg-secondary text-on-secondary text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">payments</span>
                          <span>Settle ₹{outstanding.toLocaleString('en-IN')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* Settle Balance Modal */}
      <SettleBalanceModal
        seller={settleSeller}
        outstandingBalance={settleSeller ? (ledgers[settleSeller.id]?.outstandingBalance || 0) : 0}
        isOpen={isSettleOpen}
        onClose={() => {
          setIsSettleOpen(false);
          setSettleSeller(null);
        }}
      />

      <BottomNav />
    </div>
  );
};
