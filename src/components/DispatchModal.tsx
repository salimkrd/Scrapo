import React, { useState, useEffect } from 'react';
import { SalesOrder, Dispatch } from '../types';
import { dispatchRepository } from '../repositories/dispatchRepository';

interface DispatchModalProps {
  salesOrder: SalesOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onDispatchConfirmed: (dispatch: Dispatch) => void;
}

export const DispatchModal: React.FC<DispatchModalProps> = ({
  salesOrder,
  isOpen,
  onClose,
  onDispatchConfirmed,
}) => {
  const [vehicleNumber, setVehicleNumber] = useState('KL-07-BW-4912');
  const [driverName, setDriverName] = useState('Rajesh K.');
  const [driverPhone, setDriverPhone] = useState('+91 94470 12890');
  const [transportCompany, setTransportCompany] = useState('Kochi Express Freight Line');
  const [grossVehicleWeight, setGrossVehicleWeight] = useState(14500);
  const [tareVehicleWeight, setTareVehicleWeight] = useState(5700);
  const [weighbridgeSlipNumber, setWeighbridgeSlipNumber] = useState('');
  const [notes, setNotes] = useState('Gate pass checked & weighment slip verified');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (salesOrder && isOpen) {
      setWeighbridgeSlipNumber(`WB-${Math.floor(100000 + Math.random() * 900000)}`);
      // Target net weight from sales items
      const expectedNet = salesOrder.items.reduce((s, it) => s + it.weight, 0);
      setTareVehicleWeight(5700);
      setGrossVehicleWeight(5700 + expectedNet);
      setError(null);
    }
  }, [salesOrder, isOpen]);

  if (!isOpen || !salesOrder) return null;

  const netDispatchWeight = Math.max(0, grossVehicleWeight - tareVehicleWeight);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleNumber.trim()) {
      setError('Vehicle number is required');
      return;
    }
    if (!driverName.trim()) {
      setError('Driver name is required');
      return;
    }
    if (netDispatchWeight <= 0) {
      setError('Net dispatch weight must be greater than zero');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const dsp = await dispatchRepository.createDispatch({
        yardId: salesOrder.yardId,
        salesOrderId: salesOrder.id,
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        driverName: driverName.trim(),
        driverPhone: driverPhone.trim(),
        transportCompany: transportCompany.trim(),
        grossVehicleWeight,
        tareVehicleWeight,
        netDispatchWeight,
        weighbridgeSlipNumber: weighbridgeSlipNumber.trim(),
        notes: notes.trim(),
        createdBy: 'manager',
      });

      onDispatchConfirmed(dsp);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to confirm dispatch');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface text-on-surface w-full max-w-lg max-h-[90vh] rounded-2xl shadow-2xl border border-surface-container flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-surface-container-low border-b border-surface-container flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-[22px]">local_shipping</span>
            <div>
              <h3 className="font-bold text-base text-on-surface">Vehicle Weighment & Dispatch</h3>
              <p className="text-xs text-on-surface-variant">
                Order #{salesOrder.orderNumber} • Buyer: {salesOrder.buyerSnapshot?.companyName}
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
        <form onSubmit={handleConfirm} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Vehicle & Driver Details */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                Truck / Vehicle Number *
              </label>
              <input
                type="text"
                required
                placeholder="KL-07-BW-4912"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container rounded-xl text-sm font-mono font-bold focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                Transport Carrier
              </label>
              <input
                type="text"
                placeholder="Logistics company name"
                value={transportCompany}
                onChange={(e) => setTransportCompany(e.target.value)}
                className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container rounded-xl text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                Driver Name *
              </label>
              <input
                type="text"
                required
                placeholder="Rajesh K."
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container rounded-xl text-sm focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                Driver Phone
              </label>
              <input
                type="tel"
                placeholder="+91 94470 12890"
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container rounded-xl text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Weighbridge Weighment Inputs */}
          <div className="p-3.5 bg-surface-container-low rounded-xl border border-surface-container space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-on-surface">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-primary">scale</span>
                <span>Weighbridge Calibration Slip</span>
              </span>
              <input
                type="text"
                placeholder="WB-Slip Number"
                value={weighbridgeSlipNumber}
                onChange={(e) => setWeighbridgeSlipNumber(e.target.value)}
                className="px-2 py-1 bg-surface-container-lowest border border-surface-container rounded-lg text-xs font-mono font-bold w-32 focus:outline-none focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-on-surface-variant uppercase">
                  Gross Vehicle Wt (KG)
                </label>
                <input
                  type="number"
                  step="10"
                  min="1"
                  required
                  value={grossVehicleWeight}
                  onChange={(e) => setGrossVehicleWeight(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container rounded-xl text-sm font-numeric font-bold focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-on-surface-variant uppercase">
                  Tare Vehicle Wt (KG)
                </label>
                <input
                  type="number"
                  step="10"
                  min="0"
                  required
                  value={tareVehicleWeight}
                  onChange={(e) => setTareVehicleWeight(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container rounded-xl text-sm font-numeric font-bold focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Computed Net Dispatched Weight */}
            <div className="p-3 bg-surface-container-lowest rounded-xl border border-surface-container flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-on-surface-variant">
                  Net Dispatched Cargo
                </span>
                <div className="text-xl font-black text-primary font-numeric">
                  {netDispatchWeight.toLocaleString('en-IN')} KG
                </div>
              </div>
              <div className="text-right text-xs text-on-surface-variant">
                Order Items: {salesOrder.items.length} Material(s)
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              Dispatch / Gate Pass Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container rounded-xl text-sm focus:outline-none focus:border-primary"
            />
          </div>

          <div className="text-[11px] text-on-surface-variant bg-surface-container-low p-2.5 rounded-lg flex items-start gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-primary shrink-0">verified</span>
            <span>
              On confirmation, inventory movement <strong className="font-mono text-on-surface">DISPATCH_OUT</strong> will immediately decrement available stock.
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
              disabled={submitting || netDispatchWeight <= 0}
              className="px-5 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">local_shipping</span>
              <span>{submitting ? 'Confirming Dispatch...' : 'Confirm Dispatch & Release Stock'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
