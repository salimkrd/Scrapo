import { syncRepository } from '../repositories/syncRepository';
import { rateRepository } from '../repositories/rateRepository';

export interface SyncPushResult {
  status: 'online' | 'offline' | 'error';
  syncedCount: number;
  duplicateCount: number;
  rejectedCount: number;
  message?: string;
}

export interface UserSession {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  yardIds: string[];
}

class ApiSyncService {
  private baseUrl: string;

  constructor() {
    // Uses Vite proxy /api/v1 in dev or window origin, or env override
    this.baseUrl = (import.meta as any).env?.VITE_API_URL || '/api/v1';
  }

  // Persistent unique Device ID in local storage
  getDeviceId(): string {
    let id = localStorage.getItem('scrapo_device_id');
    if (!id) {
      const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
      id = `SCRAPO-WEB-${rand}`;
      localStorage.setItem('scrapo_device_id', id);
    }
    return id;
  }

  // Auth Token helpers
  getToken(): string | null {
    return localStorage.getItem('scrapo_access_token');
  }

  setTokens(accessToken: string, refreshToken?: string, user?: UserSession): void {
    localStorage.setItem('scrapo_access_token', accessToken);
    if (refreshToken) localStorage.setItem('scrapo_refresh_token', refreshToken);
    if (user) localStorage.setItem('scrapo_user_session', JSON.stringify(user));
  }

  getUserSession(): UserSession | null {
    const raw = localStorage.getItem('scrapo_user_session');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  clearAuth(): void {
    localStorage.removeItem('scrapo_access_token');
    localStorage.removeItem('scrapo_refresh_token');
    localStorage.removeItem('scrapo_user_session');
  }

  // Auto-login with default worker credentials for demo/fieldwork
  async ensureAuthenticated(): Promise<string | null> {
    const existing = this.getToken();
    if (existing) return existing;

    try {
      const res = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login: 'worker@scrapo.in',
          password: 'Worker@1234',
        }),
      });

      if (!res.ok) {
        return null;
      }

      const data = await res.json();
      this.setTokens(data.access_token, data.refresh_token, {
        id: data.user.id,
        name: data.user.name,
        phone: data.user.phone,
        email: data.user.email,
        role: data.user.role,
        yardIds: data.user.yard_ids || [],
      });
      return data.access_token;
    } catch {
      // Offline: Cannot reach server, proceed in offline mode
      return null;
    }
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.ensureAuthenticated();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Push pending transactions from IndexedDB queue to cloud backend
   */
  async pushPendingOperations(yardId: string): Promise<SyncPushResult> {
    const records = await syncRepository.getAllRecords(yardId);
    const pending = records.filter(
      (r) => r.status === 'PENDING' || r.status === 'FAILED'
    );

    if (pending.length === 0) {
      return {
        status: 'online',
        syncedCount: 0,
        duplicateCount: 0,
        rejectedCount: 0,
        message: 'Sync queue is empty',
      };
    }

    const deviceId = this.getDeviceId();
    const operations = pending.map((p) => ({
      operation_id: p.localId,
      entity_type: p.entityType,
      entity_id: p.entityId,
      operation: p.operation,
      payload: p.payload,
      device_id: deviceId,
    }));

    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(`${this.baseUrl}/sync/push`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          yard_id: yardId,
          device_id: deviceId,
          operations,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();

      // Update statuses in local IndexedDB
      for (const resItem of data.results || []) {
        if (resItem.status === 'SYNCED' || resItem.status === 'DUPLICATE') {
          await syncRepository.updateRecordStatus(resItem.operation_id, 'SYNCED');
        } else if (resItem.status === 'CONFLICT') {
          await syncRepository.updateRecordStatus(resItem.operation_id, 'CONFLICT', resItem.message);
        } else {
          await syncRepository.updateRecordStatus(resItem.operation_id, 'FAILED', resItem.message);
        }
      }

      return {
        status: 'online',
        syncedCount: data.synced_count || 0,
        duplicateCount: data.duplicate_count || 0,
        rejectedCount: (data.conflict_count || 0) + (data.rejected_count || 0),
        message: `Synced ${data.synced_count} items to cloud`,
      };
    } catch (err: any) {
      // Offline fallback: Mark queue as attempted, keep offline
      return {
        status: 'offline',
        syncedCount: 0,
        duplicateCount: 0,
        rejectedCount: 0,
        message: `Offline: ${err.message || 'Server unreachable'}. Changes stored safely in local IndexedDB.`,
      };
    }
  }

  /**
   * Pull latest rates, materials, and sellers from cloud
   */
  async pullLatestUpdates(yardId: string): Promise<{ pulledCount: number; error?: string }> {
    const deviceId = this.getDeviceId();
    const lastCursor = localStorage.getItem('scrapo_last_sync_cursor');

    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(`${this.baseUrl}/sync/pull`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          yard_id: yardId,
          device_id: deviceId,
          last_sync_cursor: lastCursor || undefined,
        }),
      });

      if (!res.ok) {
        return { pulledCount: 0, error: `Pull HTTP ${res.status}` };
      }

      const data = await res.json();
      if (data.next_sync_cursor) {
        localStorage.setItem('scrapo_last_sync_cursor', data.next_sync_cursor);
      }

      let count = 0;
      // Sync pulled rates into local IndexedDB
      if (data.rates && data.rates.length > 0) {
        for (const r of data.rates) {
          await rateRepository.saveRate({
            id: r.id,
            materialId: r.material_id,
            yardId: r.yard_id,
            purchaseRate: Number(r.purchase_rate),
            sellingRate: Number(r.selling_rate),
            effectiveFrom: r.effective_from,
            effectiveTo: r.effective_to,
            version: r.version,
            createdBy: r.created_by,
            createdAt: r.created_at,
          });
          count++;
        }
      }

      return { pulledCount: count };
    } catch (err: any) {
      return { pulledCount: 0, error: err.message };
    }
  }

  /**
   * Full bidirectional sync: Push pending offline operations, then pull latest changes
   */
  async performFullSync(yardId: string): Promise<SyncPushResult> {
    const pushResult = await this.pushPendingOperations(yardId);
    if (pushResult.status === 'online') {
      await this.pullLatestUpdates(yardId);
    }
    return pushResult;
  }
}

export const apiSyncService = new ApiSyncService();
