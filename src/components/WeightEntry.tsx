import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Header } from './Header';
import { TicketItem, LegacyMaterialCompat } from '../types';

export const WeightEntry: React.FC = () => {
  const {
    navigateTo,
    goBack,
    activeMaterial,
    allMaterials,
    ticketItems,
    addTicketItem,
    selectedMaterialIds,
    toggleMaterialSelection,
    setActiveMaterial,
    updateTodayRate,
  } = useApp();

  const currentMaterial: LegacyMaterialCompat =
    activeMaterial || (allMaterials.length > 4 ? allMaterials[4] : allMaterials[0]) || {
      id: 'mat_paper_occ',
      name: 'Atta',
      nameMl: 'അട്ട',
      gradeEn: 'അട്ട കാർഡ്ബോർഡ്',
      standardB2BTerm: 'OCC - Old Corrugated Containers',
      rate: 18,
      category: 'paper',
      accentColor: 'secondary',
      icon: 'inventory_2',
      defaultTare: 1.5,
      keywords: [],
      rawMaterial: {} as any,
      rawAlias: {} as any,
      rawRate: {} as any,
    };

  const [rate, setRate] = useState<number>(currentMaterial.rate);
  const [tareActive, setTareActive] = useState<boolean>(true);
  const [tareWeight, setTareWeight] = useState<number>(currentMaterial.defaultTare || 1.5);
  const [grossInput, setGrossInput] = useState<string>('44.00');
  const [isCommitted, setIsCommitted] = useState<boolean>(false);
  const [editingRate, setEditingRate] = useState<boolean>(false);
  const [customRateInput, setCustomRateInput] = useState<string>(String(currentMaterial.rate));

  useEffect(() => {
    setRate(currentMaterial.rate);
    setTareWeight(currentMaterial.defaultTare || 1.5);
    setCustomRateInput(String(currentMaterial.rate));
  }, [currentMaterial]);

  // Calculations
  const gross = parseFloat(grossInput) || 0;
  const currentTare = tareActive ? tareWeight : 0.0;
  const net = Math.max(0, gross - currentTare);
  const total = net * rate;

  const handleKeypad = (digit: string) => {
    if (digit === '.') {
      if (grossInput.includes('.')) return;
      setGrossInput((prev) => (prev === '' ? '0.' : prev + '.'));
    } else {
      if (grossInput === '0' || grossInput === '44.00') {
        setGrossInput(digit);
      } else {
        const parts = grossInput.split('.');
        if (parts.length > 1 && parts[1].length >= 2) return;
        if (grossInput.length >= 7) return;
        setGrossInput((prev) => prev + digit);
      }
    }
  };

  const handleBackspace = () => {
    if (grossInput.length <= 1) {
      setGrossInput('0');
    } else {
      setGrossInput((prev) => prev.slice(0, -1));
    }
  };

  const addPreset = (val: number) => {
    const currentVal = parseFloat(grossInput) || 0;
    setGrossInput((currentVal + val).toFixed(2));
  };

  const resetWeight = () => {
    setGrossInput('0.00');
  };

  const toggleTare = () => {
    setTareActive((prev) => !prev);
  };

  const handleEditRateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(customRateInput);
    if (!isNaN(parsed) && parsed > 0) {
      setRate(parsed);
      await updateTodayRate(currentMaterial.id, parsed);
    }
    setEditingRate(false);
  };

  // Build the ticket item with scale metadata snapshot
  const buildCurrentItem = (): TicketItem => ({
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    purchaseId: '',
    materialId: currentMaterial.id,
    materialAliasId: currentMaterial.rawAlias?.id || currentMaterial.id,
    materialNameSnapshot: currentMaterial.name,
    materialMlSnapshot: currentMaterial.nameMl,
    standardB2BTermSnapshot: currentMaterial.standardB2BTerm,
    grossWeight: gross,
    tareWeight: currentTare,
    netWeight: net,
    ratePerKg: rate, // price snapshot locked
    lineAmount: total,
    weightSource: 'SIMULATED_SCALE',
    scaleDeviceId: 'CAS-CI-2001-YARD02',
    rawWeight: gross,
    tareActive,
    material: currentMaterial,
    total,
    createdAt: new Date().toISOString(),
  });

  const handleCommitAndProceed = () => {
    setIsCommitted(true);
    const item = buildCurrentItem();
    addTicketItem(item);

    // If more materials were multi-selected, queue up the next material
    const remainingIds = Array.from(selectedMaterialIds).filter((id) => id !== currentMaterial.id);
    if (remainingIds.length > 0) {
      toggleMaterialSelection(currentMaterial.id);
      const nextMat = allMaterials.find((m) => m.id === remainingIds[0]);
      if (nextMat) {
        setTimeout(() => {
          setActiveMaterial(nextMat);
          setRate(nextMat.rate);
          setTareWeight(nextMat.defaultTare);
          setGrossInput('35.00');
          setIsCommitted(false);
        }, 500);
        return;
      }
    }

    setTimeout(() => {
      navigateTo('payment');
    }, 500);
  };

  const handleAddAnotherMaterial = () => {
    const item = buildCurrentItem();
    addTicketItem(item);
    toggleMaterialSelection(currentMaterial.id);
    navigateTo('material_selection');
  };

  return (
    <div className="bg-surface font-body-md text-body-md text-on-surface flex flex-col min-h-screen">
      <Header showBack onBack={goBack} title="New Weighment" />

      <main className="flex flex-col relative w-full max-w-lg mx-auto px-space-md pt-24 pb-safe bg-surface flex-1">
        <div className="flex flex-col w-full pb-6 space-y-3">
          {/* Step 2 Progress Bar */}
          <div className="bg-surface-container-low px-space-md py-space-sm rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-on-primary font-label-bold text-label-bold flex items-center justify-center">
                  2
                </span>
                <span className="font-label-bold text-label-bold text-primary">
                  Step 2 of 3: Weight Capture
                </span>
              </div>
              <span className="font-label-caption text-label-caption text-on-surface-variant font-bold uppercase tracking-wider">
                ഡിജിറ്റൽ സ്കെയിൽ
              </span>
            </div>
            <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
              <div className="bg-primary h-full w-2/3 rounded-full transition-all duration-300"></div>
            </div>
          </div>

          {/* Hardware Scale Status Banner */}
          <div className="flex items-center justify-between bg-surface-container-lowest px-space-md py-space-sm rounded-xl shadow-sm">
            <div className="flex items-center space-x-2">
              <div className="relative flex items-center justify-center">
                <span className="w-3 h-3 rounded-full bg-tertiary-fixed-dim"></span>
                <span className="absolute w-3 h-3 rounded-full bg-tertiary-fixed-dim animate-ping opacity-75"></span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center space-x-1.5">
                  <span className="material-symbols-outlined text-[18px] text-tertiary">
                    scale
                  </span>
                  <span className="font-label-bold text-label-bold text-on-surface">
                    CAS CI-2001 Live
                  </span>
                </div>
                <span className="font-label-caption text-label-caption text-on-surface-variant">
                  Bluetooth Yard Port 02 • Synced
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-1 bg-surface-container px-2.5 py-1 rounded-full">
              <span
                className="material-symbols-outlined text-[16px] text-tertiary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
              <span className="font-label-caption text-label-caption text-on-surface uppercase tracking-wider font-bold">
                Stable
              </span>
            </div>
          </div>

          {/* Material & Yard Rate Summary Card */}
          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-xl bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed flex-shrink-0 shadow-sm">
                  <span className="material-symbols-outlined text-[26px]">
                    {currentMaterial.icon}
                  </span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center space-x-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-caption text-label-caption uppercase tracking-wider">
                      {currentMaterial.category === 'metals'
                        ? 'Metal / ലോഹം'
                        : currentMaterial.category === 'paper'
                        ? 'Paper / Cardboard'
                        : 'Plastic / പ്ലാസ്റ്റിക്'}
                    </span>
                  </div>
                  <h2 className="font-title-lg text-title-lg text-on-surface font-extrabold flex items-center gap-1.5 leading-tight">
                    {currentMaterial.name} /{' '}
                    <span className="text-primary font-bold">{currentMaterial.nameMl}</span>
                  </h2>
                  <span className="font-body-sm text-body-sm text-on-surface-variant" title={currentMaterial.standardB2BTerm}>
                    {currentMaterial.gradeEn}
                  </span>
                </div>
              </div>

              {/* Rate Badge & Quick Edit */}
              <button
                aria-label="Edit Rate"
                className="flex flex-col items-end bg-surface-container-low hover:bg-surface-container p-2 rounded-lg transition-colors text-right cursor-pointer"
                type="button"
                onClick={() => setEditingRate(true)}
              >
                <span className="font-label-caption text-label-caption text-on-surface-variant">
                  Yard Rate
                </span>
                <div className="flex items-center space-x-1">
                  <span className="font-title-md text-title-md text-primary font-bold">
                    ₹{rate.toFixed(2)}
                  </span>
                  <span className="font-label-caption text-label-caption text-on-surface-variant">
                    /KG
                  </span>
                  <span className="material-symbols-outlined text-[16px] text-outline">edit</span>
                </div>
              </button>
            </div>

            {/* Inline Rate Edit Popover if opened */}
            {editingRate && (
              <form
                onSubmit={handleEditRateSubmit}
                className="bg-surface-container p-3 rounded-lg flex items-center gap-2"
              >
                <span className="text-xs font-bold text-on-surface">New Rate (₹/KG):</span>
                <input
                  type="number"
                  step="0.5"
                  className="w-24 px-2 py-1 bg-surface-container-lowest border rounded text-sm font-bold text-primary"
                  value={customRateInput}
                  onChange={(e) => setCustomRateInput(e.target.value)}
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-3 py-1 bg-primary text-white text-xs font-bold rounded cursor-pointer"
                >
                  Save
                </button>
                <button
                  type="button"
                  className="px-2 py-1 text-xs text-on-surface-variant cursor-pointer"
                  onClick={() => setEditingRate(false)}
                >
                  Cancel
                </button>
              </form>
            )}

            {/* Tare / Deductions Allowance Toggle */}
            <div className="flex items-center justify-between pt-1">
              <button
                className="w-full flex items-center justify-between px-3 py-2 bg-surface-container-high hover:bg-surface-container-highest rounded-lg text-on-surface transition-all active:scale-[0.98] cursor-pointer"
                type="button"
                onClick={toggleTare}
              >
                <div className="flex items-center space-x-2">
                  <span className="material-symbols-outlined text-[18px] text-secondary">
                    shopping_bag
                  </span>
                  <span className="font-label-bold text-label-bold text-on-surface">
                    -{tareWeight.toFixed(2)} KG Standard Gunny Tare
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded font-label-caption text-label-caption uppercase tracking-wider font-bold transition-colors ${
                    tareActive
                      ? 'bg-tertiary-container text-on-tertiary-container'
                      : 'bg-surface-container-highest text-on-surface-variant'
                  }`}
                >
                  {tareActive ? 'Active' : 'Bypassed'}
                </span>
              </button>
            </div>
          </div>

          {/* Giant Weighbridge Digital Readout */}
          <div className="bg-surface-container-lowest rounded-xl shadow-md flex flex-col items-center justify-center relative overflow-hidden border border-outline-variant/30">
            <div className="w-full flex items-center justify-between px-space-md pt-space-sm">
              <div className="flex items-center space-x-1 text-on-surface-variant">
                <span className="material-symbols-outlined text-[18px]">straighten</span>
                <span className="font-label-bold text-label-bold">NET WEIGHT</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-secondary-container"></span>
                <span className="font-label-caption text-label-caption text-on-surface-variant font-bold uppercase">
                  Yard Digital #01
                </span>
              </div>
            </div>

            {/* Massive Numbers for Sun-Legibility & Field Work */}
            <div className="my-2 flex items-baseline justify-center space-x-2 select-none">
              <span className="font-headline-xl text-primary font-black tracking-tight text-[54px] leading-none tabular-nums">
                {net.toFixed(2)}
              </span>
              <span className="font-headline-md text-headline-md text-on-surface-variant font-extrabold tracking-wide">
                KG
              </span>
            </div>

            {/* Weight Breakdown Ledger Ticker */}
            <div className="w-full grid grid-cols-3 gap-2 px-space-md pb-space-sm pt-2 bg-surface-container-low rounded-b-xl text-center">
              <div className="flex flex-col">
                <span className="font-label-caption text-label-caption text-on-surface-variant uppercase">
                  Gross Scale
                </span>
                <span className="font-label-bold text-label-bold text-on-surface tabular-nums">
                  {gross.toFixed(2)} KG
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-caption text-label-caption text-on-surface-variant uppercase">
                  Tare Bag
                </span>
                <span className="font-label-bold text-label-bold text-error tabular-nums">
                  {currentTare.toFixed(2)} KG
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-caption text-label-caption text-on-surface-variant uppercase font-bold text-primary">
                  Final Net
                </span>
                <span className="font-label-bold text-label-bold text-primary font-extrabold tabular-nums">
                  {net.toFixed(2)} KG
                </span>
              </div>
            </div>
          </div>

          {/* Live Dynamic Price Banner */}
          <div className="bg-primary-container text-on-primary-container p-space-md rounded-xl shadow-sm flex items-center justify-between relative overflow-hidden">
            <div className="flex flex-col z-10">
              <div className="flex items-center space-x-1 text-primary-fixed-dim">
                <span className="material-symbols-outlined text-[16px]">calculate</span>
                <span className="font-label-caption text-label-caption uppercase tracking-wider font-bold">
                  Spot Valuation
                </span>
              </div>
              <span className="font-body-md text-body-md text-on-primary font-medium tracking-tight">
                {net.toFixed(2)} KG × ₹{rate.toFixed(2)}/kg
              </span>
            </div>
            <div className="flex flex-col items-end z-10">
              <span className="font-label-caption text-label-caption text-primary-fixed-dim uppercase tracking-wider font-bold">
                Total Payout
              </span>
              <span className="font-headline-lg text-headline-lg text-on-primary font-black tracking-tight tabular-nums">
                ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            {/* Soft Watermark Accent Icon */}
            <span className="material-symbols-outlined absolute -right-3 -bottom-5 text-[92px] text-white/10 pointer-events-none select-none">
              payments
            </span>
          </div>

          {/* Quick Weight Helper Chips */}
          <div className="grid grid-cols-4 gap-2 pt-1">
            <button
              className="h-11 bg-surface-container hover:bg-surface-container-high active:bg-surface-container-highest text-on-surface font-title-md text-title-md rounded-lg flex items-center justify-center font-bold shadow-sm transition-transform active:scale-95 cursor-pointer"
              type="button"
              onClick={() => addPreset(5)}
            >
              +5 KG
            </button>
            <button
              className="h-11 bg-surface-container hover:bg-surface-container-high active:bg-surface-container-highest text-on-surface font-title-md text-title-md rounded-lg flex items-center justify-center font-bold shadow-sm transition-transform active:scale-95 cursor-pointer"
              type="button"
              onClick={() => addPreset(10)}
            >
              +10 KG
            </button>
            <button
              className="h-11 bg-surface-container hover:bg-surface-container-high active:bg-surface-container-highest text-on-surface font-title-md text-title-md rounded-lg flex items-center justify-center font-bold shadow-sm transition-transform active:scale-95 cursor-pointer"
              type="button"
              onClick={() => addPreset(50)}
            >
              +50 KG
            </button>
            <button
              className="h-11 bg-secondary-fixed hover:bg-secondary-fixed-dim text-on-secondary-fixed font-label-bold text-label-bold rounded-lg flex items-center justify-center font-bold shadow-sm transition-transform active:scale-95 cursor-pointer"
              type="button"
              onClick={resetWeight}
            >
              Zero Tare
            </button>
          </div>

          {/* Giant High-Tactile Numeric Keypad (Ergonomic for Yard Gloves) */}
          <div className="bg-surface-container-lowest p-space-sm rounded-xl shadow-md select-none border border-outline-variant/30">
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  className="h-14 bg-surface-container-low active:bg-surface-container-highest text-on-surface rounded-lg font-headline-md text-headline-md font-bold flex items-center justify-center shadow-sm active:translate-y-0.5 transition-all cursor-pointer"
                  type="button"
                  onClick={() => handleKeypad(digit)}
                >
                  {digit}
                </button>
              ))}

              <button
                className="h-14 bg-surface-container-high active:bg-surface-container-highest text-on-surface rounded-lg font-headline-lg text-headline-lg font-bold flex items-center justify-center shadow-sm active:translate-y-0.5 transition-all cursor-pointer"
                type="button"
                onClick={() => handleKeypad('.')}
              >
                .
              </button>

              <button
                className="h-14 bg-surface-container-low active:bg-surface-container-highest text-on-surface rounded-lg font-headline-md text-headline-md font-bold flex items-center justify-center shadow-sm active:translate-y-0.5 transition-all cursor-pointer"
                type="button"
                onClick={() => handleKeypad('0')}
              >
                0
              </button>

              <button
                aria-label="Backspace"
                className="h-14 bg-surface-container-high active:bg-error-container text-error rounded-lg flex items-center justify-center shadow-sm active:translate-y-0.5 transition-all cursor-pointer"
                type="button"
                onClick={handleBackspace}
              >
                <span className="material-symbols-outlined text-[28px]">backspace</span>
              </button>
            </div>
          </div>

          {/* Existing Ticket Lots if any */}
          {ticketItems.length > 0 && (
            <div className="bg-surface-container-low p-3 rounded-xl border border-surface-container-high flex flex-col gap-1.5">
              <span className="font-label-bold text-label-bold text-on-surface flex items-center justify-between">
                <span>Already Weighed in this Ticket ({ticketItems.length})</span>
                <span className="text-primary font-bold">
                  ₹{ticketItems.reduce((a, b) => a + b.total, 0).toLocaleString('en-IN')}
                </span>
              </span>
              {ticketItems.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="flex items-center justify-between text-xs text-on-surface-variant bg-surface-container-lowest p-2 rounded"
                >
                  <span>
                    #{idx + 1} {item.material.name} ({item.netWeight.toFixed(2)} KG)
                  </span>
                  <span className="font-bold text-on-surface">₹{Math.round(item.total)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Sticky Pinned Fieldwork CTA Bar */}
          <div className="pt-2">
            <div className="flex items-center space-x-2">
              {/* Add Next Material Row */}
              <button
                aria-label="Add Next Item"
                className="h-14 px-3 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-title-md text-title-md rounded-xl flex items-center justify-center flex-shrink-0 font-bold active:scale-95 transition-all shadow-sm cursor-pointer"
                type="button"
                title="Add another material to slip"
                onClick={handleAddAnotherMaterial}
              >
                <span className="material-symbols-outlined text-[24px]">playlist_add</span>
              </button>

              {/* Giant Primary Confirm Ticket Button */}
              <button
                className={`h-14 flex-1 text-on-primary font-title-lg text-title-lg font-black rounded-xl flex items-center justify-between px-space-md shadow-md active:scale-[0.98] transition-all cursor-pointer ${
                  isCommitted ? 'bg-tertiary' : 'bg-primary hover:bg-primary-container'
                }`}
                type="button"
                onClick={handleCommitAndProceed}
              >
                {isCommitted ? (
                  <span className="flex items-center space-x-2 mx-auto">
                    <span className="material-symbols-outlined text-[24px]">done_all</span>
                    <span>RECORDED IN TICKET</span>
                  </span>
                ) : (
                  <>
                    <span className="flex items-center space-x-1">
                      <span>ADD ENTRY</span>
                      <span className="font-normal text-primary-fixed-dim text-body-sm">
                        (ചേർക്കുക)
                      </span>
                    </span>
                    <div className="flex items-center space-x-1">
                      <span>₹{Math.round(total).toLocaleString('en-IN')}</span>
                      <span className="material-symbols-outlined text-[22px]">arrow_forward</span>
                    </div>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
