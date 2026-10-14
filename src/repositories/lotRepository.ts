import { db, STORES } from '../storage/indexedDb';
import { Lot, LotStockSummary } from '../types';
import { inventoryRepository } from './inventoryRepository';

export class LotRepository {
  public async getAllLots(yardId: string): Promise<Lot[]> {
    const all = await db.getAll<Lot>(STORES.LOTS);
    return all
      .filter((lt) => lt.yardId === yardId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public async getLotById(id: string): Promise<Lot | null> {
    return await db.get<Lot>(STORES.LOTS, id);
  }

  public async createLot(data: {
    id?: string;
    yardId: string;
    lotNumber?: string;
    materialId: string;
    standardB2BName: string;
    grossWeight: number;
    tareWeight: number;
    netWeight?: number;
    warehouseLocation?: string;
    notes?: string;
    createdBy?: string;
  }): Promise<Lot> {
    const netWeight =
      data.netWeight !== undefined
        ? data.netWeight
        : Math.max(0, data.grossWeight - (data.tareWeight || 0));

    if (netWeight <= 0) {
      throw new Error('Net lot weight must be greater than zero');
    }

    // Check loose inventory
    const looseStock = await inventoryRepository.getBalance(data.materialId);
    if (looseStock < netWeight) {
      throw new Error(`INSUFFICIENT_INVENTORY: Available loose stock (${looseStock} KG) is less than lot weight (${netWeight} KG)`);
    }

    const allLots = await this.getAllLots(data.yardId);
    const year = new Date().getFullYear();
    const lotNumber = data.lotNumber || `LOT-${year}-${String(allLots.length + 1).padStart(4, '0')}`;
    const id = data.id || `lot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const lot: Lot = {
      id,
      yardId: data.yardId,
      lotNumber,
      materialId: data.materialId,
      standardB2BName: data.standardB2BName,
      grossWeight: data.grossWeight,
      tareWeight: data.tareWeight || 0,
      netWeight,
      availableWeight: netWeight,
      status: 'READY',
      warehouseLocation: data.warehouseLocation || 'Main Yard',
      notes: data.notes,
      createdAt: new Date().toISOString(),
      createdBy: data.createdBy || 'operator',
      version: 1,
    };

    // Deduct loose inventory movement
    await inventoryRepository.recordMovement({
      yardId: data.yardId,
      materialId: data.materialId,
      referenceType: 'LOT' as any,
      referenceId: lot.id,
      movementType: 'LOT_CREATE_OUT',
      quantity: -netWeight,
      unit: 'KG',
      unitCost: 0,
      createdBy: data.createdBy || 'system',
    });

    await db.put<Lot>(STORES.LOTS, lot);
    return lot;
  }

  public async updateLot(lotId: string, updates: Partial<Lot>): Promise<Lot> {
    const existing = await this.getLotById(lotId);
    if (!existing) {
      throw new Error(`Lot with ID ${lotId} not found`);
    }
    const updated: Lot = {
      ...existing,
      ...updates,
      version: existing.version + 1,
    };
    await db.put<Lot>(STORES.LOTS, updated);
    return updated;
  }

  public async getStockSummary(yardId: string, materialId: string, standardName: string): Promise<LotStockSummary> {
    const looseStock = await inventoryRepository.getBalance(materialId);
    const allLots = await this.getAllLots(yardId);
    const materialLots = allLots.filter((lt) => lt.materialId === materialId);

    const lotStock = materialLots
      .filter((lt) => ['READY', 'PARTIALLY_DISPATCHED', 'PREPARING'].includes(lt.status))
      .reduce((sum, lt) => sum + lt.availableWeight, 0);

    const reservedStock = materialLots
      .filter((lt) => lt.status === 'RESERVED')
      .reduce((sum, lt) => sum + lt.availableWeight, 0);

    const totalStock = Math.round((looseStock + lotStock + reservedStock) * 100) / 100;
    const availableStock = Math.round((looseStock + lotStock) * 100) / 100;

    return {
      materialId,
      standardName,
      totalStock,
      looseStock: Math.round(looseStock * 100) / 100,
      lotStock: Math.round(lotStock * 100) / 100,
      reservedStock: Math.round(reservedStock * 100) / 100,
      availableStock,
    };
  }
}

export const lotRepository = new LotRepository();
