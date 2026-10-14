// Acceptance Test Suite for Scrapo Core Foundation & Offline Repository Layer
import 'fake-indexeddb/auto';
import { seedService, DEFAULT_YARD_ID } from '../src/services/seedService';
import { materialRepository } from '../src/repositories/materialRepository';
import { rateRepository } from '../src/repositories/rateRepository';
import { sellerRepository } from '../src/repositories/sellerRepository';
import { purchaseRepository } from '../src/repositories/purchaseRepository';
import { paymentRepository } from '../src/repositories/paymentRepository';
import { inventoryRepository } from '../src/repositories/inventoryRepository';
import { syncRepository } from '../src/repositories/syncRepository';
import { procurementService } from '../src/services/procurementService';
import { db, STORES } from '../src/storage/indexedDb';
import { LegacyMaterialCompat } from '../src/types';

async function runAcceptanceTests() {
  console.log('====================================================');
  console.log('🚀 RUNNING SCRAPO FOUNDATION ACCEPTANCE TESTS');
  console.log('====================================================\n');

  let passedTests = 0;
  const totalTests = 14;

  // Setup: Seed initial data
  await seedService.seedInitialData();
  const allMaterials = await materialRepository.getResolvedMaterials(DEFAULT_YARD_ID);
  const allSellers = await sellerRepository.getAllSellers(DEFAULT_YARD_ID);

  console.log(`✓ Seeded ${allMaterials.length} materials with corrected taxonomy`);
  console.log(`✓ Seeded ${allSellers.length} active sellers\n`);

  // Verify taxonomy corrections
  const petti = allMaterials.find((m) => m.primaryAlias.displayNameEnglish === 'Petti');
  if (petti?.material.masterCategory !== 'Plastic' || petti?.material.standardName !== 'PP Crates (Polypropylene)') {
    throw new Error(`Taxonomy check failed: Petti must be Plastic -> PP Crates, found: ${petti?.material.masterCategory} -> ${petti?.material.standardName}`);
  }

  const kuppi = allMaterials.find((m) => m.primaryAlias.displayNameEnglish === 'Kuppi');
  if (kuppi?.material.masterCategory !== 'Plastic' || kuppi?.material.standardName !== 'PET Bottles (Clear/Mixed)') {
    throw new Error(`Taxonomy check failed: Kuppi must be Plastic -> PET Bottles, found: ${kuppi?.material.masterCategory} -> ${kuppi?.material.standardName}`);
  }
  console.log('✓ Taxonomy verification passed: Petti is Plastic (PP Crates), Kuppi is Plastic (PET Bottles)\n');

  const testSeller = allSellers[0]; // K.K. Shaji
  const ironMat = allMaterials.find((m) => m.primaryAlias.displayNameEnglish === 'Irumbu')!;
  const copperMat = allMaterials.find((m) => m.primaryAlias.displayNameEnglish === 'Chembu')!;

  // Helper to map resolved material to LegacyMaterialCompat
  const toCompat = (resMat: typeof ironMat): LegacyMaterialCompat => ({
    id: resMat.material.id,
    name: resMat.primaryAlias.displayNameEnglish,
    nameMl: resMat.primaryAlias.displayNameMalayalam,
    gradeEn: resMat.primaryAlias.localSubtitle,
    standardB2BTerm: resMat.material.standardName,
    rate: resMat.activePurchaseRate,
    category: 'metals',
    accentColor: 'primary',
    icon: resMat.material.icon,
    defaultTare: resMat.primaryAlias.defaultTare,
    keywords: resMat.primaryAlias.keywords,
    rawMaterial: resMat.material,
    rawAlias: resMat.primaryAlias,
    rawRate: resMat.currentRate,
  });

  const ironCompat = toCompat(ironMat);
  const copperCompat = toCompat(copperMat);

  // --------------------------------------------------------------------------
  // Scenario 1: User creates a purchase while offline.
  // --------------------------------------------------------------------------
  console.log('Scenario 1: User creates a purchase while offline');
  const initialStockIron = await inventoryRepository.getBalance(ironMat.material.id);
  const initialSyncCount = await syncRepository.getPendingCount(DEFAULT_YARD_ID);

  const purchase1 = await procurementService.executePurchase({
    yardId: DEFAULT_YARD_ID,
    seller: testSeller,
    items: [
      {
        material: ironCompat,
        grossWeight: 102.0,
        tareWeight: 2.0,
        netWeight: 100.0,
        ratePerKg: 32.0,
        lineAmount: 3200.0,
        tareActive: true,
        weightSource: 'SIMULATED_SCALE',
      },
    ],
    paymentMode: 'CASH',
  });

  if (purchase1.id && purchase1.totalAmount === 3200 && purchase1.totalNetWeight === 100) {
    console.log(`  ✓ Created Purchase ${purchase1.slipNumber} (UUID: ${purchase1.id}) with amount ₹${purchase1.totalAmount}`);
    passedTests++;
  } else {
    throw new Error('Scenario 1 failed: Purchase record was not created properly');
  }

  // --------------------------------------------------------------------------
  // Scenario 2 & 3: Browser refresh preserves newly created purchase.
  // --------------------------------------------------------------------------
  console.log('\nScenario 2 & 3: Refreshes browser -> Purchase is still present');
  // Reading directly from IndexedDB without memory state
  const fetchedPurchase = await purchaseRepository.getPurchaseById(purchase1.id);
  const fetchedItems = await purchaseRepository.getPurchaseItems(purchase1.id);

  if (fetchedPurchase && fetchedPurchase.slipNumber === purchase1.slipNumber && fetchedItems.length === 1) {
    console.log(`  ✓ Verified persistent recovery from IndexedDB: ${fetchedPurchase.slipNumber} intact with item ${fetchedItems[0].materialNameSnapshot}`);
    passedTests += 2; // Scenario 2 (reloading from storage) and Scenario 3 (purchase still present)
  } else {
    throw new Error('Scenario 2/3 failed: Purchase was lost or not persisted to IndexedDB');
  }

  // --------------------------------------------------------------------------
  // Scenario 4: Inventory increased correctly.
  // --------------------------------------------------------------------------
  console.log('\nScenario 4: Inventory increased correctly');
  const updatedStockIron = await inventoryRepository.getBalance(ironMat.material.id);
  const stockDelta = updatedStockIron - initialStockIron;

  if (stockDelta === 100.0) {
    console.log(`  ✓ Iron stock increased by exactly 100.0 KG (from ${initialStockIron} to ${updatedStockIron} KG)`);
    passedTests++;
  } else {
    throw new Error(`Scenario 4 failed: Expected delta of 100.0 KG, got ${stockDelta}`);
  }

  // --------------------------------------------------------------------------
  // Scenario 5: Seller ledger updated correctly.
  // --------------------------------------------------------------------------
  console.log('\nScenario 5: Seller ledger updated correctly');
  const ledger1 = await sellerRepository.getSellerLedger(testSeller.id);
  console.log(`  ✓ Seller ${testSeller.name} ledger: Total Purchase Value: ₹${ledger1.totalPurchaseValue}, Total Paid: ₹${ledger1.totalPaid}, Outstanding: ₹${ledger1.outstandingBalance}`);
  if (ledger1.totalPurchaseValue >= 3200 && ledger1.totalPaid >= 3200) {
    passedTests++;
  } else {
    throw new Error('Scenario 5 failed: Seller ledger was not derived correctly');
  }

  // --------------------------------------------------------------------------
  // Scenario 6: Rate used at purchase time remains unchanged even after today's rate is edited.
  // --------------------------------------------------------------------------
  console.log('\nScenario 6: Rate snapshot remains unchanged after today\'s rate is edited');
  // Edit today's rate for Irumbu from ₹32 to ₹38
  await rateRepository.setRate(ironMat.material.id, DEFAULT_YARD_ID, 38.0, 42.0);
  const newActiveRate = await rateRepository.getActiveRate(ironMat.material.id, DEFAULT_YARD_ID);

  // Check the historical purchase item snapshot
  const itemSnapshot = (await purchaseRepository.getPurchaseItems(purchase1.id))[0];
  console.log(`  • New Active Rate for today: ₹${newActiveRate?.purchaseRate}/KG`);
  console.log(`  • Historical Purchase Item Rate Snapshot: ₹${itemSnapshot.ratePerKg}/KG`);

  if (newActiveRate?.purchaseRate === 38.0 && itemSnapshot.ratePerKg === 32.0 && itemSnapshot.lineAmount === 3200.0) {
    console.log('  ✓ Verified: Old purchase transaction preserved its frozen rate of ₹32.0/KG without retroactive corruption');
    passedTests++;
  } else {
    throw new Error('Scenario 6 failed: Historical rate was corrupted or new rate did not apply');
  }

  // --------------------------------------------------------------------------
  // Scenario 7: Pending sync badge reflects unsynced records.
  // --------------------------------------------------------------------------
  console.log('\nScenario 7: Pending sync badge reflects unsynced records');
  const currentPendingSync = await syncRepository.getPendingCount(DEFAULT_YARD_ID);
  console.log(`  ✓ Current pending sync records in queue: ${currentPendingSync} (initially was ${initialSyncCount})`);
  if (currentPendingSync > initialSyncCount) {
    passedTests++;
  } else {
    throw new Error('Scenario 7 failed: Sync queue did not increment pending count');
  }

  // --------------------------------------------------------------------------
  // Scenario 8: A multi-material purchase produces one purchase with multiple items.
  // --------------------------------------------------------------------------
  console.log('\nScenario 8: A multi-material purchase produces one purchase with multiple items');
  const multiPurchase = await procurementService.executePurchase({
    yardId: DEFAULT_YARD_ID,
    seller: testSeller,
    items: [
      {
        material: ironCompat,
        grossWeight: 52.0,
        tareWeight: 2.0,
        netWeight: 50.0,
        ratePerKg: 38.0,
        lineAmount: 1900.0,
        tareActive: true,
      },
      {
        material: copperCompat,
        grossWeight: 10.5,
        tareWeight: 0.5,
        netWeight: 10.0,
        ratePerKg: 610.0,
        lineAmount: 6100.0,
        tareActive: true,
      },
    ],
    paymentMode: 'UPI',
  });

  const multiItems = await purchaseRepository.getPurchaseItems(multiPurchase.id);
  console.log(`  ✓ Multi-item purchase created: ${multiPurchase.slipNumber} with total amount ₹${multiPurchase.totalAmount}`);
  console.log(`  ✓ Total Items in single purchase: ${multiItems.length} (${multiItems[0].materialNameSnapshot} + ${multiItems[1].materialNameSnapshot})`);

  if (multiItems.length === 2 && multiPurchase.totalAmount === 8000) {
    passedTests++;
  } else {
    throw new Error(`Scenario 8 failed: Expected 2 items with total ₹8000, got ${multiItems.length} items`);
  }

  // --------------------------------------------------------------------------
  // Scenario 9: Credit payment updates seller outstanding balance.
  // --------------------------------------------------------------------------
  console.log('\nScenario 9: Credit payment updates seller outstanding balance');
  const ledgerBeforeCredit = await sellerRepository.getSellerLedger(testSeller.id);
  const outstandingBefore = ledgerBeforeCredit.outstandingBalance;

  const creditPurchase = await procurementService.executePurchase({
    yardId: DEFAULT_YARD_ID,
    seller: testSeller,
    items: [
      {
        material: ironCompat,
        grossWeight: 27.0,
        tareWeight: 2.0,
        netWeight: 25.0,
        ratePerKg: 38.0,
        lineAmount: 950.0,
        tareActive: true,
      },
    ],
    paymentMode: 'CREDIT', // Not paid immediately, added to ledger
  });

  const ledgerAfterCredit = await sellerRepository.getSellerLedger(testSeller.id);
  const outstandingAfter = ledgerAfterCredit.outstandingBalance;
  const creditDiff = outstandingAfter - outstandingBefore;

  console.log(`  • Outstanding before credit purchase: ₹${outstandingBefore}`);
  console.log(`  • Outstanding after credit purchase: ₹${outstandingAfter} (Diff: +₹${creditDiff})`);

  if (creditDiff === 950.0 && creditPurchase.paymentStatus === 'PENDING') {
    console.log('  ✓ Verified: Credit payment directly updated seller outstanding ledger balance');
    passedTests++;
  } else {
    throw new Error(`Scenario 9 failed: Expected credit diff of ₹950, got ₹${creditDiff}`);
  }

  // --------------------------------------------------------------------------
  // Scenario 10: No duplicate purchase is created when a sync operation is retried.
  // --------------------------------------------------------------------------
  console.log('\nScenario 10: No duplicate purchase is created when a sync operation is retried');
  const syncQueueBefore = await syncRepository.getAllRecords(DEFAULT_YARD_ID);
  const targetSync = syncQueueBefore.find((s) => s.entityId === multiPurchase.id);

  if (!targetSync) {
    throw new Error('Target purchase not found in sync queue');
  }

  // Simulate network attempt 1
  const result1 = await syncRepository.processSyncQueue(DEFAULT_YARD_ID);
  console.log(`  • Sync Run 1: Synced ${result1.synced} records`);

  // Retry the sync run again immediately
  const result2 = await syncRepository.processSyncQueue(DEFAULT_YARD_ID);
  console.log(`  • Sync Run 2 (Retry): Synced ${result2.synced} records (0 pending remaining)`);

  // Count total purchases in DB to ensure no duplication
  const allPurchasesAfterSync = await purchaseRepository.getAllPurchases(DEFAULT_YARD_ID);
  const matchingPurchases = allPurchasesAfterSync.filter((p) => p.id === multiPurchase.id);

  console.log(`  • Total instances of UUID ${multiPurchase.id} in store: ${matchingPurchases.length}`);

  if (matchingPurchases.length === 1 && result2.synced === 0) {
    console.log('  ✓ Idempotency verified: Stable UUID prevents duplicate purchases upon sync retries');
    passedTests++;
  } else {
    throw new Error(`Scenario 10 failed: Found ${matchingPurchases.length} matching purchases!`);
  }

  // --------------------------------------------------------------------------
  // Scenario 11: Split Payment distributes across multiple payments (Cash + Credit)
  // --------------------------------------------------------------------------
  console.log('\nScenario 11: Split Payment distributes across multiple payments');
  const ledgerBeforeSplit = await sellerRepository.getSellerLedger(testSeller.id);
  const outstandingBeforeSplit = ledgerBeforeSplit.outstandingBalance;

  const splitPurchase = await procurementService.executePurchase({
    yardId: DEFAULT_YARD_ID,
    seller: testSeller,
    items: [
      {
        material: copperCompat,
        grossWeight: 10.0,
        tareWeight: 0.0,
        netWeight: 10.0,
        ratePerKg: 500.0,
        lineAmount: 5000.0,
        tareActive: false,
      },
    ],
    paymentMode: 'SPLIT',
    splitBreakdown: [
      { mode: 'CASH', amount: 3000 },
      { mode: 'CREDIT', amount: 2000 },
    ],
  });

  const splitPayments = await paymentRepository.getPaymentsForPurchase(splitPurchase.id);
  const ledgerAfterSplit = await sellerRepository.getSellerLedger(testSeller.id);
  const outstandingAfterSplit = ledgerAfterSplit.outstandingBalance;
  const splitDiff = outstandingAfterSplit - outstandingBeforeSplit;

  console.log(`  • Split purchase total: ₹${splitPurchase.totalAmount} (Payments: ${splitPayments.length})`);
  console.log(`  • Payment 1: ${splitPayments[0]?.paymentMode} ₹${splitPayments[0]?.amount} (${splitPayments[0]?.status})`);
  console.log(`  • Payment 2: ${splitPayments[1]?.paymentMode} ₹${splitPayments[1]?.amount} (${splitPayments[1]?.status})`);
  console.log(`  • Outstanding diff: +₹${splitDiff} (matching Credit split of ₹2000)`);

  if (splitPayments.length === 2 && splitDiff === 2000 && splitPayments.some((p) => p.paymentMode === 'CASH' && p.status === 'COMPLETED') && splitPayments.some((p) => p.paymentMode === 'CREDIT' && p.status === 'PENDING')) {
    console.log('  ✓ Verified: Split payment generated distinct payments and properly adjusted ledger');
    passedTests++;
  } else {
    throw new Error('Scenario 11 failed: Split payment did not produce expected payment records or ledger diff');
  }

  // --------------------------------------------------------------------------
  // Scenario 12: Seller Credit Settlement payout reduces outstanding balance
  // --------------------------------------------------------------------------
  console.log('\nScenario 12: Seller Credit Settlement payout reduces outstanding balance');
  const settlePayment = await sellerRepository.recordSettlementPayment(
    DEFAULT_YARD_ID,
    testSeller.id,
    2000,
    'CASH',
    'Evening settlement test'
  );

  const ledgerAfterSettle = await sellerRepository.getSellerLedger(testSeller.id);
  const outstandingAfterSettle = ledgerAfterSettle.outstandingBalance;
  const settleDiff = outstandingAfterSplit - outstandingAfterSettle;

  console.log(`  • Settle payment recorded: ₹${settlePayment.amount} (${settlePayment.paymentMode})`);
  console.log(`  • Outstanding before settle: ₹${outstandingAfterSplit}`);
  console.log(`  • Outstanding after settle: ₹${outstandingAfterSettle} (Diff: -₹${settleDiff})`);

  if (settleDiff === 2000 && settlePayment.status === 'COMPLETED') {
    console.log('  ✓ Verified: Ledger credit payout successfully reduced outstanding balance');
    passedTests++;
  } else {
    throw new Error(`Scenario 12 failed: Expected ₹2000 reduction, got diff of ₹${settleDiff}`);
  }

  // --------------------------------------------------------------------------
  // Scenario 13: New seller registration stores in IndexedDB and enables immediate purchasing
  // --------------------------------------------------------------------------
  console.log('\nScenario 13: New seller registration stores in IndexedDB and enables purchasing');
  const newSellerData: Seller = {
    id: `seller_test_${Date.now()}`,
    yardId: DEFAULT_YARD_ID,
    initials: 'MS',
    name: 'M.P. Suresh',
    nameMl: 'സുരേഷ്',
    type: 'Local Collector',
    phone: '+91 98471 99887',
    badge: 'New Seller',
    vehicleNumber: 'KL-07-XX-9988',
    upiId: '9847199887@upi',
    bankName: 'Federal Bank',
    bankAccount: '•••• 1234',
    ifsc: 'FDRL0001244',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await sellerRepository.saveSeller(newSellerData);
  const retrievedSeller = await sellerRepository.getSellerById(newSellerData.id);

  console.log(`  • Registered new seller: ${retrievedSeller?.name} (${retrievedSeller?.nameMl})`);
  console.log(`  • Vehicle: ${retrievedSeller?.vehicleNumber}, Phone: ${retrievedSeller?.phone}`);

  if (retrievedSeller && retrievedSeller.id === newSellerData.id && retrievedSeller.name === 'M.P. Suresh') {
    console.log('  ✓ Verified: New seller persisted and retrievable from IndexedDB');
    passedTests++;
  } else {
    throw new Error('Scenario 13 failed: New seller not retrieved properly from IndexedDB');
  }

  // --------------------------------------------------------------------------
  // Scenario 14: Local material alias update preserves standard B2B classification
  // --------------------------------------------------------------------------
  console.log('\nScenario 14: Local material alias update preserves standard B2B classification');
  await materialRepository.updateAlias(petti.primaryAlias.id, {
    displayNameEnglish: 'Petti Box',
    displayNameMalayalam: 'പെട്ടി പെട്ടി',
    localSubtitle: 'Rigid Polypropylene Crates',
  });

  const refreshedMaterials = await materialRepository.getResolvedMaterials(DEFAULT_YARD_ID);
  const updatedPetti = refreshedMaterials.find((m) => m.primaryAlias.id === petti.primaryAlias.id)!;

  console.log(`  • Updated Local Alias (English): "${updatedPetti.primaryAlias.displayNameEnglish}"`);
  console.log(`  • Updated Local Alias (Malayalam): "${updatedPetti.primaryAlias.displayNameMalayalam}"`);
  console.log(`  • Preserved Standard B2B Term: "${updatedPetti.material.standardName}" (Category: ${updatedPetti.material.masterCategory})`);

  if (
    updatedPetti.primaryAlias.displayNameEnglish === 'Petti Box' &&
    updatedPetti.material.standardName === 'PP Crates (Polypropylene)' &&
    updatedPetti.material.masterCategory === 'Plastic'
  ) {
    console.log('  ✓ Verified: Worker-facing alias updated while standard B2B classification remained strictly preserved');
    passedTests++;
  } else {
    throw new Error('Scenario 14 failed: Taxonomy corrupted or alias not updated');
  }

  console.log('\n====================================================');
  console.log(`🎉 ALL ${passedTests}/${totalTests} ACCEPTANCE TESTS PASSED SUCCESSFULLY!`);
  console.log('====================================================\n');
}

runAcceptanceTests().catch((err) => {
  console.error('\n❌ ACCEPTANCE TEST FAILED:');
  console.error(err);
  process.exit(1);
});
