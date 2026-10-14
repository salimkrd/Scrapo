import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { syncRepository } from '../repositories/syncRepository';
import { DEFAULT_YARD_ID } from '../services/seedService';
import { SyncRecord } from '../types/domain';

export const SyncModal: React.FC = () => {
  const { isSyncModalOpen, setIsSyncModalOpen, pendingSyncCount, processSyncQueue } = useApp();
  const [records, setRecords] = useState<SyncRecord[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (isSyncModalOpen) {
      syncRepository.getAllRecords(DEFAULT_YARD_ID).then(setRecords);
    }
  }, [isSyncModalOpen, pendingSyncCount]);

  if (!isSyncModalOpen) return null;

  const handleSyncNow = async () => {
    setIsSyncing(true);
    await processSyncQueue();
    const updated = await syncRepository.getAllRecords(DEFAULT_YARD_ID);
    setRecords(updated);
    setIsSyncing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-surface rounded-t-2xl sm:rounded-2xl max-w-lg w-full shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
        {/* Header */}
        <div className="p-4 bg-primary text-on-primary flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[24px]">sync</span>
            <div>
              <h3 className="font-title-md text-title-md font-bold">
                Offline Sync Queue • സിങ്ക് ക്യൂ
              </h3>
              <p className="text-xs text-primary-fixed-dim">
                {pendingSyncCount} Pending Transaction{pendingSyncCount === 1 ? '' : 's'} • Local First
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsSyncModalOpen(false)}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-2.5">
          <div className="p-3 bg-surface-container-low rounded-xl text-xs text-on-surface-variant flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-bold text-on-surface">
              <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
              All local purchases are safely saved in IndexedDB
            </span>
            <span className="font-bold text-primary">{pendingSyncCount} Unsynced</span>
          </div>

          {records.length === 0 ? (
            <div className="p-8 text-center text-on-surface-variant text-sm">
              No transactions in queue. All records synced.
            </div>
          ) : (
            records.slice(0, 10).map((rec) => (
              <div
                key={rec.localId}
                className="p-3 rounded-xl bg-surface-container-lowest border border-surface-container flex items-center justify-between shadow-sm"
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-primary">{rec.entityType}</span>
                    <span className="text-[10px] text-on-surface-variant truncate font-mono">
                      #{rec.entityId.substring(0, 14)}...
                    </span>
                  </div>
                  <span className="text-[11px] text-on-surface-variant mt-0.5">
                    Operation: {rec.operation} • Retries: {rec.retryCount}
                  </span>
                </div>

                <div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      rec.status === 'SYNCED'
                        ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                        : rec.status === 'SYNCING'
                        ? 'bg-primary-fixed text-on-primary-fixed animate-pulse'
                        : 'bg-secondary-fixed text-on-secondary-fixed'
                    }`}
                  >
                    {rec.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Action */}
        <div className="p-4 bg-surface-container-low border-t border-surface-container flex gap-2">
          <button
            onClick={handleSyncNow}
            disabled={isSyncing || pendingSyncCount === 0}
            className={`flex-1 h-12 rounded-xl font-label-bold text-label-bold flex items-center justify-center gap-2 shadow transition-all ${
              pendingSyncCount > 0 && !isSyncing
                ? 'bg-primary text-on-primary active:scale-95 cursor-pointer'
                : 'bg-surface-container text-on-surface-variant opacity-60 cursor-not-allowed'
            }`}
            type="button"
          >
            <span className={`material-symbols-outlined text-[20px] ${isSyncing ? 'animate-spin' : ''}`}>
              sync
            </span>
            <span>{isSyncing ? 'Syncing...' : 'Sync Pending to Cloud'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
