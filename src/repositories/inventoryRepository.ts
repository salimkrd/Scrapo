import { db, STORES } from '../storage/indexedDb';
import { InventoryBalance, InventoryMovement, MovementType, WeightUnit } from '../types/domain';

export class InventoryRepository {
  async recordMovement(
    yardIdOrData:
      | string
      | {
          yardId: string;
          materialId: string;
          referenceType: any;
          referenceId: string;
          movementType: MovementType;
          quantity: number;
          unit?: WeightUnit;
          unitCost?: number;
          createdBy?: string;
        },
    materialIdParam?: string,
    referenceTypeParam?: any,
    referenceIdParam?: string,
    movementTypeParam?: MovementType,
    quantityParam?: number,
    unitParam: WeightUnit = 'KG',
    unitCostParam: number = 0,
    createdByParam: string = 'system'
  ): Promise<InventoryMovement> {
    const isObj = typeof yardIdOrData === 'object';
    const yardId = isObj ? yardIdOrData.yardId : yardIdOrData;
    const materialId = isObj ? yardIdOrData.materialId : materialIdParam!;
    const referenceType = isObj ? yardIdOrData.referenceType : referenceTypeParam!;
    const referenceId = isObj ? yardIdOrData.referenceId : referenceIdParam!;
    const movementType = isObj ? yardIdOrData.movementType : movementTypeParam!;
    const quantity = isObj ? yardIdOrData.quantity : quantityParam!;
    const unit = isObj ? yardIdOrData.unit || 'KG' : unitParam;
    const unitCost = isObj ? yardIdOrData.unitCost || 0 : unitCostParam;
    const createdBy = isObj ? yardIdOrData.createdBy || 'system' : createdByParam;

    const movement: InventoryMovement = {
      id: crypto.randomUUID ? crypto.randomUUID() : `mov_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      yardId,
      materialId,
      referenceType,
      referenceId,
      movementType,
      quantity,
      unit,
      unitCost,
      createdAt: new Date().toISOString(),
      createdBy,
    };

    await db.put(STORES.INVENTORY_MOVEMENTS, movement);

    // Update derived balance record atomically
    const existingBalance = await db.get<InventoryBalance>(STORES.INVENTORY_BALANCES, materialId);
    const updatedStock = (existingBalance?.currentStock || 0) + quantity;

    const newBalance: InventoryBalance = {
      yardId,
      materialId,
      currentStock: Math.max(0, updatedStock),
      lastMovementAt: movement.createdAt,
      updatedAt: movement.createdAt,
    };

    await db.put(STORES.INVENTORY_BALANCES, newBalance);
    return movement;
  }

  async getBalance(materialId: string): Promise<number> {
    const balance = await db.get<InventoryBalance>(STORES.INVENTORY_BALANCES, materialId);
    return balance?.currentStock || 0;
  }

  async getAllBalances(yardId: string): Promise<InventoryBalance[]> {
    const all = await db.getAll<InventoryBalance>(STORES.INVENTORY_BALANCES);
    return all.filter((b) => b.yardId === yardId);
  }

  async getMovementsForMaterial(materialId: string): Promise<InventoryMovement[]> {
    const all = await db.getAll<InventoryMovement>(STORES.INVENTORY_MOVEMENTS);
    return all
      .filter((m) => m.materialId === materialId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getAllMovements(yardId: string): Promise<InventoryMovement[]> {
    const all = await db.getAll<InventoryMovement>(STORES.INVENTORY_MOVEMENTS);
    return all
      .filter((m) => m.yardId === yardId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Recalculates balance from scratch using movement journal (audit integrity check)
   */
  async recalculateBalanceFromMovements(materialId: string): Promise<number> {
    const movements = await this.getMovementsForMaterial(materialId);
    return movements.reduce((acc, m) => acc + m.quantity, 0);
  }
}

export const inventoryRepository = new InventoryRepository();
