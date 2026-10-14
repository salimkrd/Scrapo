// Type-safe, offline-first IndexedDB wrapper for Scrapo

const DB_NAME = 'ScrapoOfflineDB';
const DB_VERSION = 2;

export const STORES = {
  YARDS: 'yards',
  MATERIALS: 'materials',
  MATERIAL_ALIASES: 'material_aliases',
  RATES: 'rates',
  SELLERS: 'sellers',
  PURCHASES: 'purchases',
  PURCHASE_ITEMS: 'purchase_items',
  PAYMENTS: 'payments',
  INVENTORY_MOVEMENTS: 'inventory_movements',
  INVENTORY_BALANCES: 'inventory_balances',
  SYNC_QUEUE: 'sync_queue',
  AUDIT_LOGS: 'audit_logs',

  // Phase 3 B2B Sales Cycle stores
  BUYERS: 'buyers',
  LOTS: 'lots',
  SALES_ORDERS: 'sales_orders',
  SALES_ITEMS: 'sales_items',
  DISPATCHES: 'dispatches',
  INVOICES: 'invoices',
  BUYER_PAYMENTS: 'buyer_payments',
  BUSINESS_PROFILES: 'business_profiles',
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

class LocalDatabase {
  private dbPromise: Promise<IDBDatabase> | null = null;

  public async getDb(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 1. Yards
        if (!db.objectStoreNames.contains(STORES.YARDS)) {
          db.createObjectStore(STORES.YARDS, { keyPath: 'id' });
        }

        // 2. Materials (B2B standard)
        if (!db.objectStoreNames.contains(STORES.MATERIALS)) {
          const store = db.createObjectStore(STORES.MATERIALS, { keyPath: 'id' });
          store.createIndex('masterCategory', 'masterCategory', { unique: false });
          store.createIndex('standardCode', 'standardCode', { unique: false });
        }

        // 3. Material Aliases (Local worker facing)
        if (!db.objectStoreNames.contains(STORES.MATERIAL_ALIASES)) {
          const store = db.createObjectStore(STORES.MATERIAL_ALIASES, { keyPath: 'id' });
          store.createIndex('materialId', 'materialId', { unique: false });
          store.createIndex('yardId', 'yardId', { unique: false });
        }

        // 4. Rates
        if (!db.objectStoreNames.contains(STORES.RATES)) {
          const store = db.createObjectStore(STORES.RATES, { keyPath: 'id' });
          store.createIndex('materialId', 'materialId', { unique: false });
          store.createIndex('yardId', 'yardId', { unique: false });
          store.createIndex('effectiveFrom', 'effectiveFrom', { unique: false });
        }

        // 5. Sellers
        if (!db.objectStoreNames.contains(STORES.SELLERS)) {
          const store = db.createObjectStore(STORES.SELLERS, { keyPath: 'id' });
          store.createIndex('yardId', 'yardId', { unique: false });
          store.createIndex('phone', 'phone', { unique: false });
        }

        // 6. Purchases
        if (!db.objectStoreNames.contains(STORES.PURCHASES)) {
          const store = db.createObjectStore(STORES.PURCHASES, { keyPath: 'id' });
          store.createIndex('yardId', 'yardId', { unique: false });
          store.createIndex('sellerId', 'sellerId', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('slipNumber', 'slipNumber', { unique: false });
        }

        // 7. Purchase Items
        if (!db.objectStoreNames.contains(STORES.PURCHASE_ITEMS)) {
          const store = db.createObjectStore(STORES.PURCHASE_ITEMS, { keyPath: 'id' });
          store.createIndex('purchaseId', 'purchaseId', { unique: false });
          store.createIndex('materialId', 'materialId', { unique: false });
        }

        // 8. Payments
        if (!db.objectStoreNames.contains(STORES.PAYMENTS)) {
          const store = db.createObjectStore(STORES.PAYMENTS, { keyPath: 'id' });
          store.createIndex('purchaseId', 'purchaseId', { unique: false });
          store.createIndex('sellerId', 'sellerId', { unique: false });
          store.createIndex('yardId', 'yardId', { unique: false });
        }

        // 9. Inventory Movements
        if (!db.objectStoreNames.contains(STORES.INVENTORY_MOVEMENTS)) {
          const store = db.createObjectStore(STORES.INVENTORY_MOVEMENTS, { keyPath: 'id' });
          store.createIndex('materialId', 'materialId', { unique: false });
          store.createIndex('yardId', 'yardId', { unique: false });
          store.createIndex('referenceId', 'referenceId', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // 10. Inventory Balances
        if (!db.objectStoreNames.contains(STORES.INVENTORY_BALANCES)) {
          const store = db.createObjectStore(STORES.INVENTORY_BALANCES, { keyPath: 'materialId' });
          store.createIndex('yardId', 'yardId', { unique: false });
        }

        // 11. Sync Queue
        if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
          const store = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'localId' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('entityId', 'entityId', { unique: false });
        }

        // 12. Audit Logs
        if (!db.objectStoreNames.contains(STORES.AUDIT_LOGS)) {
          const store = db.createObjectStore(STORES.AUDIT_LOGS, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Phase 3 Stores
        // 13. Buyers
        if (!db.objectStoreNames.contains(STORES.BUYERS)) {
          const store = db.createObjectStore(STORES.BUYERS, { keyPath: 'id' });
          store.createIndex('yardId', 'yardId', { unique: false });
          store.createIndex('companyName', 'companyName', { unique: false });
          store.createIndex('phone', 'phone', { unique: false });
        }

        // 14. Lots
        if (!db.objectStoreNames.contains(STORES.LOTS)) {
          const store = db.createObjectStore(STORES.LOTS, { keyPath: 'id' });
          store.createIndex('yardId', 'yardId', { unique: false });
          store.createIndex('materialId', 'materialId', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }

        // 15. Sales Orders
        if (!db.objectStoreNames.contains(STORES.SALES_ORDERS)) {
          const store = db.createObjectStore(STORES.SALES_ORDERS, { keyPath: 'id' });
          store.createIndex('yardId', 'yardId', { unique: false });
          store.createIndex('buyerId', 'buyerId', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }

        // 16. Sales Items
        if (!db.objectStoreNames.contains(STORES.SALES_ITEMS)) {
          const store = db.createObjectStore(STORES.SALES_ITEMS, { keyPath: 'id' });
          store.createIndex('salesOrderId', 'salesOrderId', { unique: false });
        }

        // 17. Dispatches
        if (!db.objectStoreNames.contains(STORES.DISPATCHES)) {
          const store = db.createObjectStore(STORES.DISPATCHES, { keyPath: 'id' });
          store.createIndex('yardId', 'yardId', { unique: false });
          store.createIndex('salesOrderId', 'salesOrderId', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }

        // 18. Invoices
        if (!db.objectStoreNames.contains(STORES.INVOICES)) {
          const store = db.createObjectStore(STORES.INVOICES, { keyPath: 'id' });
          store.createIndex('yardId', 'yardId', { unique: false });
          store.createIndex('buyerId', 'buyerId', { unique: false });
          store.createIndex('invoiceNumber', 'invoiceNumber', { unique: true });
        }

        // 19. Buyer Payments
        if (!db.objectStoreNames.contains(STORES.BUYER_PAYMENTS)) {
          const store = db.createObjectStore(STORES.BUYER_PAYMENTS, { keyPath: 'id' });
          store.createIndex('yardId', 'yardId', { unique: false });
          store.createIndex('buyerId', 'buyerId', { unique: false });
          store.createIndex('invoiceId', 'invoiceId', { unique: false });
        }

        // 20. Business Profiles
        if (!db.objectStoreNames.contains(STORES.BUSINESS_PROFILES)) {
          db.createObjectStore(STORES.BUSINESS_PROFILES, { keyPath: 'yardId' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  public async get<T>(storeName: StoreName, key: IDBValidKey): Promise<T | null> {
    const db = await this.getDb();
    return new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  public async getAll<T>(storeName: StoreName): Promise<T[]> {
    const db = await this.getDb();
    return new Promise<T[]>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  public async getByIndex<T>(
    storeName: StoreName,
    indexName: string,
    value: IDBValidKey
  ): Promise<T[]> {
    const db = await this.getDb();
    return new Promise<T[]>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const req = index.getAll(value);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  public async put<T>(storeName: StoreName, value: T): Promise<T> {
    const db = await this.getDb();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value);
      req.onsuccess = () => resolve(value);
      req.onerror = () => reject(req.error);
    });
  }

  public async putMany<T>(storeName: StoreName, values: T[]): Promise<void> {
    if (values.length === 0) return;
    const db = await this.getDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      for (const val of values) {
        store.put(val);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public async delete(storeName: StoreName, key: IDBValidKey): Promise<void> {
    const db = await this.getDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async clear(storeName: StoreName): Promise<void> {
    const db = await this.getDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

export const db = new LocalDatabase();
