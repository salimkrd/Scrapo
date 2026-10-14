import 'fake-indexeddb/auto';
import { seedService, DEFAULT_YARD_ID } from '../src/services/seedService';
import { materialRepository } from '../src/repositories/materialRepository';
import { inventoryRepository } from '../src/repositories/inventoryRepository';
import { buyerRepository } from '../src/repositories/buyerRepository';
import { lotRepository } from '../src/repositories/lotRepository';
import { salesRepository } from '../src/repositories/salesRepository';
import { dispatchRepository } from '../src/repositories/dispatchRepository';
import { invoiceRepository } from '../src/repositories/invoiceRepository';
import { db, STORES } from '../src/storage/indexedDb';
import { Buyer, Lot } from '../src/types';

async function runPhase3AcceptanceTests() {
  console.log('====================================================');
  console.log('🚀 RUNNING SCRAPO PHASE 3 B2B ACCEPTANCE TESTS');
  console.log('====================================================\n');

  // 1. Setup seed data
  await seedService.seedInitialData();
  const allMaterials = await materialRepository.getResolvedMaterials(DEFAULT_YARD_ID);
  const occMat = allMaterials.find((m) => m.material.standardName.includes('OCC'))!;

  console.log('✓ Database initialized with taxonomy and Phase 3 stores\n');

  // TEST 1: Buyer creation & retrieval
  console.log('Test 1: Buyer creation & retrieval');
  const newBuyer: Buyer = {
    id: 'buyer_test_kottayam',
    yardId: DEFAULT_YARD_ID,
    companyName: 'Kottayam Paper Boards Ltd',
    contactPerson: 'Thomas Varghese',
    phone: '+91 94471 99120',
    email: 'purchase@kottayampaper.com',
    gstin: '32AABCK9912D1Z8',
    billingAddress: 'Nattakom Industrial Belt, Kottayam',
    shippingAddress: 'Mill Gate 1, Kottayam',
    state: 'Kerala',
    pincode: '686013',
    paymentTermsDays: 20,
    creditLimit: 600000,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'manager',
    version: 1,
  };
  await buyerRepository.saveBuyer(newBuyer);
  const fetchedBuyer = await buyerRepository.getBuyerById('buyer_test_kottayam');
  if (!fetchedBuyer || fetchedBuyer.companyName !== 'Kottayam Paper Boards Ltd') {
    throw new Error('Test 1 failed: Buyer could not be saved or fetched properly');
  }
  console.log(`  ✓ Created & fetched buyer: ${fetchedBuyer.companyName} (Limit: ₹${fetchedBuyer.creditLimit})\n`);

  // TEST 2: Lot creation from available loose inventory
  console.log('Test 2: Lot creation from available loose inventory');
  const looseBefore = await inventoryRepository.getBalance(occMat.material.id);
  const baledNet = 400.0;

  const lot1 = await lotRepository.createLot({
    yardId: DEFAULT_YARD_ID,
    materialId: occMat.material.id,
    standardB2BName: 'OCC - Old Corrugated Containers',
    grossWeight: 402.0,
    tareWeight: 2.0,
    netWeight: baledNet,
    warehouseLocation: 'Bay C2',
    notes: 'Hydraulic strapped bale',
    createdBy: 'manager',
  });

  const looseAfter = await inventoryRepository.getBalance(occMat.material.id);
  if (Math.round((looseBefore - looseAfter) * 100) / 100 !== baledNet) {
    throw new Error(`Test 2 failed: Loose inventory should have decreased by ${baledNet} KG, but diff was ${looseBefore - looseAfter}`);
  }
  if (lot1.availableWeight !== baledNet || lot1.status !== 'READY') {
    throw new Error('Test 2 failed: Lot available weight or status incorrect');
  }
  console.log(`  ✓ Created lot ${lot1.lotNumber} (${baledNet} KG). Loose stock decreased from ${looseBefore} KG to ${looseAfter} KG\n`);

  // TEST 3: Lot creation blocks over-allocation
  console.log('Test 3: Lot creation blocks over-allocation');
  const excessiveWeight = looseAfter + 5000;
  let blocked = false;
  try {
    await lotRepository.createLot({
      yardId: DEFAULT_YARD_ID,
      materialId: occMat.material.id,
      standardB2BName: 'OCC - Old Corrugated Containers',
      grossWeight: excessiveWeight + 2,
      tareWeight: 2,
      netWeight: excessiveWeight,
    });
  } catch (err: any) {
    if (err.message.includes('INSUFFICIENT_INVENTORY')) {
      blocked = true;
    }
  }
  if (!blocked) {
    throw new Error('Test 3 failed: Lot creation should have been blocked due to insufficient stock');
  }
  console.log('  ✓ Verified: Excessive lot creation rejected with INSUFFICIENT_INVENTORY\n');

  // TEST 4: Sales order creation with standard B2B snapshot & GST calculation
  console.log('Test 4: Sales order creation with standard B2B snapshot & GST');
  const saleOrder = await salesRepository.createSale({
    yardId: DEFAULT_YARD_ID,
    buyer: fetchedBuyer,
    items: [
      {
        materialId: occMat.material.id,
        standardB2BName: 'OCC - Old Corrugated Containers',
        lotId: lot1.id,
        weight: 300.0, // Partial consumption: 300 of 400 KG
        ratePerKg: 22.0,
        taxRate: 18,
      },
    ],
    transportCharge: 500,
    loadingCharge: 200,
    discount: 100,
    notes: 'Partial lot test sale',
  });

  if (saleOrder.items[0].standardB2BNameSnapshot !== 'OCC - Old Corrugated Containers') {
    throw new Error('Test 4 failed: standardB2BNameSnapshot was not preserved');
  }
  // Subtotal = 300 * 22 = 6600
  // Taxable = 6600 + 500 + 200 - 100 = 7200
  // Intra-state (Kerala): CGST 9% (648) + SGST 9% (648) = 1296
  // Grand Total = 7200 + 1296 = 8496
  if (saleOrder.subtotal !== 6600 || saleOrder.taxableAmount !== 7200 || saleOrder.grandTotal !== 8496) {
    throw new Error(`Test 4 failed: Financial totals mismatch: grandTotal=${saleOrder.grandTotal}, expected=8496`);
  }
  console.log(`  ✓ Sales order created: ${saleOrder.orderNumber} (Subtotal: ₹${saleOrder.subtotal}, Tax: ₹${saleOrder.cgst + saleOrder.sgst}, Grand Total: ₹${saleOrder.grandTotal})\n`);

  // TEST 5: Automatic unique sequential invoice generation
  console.log('Test 5: Automatic unique sequential invoice generation');
  const invoice = await invoiceRepository.createInvoiceFromSale(saleOrder.id);
  if (!invoice.invoiceNumber.startsWith('SCR/')) {
    throw new Error(`Test 5 failed: Invalid invoice number format: ${invoice.invoiceNumber}`);
  }
  if (invoice.grandTotal !== saleOrder.grandTotal || invoice.balanceAmount !== saleOrder.grandTotal) {
    throw new Error('Test 5 failed: Invoice financial snapshot does not match sale order');
  }
  console.log(`  ✓ Generated unique invoice: ${invoice.invoiceNumber} (Status: ${invoice.status})\n`);

  // TEST 6: Vehicle weighment & confirmed dispatch
  console.log('Test 6: Vehicle weighment & confirmed dispatch (Inventory movement)');
  const dispatch = await dispatchRepository.createDispatch({
    yardId: DEFAULT_YARD_ID,
    salesOrderId: saleOrder.id,
    vehicleNumber: 'KL-05-AB-1234',
    driverName: 'Suresh Kumar',
    driverPhone: '+91 94471 55667',
    transportCompany: 'Kottayam Carriers',
    grossVehicleWeight: 8000,
    tareVehicleWeight: 7700,
    netDispatchWeight: 300,
  });

  if (dispatch.status !== 'DISPATCHED') {
    throw new Error('Test 6 failed: Dispatch status not DISPATCHED');
  }

  // Verify lot available weight decreased and lot is PARTIALLY_DISPATCHED
  const lotAfterDispatch = await lotRepository.getLotById(lot1.id);
  if (!lotAfterDispatch) {
    throw new Error('Test 6 failed: Lot not found after dispatch');
  }
  if (lotAfterDispatch.availableWeight !== 100 || lotAfterDispatch.status !== 'PARTIALLY_DISPATCHED') {
    throw new Error(`Test 6 failed: Lot available weight expected 100 KG, got ${lotAfterDispatch.availableWeight}; status expected PARTIALLY_DISPATCHED, got ${lotAfterDispatch.status}`);
  }
  console.log(`  ✓ Confirmed dispatch ${dispatch.dispatchNumber}. Lot ${lot1.lotNumber} partially dispatched (100 KG remaining available)\n`);

  // TEST 7: Dispatch prevents double consumption
  console.log('Test 7: Dispatch prevents double consumption');
  let doubleDispatchBlocked = false;
  try {
    await dispatchRepository.createDispatch({
      yardId: DEFAULT_YARD_ID,
      salesOrderId: saleOrder.id,
      vehicleNumber: 'KL-05-AB-1234',
      driverName: 'Suresh Kumar',
      driverPhone: '+91 94471 55667',
      grossVehicleWeight: 8000,
      tareVehicleWeight: 7700,
    });
  } catch (err: any) {
    if (err.message.includes('already been dispatched')) {
      doubleDispatchBlocked = true;
    }
  }
  if (!doubleDispatchBlocked) {
    throw new Error('Test 7 failed: Double dispatch was not prevented');
  }
  console.log('  ✓ Verified: Duplicate dispatch strictly blocked\n');

  // TEST 8: Partial buyer payment updates invoice status & buyer ledger
  console.log('Test 8: Partial buyer payment updates invoice status & buyer ledger');
  const partialPayment = await invoiceRepository.recordPayment({
    yardId: DEFAULT_YARD_ID,
    buyerId: fetchedBuyer.id,
    invoiceId: invoice.id,
    amount: 5000,
    paymentMethod: 'BANK_TRANSFER',
    referenceNumber: 'NEFT-0019281',
    notes: 'Advance part payment',
  });

  const invAfterPartial = await invoiceRepository.getInvoiceById(invoice.id);
  if (!invAfterPartial || invAfterPartial.status !== 'PARTIALLY_PAID' || invAfterPartial.balanceAmount !== 3496) {
    throw new Error(`Test 8 failed: Partial payment did not update invoice status properly. Status: ${invAfterPartial?.status}, Balance: ${invAfterPartial?.balanceAmount}`);
  }

  const ledgerAfterPartial = await buyerRepository.getBuyerLedger(fetchedBuyer.id);
  if (ledgerAfterPartial.totalSales !== 8496 || ledgerAfterPartial.totalReceived !== 5000 || ledgerAfterPartial.outstandingBalance !== 3496) {
    throw new Error(`Test 8 failed: Buyer ledger calculation mismatch: outstanding=${ledgerAfterPartial.outstandingBalance}, expected=3496`);
  }
  console.log(`  ✓ Recorded partial payment ₹5000. Invoice status: PARTIALLY_PAID (Balance: ₹${invAfterPartial.balanceAmount}). Buyer ledger outstanding: ₹${ledgerAfterPartial.outstandingBalance}\n`);

  // TEST 9: Final buyer payment completes invoice
  console.log('Test 9: Final buyer payment completes invoice');
  await invoiceRepository.recordPayment({
    yardId: DEFAULT_YARD_ID,
    buyerId: fetchedBuyer.id,
    invoiceId: invoice.id,
    amount: 3496,
    paymentMethod: 'UPI',
    referenceNumber: 'UPI-9921827',
    notes: 'Final settlement payment',
  });

  const invAfterFinal = await invoiceRepository.getInvoiceById(invoice.id);
  if (!invAfterFinal || invAfterFinal.status !== 'PAID' || invAfterFinal.balanceAmount !== 0) {
    throw new Error(`Test 9 failed: Final payment did not mark invoice PAID. Status: ${invAfterFinal?.status}, Balance: ${invAfterFinal?.balanceAmount}`);
  }

  const ledgerAfterFinal = await buyerRepository.getBuyerLedger(fetchedBuyer.id);
  if (ledgerAfterFinal.outstandingBalance !== 0 || ledgerAfterFinal.totalReceived !== 8496) {
    throw new Error(`Test 9 failed: Final ledger balance expected 0, got ${ledgerAfterFinal.outstandingBalance}`);
  }
  console.log(`  ✓ Recorded final payment ₹3496. Invoice status: PAID (Balance: ₹0). Buyer ledger outstanding: ₹${ledgerAfterFinal.outstandingBalance}\n`);

  // TEST 10: Stock Summary tier decomposition
  console.log('Test 10: Stock Summary tier decomposition (Total, Loose, Lots, Reserved, Available)');
  const stockSummary = await lotRepository.getStockSummary(DEFAULT_YARD_ID, occMat.material.id, occMat.material.standardName);
  if (stockSummary.looseStock < 0 || stockSummary.lotStock < 0 || stockSummary.totalStock < stockSummary.availableStock) {
    throw new Error('Test 10 failed: Inconsistent stock summary breakdown');
  }
  console.log(`  ✓ Stock Decomposition: Total: ${stockSummary.totalStock} KG | Loose: ${stockSummary.looseStock} KG | Lots: ${stockSummary.lotStock} KG | Reserved: ${stockSummary.reservedStock} KG | Available: ${stockSummary.availableStock} KG\n`);

  console.log('====================================================');
  console.log('🎉 ALL 10 PHASE 3 B2B ACCEPTANCE TESTS PASSED!');
  console.log('====================================================');
}

runPhase3AcceptanceTests().catch((err) => {
  console.error('❌ Phase 3 Acceptance Test Error:', err);
  process.exit(1);
});
