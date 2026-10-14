import { db, STORES } from '../storage/indexedDb';
import { MaterialRate } from '../types/domain';

export class RateRepository {
  /**
   * Resolves the active rate for a given material and yard at a specific timestamp.
   * If effectiveTo is undefined, it is active into the indefinite future.
   */
  async getActiveRate(
    materialId: string,
    yardId: string,
    asOfDate: string = new Date().toISOString()
  ): Promise<MaterialRate | null> {
    const allRates = await db.getAll<MaterialRate>(STORES.RATES);
    const materialRates = allRates.filter(
      (r) => r.materialId === materialId && r.yardId === yardId
    );

    if (materialRates.length === 0) return null;

    // Filter rates where effectiveFrom <= asOfDate and (effectiveTo is null or effectiveTo >= asOfDate)
    const validRates = materialRates.filter((r) => {
      const fromValid = r.effectiveFrom <= asOfDate;
      const toValid = !r.effectiveTo || r.effectiveTo >= asOfDate;
      return fromValid && toValid;
    });

    if (validRates.length === 0) {
      // Fallback to most recent created rate
      return materialRates.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    }

    // Sort by effectiveFrom desc to get the most recent effective rate
    validRates.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
    return validRates[0];
  }

  async getAllRatesForYard(yardId: string): Promise<MaterialRate[]> {
    const allRates = await db.getAll<MaterialRate>(STORES.RATES);
    return allRates.filter((r) => r.yardId === yardId);
  }

  /**
   * Sets a new rate effective immediately, maintaining full historical rate audit trail.
   */
  async setRate(
    materialId: string,
    yardId: string,
    purchaseRate: number,
    sellingRate: number,
    createdBy: string = 'worker_anoop'
  ): Promise<MaterialRate> {
    const now = new Date().toISOString();

    // Expire any currently open rate
    const currentRate = await this.getActiveRate(materialId, yardId, now);
    if (currentRate && !currentRate.effectiveTo) {
      currentRate.effectiveTo = now;
      await db.put(STORES.RATES, currentRate);
    }

    const newRate: MaterialRate = {
      id: crypto.randomUUID ? crypto.randomUUID() : `rate_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      materialId,
      yardId,
      purchaseRate,
      sellingRate,
      effectiveFrom: now,
      createdBy,
      createdAt: now,
    };

    await db.put(STORES.RATES, newRate);
    return newRate;
  }

  async saveRate(rate: MaterialRate): Promise<void> {
    await db.put(STORES.RATES, rate);
  }

  async getRateHistory(materialId: string, yardId: string): Promise<MaterialRate[]> {
    const allRates = await db.getAll<MaterialRate>(STORES.RATES);
    return allRates
      .filter((r) => r.materialId === materialId && r.yardId === yardId)
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  }
}

export const rateRepository = new RateRepository();
