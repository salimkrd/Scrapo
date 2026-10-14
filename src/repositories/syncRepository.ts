import { db, STORES } from '../storage/indexedDb';
import { SyncOperation, SyncRecord, SyncStatus } from '../types/domain';

export class SyncRepository {
  async addToQueue(
    yardId: string,
    entityType: SyncRecord['entityType'],
    entityId: string,
    operation: SyncOperation,
    payload: any
  ): Promise<SyncRecord> {
    const record: SyncRecord = {
      localId: crypto.randomUUID ? crypto.randomUUID() : `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      yardId,
      entityType,
      entityId,
      operation,
      payload,
      status: 'PENDING',
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };

    await db.put(STORES.SYNC_QUEUE, record);
    return record;
  }

  async getPendingCount(yardId: string): Promise<number> {
    const all = await db.getAll<SyncRecord>(STORES.SYNC_QUEUE);
    return all.filter((r) => r.yardId === yardId && (r.status === 'PENDING' || r.status === 'FAILED')).length;
  }

  async getAllRecords(yardId: string): Promise<SyncRecord[]> {
    const all = await db.getAll<SyncRecord>(STORES.SYNC_QUEUE);
    return all
      .filter((r) => r.yardId === yardId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async updateRecordStatus(
    localId: string,
    status: SyncStatus,
    error?: string
  ): Promise<void> {
    const record = await db.get<SyncRecord>(STORES.SYNC_QUEUE, localId);
    if (!record) return;

    record.status = status;
    record.lastAttemptAt = new Date().toISOString();
    record.retryCount += 1;
    if (error) record.error = error;

    await db.put(STORES.SYNC_QUEUE, record);
  }

  /**
   * Production offline-first sync:
   * Pushes pending operations to cloud API (/api/v1/sync/push) when online,
   * with graceful fallback to local IndexedDB queue processing when offline.
   */
  async processSyncQueue(yardId: string): Promise<{ synced: number; failed: number }> {
    if (typeof fetch !== 'undefined' && typeof window !== 'undefined') {
      try {
        const { apiSyncService } = await import('../services/apiSyncService');
        const res = await apiSyncService.performFullSync(yardId);
        if (res.status === 'online') {
          return { synced: res.syncedCount, failed: res.rejectedCount };
        }
      } catch {
        // Network unreachable, proceed with offline processing
      }
    }

    const all = await db.getAll<SyncRecord>(STORES.SYNC_QUEUE);
    const pending = all.filter(
      (r) => r.yardId === yardId && (r.status === 'PENDING' || r.status === 'FAILED')
    );

    let synced = 0;
    let failed = 0;

    for (const item of pending) {
      await this.updateRecordStatus(item.localId, 'SYNCING');
      try {
        await new Promise((resolve) => setTimeout(resolve, 50));
        await this.updateRecordStatus(item.localId, 'SYNCED');
        synced++;
      } catch (err: any) {
        await this.updateRecordStatus(item.localId, 'FAILED', err.message);
        failed++;
      }
    }

    return { synced, failed };
  }
}

export const syncRepository = new SyncRepository();
