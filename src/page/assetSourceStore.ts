import type { PageAssetSourceEncoding } from './types';

export interface AssetSourceValue {
  sourceContent: string;
  sourceEncoding?: PageAssetSourceEncoding;
}

export interface AssetSourceStore {
  delete(key: string): Promise<void>;
  get(key: string): Promise<AssetSourceValue | null>;
  set(key: string, value: AssetSourceValue): Promise<void>;
}

const memoryStores = new Map<string, Map<string, AssetSourceValue>>();

export function createMemoryAssetSourceStore(namespace = 'default'): AssetSourceStore {
  const records = memoryStores.get(namespace) ?? new Map<string, AssetSourceValue>();
  memoryStores.set(namespace, records);

  return {
    async delete(key: string) {
      records.delete(key);
    },

    async get(key: string) {
      const value = records.get(key);
      return value ? { ...value } : null;
    },

    async set(key: string, value: AssetSourceValue) {
      records.set(key, { ...value });
    },
  };
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
    request.onsuccess = () => resolve(request.result);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
    transaction.oncomplete = () => resolve();
  });
}

function openAssetSourceDatabase(dbName: string, storeName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(dbName, 1);

    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed.'));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

export function createIndexedDbAssetSourceStore(
  dbName = 'assisted-cms.asset-sources',
  storeName = 'sources',
): AssetSourceStore {
  async function withStore<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore, transaction: IDBTransaction) => Promise<T>,
  ) {
    const database = await openAssetSourceDatabase(dbName, storeName);
    try {
      const transaction = database.transaction(storeName, mode);
      const objectStore = transaction.objectStore(storeName);
      const result = await operation(objectStore, transaction);
      await transactionDone(transaction);
      return result;
    } finally {
      database.close();
    }
  }

  return {
    async delete(key: string) {
      await withStore('readwrite', async (store) => {
        store.delete(key);
      });
    },

    async get(key: string) {
      return withStore('readonly', async (store) => {
        const value = await requestResult<AssetSourceValue | undefined>(store.get(key));
        return value ? { ...value } : null;
      });
    },

    async set(key: string, value: AssetSourceValue) {
      await withStore('readwrite', async (store) => {
        store.put({ ...value }, key);
      });
    },
  };
}

export function createBrowserAssetSourceStore(): AssetSourceStore {
  const fallback = createMemoryAssetSourceStore('browser-fallback');

  if (typeof window === 'undefined' || !window.indexedDB) {
    return fallback;
  }

  const indexedDbStore = createIndexedDbAssetSourceStore();

  return {
    async delete(key: string) {
      try {
        await indexedDbStore.delete(key);
      } catch {
        await fallback.delete(key);
      }
    },

    async get(key: string) {
      try {
        return await indexedDbStore.get(key);
      } catch {
        return fallback.get(key);
      }
    },

    async set(key: string, value: AssetSourceValue) {
      try {
        await indexedDbStore.set(key, value);
      } catch {
        await fallback.set(key, value);
      }
    },
  };
}
