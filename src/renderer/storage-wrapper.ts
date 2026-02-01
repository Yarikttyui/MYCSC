import { storage, StorageAdapter } from '../core/storage-adapter';
let storageReady = false;
let storageReadyPromise: Promise<void> | null = null;

export async function initStorage(): Promise<void> {
  if (storageReady) return;
  if (storageReadyPromise) return storageReadyPromise;
  
  storageReadyPromise = storage.ensureReady();
  await storageReadyPromise;
  storageReady = true;
  
  const info = await storage.getStorageInfo();
  console.log(`MYCSC Storage initialized: ${info.backend}`);
  console.log(`  Databases: ${info.databases}, Tables: ${info.tables}`);
  console.log(`  Usage: ${info.usage || info.estimatedSize} / ${info.quota || 'unlimited'}`);
}
export function isStorageReady(): boolean {
  return storageReady;
}

export function getStorageInstance(): StorageAdapter {
  return storage;
}

class SyncStorageWrapper {
  private cache: Map<string, any> = new Map();
  private dirtyKeys: Set<string> = new Set();
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  
  async load(): Promise<void> {
    await initStorage();
    const dbs = await storage.listDatabases();
    const data: any = {};
    
    for (const dbName of dbs) {
      const dbData = await storage.exportDatabase(dbName);
      data[dbName] = dbData;
    }
    
    this.cache.set('mycsc_databases', data);
  }
  getItem(key: string): string | null {
    if (!storageReady) {
      return localStorage.getItem(key);
    }
    
    const value = this.cache.get(key);
    if (value === undefined) {
      return localStorage.getItem(key);
    }
    return value !== null ? JSON.stringify(value) : null;
  }
  setItem(key: string, value: string): void {
    try {
      const parsed = JSON.parse(value);
      this.cache.set(key, parsed);
      this.dirtyKeys.add(key);
      this.scheduleSave();
    } catch {
      this.cache.set(key, value);
      this.dirtyKeys.add(key);
      this.scheduleSave();
    }
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('localStorage setItem failed (quota exceeded?):', e);
    }
  }
  removeItem(key: string): void {
    this.cache.delete(key);
    localStorage.removeItem(key);
    this.dirtyKeys.add(key);
    this.scheduleSave();
  }
  
  private scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.flushToIndexedDB();
    }, 500);
  }
  
  private async flushToIndexedDB(): Promise<void> {
    if (!storageReady) return;
    
    for (const key of this.dirtyKeys) {
      if (key === 'mycsc_databases') {
        const data = this.cache.get(key);
        if (data) {
          await storage.importAll(data);
        }
      } else if (key.startsWith('mycsc_backup_')) {
        const id = key.replace('mycsc_backup_', '');
        const data = this.cache.get(key);
        if (data) {
          await storage.saveBackup(id, data);
        }
      }
    }
    
    this.dirtyKeys.clear();
  }
  async flush(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    await this.flushToIndexedDB();
  }
}

export const syncStorage = new SyncStorageWrapper();
initStorage().then(() => {
  syncStorage.load();
});
export async function getStorageInfo(): Promise<{
  backend: string;
  databases: number;
  tables: number;
  estimatedSize: string;
  quota?: string;
  usage?: string;
}> {
  await initStorage();
  return storage.getStorageInfo();
}
export async function migrateToIndexedDB(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    await initStorage();
    const result = await storage.forceMigrationToIndexedDB();
    if (result.success) {
      return { success: true, message: 'Migration completed successfully' };
    } else {
      return { success: false, message: result.error || 'Migration failed' };
    }
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}
