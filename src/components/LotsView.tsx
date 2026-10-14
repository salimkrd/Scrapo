import React, { useState, useEffect } from 'react';
import { Lot, LegacyMaterialCompat, LotStatus } from '../types';
import { DEFAULT_YARD_ID } from '../services/seedService';
import { lotRepository } from '../repositories/lotRepository';
import { CreateLotModal } from './CreateLotModal';

interface LotsViewProps {
  materials: LegacyMaterialCompat[];
  onSellLot?: (lot: Lot) => void;
}

export const LotsView: React.FC<LotsViewProps> = ({ materials, onSellLot }) => {
  const [lots, setLots] = useState<Lot[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [selectedLotForDetail, setSelectedLotForDetail] = useState<Lot | null>(null);

  const loadLots = async () => {
    const list = await lotRepository.getAllLots(DEFAULT_YARD_ID);
    setLots(list);
  };

  useEffect(() => {
    loadLots();
  }, []);

  const handleStatusChange = async (lotId: string, newStatus: LotStatus) => {
    try {
      await lotRepository.updateLot(lotId, { status: newStatus });
      await loadLots();
    } catch (err: any) {
      alert('Failed to update lot status: ' + err.message);
    }
  };

  const filteredLots = lots.filter((lt) => {
    const matchesStatus = filterStatus === 'ALL' || lt.status === filterStatus;
    const matchesSearch =
      lt.lotNumber.toLowerCase().includes(search.toLowerCase()) ||
      lt.standardB2BName.toLowerCase().includes(search.toLowerCase()) ||
      (lt.warehouseLocation && lt.warehouseLocation.toLowerCase().includes(search.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: LotStatus) => {
    switch (status) {
      case 'READY':
        return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30';
      case 'RESERVED':
        return 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30';
      case 'PARTIALLY_DISPATCHED':
        return 'bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-500/30';
      case 'DISPATCHED':
      case 'CLOSED':
        return 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30';
      default:
        return 'bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-500/30';
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder="Search lot by number, standard B2B name, or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-surface-container-lowest border border-surface-container rounded-xl text-xs focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-surface-container-lowest border border-surface-container rounded-xl text-xs font-semibold focus:outline-none focus:border-primary"
          >
            <option value="ALL">All Statuses ({lots.length})</option>
            <option value="READY">Ready ({lots.filter((l) => l.status === 'READY').length})</option>
            <option value="RESERVED">Reserved</option>
            <option value="PARTIALLY_DISPATCHED">Partially Dispatched</option>
            <option value="DISPATCHED">Dispatched / Closed</option>
          </select>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:bg-primary/90 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[16px]">add_box</span>
            <span>+ Create Lot / Bale</span>
          </button>
        </div>
      </div>

      {/* Lot Grid / Cards */}
      {filteredLots.length === 0 ? (
        <div className="p-8 text-center text-on-surface-variant bg-surface-container-lowest rounded-xl border border-dashed border-surface-container">
          <span className="material-symbols-outlined text-[36px] text-on-surface-variant/40 mb-1">
            package_2
          </span>
          <p className="text-sm font-medium">No lot records found</p>
          <p className="text-xs text-on-surface-variant/70 mt-1">
            Create a lot to convert accumulated scrap into standard baled stock.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredLots.map((lot) => (
            <div
              key={lot.id}
              className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container shadow-sm hover:border-outline-variant transition-all flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-primary tracking-wide">
                      {lot.lotNumber}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(
                        lot.status
                      )}`}
                    >
                      {lot.status}
                    </span>
                  </div>
                  <span className="text-xs text-on-surface-variant font-medium">
                    Loc: <strong className="text-on-surface">{lot.warehouseLocation}</strong>
                  </span>
                </div>

                <h4 className="font-bold text-sm text-on-surface mt-1.5">
                  {lot.standardB2BName}
                </h4>

                {lot.notes && (
                  <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-1">{lot.notes}</p>
                )}
              </div>

              {/* Weight Telemetry */}
              <div className="p-2.5 bg-surface-container-low rounded-lg flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-on-surface-variant">
                    Original Net
                  </span>
                  <div className="font-bold text-on-surface font-numeric">{lot.netWeight} KG</div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-primary">
                    Available Baled Stock
                  </span>
                  <div className="text-base font-black text-primary font-numeric">
                    {lot.availableWeight} KG
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-surface-container">
                {lot.status === 'READY' && (
                  <button
                    type="button"
                    onClick={() => handleStatusChange(lot.id, 'RESERVED')}
                    className="px-2.5 py-1 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer"
                  >
                    Reserve
                  </button>
                )}

                {lot.status === 'RESERVED' && (
                  <button
                    type="button"
                    onClick={() => handleStatusChange(lot.id, 'READY')}
                    className="px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
                  >
                    Mark Ready
                  </button>
                )}

                {['READY', 'PARTIALLY_DISPATCHED', 'RESERVED'].includes(lot.status) && onSellLot && (
                  <button
                    type="button"
                    onClick={() => onSellLot(lot)}
                    className="px-3 py-1 bg-primary text-on-primary rounded-lg text-xs font-bold hover:bg-primary/90 transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[14px]">point_of_sale</span>
                    <span>Sell Lot</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedLotForDetail(lot)}
                  className="px-2 py-1 text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
                >
                  View
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lot Detail Modal */}
      {selectedLotForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface text-on-surface w-full max-w-sm rounded-2xl shadow-2xl border border-surface-container p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-surface-container pb-3">
              <div>
                <span className="font-mono font-bold text-sm text-primary">
                  {selectedLotForDetail.lotNumber}
                </span>
                <h4 className="font-bold text-sm text-on-surface mt-0.5">
                  {selectedLotForDetail.standardB2BName}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLotForDetail(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-surface-container/50">
                <span className="text-on-surface-variant">Gross Weight:</span>
                <span className="font-bold">{selectedLotForDetail.grossWeight} KG</span>
              </div>
              <div className="flex justify-between py-1 border-b border-surface-container/50">
                <span className="text-on-surface-variant">Tare Weight:</span>
                <span className="font-bold">{selectedLotForDetail.tareWeight} KG</span>
              </div>
              <div className="flex justify-between py-1 border-b border-surface-container/50">
                <span className="text-on-surface-variant">Net Initial Weight:</span>
                <span className="font-bold">{selectedLotForDetail.netWeight} KG</span>
              </div>
              <div className="flex justify-between py-1 border-b border-surface-container/50">
                <span className="text-on-surface-variant">Available Stock:</span>
                <span className="font-bold text-primary font-numeric">
                  {selectedLotForDetail.availableWeight} KG
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-surface-container/50">
                <span className="text-on-surface-variant">Warehouse Location:</span>
                <span className="font-bold">{selectedLotForDetail.warehouseLocation}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-surface-container/50">
                <span className="text-on-surface-variant">Status:</span>
                <span className="font-bold">{selectedLotForDetail.status}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-on-surface-variant">Created At:</span>
                <span>
                  {new Date(selectedLotForDetail.createdAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedLotForDetail(null)}
              className="w-full py-2 bg-surface-container hover:bg-surface-container-high rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Create Lot Modal */}
      <CreateLotModal
        materials={materials}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onLotCreated={() => {
          loadLots();
        }}
      />
    </div>
  );
};
