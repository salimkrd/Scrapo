import { db, STORES } from '../storage/indexedDb';
import { Material, MaterialAlias, ResolvedMaterialView } from '../types/domain';
import { rateRepository } from './rateRepository';

export class MaterialRepository {
  async getAllMaterials(yardId: string): Promise<Material[]> {
    const materials = await db.getAll<Material>(STORES.MATERIALS);
    return materials.filter((m) => m.yardId === yardId && m.active);
  }

  async getMaterialById(id: string): Promise<Material | null> {
    return db.get<Material>(STORES.MATERIALS, id);
  }

  async getAliasesForMaterial(materialId: string, yardId: string): Promise<MaterialAlias[]> {
    const allAliases = await db.getAll<MaterialAlias>(STORES.MATERIAL_ALIASES);
    return allAliases.filter((a) => a.materialId === materialId && a.yardId === yardId);
  }

  async getPrimaryAlias(materialId: string, yardId: string): Promise<MaterialAlias | null> {
    const aliases = await this.getAliasesForMaterial(materialId, yardId);
    return aliases.find((a) => a.isPrimary) || aliases[0] || null;
  }

  async saveMaterial(material: Material): Promise<void> {
    await db.put(STORES.MATERIALS, material);
  }

  async saveAlias(alias: MaterialAlias): Promise<void> {
    await db.put(STORES.MATERIAL_ALIASES, alias);
  }

  async updateAlias(
    aliasId: string,
    updates: Partial<Pick<MaterialAlias, 'displayNameEnglish' | 'displayNameMalayalam' | 'localSubtitle' | 'defaultTare'>>
  ): Promise<MaterialAlias | null> {
    const alias = await db.get<MaterialAlias>(STORES.MATERIAL_ALIASES, aliasId);
    if (!alias) return null;

    const updated: MaterialAlias = {
      ...alias,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await db.put(STORES.MATERIAL_ALIASES, updated);
    return updated;
  }

  /**
   * Resolves complete material views (combining B2B material + local alias + active dynamic rate + inventory stock)
   */
  async getResolvedMaterials(yardId: string): Promise<ResolvedMaterialView[]> {
    const materials = await this.getAllMaterials(yardId);
    const resolvedViews: ResolvedMaterialView[] = [];

    for (const mat of materials) {
      const primaryAlias = await this.getPrimaryAlias(mat.id, yardId);
      const activeRate = await rateRepository.getActiveRate(mat.id, yardId);

      // Inventory balance lookup
      const balanceRec = await db.get<{ materialId: string; currentStock: number }>(
        STORES.INVENTORY_BALANCES,
        mat.id
      );

      if (primaryAlias && activeRate) {
        resolvedViews.push({
          material: mat,
          primaryAlias,
          currentRate: activeRate,
          activePurchaseRate: activeRate.purchaseRate,
          stockBalanceKg: balanceRec?.currentStock || 0,
        });
      }
    }

    return resolvedViews;
  }
}

export const materialRepository = new MaterialRepository();
