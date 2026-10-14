import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Header } from './Header';
import { PaymentMode, TicketItem } from '../types';
import confetti from 'canvas-confetti';

export const PaymentSettlement: React.FC = () => {
  const {
    goBack,
    ticketItems,
    activeMaterial,
    activeSeller,
    sellerLedger,
    setIsSellerPickerOpen,
    completePurchase,
    setViewingSlip,
    clearTicket,
    allMaterials,
  } = useApp();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMode>('CASH');
  const [showItemDetails, setShowItemDetails] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Split payment allocations
  const [splitCash, setSplitCash] = useState<number>(0);
  const [splitUpi, setSplitUpi] = useState<number>(0);
  const [splitCredit, setSplitCredit] = useState<number>(0);
  const [splitBank, setSplitBank] = useState<number>(0);

  // Fallback default lots if navigated directly
  const finalLots: TicketItem[] = useMemo(() => {
    if (ticketItems.length > 0) {
      return ticketItems;
    }
    const mat1 = activeMaterial || allMaterials[4] || allMaterials[0];
    const mat2 = allMaterials[0];
    return [
      {
        id: 'lot_init_1',
        purchaseId: '',
        materialId: mat1?.id || 'mat_paper_occ',
        materialAliasId: mat1?.rawAlias?.id || 'alias_atta',
        materialNameSnapshot: mat1?.name || 'Atta',
        materialMlSnapshot: mat1?.nameMl || 'അട്ട',
        standardB2BTermSnapshot: mat1?.standardB2BTerm || 'OCC - Old Corrugated Containers',
        grossWeight: 44.0,
        tareWeight: 1.5,
        tareActive: true,
        netWeight: 42.5,
        ratePerKg: mat1?.rate || 18,
        lineAmount: (42.5) * (mat1?.rate || 18),
        weightSource: 'SIMULATED_SCALE',
        scaleDeviceId: 'CAS-CI-2001-YARD02',
        material: mat1,
        total: (42.5) * (mat1?.rate || 18),
        createdAt: new Date().toISOString(),
      },
      {
        id: 'lot_init_2',
        purchaseId: '',
        materialId: mat2?.id || 'mat_iron_hms',
        materialAliasId: mat2?.rawAlias?.id || 'alias_irumbu',
        materialNameSnapshot: mat2?.name || 'Irumbu',
        materialMlSnapshot: mat2?.nameMl || 'ഇരുമ്പ്',
        standardB2BTermSnapshot: mat2?.standardB2BTerm || 'Heavy Melting Scrap / TMT Rebar',
        grossWeight: 30.0,
        tareWeight: 2.0,
        tareActive: true,
        netWeight: 28.0,
        ratePerKg: mat2?.rate || 32,
        lineAmount: (28.0) * (mat2?.rate || 32),
        weightSource: 'SIMULATED_SCALE',
        scaleDeviceId: 'CAS-CI-2001-YARD02',
        material: mat2,
        total: (28.0) * (mat2?.rate || 32),
        createdAt: new Date().toISOString(),
      },
    ];
  }, [ticketItems, activeMaterial, allMaterials]);

  const totalWeight = finalLots.reduce((acc, it) => acc + it.netWeight, 0);
  const totalAmount = Math.round(finalLots.reduce((acc, it) => acc + it.total, 0));

  // Cash denomination assistant calculation
  const denominations = useMemo(() => {
    let rem = totalAmount;
    const d500 = Math.floor(rem / 500);
    rem %= 500;
    const d100 = Math.floor(rem / 100);
    rem %= 100;
    const d50 = Math.floor(rem / 50);
    rem %= 50;
    const d10 = Math.floor(rem / 10);
    rem %= 10;
    const d1 = rem;

    return [
      { label: '₹500', count: d500, total: d500 * 500 },
      { label: '₹100', count: d100, total: d100 * 100 },
      { label: '₹50', count: d50, total: d50 * 50 },
      { label: '₹10', count: d10, total: d10 * 10 },
      { label: '₹1', count: d1, total: d1 * 1 },
    ];
  }, [totalAmount]);

  const allocatedTotal = splitCash + splitUpi + splitCredit + splitBank;
  const remainingSplit = totalAmount - allocatedTotal;

  const handleSelectMethod = (method: PaymentMode) => {
    setSelectedMethod(method);
    if (method === 'SPLIT' && splitCash === 0 && splitUpi === 0 && splitCredit === 0 && splitBank === 0) {
      setSplitCash(totalAmount);
    }
  };

  const handleComplete = async (isDraft = false) => {
    if (selectedMethod === 'SPLIT' && !isDraft) {
      if (remainingSplit !== 0) {
        alert(
          remainingSplit > 0
            ? `Please allocate the remaining ₹${remainingSplit.toLocaleString('en-IN')}`
            : `Split amounts exceed total by ₹${Math.abs(remainingSplit).toLocaleString('en-IN')}`
        );
        return;
      }
    }

    setIsProcessing(true);

    try {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.8 },
      });
    } catch {
      // safe fallback
    }

    const breakdown =
      selectedMethod === 'SPLIT'
        ? [
            { mode: 'CASH' as PaymentMode, amount: splitCash },
            { mode: 'UPI' as PaymentMode, amount: splitUpi },
            { mode: 'CREDIT' as PaymentMode, amount: splitCredit },
            { mode: 'BANK_TRANSFER' as PaymentMode, amount: splitBank },
          ].filter((s) => s.amount > 0)
        : undefined;

    const createdSlip = await completePurchase(selectedMethod, isDraft, breakdown);
    clearTicket();
    setIsProcessing(false);
    setViewingSlip(createdSlip);
  };

  const currentOutstanding = sellerLedger?.outstandingBalance || 0;

  return (
    <div className="bg-surface font-body-md text-body-md text-on-surface flex flex-col min-h-screen">
      <Header showBack onBack={goBack} title="New Weighment" />

      <main className="flex flex-col relative w-full max-w-lg mx-auto px-space-md pt-24 pb-safe bg-surface flex-1">
        <div className="flex flex-col w-full pb-36">
          {/* Step 3 Progress Bar */}
          <div className="bg-surface-container-low px-space-md py-space-sm rounded-xl mb-space-sm shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-on-primary font-label-bold text-label-bold flex items-center justify-center">
                  3
                </span>
                <span className="font-label-bold text-label-bold text-primary">
                  Step 3 of 3: Payment & Settlement
                </span>
              </div>
              <span className="font-label-caption text-label-caption text-on-surface-variant font-bold uppercase tracking-wider">
                പണം നൽകൽ
              </span>
            </div>
            <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
              <div className="bg-primary h-full w-full rounded-full transition-all duration-300"></div>
            </div>
          </div>

          {/* Top Meta Strip */}
          <div className="flex items-center justify-between py-2 px-1">
            <div className="flex items-center gap-1.5 bg-surface-container px-2.5 py-1 rounded-full">
              <span className="material-symbols-outlined text-primary text-[16px]">receipt_long</span>
              <span className="font-label-caption text-label-caption text-on-surface uppercase tracking-wider font-bold">
                Slip Generation Ready
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-tertiary-container text-on-tertiary-container px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary-fixed animate-pulse"></span>
              <span className="font-label-caption text-label-caption font-bold">
                Scale Synced • Live
              </span>
            </div>
          </div>

          {/* Seller Profile Card */}
          <div className="mt-2 bg-surface-container-lowest rounded-xl p-4 shadow-sm flex flex-col gap-3 border border-outline-variant/20">
            <div className="flex items-start justify-between">
              <div
                className="flex items-center gap-3 cursor-pointer group"
                onClick={() => setIsSellerPickerOpen(true)}
              >
                <div className="w-12 h-12 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed font-title-lg text-title-lg font-bold shadow-inner">
                  {activeSeller.initials}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <h2 className="font-title-md text-title-md text-on-surface font-bold">
                      {activeSeller.name}
                    </h2>
                    <span className="font-body-sm text-body-sm text-on-surface-variant font-normal">
                      ({activeSeller.nameMl})
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">call</span>
                    {activeSeller.phone}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                <span className="bg-secondary-fixed text-on-secondary-fixed px-2.5 py-0.5 rounded-full font-label-caption text-label-caption uppercase tracking-wide font-bold">
                  {activeSeller.badge}
                </span>
                <button
                  className="text-xs text-primary font-bold hover:underline cursor-pointer"
                  onClick={() => setIsSellerPickerOpen(true)}
                  type="button"
                >
                  Change
                </button>
              </div>
            </div>

            {/* Items Sub-summary */}
            <div className="bg-surface-container-low rounded-lg p-3 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span className="font-label-bold text-label-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px] text-primary">scale</span>
                  {finalLots.length} Weighed {finalLots.length === 1 ? 'Lot' : 'Lots'} ({totalWeight.toFixed(2)} KG Total)
                </span>
                <button
                  className="font-label-caption text-label-caption text-primary cursor-pointer underline font-bold"
                  type="button"
                  onClick={() => setShowItemDetails(!showItemDetails)}
                >
                  {showItemDetails ? 'Hide Details' : 'View Details'}
                </button>
              </div>

              {finalLots.map((lot, idx) => (
                <div
                  key={lot.id || idx}
                  className="flex items-center justify-between font-body-sm text-body-sm pt-1"
                >
                  <span className="text-on-surface">
                    {lot.materialNameSnapshot || lot.material.name} ({lot.materialMlSnapshot || lot.material.nameMl}) {lot.netWeight.toFixed(2)} KG
                  </span>
                  <span className="font-label-bold text-label-bold text-on-surface">
                    ₹{Math.round(lot.total || lot.lineAmount).toLocaleString('en-IN')}
                  </span>
                </div>
              ))}

              {showItemDetails && (
                <div className="mt-2 pt-2 border-t border-surface-container text-xs text-on-surface-variant flex flex-col gap-1">
                  {finalLots.map((lot, idx) => (
                    <div key={`detail_${idx}`} className="flex justify-between">
                      <span>
                        Lot #{idx + 1}: Gross {lot.grossWeight.toFixed(2)} KG - Tare {lot.tareWeight.toFixed(2)} KG
                      </span>
                      <span>Rate: ₹{lot.ratePerKg.toFixed(2)}/KG</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Grand Total Hero Card */}
          <div className="mt-4 bg-primary text-on-primary rounded-xl p-5 shadow-md relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-primary-container rounded-full opacity-30 pointer-events-none"></div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-label-bold text-label-bold text-primary-fixed-dim uppercase tracking-wider">
                  Total Payable / നൽകേണ്ട തുക
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="font-label-numeric-lg text-label-numeric-lg text-on-primary">
                    ₹{totalAmount.toLocaleString('en-IN')}
                  </span>
                  <span className="font-body-sm text-body-sm text-primary-fixed-dim">
                    INR
                  </span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary-container flex items-center justify-center text-on-primary-container shadow-inner">
                <span className="material-symbols-outlined text-[28px]">payments</span>
              </div>
            </div>

            {/* Collapsible Financial Micro-breakdown */}
            <div className="mt-4 pt-3 bg-primary-fixed-variant/40 rounded-lg p-2.5 flex items-center justify-between font-body-sm text-body-sm text-primary-fixed">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">info</span>
                Gross: ₹{totalAmount.toLocaleString('en-IN')}
              </span>
              <span>•</span>
              <span>Round off: ₹0</span>
              <span>•</span>
              <span>TDS: Nil</span>
            </div>
          </div>

          {/* Section Title */}
          <div className="mt-6 flex items-center justify-between">
            <h3 className="font-title-md text-title-md text-on-surface font-bold">
              Payment Method / പണം നൽകുന്ന രീതി
            </h3>
            <span className="font-label-caption text-label-caption text-on-surface-variant uppercase tracking-wider font-bold">
              Touch to Select
            </span>
          </div>

          {/* Selectable Payment Method Cards */}
          <div className="mt-3 flex flex-col gap-2.5" id="paymentMethodList">
            {/* Option 1: Cash */}
            <div
              className={`payment-card rounded-xl p-4 shadow-sm cursor-pointer transition-all border ${
                selectedMethod === 'CASH'
                  ? 'bg-surface-container-high ring-2 ring-primary border-primary'
                  : 'bg-surface-container-lowest border-transparent hover:border-surface-container'
              }`}
              onClick={() => handleSelectMethod('CASH')}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                    selectedMethod === 'CASH'
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-[24px]">point_of_sale</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-title-md text-title-md text-on-surface font-bold">
                      Cash / നേരിട്ട് പണം
                    </h4>
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                        selectedMethod === 'CASH' ? 'bg-primary' : 'bg-surface-container-highest'
                      }`}
                    >
                      {selectedMethod === 'CASH' ? (
                        <span className="w-2 h-2 rounded-full bg-on-primary"></span>
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-transparent"></span>
                      )}
                    </div>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                    Instant Cash from Register Drawer
                  </p>
                  <div className="mt-2 inline-flex items-center gap-1.5 bg-surface-container px-2 py-0.5 rounded text-tertiary font-label-bold text-label-bold">
                    <span className="material-symbols-outlined text-[14px]">
                      account_balance_wallet
                    </span>
                    Drawer Balance: ₹42,500
                  </div>
                </div>
              </div>
            </div>

            {/* Option 2: UPI */}
            <div
              className={`payment-card rounded-xl p-4 shadow-sm cursor-pointer transition-all border ${
                selectedMethod === 'UPI'
                  ? 'bg-surface-container-high ring-2 ring-primary border-primary'
                  : 'bg-surface-container-lowest border-transparent hover:border-surface-container'
              }`}
              onClick={() => handleSelectMethod('UPI')}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                    selectedMethod === 'UPI'
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-[24px]">qr_code_scanner</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-title-md text-title-md text-on-surface font-bold">
                      UPI / ഗൂഗിൾ പേ
                    </h4>
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                        selectedMethod === 'UPI' ? 'bg-primary' : 'bg-surface-container-highest'
                      }`}
                    >
                      {selectedMethod === 'UPI' ? (
                        <span className="w-2 h-2 rounded-full bg-on-primary"></span>
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-transparent"></span>
                      )}
                    </div>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                    Scan Seller QR or PhonePe / GPay
                  </p>
                  <p className="font-label-bold text-label-bold text-primary mt-1 truncate">
                    {activeSeller.phone} ({activeSeller.upiId})
                  </p>
                </div>
              </div>
            </div>

            {/* Option 3: Bank Transfer */}
            <div
              className={`payment-card rounded-xl p-4 shadow-sm cursor-pointer transition-all border ${
                selectedMethod === 'BANK_TRANSFER'
                  ? 'bg-surface-container-high ring-2 ring-primary border-primary'
                  : 'bg-surface-container-lowest border-transparent hover:border-surface-container'
              }`}
              onClick={() => handleSelectMethod('BANK_TRANSFER')}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                    selectedMethod === 'BANK_TRANSFER'
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-[24px]">account_balance</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-title-md text-title-md text-on-surface font-bold">
                      Bank Transfer / NEFT
                    </h4>
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                        selectedMethod === 'BANK_TRANSFER' ? 'bg-primary' : 'bg-surface-container-highest'
                      }`}
                    >
                      {selectedMethod === 'BANK_TRANSFER' ? (
                        <span className="w-2 h-2 rounded-full bg-on-primary"></span>
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-transparent"></span>
                      )}
                    </div>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                    {activeSeller.bankName} A/C {activeSeller.bankAccount}
                  </p>
                  <span className="font-label-caption text-label-caption text-on-surface-variant mt-0.5">
                    IFSC: {activeSeller.ifsc}
                  </span>
                </div>
              </div>
            </div>

            {/* Option 4: Credit / Add to Ledger */}
            <div
              className={`payment-card rounded-xl p-4 shadow-sm cursor-pointer transition-all border ${
                selectedMethod === 'CREDIT'
                  ? 'bg-surface-container-high ring-2 ring-primary border-primary'
                  : 'bg-surface-container-lowest border-transparent hover:border-surface-container'
              }`}
              onClick={() => handleSelectMethod('CREDIT')}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                    selectedMethod === 'CREDIT'
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-[24px]">menu_book</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-title-md text-title-md text-on-surface font-bold">
                      Credit / കടം (Add to Ledger)
                    </h4>
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                        selectedMethod === 'CREDIT' ? 'bg-primary' : 'bg-surface-container-highest'
                      }`}
                    >
                      {selectedMethod === 'CREDIT' ? (
                        <span className="w-2 h-2 rounded-full bg-on-primary"></span>
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-transparent"></span>
                      )}
                    </div>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                    Current Outstanding: ₹{currentOutstanding.toLocaleString('en-IN')}
                  </p>
                  <div className="mt-1.5 flex items-center gap-1 font-label-bold text-label-bold text-secondary">
                    <span>
                      New Ledger Total: ₹
                      {(currentOutstanding + totalAmount).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Option 5: Split Payment */}
            <div
              className={`payment-card rounded-xl p-4 shadow-sm cursor-pointer transition-all border ${
                selectedMethod === 'SPLIT'
                  ? 'bg-surface-container-high ring-2 ring-primary border-primary'
                  : 'bg-surface-container-lowest border-transparent hover:border-surface-container'
              }`}
              onClick={() => handleSelectMethod('SPLIT')}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                    selectedMethod === 'SPLIT'
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-[24px]">call_split</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-title-md text-title-md text-on-surface font-bold">
                      Split Payment / വിഭജനം
                    </h4>
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                        selectedMethod === 'SPLIT' ? 'bg-primary' : 'bg-surface-container-highest'
                      }`}
                    >
                      {selectedMethod === 'SPLIT' ? (
                        <span className="w-2 h-2 rounded-full bg-on-primary"></span>
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-transparent"></span>
                      )}
                    </div>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                    Allocate between Cash, UPI, Ledger Credit, or Bank Transfer
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Split Payment Manager */}
          {selectedMethod === 'SPLIT' && (
            <div className="mt-4 bg-surface-container-low rounded-xl p-4 shadow-sm border border-surface-container flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">
                    pie_chart
                  </span>
                  <span className="font-title-md text-title-md text-on-surface font-bold">
                    Split Breakdown Manager
                  </span>
                </div>
                <span
                  className={`font-label-bold text-label-bold px-2 py-0.5 rounded text-xs ${
                    remainingSplit === 0
                      ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                      : 'bg-amber-500/20 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  ₹{allocatedTotal.toLocaleString('en-IN')} / ₹{totalAmount.toLocaleString('en-IN')}
                </span>
              </div>

              {/* Status Alert Indicator */}
              {remainingSplit === 0 ? (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 text-xs font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>Exact total matched (₹{totalAmount.toLocaleString('en-IN')}). Ready to confirm.</span>
                </div>
              ) : remainingSplit > 0 ? (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 text-xs font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">warning</span>
                    <span>₹{remainingSplit.toLocaleString('en-IN')} remaining to allocate</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSplitCash((prev) => prev + remainingSplit)}
                    className="text-primary font-bold underline cursor-pointer"
                  >
                    Add to Cash
                  </button>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-700 text-xs font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  <span>Exceeds total by ₹{Math.abs(remainingSplit).toLocaleString('en-IN')}</span>
                </div>
              )}

              {/* Split Rows */}
              <div className="flex flex-col gap-2.5 mt-1">
                {/* 1. Cash Split Row */}
                <div className="bg-surface-container-lowest p-3 rounded-lg border border-surface-container flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-label-bold text-label-bold flex items-center gap-1.5 text-on-surface">
                      <span className="material-symbols-outlined text-[16px] text-primary">point_of_sale</span>
                      Cash / പണം
                    </span>
                    <button
                      type="button"
                      onClick={() => setSplitCash((c) => Math.max(0, c + remainingSplit))}
                      className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                    >
                      Fill Remainder
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-2.5 text-on-surface-variant font-bold text-sm">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={splitCash || ''}
                        placeholder="0"
                        onChange={(e) => setSplitCash(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full h-10 pl-7 pr-3 rounded-lg bg-surface-container-low text-on-surface font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setSplitCash((c) => c + 500)}
                      className="h-10 px-2.5 bg-surface-container rounded-lg text-xs font-bold text-on-surface hover:bg-surface-container-high cursor-pointer"
                    >
                      +₹500
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitCash((c) => c + 1000)}
                      className="h-10 px-2.5 bg-surface-container rounded-lg text-xs font-bold text-on-surface hover:bg-surface-container-high cursor-pointer"
                    >
                      +₹1k
                    </button>
                  </div>
                </div>

                {/* 2. UPI Split Row */}
                <div className="bg-surface-container-lowest p-3 rounded-lg border border-surface-container flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-label-bold text-label-bold flex items-center gap-1.5 text-on-surface">
                      <span className="material-symbols-outlined text-[16px] text-primary">qr_code_scanner</span>
                      UPI / ഗൂഗിൾ പേ
                    </span>
                    <button
                      type="button"
                      onClick={() => setSplitUpi((u) => Math.max(0, u + remainingSplit))}
                      className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                    >
                      Fill Remainder
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-2.5 text-on-surface-variant font-bold text-sm">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={splitUpi || ''}
                        placeholder="0"
                        onChange={(e) => setSplitUpi(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full h-10 pl-7 pr-3 rounded-lg bg-surface-container-low text-on-surface font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setSplitUpi((u) => u + 500)}
                      className="h-10 px-2.5 bg-surface-container rounded-lg text-xs font-bold text-on-surface hover:bg-surface-container-high cursor-pointer"
                    >
                      +₹500
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitUpi((u) => u + 1000)}
                      className="h-10 px-2.5 bg-surface-container rounded-lg text-xs font-bold text-on-surface hover:bg-surface-container-high cursor-pointer"
                    >
                      +₹1k
                    </button>
                  </div>
                </div>

                {/* 3. Credit Split Row */}
                <div className="bg-surface-container-lowest p-3 rounded-lg border border-surface-container flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-label-bold text-label-bold flex items-center gap-1.5 text-secondary">
                      <span className="material-symbols-outlined text-[16px]">menu_book</span>
                      Credit / കടം (Ledger)
                    </span>
                    <button
                      type="button"
                      onClick={() => setSplitCredit((cr) => Math.max(0, cr + remainingSplit))}
                      className="text-[11px] font-bold text-secondary hover:underline cursor-pointer"
                    >
                      Fill Remainder
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-2.5 text-on-surface-variant font-bold text-sm">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={splitCredit || ''}
                        placeholder="0"
                        onChange={(e) => setSplitCredit(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full h-10 pl-7 pr-3 rounded-lg bg-surface-container-low text-on-surface font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setSplitCredit((cr) => cr + 500)}
                      className="h-10 px-2.5 bg-surface-container rounded-lg text-xs font-bold text-on-surface hover:bg-surface-container-high cursor-pointer"
                    >
                      +₹500
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitCredit((cr) => cr + 1000)}
                      className="h-10 px-2.5 bg-surface-container rounded-lg text-xs font-bold text-on-surface hover:bg-surface-container-high cursor-pointer"
                    >
                      +₹1k
                    </button>
                  </div>
                </div>

                {/* 4. Bank Transfer Split Row */}
                <div className="bg-surface-container-lowest p-3 rounded-lg border border-surface-container flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-label-bold text-label-bold flex items-center gap-1.5 text-on-surface">
                      <span className="material-symbols-outlined text-[16px] text-primary">account_balance</span>
                      Bank Transfer / ബാങ്ക്
                    </span>
                    <button
                      type="button"
                      onClick={() => setSplitBank((b) => Math.max(0, b + remainingSplit))}
                      className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                    >
                      Fill Remainder
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-2.5 text-on-surface-variant font-bold text-sm">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={splitBank || ''}
                        placeholder="0"
                        onChange={(e) => setSplitBank(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full h-10 pl-7 pr-3 rounded-lg bg-surface-container-low text-on-surface font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setSplitBank((b) => b + 500)}
                      className="h-10 px-2.5 bg-surface-container rounded-lg text-xs font-bold text-on-surface hover:bg-surface-container-high cursor-pointer"
                    >
                      +₹500
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitBank((b) => b + 1000)}
                      className="h-10 px-2.5 bg-surface-container rounded-lg text-xs font-bold text-on-surface hover:bg-surface-container-high cursor-pointer"
                    >
                      +₹1k
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Cash Denomination Assistant */}
          {selectedMethod === 'CASH' && (
            <div className="mt-4 bg-surface-container-low rounded-xl p-4 shadow-sm transition-all border border-surface-container">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">
                    calculate
                  </span>
                  <span className="font-title-md text-title-md text-on-surface font-bold">
                    Cash Quick Counter
                  </span>
                </div>
                <span className="font-label-caption text-label-caption text-tertiary bg-tertiary-container/30 px-2 py-0.5 rounded font-bold">
                  Exact ₹{totalAmount.toLocaleString('en-IN')}
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-3">
                Recommended drawer breakdown:
              </p>

              {/* Denomination Chips Grid */}
              <div className="grid grid-cols-5 gap-1.5 text-center">
                {denominations.map((denom) => (
                  <div
                    key={denom.label}
                    className="bg-surface-container-lowest rounded-lg p-2 flex flex-col items-center shadow-sm"
                  >
                    <span className="font-label-bold text-label-bold text-primary">
                      {denom.label}
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface font-semibold mt-0.5">
                      × {denom.count}
                    </span>
                    <span className="font-label-caption text-label-caption text-on-surface-variant mt-1">
                      {denom.total}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sticky Bottom Action Footer */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-surface/95 backdrop-blur-md z-40 flex flex-col gap-2 border-t border-surface-container">
            <div className="max-w-lg mx-auto w-full flex flex-col gap-2">
              {/* Printer Connection Indicator */}
              <div className="flex items-center justify-center gap-1.5 pb-0.5">
                <span className="material-symbols-outlined text-[14px] text-tertiary">
                  bluetooth_connected
                </span>
                <span className="font-label-caption text-label-caption text-on-surface-variant">
                  Thermal Printer &apos;Everycom-58&apos; Ready
                </span>
              </div>

              {/* Giant Primary Field Button */}
              <button
                className="w-full h-14 bg-primary text-on-primary rounded-xl font-label-bold text-label-bold flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-transform cursor-pointer"
                disabled={isProcessing}
                type="button"
                onClick={() => handleComplete(false)}
              >
                <span className="material-symbols-outlined text-[22px]">print</span>
                <span>
                  {isProcessing
                    ? 'RECORDING TRANSACTION...'
                    : `COMPLETE PURCHASE & PRINT SLIP (₹${totalAmount.toLocaleString('en-IN')})`}
                </span>
              </button>

              {/* Secondary Safe Action */}
              <button
                className="w-full py-2.5 text-center text-on-surface-variant font-label-bold text-label-bold hover:text-on-surface transition-colors active:opacity-75 cursor-pointer"
                type="button"
                onClick={() => handleComplete(true)}
              >
                Save as Unpaid Draft
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
