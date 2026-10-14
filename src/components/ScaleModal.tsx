import React from 'react';
import { useApp } from '../context/AppContext';

export const ScaleModal: React.FC = () => {
  const {
    isScaleModalOpen,
    setIsScaleModalOpen,
    scaleConnected,
    setScaleConnected,
    scaleTare,
    setScaleTare,
    zeroTareScale,
  } = useApp();

  if (!isScaleModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-surface rounded-t-2xl sm:rounded-2xl max-w-lg w-full shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
        {/* Header */}
        <div className="p-4 bg-surface-container-high border-b border-surface-container flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[24px] text-primary">scale</span>
            <div>
              <h3 className="font-title-md text-title-md font-bold text-on-surface">
                Weigh Scale Telemetry
              </h3>
              <p className="text-xs text-on-surface-variant">
                CAS CI-2001 Digital Indicator • Port 02
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsScaleModalOpen(false)}
            className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-highest flex items-center justify-center text-on-surface"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Status card */}
        <div className="p-4 flex flex-col gap-4">
          <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  scaleConnected ? 'bg-tertiary animate-pulse' : 'bg-error'
                }`}
              ></div>
              <div>
                <span className="font-bold text-sm text-on-surface">
                  {scaleConnected ? 'Bluetooth Link Active' : 'Scale Disconnected'}
                </span>
                <p className="text-xs text-on-surface-variant">Baud: 9600 bps • Continuous Output</p>
              </div>
            </div>

            <button
              onClick={() => setScaleConnected(!scaleConnected)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                scaleConnected
                  ? 'bg-error-container text-error'
                  : 'bg-tertiary-container text-on-tertiary-container'
              }`}
              type="button"
            >
              {scaleConnected ? 'Disconnect' : 'Connect'}
            </button>
          </div>

          {/* Current Tare */}
          <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container flex flex-col gap-2">
            <span className="text-xs uppercase font-bold text-on-surface-variant">
              Active Platform Tare
            </span>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-black text-primary">{scaleTare.toFixed(2)} KG</span>
              <div className="flex gap-2">
                <button
                  onClick={zeroTareScale}
                  className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold active:scale-95"
                  type="button"
                >
                  Zero Platform
                </button>
                <button
                  onClick={() => setScaleTare(1.5)}
                  className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface text-xs font-bold active:scale-95"
                  type="button"
                >
                  Set Gunny (1.5kg)
                </button>
              </div>
            </div>
          </div>

          {/* Diagnostics info */}
          <div className="p-3 rounded-xl bg-surface-container-low text-xs text-on-surface-variant flex flex-col gap-1.5">
            <div className="flex justify-between">
              <span>Calibration Date:</span>
              <span className="font-bold text-on-surface">15-Aug-2026 (Govt Legal Metrology)</span>
            </div>
            <div className="flex justify-between">
              <span>Max Capacity:</span>
              <span className="font-bold text-on-surface">500.00 KG (e = 50g)</span>
            </div>
            <div className="flex justify-between">
              <span>Zero Tracking:</span>
              <span className="font-bold text-tertiary">STABLE 0.00</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-surface-container-low border-t border-surface-container">
          <button
            onClick={() => setIsScaleModalOpen(false)}
            className="w-full h-11 bg-primary text-on-primary font-label-bold text-label-bold rounded-xl"
            type="button"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
