import React, { useState, useEffect } from 'react';
import { Buyer, Lot, LegacyMaterialCompat, SalesOrder, Invoice } from '../types';
import { DEFAULT_YARD_ID } from '../services/seedService';
import { buyerRepository } from '../repositories/buyerRepository';
import { lotRepository } from '../repositories/lotRepository';
import { inventoryRepository } from '../repositories/inventoryRepository';
import { salesRepository } from '../repositories/salesRepository';
import { invoiceRepository } from '../repositories/invoiceRepository';

interface NewSaleModalProps {
  materials: LegacyMaterialCompat[];
  isOpen: boolean;
  onClose: () => void;
  onSaleCreated: (order: SalesOrder, invoice: Invoice) => void;
}

export const NewSaleModal: React.FC<NewSaleModalProps> = ({
  materials,
  isOpen,
  onClose,
  onSaleCreated,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [buyerSearch, setBuyerSearch] = useState<string>('');

  // Form State
  const [selectedBuyer, setSelectedBuyer] = useState<Buyer | null>(null);
  const [sourceType, setSourceType] = useState<'LOT' | 'LOOSE'>('LOT');
  const [selectedLotId, setSelectedLotId] = useState<string>('');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const [saleWeight, setSaleWeight] = useState<number>(850);
  const [sellingRate, setSellingRate] = useState<number>(21);
  const [transportCharge, setTransportCharge] = useState<number>(0);
  const [loadingCharge, setLoadingCharge] = useState<number>(0);
  const [otherCharge, setOtherCharge] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('Contract delivery terms apply');

  const [availableStock, setAvailableStock] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Load buyers and lots on open
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setError(null);
      buyerRepository.getAllBuyers(DEFAULT_YARD_ID).then((bList) => {
        setBuyers(bList);
        if (bList.length > 0 && !selectedBuyer) {
          setSelectedBuyer(bList[0]);
        }
      });
      lotRepository.getAllLots(DEFAULT_YARD_ID).then((lList) => {
        const availableLots = lList.filter(
          (l) => ['READY', 'PARTIALLY_DISPATCHED'].includes(l.status) && l.availableWeight > 0
        );
        setLots(availableLots);
        if (availableLots.length > 0) {
          setSelectedLotId(availableLots[0].id);
          setSelectedMaterialId(availableLots[0].materialId);
          setSaleWeight(availableLots[0].availableWeight);
          setAvailableStock(availableLots[0].availableWeight);
          const mat = materials.find((m) => m.id === availableLots[0].materialId);
          if (mat) {
            setSellingRate(mat.rawMaterial?.expectedSellingRate || mat.rate * 1.15);
          }
        }
      });
    }
  }, [isOpen]);

  // Update available stock when lot or loose material changes
  useEffect(() => {
    if (sourceType === 'LOT' && selectedLotId) {
      const lot = lots.find((l) => l.id === selectedLotId);
      if (lot) {
        setAvailableStock(lot.availableWeight);
        setSelectedMaterialId(lot.materialId);
        const mat = materials.find((m) => m.id === lot.materialId);
        if (mat) {
          setSellingRate(mat.rawMaterial?.expectedSellingRate || mat.rate * 1.15);
        }
      }
    } else if (sourceType === 'LOOSE' && selectedMaterialId) {
      inventoryRepository.getBalance(selectedMaterialId).then((bal) => {
        setAvailableStock(bal);
        const mat = materials.find((m) => m.id === selectedMaterialId);
        if (mat) {
          setSellingRate(mat.rawMaterial?.expectedSellingRate || mat.rate * 1.15);
        }
      });
    }
  }, [sourceType, selectedLotId, selectedMaterialId, lots, materials]);

  if (!isOpen) return null;

  // Financial recalculation
  const lineAmount = Math.round(saleWeight * sellingRate * 100) / 100;
  const subtotal = lineAmount;
  const taxableAmount = Math.max(0, Math.round((subtotal + transportCharge + loadingCharge + otherCharge - discount) * 100) / 100);

  const isIntraState = !selectedBuyer?.state || selectedBuyer.state.trim().toLowerCase() === 'kerala';
  const taxRate = 18; // Standard GST for scrap recyclables
  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (isIntraState) {
    cgst = Math.round(taxableAmount * (taxRate / 200) * 100) / 100;
    sgst = Math.round(taxableAmount * (taxRate / 200) * 100) / 100;
  } else {
    igst = Math.round(taxableAmount * (taxRate / 100) * 100) / 100;
  }
  const grandTotal = Math.round((taxableAmount + cgst + sgst + igst) * 100) / 100;

  const currentMat = materials.find((m) => m.id === selectedMaterialId);
  const currentLot = lots.find((l) => l.id === selectedLotId);
  const standardName = currentLot
    ? currentLot.standardB2BName
    : currentMat
    ? currentMat.standardB2BTerm
    : 'Industrial Scrap Material';

  // Step Validation & Navigation
  const handleNext = () => {
    setError(null);
    if (currentStep === 1) {
      if (!selectedBuyer) {
        setError('Please select a B2B buyer to proceed.');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (sourceType === 'LOT' && !selectedLotId) {
        setError('Please select an active lot.');
        return;
      }
      if (sourceType === 'LOOSE' && !selectedMaterialId) {
        setError('Please select a material.');
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (saleWeight <= 0) {
        setError('Sale weight must be greater than zero.');
        return;
      }
      if (saleWeight > availableStock) {
        setError(`INSUFFICIENT_INVENTORY: Selected weight (${saleWeight} KG) exceeds available stock (${availableStock} KG).`);
        return;
      }
      setCurrentStep(4);
    } else if (currentStep === 4) {
      if (sellingRate <= 0) {
        setError('Selling rate must be greater than zero.');
        return;
      }
      setCurrentStep(5);
    } else if (currentStep === 5) {
      setCurrentStep(6);
    } else if (currentStep === 6) {
      setCurrentStep(7);
    }
  };

  const handleBack = () => {
    setError(null);
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleConfirmSale = async () => {
    if (!selectedBuyer) return;
    setSubmitting(true);
    setError(null);

    try {
      const order = await salesRepository.createSale({
        yardId: DEFAULT_YARD_ID,
        buyer: selectedBuyer,
        items: [
          {
            materialId: selectedMaterialId,
            standardB2BName: standardName,
            lotId: sourceType === 'LOT' ? selectedLotId : undefined,
            weight: saleWeight,
            ratePerKg: sellingRate,
            taxRate: 18,
            unit: 'KG',
          },
        ],
        transportCharge,
        loadingCharge,
        otherCharge,
        discount,
        notes,
        createdBy: 'manager',
      });

      // Generate invoice snapshot
      const invoice = await invoiceRepository.createInvoiceFromSale(order.id, 'manager');

      onSaleCreated(order, invoice);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to complete sale transaction');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredBuyers = buyers.filter(
    (b) =>
      b.companyName.toLowerCase().includes(buyerSearch.toLowerCase()) ||
      b.contactPerson.toLowerCase().includes(buyerSearch.toLowerCase()) ||
      (b.gstin && b.gstin.toLowerCase().includes(buyerSearch.toLowerCase()))
  );

  const stepTitles = [
    'Select Buyer',
    'Select Material / Lot',
    'Enter Dispatch Weight',
    'Enter Selling Rate',
    'Charges & Tax',
    'Review Order',
    'Confirm Sale',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface text-on-surface w-full max-w-xl max-h-[92vh] rounded-2xl shadow-2xl border border-surface-container flex flex-col overflow-hidden">
        {/* Step Indicator Header */}
        <div className="px-6 py-4 bg-surface-container-low border-b border-surface-container">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-on-primary text-xs font-bold flex items-center justify-center">
                {currentStep}
              </span>
              <h3 className="font-bold text-sm sm:text-base text-on-surface">
                Step {currentStep} of 7: {stepTitles[currentStep - 1]}
              </h3>
            </div>
            <button
              onClick={onClose}
              type="button"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-primary h-full transition-all duration-300 rounded-full"
              style={{ width: `${(currentStep / 7) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Select Buyer */}
          {currentStep === 1 && (
            <div className="space-y-3">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Search buyer by company name, contact, or GSTIN..."
                  value={buyerSearch}
                  onChange={(e) => setBuyerSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-surface-container-lowest border border-surface-container rounded-xl text-xs focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {filteredBuyers.map((b) => {
                  const isSelected = selectedBuyer?.id === b.id;
                  return (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBuyer(b)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-primary/10 border-primary shadow-sm'
                          : 'bg-surface-container-lowest border-surface-container hover:border-outline-variant'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${
                            isSelected ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface'
                          }`}
                        >
                          {b.companyName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-on-surface">{b.companyName}</div>
                          <div className="text-xs text-on-surface-variant flex items-center gap-1.5 mt-0.5">
                            <span>{b.contactPerson}</span>
                            <span>•</span>
                            <span>{b.state}</span>
                            {b.gstin && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-[10px] bg-surface-container px-1 rounded">
                                  {b.gstin}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold text-on-surface">
                          Limit: ₹{(b.creditLimit / 1000).toFixed(0)}k
                        </span>
                        <div className="text-[10px] text-on-surface-variant">Terms: {b.paymentTermsDays}d</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: Select Material / Lot */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex gap-2 p-1 bg-surface-container-low rounded-xl border border-surface-container">
                <button
                  type="button"
                  onClick={() => setSourceType('LOT')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                    sourceType === 'LOT' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
                  }`}
                >
                  From Ready Lots / Bales
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType('LOOSE')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                    sourceType === 'LOOSE' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
                  }`}
                >
                  From Loose Yard Stock
                </button>
              </div>

              {sourceType === 'LOT' ? (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                    Select Ready Lot ({lots.length} available)
                  </label>
                  {lots.length === 0 ? (
                    <div className="p-6 text-center text-on-surface-variant bg-surface-container-lowest rounded-xl border border-dashed border-surface-container text-xs">
                      No ready lots available. Please create a lot first or choose Loose Yard Stock.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                      {lots.map((lot) => {
                        const isSelected = selectedLotId === lot.id;
                        return (
                          <div
                            key={lot.id}
                            onClick={() => {
                              setSelectedLotId(lot.id);
                              setSelectedMaterialId(lot.materialId);
                              setSaleWeight(lot.availableWeight);
                            }}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? 'bg-primary/10 border-primary shadow-sm'
                                : 'bg-surface-container-lowest border-surface-container hover:border-outline-variant'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-sm text-primary">
                                  {lot.lotNumber}
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">
                                  {lot.status}
                                </span>
                              </div>
                              <div className="font-semibold text-xs text-on-surface mt-1">
                                {lot.standardB2BName}
                              </div>
                              <div className="text-[11px] text-on-surface-variant mt-0.5">
                                Staging Location: <span className="font-medium text-on-surface">{lot.warehouseLocation}</span>
                              </div>
                            </div>

                            <div className="text-right">
                              <span className="font-bold text-base text-on-surface font-numeric">
                                {lot.availableWeight} KG
                              </span>
                              <div className="text-[10px] text-on-surface-variant">Available Stock</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                    Select Material from Loose Inventory
                  </label>
                  <select
                    value={selectedMaterialId}
                    onChange={(e) => setSelectedMaterialId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-surface-container-lowest border border-surface-container rounded-xl text-sm font-medium focus:outline-none focus:border-primary"
                  >
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.standardB2BTerm} ({m.name})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Enter Dispatch Weight */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="p-3.5 bg-surface-container-low rounded-xl border border-surface-container flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
                    {sourceType === 'LOT' ? 'Lot Available Balance' : 'Loose Available Stock'}
                  </div>
                  <div className="text-xl font-black text-on-surface mt-0.5 font-numeric">
                    {availableStock.toLocaleString('en-IN')} KG
                  </div>
                </div>
                <div className="text-right text-xs text-on-surface-variant">
                  Standard B2B Item:<br />
                  <strong className="text-primary">{standardName}</strong>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  Sale / Dispatch Weight (KG) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max={availableStock}
                    value={saleWeight}
                    onChange={(e) => setSaleWeight(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-surface-container-lowest border border-surface-container rounded-xl text-2xl font-bold font-numeric focus:outline-none focus:border-primary"
                  />
                  <span className="absolute right-4 top-3.5 text-sm font-bold text-on-surface-variant">
                    KG
                  </span>
                </div>
              </div>

              {sourceType === 'LOT' && (
                <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 text-xs text-blue-800 dark:text-blue-300">
                  {saleWeight < availableStock ? (
                    <span>
                      ℹ️ <strong>Partial Lot Consumption:</strong> {saleWeight} KG will be sold. The remaining{' '}
                      <strong>{(availableStock - saleWeight).toFixed(1)} KG</strong> will stay in this lot with status{' '}
                      <span className="font-mono font-bold">PARTIALLY_DISPATCHED</span>.
                    </span>
                  ) : (
                    <span>
                      ℹ️ <strong>Full Lot Consumption:</strong> Entire lot of {availableStock} KG will be sold.
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Enter Selling Rate */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  B2B Selling Rate (₹ / KG) *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-lg font-bold text-on-surface-variant">₹</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0.1"
                    value={sellingRate}
                    onChange={(e) => setSellingRate(Number(e.target.value))}
                    className="w-full pl-8 pr-4 py-3 bg-surface-container-lowest border border-surface-container rounded-xl text-2xl font-bold font-numeric focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="p-3.5 bg-surface-container-low rounded-xl border border-surface-container flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
                    Computed Material Line Value
                  </div>
                  <div className="text-xl font-bold text-primary mt-0.5 font-numeric">
                    ₹{lineAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="text-right text-xs text-on-surface-variant">
                  {saleWeight} KG × ₹{sellingRate}/KG
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Charges & Tax */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                    Transport Charge (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={transportCharge}
                    onChange={(e) => setTransportCharge(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container rounded-xl text-sm font-numeric focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                    Loading Charge (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={loadingCharge}
                    onChange={(e) => setLoadingCharge(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container rounded-xl text-sm font-numeric focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                    Other Surcharge (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={otherCharge}
                    onChange={(e) => setOtherCharge(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container rounded-xl text-sm font-numeric focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                    Discount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container rounded-xl text-sm font-numeric focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  Contract / Delivery Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Weighbridge slip required with consignment"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container rounded-xl text-sm focus:outline-none focus:border-primary"
                />
              </div>

              {/* Automatic GST Determination Card */}
              <div className="p-3.5 bg-surface-container-low rounded-xl border border-surface-container space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-on-surface">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-primary">policy</span>
                    <span>GST Calculation ({selectedBuyer?.state || 'Kerala'})</span>
                  </span>
                  <span className="font-mono text-primary">
                    {isIntraState ? 'Intra-State (CGST + SGST)' : 'Inter-State (IGST)'}
                  </span>
                </div>

                <div className="text-xs space-y-1 text-on-surface-variant border-t border-surface-container pt-2">
                  <div className="flex justify-between">
                    <span>Taxable Base Value:</span>
                    <span className="font-semibold text-on-surface">
                      ₹{taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {isIntraState ? (
                    <>
                      <div className="flex justify-between">
                        <span>CGST (9.0%):</span>
                        <span className="font-semibold text-on-surface">
                          ₹{cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>SGST (9.0%):</span>
                        <span className="font-semibold text-on-surface">
                          ₹{sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between">
                      <span>IGST (18.0%):</span>
                      <span className="font-semibold text-on-surface">
                        ₹{igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm text-primary pt-1 border-t border-surface-container">
                    <span>Grand Total:</span>
                    <span>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6 & 7: Review & Confirm */}
          {(currentStep === 6 || currentStep === 7) && (
            <div className="space-y-4">
              <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container space-y-3">
                <div className="flex items-start justify-between border-b border-surface-container pb-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">
                      Buyer Snapshot
                    </span>
                    <h4 className="font-bold text-sm text-on-surface mt-0.5">
                      {selectedBuyer?.companyName}
                    </h4>
                    <p className="text-xs text-on-surface-variant">
                      {selectedBuyer?.contactPerson} • {selectedBuyer?.state} • GSTIN:{' '}
                      <span className="font-mono">{selectedBuyer?.gstin || 'None'}</span>
                    </p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-bold">
                    Terms: {selectedBuyer?.paymentTermsDays} Days
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-surface-container/50">
                    <span className="text-on-surface-variant">Material (Standard B2B):</span>
                    <span className="font-bold text-on-surface">{standardName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-surface-container/50">
                    <span className="text-on-surface-variant">Dispatch Weight:</span>
                    <span className="font-bold text-on-surface">{saleWeight} KG</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-surface-container/50">
                    <span className="text-on-surface-variant">Selling Rate:</span>
                    <span className="font-bold text-on-surface">₹{sellingRate}/KG</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-surface-container/50">
                    <span className="text-on-surface-variant">Subtotal:</span>
                    <span className="font-bold text-on-surface">
                      ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {(transportCharge > 0 || loadingCharge > 0 || otherCharge > 0 || discount > 0) && (
                    <div className="flex justify-between py-1 border-b border-surface-container/50">
                      <span className="text-on-surface-variant">Ancillary Charges & Discount:</span>
                      <span className="font-bold text-on-surface">
                        ₹{(transportCharge + loadingCharge + otherCharge - discount).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-b border-surface-container/50">
                    <span className="text-on-surface-variant">Taxes (GST 18%):</span>
                    <span className="font-bold text-on-surface">
                      ₹{(cgst + sgst + igst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 text-base font-black text-primary">
                    <span>Grand Total:</span>
                    <span>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {currentStep === 7 && (
                <div className="p-3.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">task_alt</span>
                    <span>Ready to finalize B2B Sales Order</span>
                  </div>
                  <p>
                    Confirming this sale will reserve the inventory, freeze price and material snapshots, and automatically generate sequential invoice{' '}
                    <span className="font-mono font-bold">SCR/26-27/XXXXXX</span>.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-3 bg-surface-container-low border-t border-surface-container flex items-center justify-between">
          <button
            type="button"
            onClick={currentStep === 1 ? onClose : handleBack}
            className="px-4 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            {currentStep === 1 ? 'Cancel' : 'Back'}
          </button>

          {currentStep < 7 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-5 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <span>Continue</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={handleConfirmSale}
              className="px-6 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              <span>{submitting ? 'Confirming Sale...' : 'Confirm B2B Sale & Generate Invoice'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
