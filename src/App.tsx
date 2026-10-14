import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { WorkerHome } from './components/WorkerHome';
import { PurchasesView } from './components/PurchasesView';
import { SalesView } from './components/SalesView';
import { SellersView } from './components/SellersView';
import { MoreView } from './components/MoreView';
import { MaterialSelection } from './components/MaterialSelection';
import { WeightEntry } from './components/WeightEntry';
import { PaymentSettlement } from './components/PaymentSettlement';
import { ThermalReceiptModal } from './components/ThermalReceiptModal';
import { SellerPickerModal } from './components/SellerPickerModal';
import { RatesModal } from './components/RatesModal';
import { ScaleModal } from './components/ScaleModal';
import { SyncModal } from './components/SyncModal';

const AppContent: React.FC = () => {
  const { currentScreen, activeNavTab } = useApp();
  const [deviceFrame, setDeviceFrame] = useState(false);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'home':
        if (activeNavTab === 'sales') return <SalesView />;
        if (activeNavTab === 'purchases') return <PurchasesView />;
        if (activeNavTab === 'sellers') return <SellersView />;
        if (activeNavTab === 'more') return <MoreView />;
        return <WorkerHome />;
      case 'material_selection':
        return <MaterialSelection />;
      case 'weight_entry':
        return <WeightEntry />;
      case 'payment':
        return <PaymentSettlement />;
      default:
        return <WorkerHome />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-start sm:py-6">
      {/* Top Desktop bar for viewing mode info */}
      <aside
        aria-label="Desktop Preview Toolbar"
        className="hidden sm:flex items-center justify-between w-full max-w-lg mb-3 px-3 text-xs text-slate-400"
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-semibold text-slate-300">Scrapo Mobile Application</span>
          <span className="text-slate-500">• Industrial Fieldwork System</span>
        </div>
        <button
          onClick={() => setDeviceFrame(!deviceFrame)}
          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1 cursor-pointer"
          type="button"
        >
          <span className="material-symbols-outlined text-[14px]">
            {deviceFrame ? 'smartphone' : 'fit_screen'}
          </span>
          <span>{deviceFrame ? 'Phone Frame' : 'Fluid View'}</span>
        </button>
      </aside>

      {/* Main Mobile App Frame */}
      <div
        className={`w-full bg-surface text-on-surface relative shadow-2xl transition-all duration-300 ${
          deviceFrame
            ? 'max-w-[420px] rounded-[36px] overflow-hidden border-[8px] border-slate-800 ring-1 ring-slate-700 min-h-[880px]'
            : 'max-w-lg sm:rounded-2xl sm:overflow-hidden min-h-screen sm:min-h-[884px]'
        }`}
      >
        {renderScreen()}

        {/* Global Modals */}
        <ThermalReceiptModal />
        <SellerPickerModal />
        <RatesModal />
        <ScaleModal />
        <SyncModal />
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
