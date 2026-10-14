import { purchaseRepository } from '../repositories/purchaseRepository';
import {
  Payment,
  PaymentMode,
  PaymentStatus,
  Purchase,
  PurchaseItem,
  Seller,
  WeightSource,
} from '../types/domain';
import { LegacyMaterialCompat } from '../types';

export interface ProcurementItemInput {
  material: LegacyMaterialCompat;
  grossWeight: number;
  tareWeight: number;
  netWeight: number;
  ratePerKg: number;
  lineAmount: number;
  weightSource?: WeightSource;
  scaleDeviceId?: string;
  rawWeight?: number;
  tareActive: boolean;
}

export interface CompleteProcurementInput {
  yardId: string;
  seller: Seller;
  items: ProcurementItemInput[];
  paymentMode: PaymentMode;
  splitBreakdown?: { mode: PaymentMode; amount: number }[];
  isDraft?: boolean;
  notes?: string;
  createdBy?: string;
}

export class ProcurementService {
  async executePurchase(input: CompleteProcurementInput): Promise<Purchase> {
    const {
      yardId,
      seller,
      items,
      paymentMode,
      splitBreakdown,
      isDraft = false,
      notes,
      createdBy = 'worker_anoop',
    } = input;

    const now = new Date().toISOString();

    // 1. Stable UUID for Idempotency
    const purchaseId = crypto.randomUUID
      ? crypto.randomUUID()
      : `pur_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // 2. Sequential Slip Number
    const slipNumber = await purchaseRepository.getNextSlipNumber(yardId);

    // 3. Calculate Weight and Amount Totals
    const totalGrossWeight = items.reduce((acc, it) => acc + it.grossWeight, 0);
    const totalTareWeight = items.reduce((acc, it) => acc + it.tareWeight, 0);
    const totalNetWeight = items.reduce((acc, it) => acc + it.netWeight, 0);
    const subtotalAmount = items.reduce((acc, it) => acc + it.lineAmount, 0);
    const totalAmount = Math.round(subtotalAmount);
    const roundOff = totalAmount - subtotalAmount;

    // 4. Create Purchase Items with rate snapshots
    const purchaseItems: PurchaseItem[] = items.map((it) => ({
      id: crypto.randomUUID
        ? crypto.randomUUID()
        : `item_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      purchaseId,
      materialId: it.material.rawMaterial?.id || it.material.id,
      materialAliasId: it.material.rawAlias?.id || it.material.id,
      materialNameSnapshot: it.material.name,
      materialMlSnapshot: it.material.nameMl,
      standardB2BTermSnapshot: it.material.standardB2BTerm || it.material.gradeEn,
      grossWeight: it.grossWeight,
      tareWeight: it.tareWeight,
      netWeight: it.netWeight,
      ratePerKg: it.ratePerKg, // snapshot locked at purchase time
      lineAmount: it.lineAmount,
      weightSource: it.weightSource || 'SIMULATED_SCALE',
      scaleDeviceId: it.scaleDeviceId || 'CAS-CI-2001-YARD02',
      rawWeight: it.rawWeight || it.grossWeight,
      tareActive: it.tareActive,
      createdAt: now,
    }));

    // 5. Determine Payment Status and Records
    let paymentStatus: PaymentStatus = 'PAID';
    if (isDraft) {
      paymentStatus = 'DRAFT';
    } else if (paymentMode === 'CREDIT') {
      paymentStatus = 'PENDING';
    }

    const payments: Payment[] = [];

    if (splitBreakdown && splitBreakdown.length > 0) {
      for (const split of splitBreakdown) {
        payments.push({
          id: crypto.randomUUID
            ? crypto.randomUUID()
            : `pay_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          purchaseId,
          yardId,
          sellerId: seller.id,
          paymentMode: split.mode,
          amount: split.amount,
          status: isDraft ? 'PENDING' : split.mode === 'CREDIT' ? 'PENDING' : 'COMPLETED',
          createdAt: now,
          createdBy,
        });
      }
    } else {
      payments.push({
        id: crypto.randomUUID
          ? crypto.randomUUID()
          : `pay_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        purchaseId,
        yardId,
        sellerId: seller.id,
        paymentMode,
        amount: totalAmount,
        status: isDraft ? 'PENDING' : paymentMode === 'CREDIT' ? 'PENDING' : 'COMPLETED',
        createdAt: now,
        createdBy,
      });
    }

    // 6. Complete Purchase Record
    const purchase: Purchase = {
      id: purchaseId,
      yardId,
      slipNumber,
      sellerId: seller.id,
      sellerSnapshot: seller,
      totalGrossWeight,
      totalTareWeight,
      totalNetWeight,
      subtotalAmount,
      roundOff,
      totalAmount,
      paymentStatus,
      primaryPaymentMode: paymentMode,
      notes,
      items: purchaseItems,
      payments,
      createdAt: now,
      updatedAt: now,
      createdBy,
    };

    // 7. Atomic Transaction Commit (Purchase + Items + Payments + Inventory Movement + Sync Queue)
    await purchaseRepository.createPurchaseTransaction(purchase, purchaseItems, payments);

    return purchase;
  }
}

export const procurementService = new ProcurementService();
