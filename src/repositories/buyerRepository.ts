import { db, STORES } from '../storage/indexedDb';
import { Buyer, BuyerLedgerSummary, BuyerLedgerTransaction, Invoice, BuyerPayment } from '../types';

export class BuyerRepository {
  public async getAllBuyers(yardId: string): Promise<Buyer[]> {
    const all = await db.getAll<Buyer>(STORES.BUYERS);
    return all.filter((b) => b.yardId === yardId);
  }

  public async getBuyerById(id: string): Promise<Buyer | null> {
    return await db.get<Buyer>(STORES.BUYERS, id);
  }

  public async saveBuyer(buyer: Buyer): Promise<Buyer> {
    return await db.put<Buyer>(STORES.BUYERS, buyer);
  }

  public async getBuyerLedger(buyerId: string): Promise<BuyerLedgerSummary> {
    const buyer = await this.getBuyerById(buyerId);
    const allInvoices = await db.getAll<Invoice>(STORES.INVOICES);
    const buyerInvoices = allInvoices
      .filter((inv) => inv.buyerId === buyerId && inv.status !== 'CANCELLED')
      .sort((a, b) => new Date(a.invoiceDate).getTime() - new Date(b.invoiceDate).getTime());

    const allPayments = await db.getAll<BuyerPayment>(STORES.BUYER_PAYMENTS);
    const buyerPayments = allPayments
      .filter((p) => p.buyerId === buyerId)
      .sort((a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime());

    const totalSales = buyerInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
    const totalReceived = buyerPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const outstandingBalance = Math.round((totalSales - totalReceived) * 100) / 100;

    const now = Date.now();
    let overdueAmount = 0;
    for (const inv of buyerInvoices) {
      const dueTime = new Date(inv.dueDate).getTime();
      if (dueTime < now && inv.balanceAmount > 0) {
        overdueAmount += inv.balanceAmount;
      }
    }

    // Build chronological transaction history
    type RawTx = {
      date: string;
      time: number;
      type: 'INVOICE' | 'PAYMENT' | 'CREDIT_NOTE';
      referenceId: string;
      referenceNumber: string;
      debit: number;
      credit: number;
      notes?: string;
    };

    const rawTxs: RawTx[] = [];
    for (const inv of buyerInvoices) {
      rawTxs.push({
        date: inv.invoiceDate,
        time: new Date(inv.invoiceDate).getTime(),
        type: 'INVOICE',
        referenceId: inv.id,
        referenceNumber: inv.invoiceNumber,
        debit: inv.grandTotal,
        credit: 0,
        notes: inv.notes || `Invoice ${inv.invoiceNumber}`,
      });
    }

    for (const p of buyerPayments) {
      const isCreditNote = p.paymentMethod === 'CREDIT_ADJUSTMENT';
      rawTxs.push({
        date: p.paymentDate,
        time: new Date(p.paymentDate).getTime(),
        type: isCreditNote ? 'CREDIT_NOTE' : 'PAYMENT',
        referenceId: p.id,
        referenceNumber: p.referenceNumber || p.id.slice(0, 8).toUpperCase(),
        debit: 0,
        credit: p.amount,
        notes: p.notes || `Payment via ${p.paymentMethod}`,
      });
    }

    rawTxs.sort((a, b) => a.time - b.time);

    let runningBal = 0;
    const history: BuyerLedgerTransaction[] = [];
    for (const tx of rawTxs) {
      runningBal += (tx.debit - tx.credit);
      history.push({
        date: tx.date,
        type: tx.type,
        referenceId: tx.referenceId,
        referenceNumber: tx.referenceNumber,
        debit: tx.debit,
        credit: tx.credit,
        runningBalance: Math.round(runningBal * 100) / 100,
        notes: tx.notes,
      });
    }

    return {
      buyerId,
      companyName: buyer ? buyer.companyName : 'Unknown Buyer',
      creditLimit: buyer ? buyer.creditLimit : 0,
      totalSales: Math.round(totalSales * 100) / 100,
      totalReceived: Math.round(totalReceived * 100) / 100,
      outstandingBalance,
      overdueAmount: Math.round(overdueAmount * 100) / 100,
      transactionHistory: history,
    };
  }
}

export const buyerRepository = new BuyerRepository();
