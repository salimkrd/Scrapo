import { db, STORES } from '../storage/indexedDb';
import { Payment } from '../types/domain';

export class PaymentRepository {
  async recordPayment(payment: Payment): Promise<Payment> {
    await db.put(STORES.PAYMENTS, payment);
    return payment;
  }

  async recordPayments(payments: Payment[]): Promise<void> {
    await db.putMany(STORES.PAYMENTS, payments);
  }

  async getPaymentsForPurchase(purchaseId: string): Promise<Payment[]> {
    const all = await db.getAll<Payment>(STORES.PAYMENTS);
    return all.filter((p) => p.purchaseId === purchaseId);
  }

  async getPaymentsForSeller(sellerId: string): Promise<Payment[]> {
    const all = await db.getAll<Payment>(STORES.PAYMENTS);
    return all
      .filter((p) => p.sellerId === sellerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export const paymentRepository = new PaymentRepository();
