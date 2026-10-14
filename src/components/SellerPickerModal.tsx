import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { sellerRepository } from '../repositories/sellerRepository';
import { Seller } from '../types';

export const SellerPickerModal: React.FC = () => {
  const {
    isSellerPickerOpen,
    setIsSellerPickerOpen,
    activeSeller,
    setActiveSeller,
    allSellers,
    createSeller,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [filter, setFilter] = useState('');
  const [ledgers, setLedgers] = useState<Record<string, number>>({});

  // New Seller Form State
  const [newName, setNewName] = useState('');
  const [newNameMl, setNewNameMl] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newType, setNewType] = useState('Local Collector');
  const [newVehicle, setNewVehicle] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isSellerPickerOpen) {
      allSellers.forEach(async (s) => {
        const ledger = await sellerRepository.getSellerLedger(s.id);
        setLedgers((prev) => ({ ...prev, [s.id]: ledger.outstandingBalance }));
      });
    }
  }, [isSellerPickerOpen, allSellers]);

  if (!isSellerPickerOpen) return null;

  const sellersList = allSellers.filter(
    (s) =>
      s.name.toLowerCase().includes(filter.toLowerCase()) ||
      s.phone.includes(filter) ||
      s.nameMl.includes(filter)
  );

  const handleSelect = (seller: Seller) => {
    setActiveSeller(seller);
    setIsSellerPickerOpen(false);
  };

  const handleCreateSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setFormError('Seller name is required / പേര് ആവശ്യമാണ്');
      return;
    }
    const cleanDigits = newPhone.replace(/[^0-9]/g, '');
    if (cleanDigits.length < 10) {
      setFormError('Enter a valid 10-digit phone / 10 അക്ക ഫോൺ നമ്പർ നൽകുക');
      return;
    }

    setFormError(null);
    setIsSaving(true);
    try {
      const formattedPhone = newPhone.trim().startsWith('+91')
        ? newPhone.trim()
        : `+91 ${cleanDigits.slice(-10, -5)} ${cleanDigits.slice(-5)}`;

      await createSeller({
        name: newName.trim(),
        nameMl: newNameMl.trim() || newName.trim(),
        phone: formattedPhone,
        type: newType,
        vehicleNumber: newVehicle.trim() || undefined,
      });

      // Reset form
      setNewName('');
      setNewNameMl('');
      setNewPhone('');
      setNewVehicle('');
      setActiveTab('list');
      setIsSellerPickerOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save seller');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-surface rounded-t-2xl sm:rounded-2xl max-w-lg w-full shadow-2xl flex flex-col overflow-hidden max-h-[88vh]">
        {/* Header */}
        <div className="p-4 border-b border-surface-container flex items-center justify-between">
          <div>
            <h3 className="font-title-lg text-title-lg font-bold text-on-surface">
              {activeTab === 'list'
                ? 'Select Seller / സപ്ലയറെ തിരഞ്ഞെടുക്കുക'
                : 'Add New Seller / പുതിയ സപ്ലയർ'}
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {activeTab === 'list'
                ? 'Active yard sellers and verified regulars'
                : 'Create and verify new supplier account for yard'}
            </p>
          </div>
          <button
            onClick={() => setIsSellerPickerOpen(false)}
            className="w-9 h-9 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-surface-container bg-surface-container-low px-3 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`pb-2.5 px-3 font-label-bold text-label-bold text-sm border-b-2 transition-all cursor-pointer ${
              activeTab === 'list'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Existing Sellers ({allSellers.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`pb-2.5 px-3 font-label-bold text-label-bold text-sm border-b-2 transition-all cursor-pointer flex items-center gap-1 ${
              activeTab === 'create'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            + Add New Seller
          </button>
        </div>

        {/* Tab 1: Existing Sellers List */}
        {activeTab === 'list' && (
          <>
            {/* Search */}
            <div className="p-3 bg-surface-container-low border-b border-surface-container">
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-outline text-[20px]">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Search by name, phone or vehicle..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="w-full h-11 pl-10 pr-3 rounded-lg bg-surface-container-lowest text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* Sellers list */}
            <div className="p-3 overflow-y-auto flex flex-col gap-2 flex-1">
              {sellersList.length === 0 ? (
                <div className="text-center py-8 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[36px] text-outline">search_off</span>
                  <p className="text-sm font-semibold mt-2">No sellers found</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('create')}
                    className="mt-3 px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold"
                  >
                    + Add as New Seller
                  </button>
                </div>
              ) : (
                sellersList.map((seller) => {
                  const isSelected = activeSeller.id === seller.id;
                  const outstanding = ledgers[seller.id] ?? 0;
                  return (
                    <div
                      key={seller.id}
                      onClick={() => handleSelect(seller)}
                      className={`p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all border ${
                        isSelected
                          ? 'bg-surface-container-high border-primary ring-2 ring-primary/30'
                          : 'bg-surface-container-lowest border-surface-container hover:border-outline-variant'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center font-bold text-on-primary-fixed">
                          {seller.initials}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-title-md text-title-md text-on-surface font-bold">
                              {seller.name}
                            </span>
                            <span className="text-xs text-on-surface-variant">({seller.nameMl})</span>
                          </div>
                          <div className="text-xs text-on-surface-variant flex items-center gap-2">
                            <span>{seller.phone}</span>
                            <span>•</span>
                            <span>{seller.type}</span>
                            {seller.vehicleNumber && (
                              <>
                                <span>•</span>
                                <span className="font-mono">{seller.vehicleNumber}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed">
                          {seller.badge}
                        </span>
                        {outstanding > 0 && (
                          <div className="text-[11px] text-secondary mt-1 font-semibold">
                            Ledger: ₹{outstanding.toLocaleString('en-IN')}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick footer to create */}
            <div className="p-3 bg-surface border-t border-surface-container">
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className="w-full h-11 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-primary font-label-bold text-label-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                <span>Register New Seller / പുതിയ സപ്ലയർ</span>
              </button>
            </div>
          </>
        )}

        {/* Tab 2: Add New Seller Form */}
        {activeTab === 'create' && (
          <form onSubmit={handleCreateSeller} className="p-4 overflow-y-auto flex flex-col gap-3 flex-1">
            {formError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 text-xs font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span>{formError}</span>
              </div>
            )}

            {/* Name English */}
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                Seller Name (English) * / പേര്
              </label>
              <input
                type="text"
                placeholder="e.g. M.P. Suresh"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 border border-surface-container"
                required
              />
            </div>

            {/* Name Malayalam */}
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                Name (Malayalam) / മലയാളം പേര്
              </label>
              <input
                type="text"
                placeholder="e.g. സുരേഷ്"
                value={newNameMl}
                onChange={(e) => setNewNameMl(e.target.value)}
                className="w-full h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 border border-surface-container"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                Mobile Number * / മൊബൈൽ നമ്പർ
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-xs font-bold text-on-surface-variant">+91</span>
                <input
                  type="tel"
                  placeholder="98471 23456"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full h-11 pl-12 pr-3 rounded-lg bg-surface-container-low text-on-surface font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 border border-surface-container"
                  required
                />
              </div>
            </div>

            {/* Seller Type Selector */}
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                Seller Category / വിഭാഗം
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  'Local Collector',
                  'Commercial / Factory',
                  'Demolition Contractor',
                  'Walk-in Seller',
                ].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setNewType(type)}
                    className={`h-10 px-2.5 rounded-lg text-xs font-bold text-left transition-all border cursor-pointer ${
                      newType === type
                        ? 'bg-primary text-on-primary border-primary shadow-sm'
                        : 'bg-surface-container-low text-on-surface border-surface-container hover:bg-surface-container'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Vehicle Number (Optional) */}
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                Vehicle Registration (Optional) / വണ്ടി നമ്പർ
              </label>
              <input
                type="text"
                placeholder="e.g. KL-07-CR-4412"
                value={newVehicle}
                onChange={(e) => setNewVehicle(e.target.value.toUpperCase())}
                className="w-full h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 border border-surface-container uppercase"
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="submit"
                disabled={isSaving}
                className="w-full h-12 bg-primary text-on-primary rounded-xl font-label-bold text-label-bold flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">check</span>
                <span>{isSaving ? 'CREATING SELLER...' : 'SAVE & SELECT SELLER'}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className="w-full h-10 text-on-surface-variant text-xs font-bold hover:text-on-surface cursor-pointer"
              >
                Cancel and back to list
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
