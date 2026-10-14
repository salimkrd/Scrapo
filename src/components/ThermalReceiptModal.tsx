import React from 'react';
import { useApp } from '../context/AppContext';

export const ThermalReceiptModal: React.FC = () => {
  const { viewingSlip, setViewingSlip, navigateTo } = useApp();

  if (!viewingSlip) return null;

  const seller = viewingSlip.sellerSnapshot;

  const handlePrint = () => {
    window.print();
  };

  const handleDone = () => {
    setViewingSlip(null);
    navigateTo('home');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-surface rounded-2xl max-w-sm w-full shadow-2xl flex flex-col overflow-hidden max-h-[92vh]">
        {/* Modal Top Bar */}
        <div className="p-4 bg-primary text-on-primary flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px]">check_circle</span>
            <span className="font-title-md text-title-md font-bold">Purchase Confirmed</span>
          </div>
          <button
            onClick={handleDone}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Thermal Slip Simulation Body */}
        <div className="p-4 overflow-y-auto flex-1 bg-[#f4f4f0] font-mono text-xs text-gray-800 border-b border-dashed border-gray-300">
          <div className="bg-white p-4 rounded shadow-sm border border-gray-200 flex flex-col gap-2">
            {/* Header */}
            <div className="text-center border-b border-dashed border-gray-400 pb-2">
              <h2 className="font-bold text-sm tracking-wider uppercase">SCRAPO YARD NETWORK</h2>
              <p className="text-[11px] text-gray-600">Sri Balaji Scrap Yard (Yard #2)</p>
              <p className="text-[10px] text-gray-500">Kalamassery, Kochi - 683104</p>
              <p className="text-[10px] text-gray-500">GSTIN: 32AABCS1429B1Z8</p>
            </div>

            {/* Meta */}
            <div className="flex justify-between text-[11px] pt-1">
              <span>Slip: <b>{viewingSlip.slipNumber}</b></span>
              <span>{viewingSlip.timestamp || 'Live'}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span>Date: {new Date(viewingSlip.createdAt || Date.now()).toLocaleDateString('en-GB')}</span>
              <span>Supervisor: Anoop K.</span>
            </div>
            <div className="border-t border-dashed border-gray-300 pt-1 text-[11px]">
              <div>Seller: <b>{seller?.name}</b> ({seller?.nameMl})</div>
              <div>Phone: {seller?.phone}</div>
              <div>Vehicle: {viewingSlip.vehicleNumber || seller?.vehicleNumber || 'Hand Carry'}</div>
            </div>

            {/* Items Table */}
            <div className="border-t border-b border-dashed border-gray-400 py-2 my-1">
              <div className="flex justify-between font-bold text-[10px] uppercase text-gray-600 mb-1">
                <span>Item</span>
                <span>Net Wt</span>
                <span>Rate</span>
                <span>Amount</span>
              </div>
              {viewingSlip.items.map((item, idx) => (
                <div key={item.id || idx} className="flex flex-col py-0.5 border-b border-gray-100 last:border-b-0">
                  <div className="flex justify-between text-[11px]">
                    <span className="font-bold truncate max-w-[110px]">
                      {item.materialNameSnapshot}
                    </span>
                    <span>{item.netWeight.toFixed(2)}kg</span>
                    <span>₹{item.ratePerKg.toFixed(0)}</span>
                    <span className="font-bold">₹{Math.round(item.lineAmount)}</span>
                  </div>
                  {item.standardB2BTermSnapshot && (
                    <span className="text-[9px] text-gray-500 truncate">
                      {item.standardB2BTermSnapshot}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="flex flex-col gap-1 text-[11px]">
              <div className="flex justify-between font-bold text-sm">
                <span>NET PAYABLE:</span>
                <span>₹{viewingSlip.totalAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-gray-600 text-[10px]">
                <span>Payment Mode:</span>
                <span className="uppercase font-bold text-primary">
                  {viewingSlip.primaryPaymentMode || viewingSlip.paymentMethod} ({viewingSlip.paymentStatus || viewingSlip.status})
                </span>
              </div>
              <div className="flex justify-between text-gray-600 text-[10px]">
                <span>Total Net Weight:</span>
                <span>{viewingSlip.totalNetWeight?.toFixed(2) || viewingSlip.totalWeight?.toFixed(2)} KG</span>
              </div>
            </div>

            {/* Barcode Mockup */}
            <div className="mt-3 pt-2 border-t border-dashed border-gray-400 flex flex-col items-center">
              <div className="tracking-[6px] text-lg font-bold">|||| | ||||| || ||| ||||</div>
              <span className="text-[9px] text-gray-500 mt-1">SCRAPO-{viewingSlip.slipNumber.replace('#', '')}-VERIFIED</span>
              <p className="text-[10px] text-center text-gray-500 mt-2">
                Thank you! നന്ദി! Keep Yard Clean.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-surface flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex-1 h-12 bg-primary text-on-primary rounded-xl font-label-bold text-label-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">print</span>
              <span>Print Slip</span>
            </button>
            <button
              onClick={() => {
                alert(`Receipt sent to WhatsApp of ${seller?.name} (${seller?.phone})!`);
              }}
              className="flex-1 h-12 bg-[#25D366] text-white rounded-xl font-label-bold text-label-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">chat</span>
              <span>WhatsApp</span>
            </button>
          </div>
          <button
            onClick={handleDone}
            className="w-full h-11 bg-surface-container hover:bg-surface-container-high text-on-surface font-label-bold text-label-bold rounded-xl transition-all cursor-pointer"
            type="button"
          >
            Done & Return to Home
          </button>
        </div>
      </div>
    </div>
  );
};
