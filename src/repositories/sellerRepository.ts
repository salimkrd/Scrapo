import { db, STORES } from '../storage/indexedDb';
import { Purchase, Payment, PaymentMode, Seller, SellerLedgerSummary } from '../types/domain';

export class SellerRepository {
  async getAllSellers(yardId: string): Promise<Seller[]> {
    const all = await db.getAll<Seller>(STORES.SELLERS);
    return all.filter((s) => s.yardId === yardId && s.active);
  }

  async getSellerById(id: string): Promise<Seller | null> {
    return db.get<Seller>(STORES.SELLERS, id);
  }

  async saveSeller(seller: Seller): Promise<Seller> {
    await db.put(STORES.SELLERS, seller);
    return seller;
  }

  /**
   * Dynamically computes the seller ledger balance:
   * Total Purchases = sum of all non-draft purchase totalAmounts
   * Total Paid = sum of all COMPLETED non-credit payments
   * Outstanding Balance = Total Purchases - Total Paid
   */
  async getSellerLedger(sellerId: string): Promise<SellerLedgerSummary> {
    const allPurchases = await db.getAll<Purchase>(STORES.PURCHASES);
    const sellerPurchases = allPurchases.filter(
      (p) => p.sellerId === sellerId && p.paymentStatus !== 'DRAFT'
    );

    const allPayments = await db.getAll<Payment>(STORES.PAYMENTS);
    const sellerPayments = allPayments.filter(
      (p) => p.sellerId === sellerId && p.status === 'COMPLETED'
    );

    const totalPurchaseValue = sellerPurchases.reduce((acc, p) => acc + p.totalAmount, 0);

    // Payments actually disbursed to the seller (Cash, UPI, Bank Transfer)
    const totalPaid = sellerPayments
      .filter((p) => p.paymentMode !== 'CREDIT')
      .reduce((acc, p) => acc + p.amount, 0);

    // Outstanding balance owed to seller (or if credit extended)
    const outstandingBalance = Math.max(0, totalPurchaseValue - totalPaid);

    const lastPurchase = sellerPurchases.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

    return {
      sellerId,
      totalPurchaseValue,
      totalPaid,
      outstandingBalance,
      transactionsCount: sellerPurchases.length,
      lastTransactionAt: lastPurchase?.createdAt,
    };
  }

  /**
   * Records a direct cash/UPI/bank payout to settle an outstanding seller credit balance
   */
  async recordSettlementPayment(
    yardId: string,
    sellerId: string,
    amount: number,
    paymentMode: PaymentMode,
    notes?: string
  ): Promise<Payment> {
    const payment: Payment = {
      id: crypto.randomUUID
        ? crypto.randomUUID()
        : `pay_settle_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      purchaseId: 'SETTLEMENT',
      yardId,
      sellerId,
      paymentMode,
      amount,
      status: 'COMPLETED',
      referenceNumber: `SETTLE-${Date.now().toString().slice(-6)}`,
      notes: notes || 'Ledger credit payout',
      createdAt: new Date().toISOString(),
      createdBy: 'worker_anoop',
    };

    await db.put(STORES.PAYMENTS, payment);
    return payment;
  }
}

export const sellerRepository = new SellerRepository();
