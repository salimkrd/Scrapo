import { db, STORES } from '../storage/indexedDb';
import { Purchase, PurchaseItem, Payment } from '../types/domain';
import { inventoryRepository } from './inventoryRepository';
import { syncRepository } from './syncRepository';

export class PurchaseRepository {
  async getAllPurchases(yardId: string): Promise<Purchase[]> {
    const all = await db.getAll<Purchase>(STORES.PURCHASES);
    return all
      .filter((p) => p.yardId === yardId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getPurchaseById(id: string): Promise<Purchase | null> {
    return db.get<Purchase>(STORES.PURCHASES, id);
  }

  async getPurchaseItems(purchaseId: string): Promise<PurchaseItem[]> {
    const all = await db.getAll<PurchaseItem>(STORES.PURCHASE_ITEMS);
    return all.filter((i) => i.purchaseId === purchaseId);
  }

  async getNextSlipNumber(yardId: string): Promise<string> {
    const purchases = await this.getAllPurchases(yardId);
    let maxNum = 8942; // base benchmark from Stitch
    for (const p of purchases) {
      const match = p.slipNumber.match(/SC-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    return `#SC-${maxNum + 1}`;
  }

  /**
   * Complete transactional commit of a purchase:
   * 1. Saves Purchase
   * 2. Saves PurchaseItems
   * 3. Saves Payments
   * 4. Records InventoryMovements
   * 5. Appends to Sync Queue
   */
  async createPurchaseTransaction(
    purchase: Purchase,
    items: PurchaseItem[],
    payments: Payment[]
  ): Promise<Purchase> {
    // 1. Save Purchase
    await db.put(STORES.PURCHASES, purchase);

    // 2. Save Items
    await db.putMany(STORES.PURCHASE_ITEMS, items);

    // 3. Save Payments
    await db.putMany(STORES.PAYMENTS, payments);

    // 4. Record Inventory Movements for each item
    for (const item of items) {
      await inventoryRepository.recordMovement(
        purchase.yardId,
        item.materialId,
        'PURCHASE',
        purchase.id,
        'PURCHASE',
        item.netWeight,
        'KG',
        item.ratePerKg,
        purchase.createdBy
      );
    }

    // 5. Add to Sync Queue with stable UUID for idempotency
    await syncRepository.addToQueue(
      purchase.yardId,
      'PURCHASE',
      purchase.id,
      'INSERT',
      {
        purchase,
        items,
        payments,
      }
    );

    return purchase;
  }
}

export const purchaseRepository = new PurchaseRepository();
