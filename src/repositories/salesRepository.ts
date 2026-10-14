import { db, STORES } from '../storage/indexedDb';
import { SalesOrder, SalesItem, SalesDashboardMetrics, Buyer } from '../types';
import { inventoryRepository } from './inventoryRepository';
import { lotRepository } from './lotRepository';

export class SalesRepository {
  public async getAllSales(yardId: string): Promise<SalesOrder[]> {
    const all = await db.getAll<SalesOrder>(STORES.SALES_ORDERS);
    return all
      .filter((s) => s.yardId === yardId)
      .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  }

  public async getSaleById(id: string): Promise<SalesOrder | null> {
    return await db.get<SalesOrder>(STORES.SALES_ORDERS, id);
  }

  public async createSale(data: {
    id?: string;
    yardId: string;
    buyer: Buyer;
    items: {
      materialId: string;
      standardB2BName: string;
      hsnCode?: string;
      lotId?: string;
      weight: number;
      ratePerKg: number;
      taxRate?: number;
      unit?: 'KG' | 'TON' | 'PCS';
    }[];
    transportCharge?: number;
    loadingCharge?: number;
    otherCharge?: number;
    discount?: number;
    notes?: string;
    createdBy?: string;
    orderDate?: string;
  }): Promise<SalesOrder> {
    const allSales = await this.getAllSales(data.yardId);
    const year = new Date().getFullYear();
    const orderNumber = `SO-${year}-${String(allSales.length + 1).padStart(4, '0')}`;
    const orderId = data.id || `sale_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = data.orderDate || new Date().toISOString();

    const salesItems: SalesItem[] = [];
    let subtotal = 0;
    let weightedTaxSum = 0;

    for (const it of data.items) {
      if (it.weight <= 0) {
        throw new Error('Sale item weight must be greater than zero');
      }
      if (it.ratePerKg <= 0) {
        throw new Error('Sale item rate must be greater than zero');
      }

      // Stock check
      if (it.lotId) {
        const lot = await lotRepository.getLotById(it.lotId);
        if (!lot) {
          throw new Error(`Lot ${it.lotId} not found`);
        }
        if (lot.availableWeight < it.weight) {
          throw new Error(`INSUFFICIENT_INVENTORY: Lot only has ${lot.availableWeight} KG available`);
        }
      } else {
        const looseStock = await inventoryRepository.getBalance(it.materialId);
        if (looseStock < it.weight) {
          throw new Error(`INSUFFICIENT_INVENTORY: Loose stock is ${looseStock} KG, cannot sell ${it.weight} KG`);
        }
      }

      const lineAmount = Math.round(it.weight * it.ratePerKg * 100) / 100;
      const taxRate = it.taxRate !== undefined ? it.taxRate : 18;
      subtotal += lineAmount;
      weightedTaxSum += (lineAmount * taxRate);

      salesItems.push({
        id: `sitem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        salesOrderId: orderId,
        materialId: it.materialId,
        lotId: it.lotId,
        descriptionSnapshot: it.standardB2BName,
        standardB2BNameSnapshot: it.standardB2BName,
        hsnCodeSnapshot: it.hsnCode || '7204',
        weight: it.weight,
        unit: it.unit || 'KG',
        ratePerKg: it.ratePerKg,
        lineAmount,
        taxRate,
      });
    }

    const transport = data.transportCharge || 0;
    const loading = data.loadingCharge || 0;
    const other = data.otherCharge || 0;
    const discount = data.discount || 0;

    const taxableAmount = Math.max(0, Math.round((subtotal + transport + loading + other - discount) * 100) / 100);
    const avgTaxRate = subtotal > 0 ? weightedTaxSum / subtotal : 18;

    const isIntraState = !data.buyer.state || data.buyer.state.trim().toLowerCase() === 'kerala';
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (isIntraState) {
      const halfRate = avgTaxRate / 2;
      cgst = Math.round(taxableAmount * (halfRate / 100) * 100) / 100;
      sgst = Math.round(taxableAmount * (halfRate / 100) * 100) / 100;
    } else {
      igst = Math.round(taxableAmount * (avgTaxRate / 100) * 100) / 100;
    }

    const grandTotal = Math.round((taxableAmount + cgst + sgst + igst) * 100) / 100;

    const salesOrder: SalesOrder = {
      id: orderId,
      yardId: data.yardId,
      orderNumber,
      buyerId: data.buyer.id,
      buyerSnapshot: data.buyer,
      orderDate: now,
      status: 'CONFIRMED',
      subtotal: Math.round(subtotal * 100) / 100,
      transportCharge: transport,
      loadingCharge: loading,
      otherCharge: other,
      discount,
      taxableAmount,
      cgst,
      sgst,
      igst,
      grandTotal,
      paidAmount: 0,
      balanceAmount: grandTotal,
      notes: data.notes,
      createdBy: data.createdBy || 'manager',
      createdAt: now,
      updatedAt: now,
      items: salesItems,
    };

    await db.put<SalesOrder>(STORES.SALES_ORDERS, salesOrder);
    return salesOrder;
  }

  public async updateSale(id: string, updates: Partial<SalesOrder>): Promise<SalesOrder> {
    const existing = await this.getSaleById(id);
    if (!existing) {
      throw new Error(`Sales order ${id} not found`);
    }
    const updated: SalesOrder = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await db.put<SalesOrder>(STORES.SALES_ORDERS, updated);
    return updated;
  }

  public async getSalesMetrics(yardId: string): Promise<SalesDashboardMetrics> {
    const allSales = await this.getAllSales(yardId);
    const activeSales = allSales.filter((s) => s.status !== 'CANCELLED');
    const allLots = await lotRepository.getAllLots(yardId);

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const thisMonthStr = now.toISOString().slice(0, 7);

    const todaySales = activeSales
      .filter((s) => s.orderDate.startsWith(todayStr))
      .reduce((sum, s) => sum + s.grandTotal, 0);

    const thisMonthSales = activeSales
      .filter((s) => s.orderDate.startsWith(thisMonthStr))
      .reduce((sum, s) => sum + s.grandTotal, 0);

    const grossSalesValue = activeSales.reduce((sum, s) => sum + s.grandTotal, 0);
    const buyerReceivables = activeSales.reduce((sum, s) => sum + (s.balanceAmount || 0), 0);
    const pendingDispatch = activeSales.filter((s) => ['CONFIRMED', 'READY_FOR_DISPATCH'].includes(s.status)).length;
    const readyLots = allLots.filter((lt) => lt.status === 'READY').length;

    // Top buyer
    const buyerMap: Record<string, number> = {};
    activeSales.forEach((s) => {
      const name = s.buyerSnapshot?.companyName || 'B2B Client';
      buyerMap[name] = (buyerMap[name] || 0) + s.grandTotal;
    });
    let topBuyer = 'Cochin Paper Mills';
    let maxBuyerAmt = 0;
    Object.entries(buyerMap).forEach(([name, amt]) => {
      if (amt > maxBuyerAmt) {
        maxBuyerAmt = amt;
        topBuyer = name;
      }
    });

    // Top selling material
    const matMap: Record<string, number> = {};
    activeSales.forEach((s) => {
      s.items?.forEach((it) => {
        matMap[it.standardB2BNameSnapshot] = (matMap[it.standardB2BNameSnapshot] || 0) + it.weight;
      });
    });
    let topSellingMaterial = 'OCC — Old Corrugated Containers';
    let maxMatWt = 0;
    Object.entries(matMap).forEach(([name, wt]) => {
      if (wt > maxMatWt) {
        maxMatWt = wt;
        topSellingMaterial = name;
      }
    });

    return {
      todaySales: Math.round(todaySales * 100) / 100,
      thisMonthSales: Math.round(thisMonthSales * 100) / 100,
      grossSalesValue: Math.round(grossSalesValue * 100) / 100,
      buyerReceivables: Math.round(buyerReceivables * 100) / 100,
      pendingDispatch,
      readyLots,
      topBuyer,
      topSellingMaterial,
    };
  }
}

export const salesRepository = new SalesRepository();
