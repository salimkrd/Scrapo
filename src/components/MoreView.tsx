import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { inventoryRepository } from '../repositories/inventoryRepository';
import { db, STORES } from '../storage/indexedDb';
import { seedService, DEFAULT_YARD_ID } from '../services/seedService';
import { LegacyMaterialCompat, InventoryBalance, LotStockSummary } from '../types';
import { lotRepository } from '../repositories/lotRepository';
import { LocalAliasModal } from './LocalAliasModal';
import { LotsView } from './LotsView';

export const MoreView: React.FC = () => {
  const {
    allMaterials,
    scaleConnected,
    setScaleConnected,
    scaleGross,
    scaleTare,
    zeroTareScale,
    pendingSyncCount,
    processSyncQueue,
    reloadData,
  } = useApp();

  const [activeSection, setActiveSection] = useState<'taxonomy' | 'inventory' | 'lots' | 'scale' | 'data'>('taxonomy');
  const [selectedMaterialForEdit, setSelectedMaterialForEdit] = useState<LegacyMaterialCompat | null>(null);
  const [isAliasModalOpen, setIsAliasModalOpen] = useState(false);
  const [inventoryBalances, setInventoryBalances] = useState<Record<string, number>>({});
  const [stockSummaries, setStockSummaries] = useState<Record<string, LotStockSummary>>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Load live inventory balances and decomposed lot summaries
  useEffect(() => {
    const loadBalances = async () => {
      const balances = await inventoryRepository.getAllBalances(DEFAULT_YARD_ID);
      const map: Record<string, number> = {};
      balances.forEach((b: InventoryBalance) => {
        map[b.materialId] = b.currentStock;
      });
      setInventoryBalances(map);

      const sumMap: Record<string, LotStockSummary> = {};
      for (const mat of allMaterials) {
        const sum = await lotRepository.getStockSummary(DEFAULT_YARD_ID, mat.id, mat.standardB2BTerm);
        sumMap[mat.id] = sum;
      }
      setStockSummaries(sumMap);
    };
    loadBalances();
  }, [allMaterials]);

  const handleEditMaterial = (m: LegacyMaterialCompat) => {
    setSelectedMaterialForEdit(m);
    setIsAliasModalOpen(true);
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      await processSyncQueue();
      setStatusMessage('Sync complete! All pending actions submitted.');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch {
      setStatusMessage('Sync failed. Please check internet connection.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      const backupData: Record<string, any[]> = {};
      for (const storeKey of Object.values(STORES)) {
        backupData[storeKey] = await db.getAll(storeKey);
      }

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scrapo_offline_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatusMessage('Backup exported successfully! ഡാറ്റ ബാക്കപ്പ് ഡൗൺലോഡ് ചെയ്തു.');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      alert('Failed to export backup: ' + err.message);
    }
  };

  const handleResetData = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to reset demo data? All new purchases and ledger entries will be restored to default state.'
    );
    if (!confirmed) return;

    setResetting(true);
    try {
      await seedService.resetAndReseed();
      await reloadData();
      setStatusMessage('Demo data reset successfully! ഫാക്ടറി റീസെറ്റ് പൂർത്തിയായി.');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      alert('Reset failed: ' + err.message);
    } finally {
      setResetting(false);
    }
  };

  // Compute category weights
  const totalStockKg = Object.values(inventoryBalances).reduce((acc, v) => acc + v, 0);

  return (
    <div className="bg-surface font-body-md text-body-md text-on-surface flex flex-col min-h-screen">
      <Header />

      <main className="flex flex-col relative w-full max-w-lg mx-auto px-space-md pt-24 pb-28 bg-surface">
        <div className="flex flex-col w-full gap-3">
          {/* Header Title */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <h2 className="font-title-lg text-title-lg font-bold text-on-surface">
                Yard Operations & Settings
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Material taxonomy, scale calibration, and offline storage
              </p>
            </div>
            <div className="flex items-center gap-1.5 bg-tertiary-container text-on-tertiary-container px-2.5 py-1 rounded-full text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
              <span>Yard #2 Active</span>
            </div>
          </div>

          {/* Status Message Notification */}
          {statusMessage && (
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/30 text-primary text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150">
              <span className="material-symbols-outlined text-[18px]">info</span>
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Operation Navigation Pills */}
          <div className="grid grid-cols-5 gap-1 p-1 bg-surface-container-low rounded-xl border border-surface-container">
            {[
              { id: 'taxonomy', label: 'Aliases', icon: 'label' },
              { id: 'inventory', label: 'Stock', icon: 'inventory_2' },
              { id: 'lots', label: 'Lots', icon: 'package_2' },
              { id: 'scale', label: 'Scale', icon: 'scale' },
              { id: 'data', label: 'Backup', icon: 'cloud_sync' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSection(tab.id as any)}
                className={`py-2 px-1 rounded-lg text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeSection === tab.id
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                <span className="text-[10px]">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* SECTION 1: Material Taxonomy & Worker Aliases */}
          {activeSection === 'taxonomy' && (
            <div className="flex flex-col gap-3">
              <div className="bg-surface-container-lowest p-3 rounded-xl border border-surface-container flex items-center justify-between">
                <div>
                  <h3 className="font-title-md text-title-md font-bold text-on-surface">
                    Material Aliases & Rates
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Master Category → Local Alias → Standard B2B Term
                  </p>
                </div>
                <span className="text-xs font-bold text-primary bg-primary-container/20 px-2 py-0.5 rounded-full">
                  {allMaterials.length} Materials
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {allMaterials.map((mat) => (
                  <div
                    key={mat.id}
                    className="bg-surface-container-lowest rounded-xl p-3.5 shadow-sm border border-surface-container hover:border-outline-variant transition-all flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                          <span className="material-symbols-outlined text-[22px]">{mat.icon}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 font-bold text-sm text-on-surface">
                            <span>{mat.name}</span>
                            <span className="text-xs text-on-surface-variant font-normal">
                              ({mat.nameMl})
                            </span>
                          </div>
                          <div className="text-[11px] text-on-surface-variant flex items-center gap-1">
                            <span className="font-semibold text-primary">
                              {mat.rawMaterial?.masterCategory || mat.category}
                            </span>
                            <span>•</span>
                            <span>{mat.gradeEn}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-label-numeric-lg text-base font-bold text-primary">
                          ₹{mat.rate}/kg
                        </span>
                        <div className="text-[10px] text-on-surface-variant">Purchase Rate</div>
                      </div>
                    </div>

                    {/* Standard B2B Term Badge */}
                    <div className="bg-surface-container-low px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1 text-on-surface-variant truncate max-w-[260px]">
                        <span className="material-symbols-outlined text-[14px] text-outline">verified</span>
                        <span className="truncate">{mat.standardB2BTerm}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleEditMaterial(mat)}
                        className="text-xs font-bold text-primary hover:underline cursor-pointer flex items-center gap-0.5"
                      >
                        <span className="material-symbols-outlined text-[14px]">edit</span>
                        <span>Edit</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 2: Live Inventory Stock (Upgraded per Section 27) */}
          {activeSection === 'inventory' && (
            <div className="flex flex-col gap-3">
              {/* Inventory Summary Hero */}
              <div className="bg-primary text-on-primary rounded-xl p-4 shadow-sm flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary-fixed-dim uppercase tracking-wider">
                    Total Scrap Stock in Yard
                  </span>
                  <span className="material-symbols-outlined text-[20px]">warehouse</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold font-numeric">{totalStockKg.toFixed(2)}</span>
                  <span className="text-sm font-semibold text-primary-fixed-dim">KG</span>
                </div>
                <div className="text-xs text-primary-fixed-dim pt-1 border-t border-primary-container/30">
                  Computed dynamically from purchase transactions, lot baling, and sales dispatches
                </div>
              </div>

              {/* Material Stock Decomposed Rows (Section 27) */}
              <div className="flex flex-col gap-2.5">
                {allMaterials.map((mat) => {
                  const summary = stockSummaries[mat.id] || {
                    materialId: mat.id,
                    standardName: mat.standardB2BTerm,
                    totalStock: inventoryBalances[mat.id] || 0,
                    looseStock: inventoryBalances[mat.id] || 0,
                    lotStock: 0,
                    reservedStock: 0,
                    availableStock: inventoryBalances[mat.id] || 0,
                  };

                  return (
                    <div
                      key={mat.id}
                      className="bg-surface-container-lowest p-3.5 rounded-xl border border-surface-container shadow-xs flex flex-col gap-2.5"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined text-[20px]">{mat.icon}</span>
                          </div>
                          <div>
                            <div className="font-bold text-sm text-on-surface">
                              {mat.name} ({mat.nameMl})
                            </div>
                            <div className="text-[11px] text-on-surface-variant font-medium">
                              {mat.standardB2BTerm}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-base font-black text-on-surface font-numeric">
                            {summary.totalStock.toLocaleString('en-IN')} KG
                          </span>
                          <div className="text-[10px] uppercase font-bold text-on-surface-variant">
                            Total Stock
                          </div>
                        </div>
                      </div>

                      {/* Decomposed Breakdown Grid (Section 27) */}
                      <div className="grid grid-cols-4 gap-1.5 p-2 bg-surface-container-low rounded-lg text-center text-xs">
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase font-semibold text-on-surface-variant">
                            Loose
                          </span>
                          <span className="font-bold text-on-surface font-numeric mt-0.5">
                            {summary.looseStock} KG
                          </span>
                        </div>

                        <div className="flex flex-col border-l border-surface-container">
                          <span className="text-[10px] uppercase font-semibold text-primary">
                            Lots / Baled
                          </span>
                          <span className="font-bold text-primary font-numeric mt-0.5">
                            {summary.lotStock} KG
                          </span>
                        </div>

                        <div className="flex flex-col border-l border-surface-container">
                          <span className="text-[10px] uppercase font-semibold text-amber-800 dark:text-amber-300">
                            Reserved
                          </span>
                          <span className="font-bold text-amber-800 dark:text-amber-300 font-numeric mt-0.5">
                            {summary.reservedStock} KG
                          </span>
                        </div>

                        <div className="flex flex-col border-l border-surface-container bg-emerald-500/10 rounded">
                          <span className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300">
                            Available
                          </span>
                          <span className="font-black text-emerald-800 dark:text-emerald-300 font-numeric mt-0.5">
                            {summary.availableStock} KG
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 3: Lots / Bales Management (Section 26) */}
          {activeSection === 'lots' && (
            <LotsView materials={allMaterials} />
          )}

          {/* SECTION 3: Scale Diagnostics */}
          {activeSection === 'scale' && (
            <div className="flex flex-col gap-3">
              <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-surface-container flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[22px]">scale</span>
                    <div>
                      <h3 className="font-title-md text-title-md font-bold text-on-surface">
                        Industrial Weighbridge Status
                      </h3>
                      <p className="text-xs text-on-surface-variant font-mono">CAS-CI-2001-YARD02</p>
                    </div>
                  </div>

                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                      scaleConnected
                        ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                        : 'bg-red-500/15 text-red-800 dark:text-red-300'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
                    <span>{scaleConnected ? 'Connected • Stable' : 'Disconnected'}</span>
                  </span>
                </div>

                {/* Telemetry Display */}
                <div className="grid grid-cols-3 gap-2 bg-surface-container-low p-3 rounded-xl border border-surface-container text-center">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-on-surface-variant">Gross Weight</span>
                    <span className="font-bold text-lg text-on-surface mt-0.5">{scaleGross.toFixed(2)} KG</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-on-surface-variant">Tare Offset</span>
                    <span className="font-bold text-lg text-amber-700 mt-0.5">{scaleTare.toFixed(2)} KG</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-on-surface-variant">Net Available</span>
                    <span className="font-bold text-lg text-primary mt-0.5">
                      {(scaleGross - scaleTare).toFixed(2)} KG
                    </span>
                  </div>
                </div>

                {/* Calibration Actions */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={zeroTareScale}
                    className="flex-1 h-11 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">exposure_zero</span>
                    <span>Zero Tare Scale (0.00 KG)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setScaleConnected(!scaleConnected)}
                    className="h-11 px-3 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {scaleConnected ? 'link_off' : 'link'}
                    </span>
                    <span>{scaleConnected ? 'Simulate Disconnect' : 'Reconnect'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 4: Data Management & Offline Storage */}
          {activeSection === 'data' && (
            <div className="flex flex-col gap-3">
              {/* Sync Status Card */}
              <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-surface-container flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[22px]">sync</span>
                    <div>
                      <h3 className="font-title-md text-title-md font-bold text-on-surface">
                        Offline Sync Queue
                      </h3>
                      <p className="text-xs text-on-surface-variant">
                        Queue holds idempotent device records for cloud replication
                      </p>
                    </div>
                  </div>
                  <span className="font-bold text-xs px-2.5 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed">
                    {pendingSyncCount} Pending
                  </span>
                </div>

                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={handleSyncNow}
                  className="w-full h-11 bg-primary text-on-primary rounded-xl font-label-bold text-label-bold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {isSyncing ? 'sync' : 'cloud_upload'}
                  </span>
                  <span>{isSyncing ? 'SYNCHRONIZING QUEUE...' : 'PROCESS SYNC QUEUE NOW'}</span>
                </button>
              </div>

              {/* Backup & Export Card */}
              <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-surface-container flex flex-col gap-2.5">
                <h3 className="font-title-md text-title-md font-bold text-on-surface">
                  Data Portability & Backup
                </h3>
                <p className="text-xs text-on-surface-variant">
                  Download complete snapshot of local IndexedDB tables (purchases, ledger, materials, inventory).
                </p>

                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="w-full h-11 bg-surface-container-high hover:bg-surface-container-highest text-primary rounded-xl font-label-bold text-label-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  <span>Export Database Backup (JSON)</span>
                </button>
              </div>

              {/* Reset Card */}
              <div className="bg-red-500/5 rounded-xl p-4 border border-red-500/20 flex flex-col gap-2">
                <h3 className="font-title-md text-title-md font-bold text-red-600">
                  Reset Demo Data
                </h3>
                <p className="text-xs text-on-surface-variant">
                  Clears local IndexedDB stores and reseeds initial yard taxonomy and sample transactions.
                </p>

                <button
                  type="button"
                  disabled={resetting}
                  onClick={handleResetData}
                  className="w-full h-10 bg-red-600 hover:bg-red-700 text-white rounded-xl font-label-bold text-label-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                  <span>{resetting ? 'RESETTING...' : 'Reset to Initial Demo State'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Local Alias & Rate Editor Modal */}
      <LocalAliasModal
        material={selectedMaterialForEdit}
        isOpen={isAliasModalOpen}
        onClose={() => {
          setIsAliasModalOpen(false);
          setSelectedMaterialForEdit(null);
        }}
      />

      <BottomNav />
    </div>
  );
};
