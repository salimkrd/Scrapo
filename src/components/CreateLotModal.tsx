import React, { useState, useEffect } from 'react';
import { LegacyMaterialCompat, Lot } from '../types';
import { DEFAULT_YARD_ID } from '../services/seedService';
import { lotRepository } from '../repositories/lotRepository';
import { inventoryRepository } from '../repositories/inventoryRepository';

interface CreateLotModalProps {
  materials: LegacyMaterialCompat[];
  isOpen: boolean;
  onClose: () => void;
  onLotCreated: (lot: Lot) => void;
}

export const CreateLotModal: React.FC<CreateLotModalProps> = ({
  materials,
  isOpen,
  onClose,
  onLotCreated,
}) => {
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const [grossWeight, setGrossWeight] = useState<number>(852);
  const [tareWeight, setTareWeight] = useState<number>(2);
  const [warehouseLocation, setWarehouseLocation] = useState<string>('Bay A3');
  const [notes, setNotes] = useState<string>('Hydraulic baled cartons, strapped');
  const [looseStock, setLooseStock] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && materials.length > 0) {
      const defaultMat = materials.find((m) => m.id === 'mat_paper_occ') || materials[0];
      setSelectedMaterialId(defaultMat.id);
      loadLooseStock(defaultMat.id);
    }
    setError(null);
  }, [isOpen, materials]);

  const loadLooseStock = async (matId: string) => {
    try {
      const bal = await inventoryRepository.getBalance(matId);
      setLooseStock(bal);
    } catch {
      setLooseStock(0);
    }
  };

  const handleMaterialChange = (matId: string) => {
    setSelectedMaterialId(matId);
    loadLooseStock(matId);
  };

  if (!isOpen) return null;

  const netWeight = Math.max(0, Math.round((grossWeight - tareWeight) * 100) / 100);
  const selectedMat = materials.find((m) => m.id === selectedMaterialId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMat) {
      setError('Please select a material');
      return;
    }
    if (netWeight <= 0) {
      setError('Net weight must be greater than zero');
      return;
    }
    if (netWeight > looseStock) {
      setError(`INSUFFICIENT_INVENTORY: Available loose stock (${looseStock} KG) is less than bale net weight (${netWeight} KG)`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const lot = await lotRepository.createLot({
        yardId: DEFAULT_YARD_ID,
        materialId: selectedMat.id,
        standardB2BName: selectedMat.standardB2BTerm,
        grossWeight,
        tareWeight,
        netWeight,
        warehouseLocation,
        notes,
        createdBy: 'manager',
      });

      onLotCreated(lot);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create lot');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface text-on-surface w-full max-w-lg max-h-[90vh] rounded-2xl shadow-2xl border border-surface-container flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-surface-container-low border-b border-surface-container flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-[22px]">package_2</span>
            <div>
              <h3 className="font-bold text-base text-on-surface">Create New Lot / Bale</h3>
              <p className="text-xs text-on-surface-variant">
                Convert loose yard scrap into traceable B2B lot
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Material Selection */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              Scrap Material *
            </label>
            <select
              value={selectedMaterialId}
              onChange={(e) => handleMaterialChange(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface-container-lowest border border-surface-container rounded-xl text-sm font-medium focus:outline-none focus:border-primary"
            >
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.standardB2BTerm} ({m.name} / {m.nameMl})
                </option>
              ))}
            </select>
          </div>

          {/* Current Loose Stock Banner */}
          <div className="p-3.5 bg-surface-container-low rounded-xl border border-surface-container flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
                Current Loose Available Stock
              </div>
              <div className="text-lg font-bold text-on-surface mt-0.5 font-numeric">
                {looseStock.toLocaleString('en-IN')} KG
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-on-surface-variant">Post-Creation Remaining</div>
              <div
                className={`text-sm font-bold mt-0.5 ${
                  looseStock - netWeight < 0 ? 'text-red-500' : 'text-emerald-800 dark:text-emerald-300'
                }`}
              >
                {looseStock - netWeight < 0 ? 'Insufficient!' : `${(looseStock - netWeight).toFixed(1)} KG`}
              </div>
            </div>
          </div>

          {/* Weights */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                Gross Weight (KG) *
              </label>
              <input
                type="number"
                step="0.5"
                min="1"
                required
                value={grossWeight}
                onChange={(e) => setGrossWeight(Number(e.target.value))}
                className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container rounded-xl text-sm font-numeric focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                Tare / Strapping (KG)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={tareWeight}
                onChange={(e) => setTareWeight(Number(e.target.value))}
                className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container rounded-xl text-sm font-numeric focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Net Lot Weight Computed Callout */}
          <div className="p-3 bg-primary/10 rounded-xl border border-primary/20 flex items-center justify-between">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">
              Net Lot Baled Weight
            </span>
            <span className="text-xl font-black text-primary font-numeric">
              {netWeight.toFixed(2)} KG
            </span>
          </div>

          {/* Location & Notes */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              Warehouse Staging Location *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Bay A3 / Yard Staging Stack 2"
              value={warehouseLocation}
              onChange={(e) => setWarehouseLocation(e.target.value)}
              className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container rounded-xl text-sm focus:outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              Bale / Batch Notes
            </label>
            <input
              type="text"
              placeholder="e.g. Double-strapped hydraulic press bale"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container rounded-xl text-sm focus:outline-none focus:border-primary"
            />
          </div>

          {/* Traceability Audit Notice */}
          <div className="text-[11px] text-on-surface-variant bg-surface-container-low p-2.5 rounded-lg flex items-start gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-primary shrink-0">verified</span>
            <span>
              Inventory movement <strong className="font-mono text-on-surface">LOT_CREATE_OUT</strong> will be recorded to auditably decrease loose scrap and establish the bale lot.
            </span>
          </div>

          {/* Actions */}
          <div className="pt-4 flex items-center justify-end gap-2 border-t border-surface-container">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || netWeight <= 0 || netWeight > looseStock}
              className="px-5 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">add_box</span>
              <span>{saving ? 'Creating Lot...' : 'Create Lot / Bale'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
