import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { LegacyMaterialCompat } from '../types';

interface LocalAliasModalProps {
  material: LegacyMaterialCompat | null;
  isOpen: boolean;
  onClose: () => void;
}

export const LocalAliasModal: React.FC<LocalAliasModalProps> = ({
  material,
  isOpen,
  onClose,
}) => {
  const { updateLocalAlias, updateTodayRate } = useApp();

  const [englishName, setEnglishName] = useState('');
  const [malayalamName, setMalayalamName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [rate, setRate] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    if (material) {
      setEnglishName(material.name);
      setMalayalamName(material.nameMl);
      setSubtitle(material.gradeEn);
      setRate(material.rate);
    }
  }, [material, isOpen]);

  if (!isOpen || !material) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!englishName.trim()) return;

    setIsSaving(true);
    try {
      // 1. Update local alias
      if (material.rawAlias?.id) {
        await updateLocalAlias(
          material.rawAlias.id,
          englishName.trim(),
          malayalamName.trim(),
          subtitle.trim()
        );
      }

      // 2. Update rate if changed
      if (rate !== material.rate && rate > 0) {
        await updateTodayRate(material.id, rate);
      }

      setSuccessNotice('Saved successfully! തദ്ദേശീയ മാറ്റങ്ങൾ രേഖപ്പെടുത്തി.');
      setTimeout(() => {
        setSuccessNotice(null);
        onClose();
      }, 1000);
    } catch (err: any) {
      alert(err.message || 'Failed to update alias');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-surface rounded-t-2xl sm:rounded-2xl max-w-md w-full shadow-2xl flex flex-col overflow-hidden max-h-[88vh]">
        {/* Header */}
        <div className="p-4 bg-primary text-on-primary flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px]">edit_note</span>
            <div>
              <h3 className="font-title-md text-title-md font-bold">
                Edit Local Alias & Rate
              </h3>
              <p className="text-xs text-primary-fixed-dim">
                Customize local yard naming while preserving B2B standard
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
        <form onSubmit={handleSave} className="p-4 flex flex-col gap-3 overflow-y-auto">
          {successNotice && (
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              <span>{successNotice}</span>
            </div>
          )}

          {/* Immutable Standard B2B Info Box */}
          <div className="bg-surface-container-low p-3 rounded-xl border border-surface-container flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                B2B Standard Classification (Immutable)
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed uppercase">
                {material.rawMaterial?.masterCategory || material.category}
              </span>
            </div>
            <div className="font-bold text-sm text-on-surface">
              {material.standardB2BTerm}
            </div>
            <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">lock</span>
              Standard category stays unchanged across all yards and invoices
            </span>
          </div>

          {/* Worker English Alias */}
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Local English Name / ലോക്കൽ പേര് (Worker Facing)
            </label>
            <input
              type="text"
              value={englishName}
              onChange={(e) => setEnglishName(e.target.value)}
              className="w-full h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 border border-surface-container"
              placeholder="e.g. Irumbu, Petti, Kuppi"
              required
            />
          </div>

          {/* Worker Malayalam Alias */}
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Local Malayalam Name / മലയാളം പേര്
            </label>
            <input
              type="text"
              value={malayalamName}
              onChange={(e) => setMalayalamName(e.target.value)}
              className="w-full h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 border border-surface-container"
              placeholder="e.g. ഇരുമ്പ്, പെട്ടി, കുപ്പി"
            />
          </div>

          {/* Subtitle / Grade */}
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Local Subtitle / ഗ്രേഡ് വിവരണം
            </label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="w-full h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 border border-surface-container"
              placeholder="e.g. ഇരുമ്പ് കമ്പി, പിപി ക്രേറ്റ്സ്"
            />
          </div>

          {/* Active Rate */}
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Today&apos;s Purchase Rate / ഇന്നത്തെ വില (₹/KG)
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-sm font-bold text-on-surface-variant">₹</span>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={rate || ''}
                onChange={(e) => setRate(Number(e.target.value) || 0)}
                className="w-full h-11 pl-8 pr-3 rounded-lg bg-surface-container-low text-on-surface font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 border border-surface-container"
                required
              />
            </div>
            <span className="text-[11px] text-on-surface-variant mt-1 block">
              Rate change applies immediately to new purchases. Past slips keep their historical snapshot.
            </span>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full h-12 bg-primary text-on-primary rounded-xl font-label-bold text-label-bold flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">save</span>
              <span>{isSaving ? 'SAVING CHANGES...' : 'SAVE ALIAS & RATE'}</span>
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
