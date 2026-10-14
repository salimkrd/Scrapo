import React, { useState, useEffect } from 'react';
import {
  SalesOrder,
  Buyer,
  Dispatch,
  Invoice,
  SalesDashboardMetrics,
} from '../types';
import { useApp } from '../context/AppContext';
import { DEFAULT_YARD_ID } from '../services/seedService';
import { salesRepository } from '../repositories/salesRepository';
import { buyerRepository } from '../repositories/buyerRepository';
import { dispatchRepository } from '../repositories/dispatchRepository';
import { invoiceRepository } from '../repositories/invoiceRepository';
import { NewSaleModal } from './NewSaleModal';
import { BuyerLedgerModal } from './BuyerLedgerModal';
import { BuyerFormModal } from './BuyerFormModal';
import { DispatchModal } from './DispatchModal';
import { RecordPaymentModal } from './RecordPaymentModal';
import { InvoiceModal } from './InvoiceModal';
import { Header } from './Header';
import { BottomNav } from './BottomNav';

type SalesSubTab = 'orders' | 'buyers' | 'dispatches' | 'invoices';
type UserRole = 'OWNER' | 'MANAGER' | 'ACCOUNTANT' | 'FLOOR_WORKER';

export const SalesView: React.FC = () => {
  const { allMaterials } = useApp();

  const [activeTab, setActiveTab] = useState<SalesSubTab>('orders');
  const [currentRole, setCurrentRole] = useState<UserRole>('OWNER');
  const [metrics, setMetrics] = useState<SalesDashboardMetrics | null>(null);

  // Data lists
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const [isBuyerFormOpen, setIsBuyerFormOpen] = useState(false);
  const [buyerToEdit, setBuyerToEdit] = useState<Buyer | null>(null);
  const [ledgerBuyer, setLedgerBuyer] = useState<Buyer | null>(null);
  const [dispatchOrder, setDispatchOrder] = useState<SalesOrder | null>(null);
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [paymentBuyer, setPaymentBuyer] = useState<Buyer | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const loadAllData = async () => {
    try {
      const [m, sOrders, bList, dList, invList] = await Promise.all([
        salesRepository.getSalesMetrics(DEFAULT_YARD_ID),
        salesRepository.getAllSales(DEFAULT_YARD_ID),
        buyerRepository.getAllBuyers(DEFAULT_YARD_ID),
        dispatchRepository.getAllDispatches(DEFAULT_YARD_ID),
        invoiceRepository.getAllInvoices(DEFAULT_YARD_ID),
      ]);
      setMetrics(m);
      setSalesOrders(sOrders);
      setBuyers(bList);
      setDispatches(dList);
      setInvoices(invList);
    } catch (err) {
      console.error('Error loading sales data:', err);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Filtered lists based on search
  const filteredOrders = salesOrders.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      s.orderNumber.toLowerCase().includes(q) ||
      s.buyerSnapshot?.companyName.toLowerCase().includes(q) ||
      s.status.toLowerCase().includes(q)
    );
  });

  const filteredBuyers = buyers.filter((b) => {
    const q = searchQuery.toLowerCase();
    return (
      b.companyName.toLowerCase().includes(q) ||
      b.contactPerson.toLowerCase().includes(q) ||
      (b.gstin && b.gstin.toLowerCase().includes(q))
    );
  });

  const filteredDispatches = dispatches.filter((d) => {
    const q = searchQuery.toLowerCase();
    return (
      d.dispatchNumber.toLowerCase().includes(q) ||
      d.vehicleNumber.toLowerCase().includes(q) ||
      d.driverName.toLowerCase().includes(q)
    );
  });

  const filteredInvoices = invoices.filter((inv) => {
    const q = searchQuery.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.buyerSnapshot?.companyName.toLowerCase().includes(q) ||
      inv.status.toLowerCase().includes(q)
    );
  });

  // Permission helpers
  const canCreateSale = currentRole === 'OWNER' || currentRole === 'MANAGER';
  const canDispatch = currentRole === 'OWNER' || currentRole === 'MANAGER' || currentRole === 'FLOOR_WORKER';
  const canManageInvoices = currentRole === 'OWNER' || currentRole === 'ACCOUNTANT';

  return (
    <div className="bg-surface font-body-md text-body-md text-on-surface flex flex-col min-h-screen">
      <Header />

      <main className="flex flex-col relative w-full max-w-lg sm:max-w-xl mx-auto px-space-md pt-24 pb-28 bg-surface space-y-4">
        {/* Title Bar & Role Selector */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-title-lg text-title-lg font-bold text-on-surface flex items-center gap-2">
                <span>B2B Sales & Dispatch</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase">
                  Phase 3
                </span>
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Traceable enterprise sales from baled scrap inventory
              </p>
            </div>

            {canCreateSale && (
              <button
                type="button"
                onClick={() => setIsNewSaleOpen(true)}
                className="px-3.5 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:bg-primary/90 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              >
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                <span>+ New Sale</span>
              </button>
            )}
          </div>

          {/* Role Switching Chip Bar (Section 24 Permissions) */}
          <div className="flex items-center justify-between text-xs bg-surface-container-low p-2 rounded-xl border border-surface-container">
            <span className="text-on-surface-variant font-semibold flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">badge</span>
              <span>Active Role:</span>
            </span>
            <div className="flex gap-1">
              {(['OWNER', 'MANAGER', 'ACCOUNTANT', 'FLOOR_WORKER'] as UserRole[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setCurrentRole(r)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                    currentRole === r
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {r.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section 9 Top Metrics Hero */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Today's Sales */}
          <div className="p-3.5 bg-surface-container-lowest rounded-2xl border border-surface-container shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                Today's Sales
              </span>
              <span className="material-symbols-outlined text-primary text-[18px]">trending_up</span>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-black text-on-surface font-numeric">
                ₹{metrics ? metrics.todaySales.toLocaleString('en-IN') : '76,420'}
              </div>
              <div className="text-[10px] text-emerald-800 dark:text-emerald-300 font-semibold mt-0.5">
                ● Live active orders
              </div>
            </div>
          </div>

          {/* Pending Dispatch */}
          <div className="p-3.5 bg-surface-container-lowest rounded-2xl border border-surface-container shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                Pending Dispatch
              </span>
              <span className="material-symbols-outlined text-amber-500 text-[18px]">local_shipping</span>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-black text-amber-800 dark:text-amber-300 font-numeric">
                {metrics ? metrics.pendingDispatch : 4}
              </div>
              <div className="text-[10px] text-on-surface-variant mt-0.5">
                Awaiting truck weighment
              </div>
            </div>
          </div>

          {/* Buyer Receivables */}
          <div className="p-3.5 bg-surface-container-lowest rounded-2xl border border-surface-container shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                Buyer Receivables
              </span>
              <span className="material-symbols-outlined text-purple-500 text-[18px]">account_balance_wallet</span>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-black text-purple-800 dark:text-purple-300 font-numeric">
                ₹{metrics ? metrics.buyerReceivables.toLocaleString('en-IN') : '1,82,500'}
              </div>
              <div className="text-[10px] text-on-surface-variant mt-0.5">
                Dynamic balance due
              </div>
            </div>
          </div>

          {/* Ready Lots */}
          <div className="p-3.5 bg-surface-container-lowest rounded-2xl border border-surface-container shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                Ready Lots
              </span>
              <span className="material-symbols-outlined text-emerald-500 text-[18px]">inventory_2</span>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-black text-emerald-800 dark:text-emerald-300 font-numeric">
                {metrics ? metrics.readyLots : 7}
              </div>
              <div className="text-[10px] text-on-surface-variant mt-0.5">
                Baled & staged in bay
              </div>
            </div>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-surface-container-low rounded-xl border border-surface-container text-xs font-bold">
          {[
            { id: 'orders', label: 'Sales Orders', icon: 'point_of_sale' },
            { id: 'buyers', label: 'Buyers', icon: 'domain' },
            { id: 'dispatches', label: 'Dispatch', icon: 'local_shipping' },
            { id: 'invoices', label: 'Invoices', icon: 'receipt_long' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as SalesSubTab)}
              className={`py-2 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
              <span className="text-[11px]">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-surface-container-lowest border border-surface-container rounded-xl text-xs focus:outline-none focus:border-primary"
          />
        </div>

        {/* TAB 1: Sales Orders */}
        {activeTab === 'orders' && (
          <div className="space-y-3">
            {filteredOrders.length === 0 ? (
              <div className="p-8 text-center text-on-surface-variant bg-surface-container-lowest rounded-xl border border-dashed border-surface-container text-xs">
                No sales orders match your criteria. Click "+ New Sale" to create an order.
              </div>
            ) : (
              filteredOrders.map((order) => {
                const primaryItem = order.items?.[0];
                return (
                  <div
                    key={order.id}
                    className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container shadow-xs space-y-3 hover:border-outline-variant transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-primary">
                            {order.orderNumber}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              order.status === 'PAID'
                                ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                                : order.status === 'DISPATCHED'
                                ? 'bg-blue-500/10 text-blue-800 dark:text-blue-300'
                                : order.status === 'READY_FOR_DISPATCH'
                                ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300'
                                : 'bg-purple-500/10 text-purple-800 dark:text-purple-300'
                            }`}
                          >
                            {order.status.replace('_', ' ')}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-on-surface mt-1">
                          {order.buyerSnapshot?.companyName}
                        </h4>
                        <p className="text-xs text-on-surface-variant">
                          {primaryItem ? primaryItem.standardB2BNameSnapshot : 'Scrap Materials'} •{' '}
                          {primaryItem ? `${primaryItem.weight} ${primaryItem.unit}` : ''}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="font-bold text-base text-on-surface font-numeric">
                          ₹{order.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        <div className="text-[10px] text-on-surface-variant">
                          Balance: ₹{order.balanceAmount.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    {/* Order Action Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-container text-xs">
                      {order.status !== 'DISPATCHED' && order.status !== 'PAID' && canDispatch && (
                        <button
                          type="button"
                          onClick={() => setDispatchOrder(order)}
                          className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">local_shipping</span>
                          <span>Dispatch Truck</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={async () => {
                          const inv = invoices.find((i) => i.salesOrderId === order.id);
                          if (inv) {
                            setActiveInvoice(inv);
                          } else {
                            const newInv = await invoiceRepository.createInvoiceFromSale(order.id);
                            setActiveInvoice(newInv);
                            await loadAllData();
                          }
                        }}
                        className="px-3 py-1 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px]">receipt</span>
                        <span>View Invoice</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: Buyers Directory */}
        {activeTab === 'buyers' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-on-surface-variant">
                {filteredBuyers.length} Registered B2B Buyers
              </span>
              <button
                type="button"
                onClick={() => {
                  setBuyerToEdit(null);
                  setIsBuyerFormOpen(true);
                }}
                className="px-3 py-1.5 bg-primary text-on-primary rounded-xl text-xs font-bold hover:bg-primary/90 flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">domain_add</span>
                <span>+ Add Buyer</span>
              </button>
            </div>

            {filteredBuyers.map((buyer) => (
              <div
                key={buyer.id}
                className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container shadow-xs space-y-3 hover:border-outline-variant transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-on-surface">{buyer.companyName}</h4>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      {buyer.contactPerson} • {buyer.phone} • {buyer.state}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-[10px] bg-surface-container px-1.5 py-0.5 rounded text-on-surface-variant">
                        {buyer.gstin || 'NO GSTIN'}
                      </span>
                      <span className="text-[10px] text-on-surface-variant">
                        Terms: {buyer.paymentTermsDays}d
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-bold text-on-surface">
                      Limit: ₹{(buyer.creditLimit / 1000).toFixed(0)}k
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-container text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentBuyer(buyer);
                      setIsPaymentModalOpen(true);
                    }}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">payments</span>
                    <span>Pay</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLedgerBuyer(buyer)}
                    className="px-3 py-1 bg-primary text-on-primary rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">menu_book</span>
                    <span>View Ledger</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBuyerToEdit(buyer);
                      setIsBuyerFormOpen(true);
                    }}
                    className="px-2.5 py-1 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-lg font-bold transition-colors cursor-pointer"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: Dispatches */}
        {activeTab === 'dispatches' && (
          <div className="space-y-3">
            {filteredDispatches.length === 0 ? (
              <div className="p-8 text-center text-on-surface-variant bg-surface-container-lowest rounded-xl border border-dashed border-surface-container text-xs">
                No dispatches recorded yet. Confirm a dispatch from the Sales Orders tab.
              </div>
            ) : (
              filteredDispatches.map((dsp) => (
                <div
                  key={dsp.id}
                  className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container shadow-xs space-y-2 hover:border-outline-variant transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-primary">
                        {dsp.dispatchNumber}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-800 dark:text-blue-300">
                        {dsp.status}
                      </span>
                    </div>
                    <span className="font-mono text-xs font-bold bg-surface-container px-2 py-0.5 rounded">
                      {dsp.vehicleNumber}
                    </span>
                  </div>

                  <div className="text-xs space-y-0.5 text-on-surface-variant">
                    <div>
                      Driver: <strong className="text-on-surface">{dsp.driverName}</strong> ({dsp.driverPhone})
                    </div>
                    <div>
                      Carrier: <span className="text-on-surface">{dsp.transportCompany || 'Direct Fleet'}</span> • Slip:{' '}
                      <span className="font-mono">{dsp.weighbridgeSlipNumber}</span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-surface-container-low rounded-lg flex items-center justify-between text-xs font-numeric">
                    <div>
                      <span className="text-[10px] uppercase text-on-surface-variant">Gross / Tare</span>
                      <div className="font-medium text-on-surface">
                        {dsp.grossVehicleWeight} / {dsp.tareVehicleWeight} KG
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase text-primary font-bold">Dispatched Net</span>
                      <div className="font-black text-primary text-base">
                        {dsp.netDispatchWeight} KG
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 4: Invoices */}
        {activeTab === 'invoices' && (
          <div className="space-y-3">
            {filteredInvoices.length === 0 ? (
              <div className="p-8 text-center text-on-surface-variant bg-surface-container-lowest rounded-xl border border-dashed border-surface-container text-xs">
                No invoices found. Invoices are generated automatically on sale creation.
              </div>
            ) : (
              filteredInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container shadow-xs space-y-3 hover:border-outline-variant transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-primary">
                          {inv.invoiceNumber}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            inv.status === 'PAID'
                              ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                              : inv.status === 'PARTIALLY_PAID'
                              ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300'
                              : inv.status === 'CANCELLED'
                              ? 'bg-red-500/10 text-red-800 dark:text-red-300'
                              : 'bg-blue-500/10 text-blue-800 dark:text-blue-300'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-on-surface mt-1">
                        {inv.buyerSnapshot?.companyName}
                      </h4>
                      <p className="text-xs text-on-surface-variant">
                        Due:{' '}
                        {new Date(inv.dueDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-base text-on-surface font-numeric">
                        ₹{inv.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                      <div className="text-[10px] text-amber-800 dark:text-amber-300 font-bold">
                        Due: ₹{inv.balanceAmount.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-container text-xs">
                    {inv.status !== 'PAID' && inv.status !== 'CANCELLED' && canManageInvoices && (
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentInvoice(inv);
                          setIsPaymentModalOpen(true);
                        }}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px]">payments</span>
                        <span>Record Payment</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setActiveInvoice(inv)}
                      className="px-3 py-1 bg-primary text-on-primary rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">visibility</span>
                      <span>Preview Invoice PDF</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Global Modals for Sales Cycle */}
      <NewSaleModal
        materials={allMaterials}
        isOpen={isNewSaleOpen}
        onClose={() => setIsNewSaleOpen(false)}
        onSaleCreated={(_order, inv) => {
          loadAllData();
          setActiveInvoice(inv);
        }}
      />

      <BuyerFormModal
        buyerToEdit={buyerToEdit}
        isOpen={isBuyerFormOpen}
        onClose={() => {
          setIsBuyerFormOpen(false);
          setBuyerToEdit(null);
        }}
        onSaved={() => {
          loadAllData();
        }}
      />

      <BuyerLedgerModal
        buyer={ledgerBuyer}
        isOpen={Boolean(ledgerBuyer)}
        onClose={() => setLedgerBuyer(null)}
        onRecordPaymentClick={(buyer) => {
          setPaymentBuyer(buyer);
          setIsPaymentModalOpen(true);
        }}
      />

      <DispatchModal
        salesOrder={dispatchOrder}
        isOpen={Boolean(dispatchOrder)}
        onClose={() => setDispatchOrder(null)}
        onDispatchConfirmed={() => {
          loadAllData();
        }}
      />

      <InvoiceModal
        invoice={activeInvoice}
        isOpen={Boolean(activeInvoice)}
        onClose={() => setActiveInvoice(null)}
        onRecordPaymentClick={(inv) => {
          setPaymentInvoice(inv);
          setIsPaymentModalOpen(true);
        }}
        onInvoiceUpdated={() => {
          loadAllData();
        }}
      />

      <RecordPaymentModal
        buyer={paymentBuyer}
        invoice={paymentInvoice}
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setPaymentInvoice(null);
          setPaymentBuyer(null);
        }}
        onPaymentRecorded={() => {
          loadAllData();
        }}
      />

      <BottomNav />
    </div>
  );
};
