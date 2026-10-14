import { db, STORES } from '../storage/indexedDb';
import { Dispatch } from '../types';
import { inventoryRepository } from './inventoryRepository';
import { lotRepository } from './lotRepository';
import { salesRepository } from './salesRepository';

export class DispatchRepository {
  public async getAllDispatches(yardId: string): Promise<Dispatch[]> {
    const all = await db.getAll<Dispatch>(STORES.DISPATCHES);
    return all
      .filter((d) => d.yardId === yardId)
      .sort((a, b) => new Date(b.dispatchDate).getTime() - new Date(a.dispatchDate).getTime());
  }

  public async getDispatchById(id: string): Promise<Dispatch | null> {
    return await db.get<Dispatch>(STORES.DISPATCHES, id);
  }

  public async createDispatch(data: {
    id?: string;
    yardId: string;
    salesOrderId: string;
    vehicleNumber: string;
    driverName: string;
    driverPhone: string;
    transportCompany?: string;
    grossVehicleWeight: number;
    tareVehicleWeight: number;
    netDispatchWeight?: number;
    weighbridgeSlipNumber?: string;
    notes?: string;
    createdBy?: string;
  }): Promise<Dispatch> {
    const sale = await salesRepository.getSaleById(data.salesOrderId);
    if (!sale) {
      throw new Error(`Sales order ${data.salesOrderId} not found`);
    }

    if (sale.status === 'DISPATCHED' || sale.status === 'PAID') {
      // Check if already dispatched
      const existingDispatches = await this.getAllDispatches(data.yardId);
      const alreadyDispatched = existingDispatches.some(
        (d) => d.salesOrderId === sale.id && d.status === 'DISPATCHED'
      );
      if (alreadyDispatched) {
        throw new Error('Sales order has already been dispatched');
      }
    }

    const netWeight =
      data.netDispatchWeight !== undefined
        ? data.netDispatchWeight
        : Math.max(0, data.grossVehicleWeight - data.tareVehicleWeight);

    if (netWeight <= 0) {
      throw new Error('Net dispatch weight must be greater than zero');
    }

    const allDispatches = await this.getAllDispatches(data.yardId);
    const year = new Date().getFullYear();
    const dispatchNumber = `DSP-${year}-${String(allDispatches.length + 1).padStart(4, '0')}`;
    const id = data.id || `dsp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const dispatch: Dispatch = {
      id,
      yardId: data.yardId,
      dispatchNumber,
      salesOrderId: sale.id,
      buyerId: sale.buyerId,
      vehicleNumber: data.vehicleNumber,
      driverName: data.driverName,
      driverPhone: data.driverPhone,
      transportCompany: data.transportCompany,
      dispatchDate: now,
      grossVehicleWeight: data.grossVehicleWeight,
      tareVehicleWeight: data.tareVehicleWeight,
      netDispatchWeight: netWeight,
      weighbridgeSlipNumber: data.weighbridgeSlipNumber || `WB-${Math.floor(100000 + Math.random() * 900000)}`,
      notes: data.notes,
      status: 'DISPATCHED',
      createdBy: data.createdBy || 'manager',
      createdAt: now,
    };

    // Deduct stock and update lots/inventory
    for (const item of sale.items) {
      if (item.lotId) {
        const lot = await lotRepository.getLotById(item.lotId);
        if (!lot) {
          throw new Error(`Lot ${item.lotId} not found`);
        }
        if (lot.availableWeight < item.weight) {
          throw new Error(`INSUFFICIENT_INVENTORY: Lot only has ${lot.availableWeight} KG available`);
        }

        const remaining = Math.max(0, Math.round((lot.availableWeight - item.weight) * 100) / 100);
        let newStatus = lot.status;
        if (remaining === 0) {
          newStatus = 'DISPATCHED';
        } else if (remaining < lot.netWeight) {
          newStatus = 'PARTIALLY_DISPATCHED';
        }

        await lotRepository.updateLot(lot.id, {
          availableWeight: remaining,
          status: newStatus,
        });

        // Also record auditable movement for material
        await inventoryRepository.recordMovement({
          yardId: data.yardId,
          materialId: item.materialId,
          referenceType: 'SALE' as any,
          referenceId: dispatch.id,
          movementType: 'DISPATCH_OUT',
          quantity: -item.weight,
          unit: item.unit || 'KG',
          unitCost: item.ratePerKg,
          createdBy: data.createdBy || 'system',
        });
      } else {
        // Loose stock sale
        const currentBalance = await inventoryRepository.getBalance(item.materialId);
        if (currentBalance < item.weight) {
          throw new Error(`INSUFFICIENT_INVENTORY: Loose stock is ${currentBalance} KG, cannot dispatch ${item.weight} KG`);
        }

        await inventoryRepository.recordMovement({
          yardId: data.yardId,
          materialId: item.materialId,
          referenceType: 'SALE' as any,
          referenceId: dispatch.id,
          movementType: 'DISPATCH_OUT',
          quantity: -item.weight,
          unit: item.unit || 'KG',
          unitCost: item.ratePerKg,
          createdBy: data.createdBy || 'system',
        });
      }
    }

    // Update sales order status
    await salesRepository.updateSale(sale.id, {
      status: 'DISPATCHED',
    });

    await db.put<Dispatch>(STORES.DISPATCHES, dispatch);
    return dispatch;
  }
}

export const dispatchRepository = new DispatchRepository();
