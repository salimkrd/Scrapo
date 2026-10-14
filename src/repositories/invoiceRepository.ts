import { db, STORES } from '../storage/indexedDb';
import { Invoice, InvoiceStatus, BuyerPayment, BuyerPaymentMethod } from '../types';
import { businessProfileRepository } from './businessProfileRepository';
import { buyerRepository } from './buyerRepository';
import { salesRepository } from './salesRepository';

export class InvoiceRepository {
  public async getAllInvoices(yardId: string): Promise<Invoice[]> {
    const all = await db.getAll<Invoice>(STORES.INVOICES);
    return all
      .filter((inv) => inv.yardId === yardId)
      .sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());
  }

  public async getInvoiceById(id: string): Promise<Invoice | null> {
    return await db.get<Invoice>(STORES.INVOICES, id);
  }

  private generateFinancialYear(): string {
    const now = new Date();
    const month = now.getMonth() + 1; // 1-12
    const year = now.getFullYear();
    const startYear = month >= 4 ? year : year - 1;
    const endYear = startYear + 1;
    return `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
  }

  public async generateNextInvoiceNumber(yardId: string): Promise<string> {
    const all = await this.getAllInvoices(yardId);
    const fy = this.generateFinancialYear();
    const prefix = `SCR/${fy}/`;
    const count = all.length + 1;
    return `${prefix}${String(count).padStart(6, '0')}`;
  }

  public async createInvoiceFromSale(salesOrderId: string, createdBy = 'manager'): Promise<Invoice> {
    const sale = await salesRepository.getSaleById(salesOrderId);
    if (!sale) {
      throw new Error(`Sales order ${salesOrderId} not found`);
    }

    // Check if an invoice already exists for this order
    const existing = await this.getAllInvoices(sale.yardId);
    const alreadyExists = existing.find((inv) => inv.salesOrderId === salesOrderId && inv.status !== 'CANCELLED');
    if (alreadyExists) {
      return alreadyExists;
    }

    const buyer = await buyerRepository.getBuyerById(sale.buyerId);
    if (!buyer) {
      throw new Error(`Buyer ${sale.buyerId} not found`);
    }

    const sellerProfile = await businessProfileRepository.getProfile(sale.yardId);
    const invoiceNumber = await this.generateNextInvoiceNumber(sale.yardId);

    const now = new Date();
    const invoiceDate = now.toISOString();
    const dueTime = new Date(now.getTime() + (buyer.paymentTermsDays || 15) * 24 * 60 * 60 * 1000);
    const dueDate = dueTime.toISOString();

    const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const invoice: Invoice = {
      id: invoiceId,
      yardId: sale.yardId,
      invoiceNumber,
      salesOrderId: sale.id,
      buyerId: buyer.id,
      invoiceDate,
      dueDate,
      status: 'ISSUED',
      sellerProfileSnapshot: JSON.parse(JSON.stringify(sellerProfile)),
      buyerSnapshot: JSON.parse(JSON.stringify(buyer)),
      itemsSnapshot: JSON.parse(JSON.stringify(sale.items)),
      subtotal: sale.subtotal,
      loadingCharge: sale.loadingCharge,
      transportCharge: sale.transportCharge,
      otherCharge: sale.otherCharge,
      discount: sale.discount,
      taxableAmount: sale.taxableAmount,
      cgst: sale.cgst,
      sgst: sale.sgst,
      igst: sale.igst,
      grandTotal: sale.grandTotal,
      paidAmount: 0,
      balanceAmount: sale.grandTotal,
      notes: sale.notes,
      createdBy,
      createdAt: invoiceDate,
      updatedAt: invoiceDate,
    };

    await db.put<Invoice>(STORES.INVOICES, invoice);
    return invoice;
  }

  public async recordPayment(data: {
    yardId: string;
    buyerId: string;
    invoiceId?: string;
    salesOrderId?: string;
    amount: number;
    paymentMethod: BuyerPaymentMethod;
    referenceNumber?: string;
    notes?: string;
    createdBy?: string;
  }): Promise<BuyerPayment> {
    if (data.amount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    const id = `bpay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const payment: BuyerPayment = {
      id,
      yardId: data.yardId,
      buyerId: data.buyerId,
      invoiceId: data.invoiceId,
      salesOrderId: data.salesOrderId,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      referenceNumber: data.referenceNumber,
      paymentDate: now,
      notes: data.notes,
      createdBy: data.createdBy || 'accountant',
      createdAt: now,
    };

    await db.put<BuyerPayment>(STORES.BUYER_PAYMENTS, payment);

    // If payment is against a specific invoice, update invoice balance
    if (data.invoiceId) {
      const invoice = await this.getInvoiceById(data.invoiceId);
      if (invoice) {
        const newPaid = Math.round((invoice.paidAmount + data.amount) * 100) / 100;
        const newBalance = Math.max(0, Math.round((invoice.grandTotal - newPaid) * 100) / 100);
        let newStatus: InvoiceStatus = 'PARTIALLY_PAID';
        if (newBalance <= 0) {
          newStatus = 'PAID';
        }

        const updatedInv: Invoice = {
          ...invoice,
          paidAmount: newPaid,
          balanceAmount: newBalance,
          status: newStatus,
          updatedAt: now,
        };
        await db.put<Invoice>(STORES.INVOICES, updatedInv);

        // Also update sales order paidAmount / balanceAmount if tied
        if (invoice.salesOrderId) {
          const sale = await salesRepository.getSaleById(invoice.salesOrderId);
          if (sale) {
            const salePaid = Math.round((sale.paidAmount + data.amount) * 100) / 100;
            const saleBal = Math.max(0, Math.round((sale.grandTotal - salePaid) * 100) / 100);
            await salesRepository.updateSale(sale.id, {
              paidAmount: salePaid,
              balanceAmount: saleBal,
              status: saleBal <= 0 ? 'PAID' : 'PARTIALLY_PAID',
            });
          }
        }
      }
    }

    return payment;
  }

  public async cancelInvoice(invoiceId: string): Promise<Invoice> {
    const invoice = await this.getInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }
    const updated: Invoice = {
      ...invoice,
      status: 'CANCELLED',
      updatedAt: new Date().toISOString(),
    };
    await db.put<Invoice>(STORES.INVOICES, updated);
    return updated;
  }
}

export const invoiceRepository = new InvoiceRepository();
