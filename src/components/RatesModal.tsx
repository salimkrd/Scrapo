import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

export const RatesModal: React.FC = () => {
  const { isRatesModalOpen, setIsRatesModalOpen, allMaterials, updateTodayRate } = useApp();
  const [editingMatId, setEditingMatId] = useState<string | null>(null);
  const [editRateValue, setEditRateValue] = useState<string>('');

  if (!isRatesModalOpen) return null;

  const handleStartEdit = (matId: string, currentRate: number) => {
    setEditingMatId(matId);
    setEditRateValue(String(currentRate));
  };

  const handleSaveRate = async (matId: string) => {
    const parsed = parseFloat(editRateValue);
    if (!isNaN(parsed) && parsed > 0) {
      await updateTodayRate(matId, parsed);
    }
    setEditingMatId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-surface rounded-t-2xl sm:rounded-2xl max-w-lg w-full shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
        {/* Header */}
        <div className="p-4 bg-primary text-on-primary flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[24px]">trending_up</span>
            <div>
              <h3 className="font-title-md text-title-md font-bold">
                Today&apos;s Scrap Rates • ഇന്നത്തെ വില
              </h3>
              <p className="text-xs text-primary-fixed-dim">
                Active Benchmark • Rate Engine Connected
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsRatesModalOpen(false)}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Rates table */}
        <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-2">
          {allMaterials.map((mat) => (
            <div
              key={mat.id}
              className="p-3 rounded-xl bg-surface-container-lowest border border-surface-container flex flex-col gap-2 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[20px]">{mat.icon}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-title-md text-title-md font-bold text-on-surface">
                        {mat.name}
                      </span>
                      <span className="text-xs font-bold text-primary">({mat.nameMl})</span>
                    </div>
                    <span className="text-xs text-on-surface-variant font-medium">
                      {mat.standardB2BTerm}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span className="font-headline-md text-headline-md font-extrabold text-primary">
                      ₹{mat.rate}
                    </span>
                    <span className="text-xs text-on-surface-variant font-normal"> / KG</span>
                  </div>

                  <button
                    onClick={() => handleStartEdit(mat.id, mat.rate)}
                    className="w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant flex items-center justify-center"
                    type="button"
                    title="Edit Rate"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                  </button>
                </div>
              </div>

              {/* Inline Rate Edit Form */}
              {editingMatId === mat.id && (
                <div className="flex items-center gap-2 pt-2 border-t border-surface-container bg-surface-container-low p-2 rounded-lg">
                  <span className="text-xs font-bold text-on-surface">New Purchase Rate (₹/KG):</span>
                  <input
                    type="number"
                    step="0.5"
                    value={editRateValue}
                    onChange={(e) => setEditRateValue(e.target.value)}
                    className="w-20 px-2 py-1 bg-surface-container-lowest border rounded text-xs font-bold text-primary"
                    autoFocus
                  />
                  <button
                    onClick={() => handleSaveRate(mat.id)}
                    className="px-2.5 py-1 bg-primary text-white text-xs font-bold rounded"
                    type="button"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingMatId(null)}
                    className="px-2 py-1 text-xs text-on-surface-variant"
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-4 bg-surface-container-low border-t border-surface-container">
          <button
            onClick={() => setIsRatesModalOpen(false)}
            className="w-full h-11 bg-primary text-on-primary font-label-bold text-label-bold rounded-xl cursor-pointer"
            type="button"
          >
            Close Rates Sheet
          </button>
        </div>
      </div>
    </div>
  );
};
