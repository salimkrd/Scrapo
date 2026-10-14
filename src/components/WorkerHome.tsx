import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Header } from './Header';
import { BottomNav } from './BottomNav';

export const WorkerHome: React.FC = () => {
  const {
    navigateTo,
    recentSlips,
    setViewingSlip,
    setIsRatesModalOpen,
    setIsScaleModalOpen,
    scaleTare,
    zeroTareScale,
    yardNotices,
  } = useApp();

  const [tareNotice, setTareNotice] = useState<string | null>(null);

  const handleZeroTare = () => {
    zeroTareScale();
    setTareNotice('Scale Zeroed (0.00 KG Tare)');
    setTimeout(() => setTareNotice(null), 2000);
  };

  const handleFastAction = (action: string) => {
    if (action === 'rates') {
      setIsRatesModalOpen(true);
    } else if (action === 'weighbridge') {
      setIsScaleModalOpen(true);
    } else {
      navigateTo('material_selection');
    }
  };

  // Compute live metrics from recent slips
  const totalWeightDispatched = recentSlips.reduce((acc, s) => acc + s.totalWeight, 0);
  const totalPaidSum = recentSlips
    .filter((s) => s.paymentMethod !== 'CREDIT')
    .reduce((acc, s) => acc + s.totalAmount, 0);
  const pendingCount = recentSlips.filter((s) => s.status === 'pending').length;

  return (
    <div className="bg-surface font-body-md text-body-md text-on-surface flex flex-col min-h-screen">
      <Header />

      <main className="flex flex-col relative w-full max-w-lg mx-auto px-space-md pt-24 pb-28 bg-surface">
        <div className="flex flex-col w-full gap-space-md">
          {/* Supervisor Context & Welcome Card */}
          <section className="bg-surface-container-low rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm relative overflow-hidden">
            {/* Subtle Ambient Accent */}
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-primary/5 rounded-full pointer-events-none"></div>

            <div className="flex items-center justify-between gap-space-sm">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-caption text-label-caption font-bold shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-tertiary animate-ping"></span>
                  Connected • Live Local Sync
                </span>
              </div>
              <div className="flex items-center gap-1 text-on-surface-variant font-label-caption text-label-caption">
                <span className="material-symbols-outlined text-[15px]">location_on</span>
                <span>Kalamassery, Kochi</span>
              </div>
            </div>

            <div className="flex flex-col pt-1">
              <div className="flex items-center gap-1.5 text-primary font-headline-md text-headline-md">
                <span>നമസ്കാരം,</span>
                <span className="text-on-surface">Anoop Kumar</span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Yard Supervisor • Sri Balaji Scrap Yard (Kochi Yard #2)
              </p>
            </div>
          </section>

          {/* Giant Primary Action Button (Optimized for field/gloved thumb) */}
          <section className="w-full">
            <button
              aria-label="Create New Purchase Slip"
              className="w-full min-h-[62px] bg-primary-container text-on-primary rounded-xl px-space-md py-3 flex items-center justify-between shadow-md active:scale-[0.98] transition-all duration-100 group cursor-pointer"
              type="button"
              onClick={() => navigateTo('material_selection')}
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-lg bg-surface-container-lowest/15 flex items-center justify-center text-on-primary">
                  <span
                    className="material-symbols-outlined text-[28px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    add_circle
                  </span>
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-title-lg text-title-lg tracking-wide uppercase leading-tight font-extrabold">
                    + NEW PURCHASE
                  </span>
                  <span className="font-label-bold text-label-bold text-on-primary-container opacity-90">
                    പുതിയ പർച്ചേസ് സ്ലിപ്പ്
                  </span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-full bg-surface-container-lowest/20 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </div>
            </button>
          </section>

          {/* Quick Stats (3-column High-Contrast Outdoor Metric Cards) */}
          <section className="w-full">
            <div className="grid grid-cols-3 gap-2.5">
              {/* Slips Count */}
              <div className="bg-surface-container-lowest rounded-xl p-3 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-on-surface-variant">
                  <span className="font-label-caption text-label-caption uppercase tracking-wider font-bold">
                    Today Slips
                  </span>
                  <span className="material-symbols-outlined text-[16px] text-primary">
                    receipt
                  </span>
                </div>
                <div className="mt-2">
                  <div className="font-headline-md text-headline-md text-on-surface font-extrabold">
                    {recentSlips.length + 44}
                  </div>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    {pendingCount} Pending
                  </span>
                </div>
              </div>

              {/* Total Weight */}
              <div className="bg-surface-container-lowest rounded-xl p-3 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-on-surface-variant">
                  <span className="font-label-caption text-label-caption uppercase tracking-wider font-bold">
                    Gross Wt
                  </span>
                  <span className="material-symbols-outlined text-[16px] text-secondary">
                    scale
                  </span>
                </div>
                <div className="mt-2">
                  <div className="font-headline-md text-headline-md text-on-surface font-extrabold">
                    {Math.round(totalWeightDispatched + 4156).toLocaleString('en-IN')}
                  </div>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    KG Dispatched
                  </span>
                </div>
              </div>

              {/* Purchase Value */}
              <div className="bg-surface-container-lowest rounded-xl p-3 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-on-surface-variant">
                  <span className="font-label-caption text-label-caption uppercase tracking-wider font-bold">
                    Total Paid
                  </span>
                  <span className="material-symbols-outlined text-[16px] text-primary-container">
                    payments
                  </span>
                </div>
                <div className="mt-2 min-w-0">
                  <div className="font-title-lg text-title-lg text-primary font-extrabold truncate">
                    ₹{(Math.round((totalPaidSum + 95620) / 1000) / 100).toFixed(2)}L
                  </div>
                  <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                    ₹{(totalPaidSum + 95620).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Yard Quick Action Shortcuts */}
          <section className="w-full flex flex-col gap-2">
            <div className="flex items-center justify-between px-0.5">
              <span className="font-label-bold text-label-bold text-on-surface uppercase tracking-wider">
                Fast Actions • പെട്ടെന്നുള്ള സേവനങ്ങൾ
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                className="min-h-[58px] bg-surface-container-lowest rounded-xl p-2.5 flex flex-col items-center justify-center text-center shadow-sm active:bg-surface-container active:scale-95 transition-all cursor-pointer"
                type="button"
                onClick={() => handleFastAction('cash')}
              >
                <span className="material-symbols-outlined text-primary text-[22px]">
                  point_of_sale
                </span>
                <span className="font-label-bold text-label-bold text-on-surface mt-1 leading-tight">
                  Walk-in Cash
                </span>
                <span className="font-label-caption text-label-caption text-on-surface-variant">
                  നേരിട്ടുള്ള കാഷ്
                </span>
              </button>

              <button
                className="min-h-[58px] bg-surface-container-lowest rounded-xl p-2.5 flex flex-col items-center justify-center text-center shadow-sm active:bg-surface-container active:scale-95 transition-all cursor-pointer"
                type="button"
                onClick={() => handleFastAction('weighbridge')}
              >
                <span className="material-symbols-outlined text-secondary text-[22px]">
                  local_shipping
                </span>
                <span className="font-label-bold text-label-bold text-on-surface mt-1 leading-tight">
                  Weighbridge
                </span>
                <span className="font-label-caption text-label-caption text-on-surface-variant">
                  ലോറി തൂക്കം
                </span>
              </button>

              <button
                className="min-h-[58px] bg-surface-container-lowest rounded-xl p-2.5 flex flex-col items-center justify-center text-center shadow-sm active:bg-surface-container active:scale-95 transition-all cursor-pointer"
                type="button"
                onClick={() => handleFastAction('rates')}
              >
                <span className="material-symbols-outlined text-tertiary-container text-[22px]">
                  trending_up
                </span>
                <span className="font-label-bold text-label-bold text-on-surface mt-1 leading-tight">
                  Today Rates
                </span>
                <span className="font-label-caption text-label-caption text-on-surface-variant">
                  ഇന്നത്തെ വില
                </span>
              </button>
            </div>
          </section>

          {/* Live Weigh Scale Telemetry Pill */}
          <section className="bg-surface-container rounded-xl p-space-sm px-space-md flex items-center justify-between shadow-sm relative overflow-hidden">
            <div
              className="flex items-center gap-2.5 cursor-pointer flex-1"
              onClick={() => setIsScaleModalOpen(true)}
            >
              <div className="w-3 h-3 rounded-full bg-tertiary animate-pulse flex-shrink-0"></div>
              <div className="flex flex-col">
                <span className="font-label-bold text-label-bold text-on-surface leading-tight">
                  Floor Scale #01 (500 KG Platform)
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  {tareNotice || `Bluetooth Bridge Active • ${scaleTare.toFixed(2)} KG Tare`}
                </span>
              </div>
            </div>
            <button
              className="px-3 py-1.5 rounded-lg bg-surface-container-lowest text-primary font-label-bold text-label-bold shadow-sm active:scale-95 transition-transform cursor-pointer"
              type="button"
              onClick={handleZeroTare}
            >
              Zero / Tare
            </button>
          </section>

          {/* Live Transactions Feed Header */}
          <section className="flex items-center justify-between pt-1 px-0.5">
            <div className="flex items-center gap-1.5">
              <span className="font-title-lg text-title-lg font-extrabold text-on-surface">
                Recent Purchase Slips
              </span>
              <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-bold text-label-bold">
                {recentSlips.length} Live
              </span>
            </div>
            <button
              className="text-primary font-label-bold text-label-bold flex items-center gap-0.5 cursor-pointer"
              type="button"
            >
              <span>View All</span>
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </section>

          {/* Transactions List (High Legibility Cards for Sun-lit Yards) */}
          <section className="flex flex-col gap-3">
            {recentSlips.map((slip) => (
              <article
                key={slip.id}
                className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-2.5 transition-all hover:shadow-md border border-surface-container"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-label-bold text-label-bold text-primary px-2 py-0.5 rounded bg-primary-fixed">
                      {slip.slipNumber}
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      {slip.timestamp}
                    </span>
                  </div>

                  {slip.paymentMethod === 'CASH' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-caption text-label-caption font-bold">
                      <span className="material-symbols-outlined text-[13px]">payments</span>
                      Paid Cash
                    </span>
                  ) : slip.paymentMethod === 'UPI' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant font-label-caption text-label-caption font-bold">
                      <span className="material-symbols-outlined text-[13px]">qr_code_scanner</span>
                      Paid UPI
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant font-label-caption text-label-caption font-bold">
                      <span className="material-symbols-outlined text-[13px]">pending</span>
                      Pending Credit
                    </span>
                  )}
                </div>

                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-title-md text-title-md font-bold text-on-surface">
                        {slip.sellerSnapshot.name}
                      </span>
                      <span className="font-body-sm text-body-sm text-on-surface-variant">
                        ({slip.sellerSnapshot.type})
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-on-surface-variant">
                      <span className="font-label-bold text-label-bold text-on-surface">
                        {slip.primaryMaterialName}
                      </span>
                      {slip.primaryMaterialMl && (
                        <>
                          <span>•</span>
                          <span className="font-body-sm text-body-sm">
                            {slip.primaryMaterialMl}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <span className="font-headline-md text-headline-md font-extrabold text-primary">
                      ₹{slip.totalAmount.toLocaleString('en-IN')}
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      @ ₹{slip.ratePerKg} / KG
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 bg-surface-container-low p-2 rounded-lg">
                  <div className="flex items-center gap-3 font-label-caption text-label-caption text-on-surface-variant">
                    <span className="font-bold text-on-surface px-1.5 py-0.5 rounded bg-surface-container-lowest shadow-sm">
                      {slip.totalWeight.toFixed(2)} KG
                    </span>
                    <span className="flex items-center gap-1 truncate max-w-[130px]">
                      <span className="material-symbols-outlined text-[14px]">
                        {slip.vehicleNumber?.includes('KL') ? 'directions_car' : 'pedal_bike'}
                      </span>
                      {slip.vehicleNumber || 'Hand Carry'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      aria-label="Print Thermal Slip"
                      className="w-8 h-8 rounded-lg bg-surface-container-lowest text-on-surface-variant flex items-center justify-center hover:text-primary active:scale-95 shadow-sm transition-colors cursor-pointer"
                      type="button"
                      onClick={() => setViewingSlip(slip)}
                    >
                      <span className="material-symbols-outlined text-[18px]">print</span>
                    </button>
                    <button
                      aria-label="Share WhatsApp Slip"
                      className="w-8 h-8 rounded-lg bg-surface-container-lowest text-on-surface-variant flex items-center justify-center hover:text-primary active:scale-95 shadow-sm transition-colors cursor-pointer"
                      type="button"
                      onClick={() => {
                        alert(
                          `Sharing Purchase Slip ${slip.slipNumber} (₹${slip.totalAmount}) to WhatsApp for ${
                            slip.sellerSnapshot.name
                          }`
                        );
                      }}
                    >
                      <span className="material-symbols-outlined text-[18px]">share</span>
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>

          {/* Configurable Yard Operator Quick Note Banner */}
          {yardNotices.map((notice) => (
            <section
              key={notice.id}
              className="bg-surface-container-highest rounded-xl p-space-md flex items-center gap-3 mb-2"
            >
              <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-[20px]">{notice.icon}</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-label-bold text-label-bold text-on-surface">
                  {notice.title}
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                  {notice.subtitle}
                </span>
              </div>
            </section>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  );
};
