const DB_NAME = 'mycsc_database';
const DB_VERSION = 1;
const STORES = {
  DATABASES: 'databases',
  TABLES: 'tables',
  ROWS: 'rows',
  INDEXES: 'indexes',
  WAL: 'wal',
  BACKUPS: 'backups',
  SETTINGS: 'settings',
} as const;
const CHUNK_SIZE = 10000;

export interface DatabaseMeta {
  name: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface TableMeta {
  dbName: string;
  tableName: string;
  schema: any;
  rowCount: number;
  chunkCount: number;
  autoIncrementId: number;
  createdAt: string;
  updatedAt: string;
  indexes?: any[];
  partitionInfo?: any;
  fulltextIndexes?: any[];
}

export interface RowChunk {
  dbName: string;
  tableName: string;
  chunkIndex: number;
  rows: Record<string, any>[];
}

export interface WALEntry {
  id?: number;
  dbName: string;
  timestamp: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'DDL';
  tableName?: string;
  sql: string;
  data?: any;
}

export class IndexedDBStorage {
  private db: IDBDatabase | null = null;
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.init();
  }
  async init(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        console.log('IndexedDB initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORES.DATABASES)) {
          db.createObjectStore(STORES.DATABASES, { keyPath: 'name' });
        }

        if (!db.objectStoreNames.contains(STORES.TABLES)) {
          const tableStore = db.createObjectStore(STORES.TABLES, { keyPath: ['dbName', 'tableName'] });
          tableStore.createIndex('byDatabase', 'dbName', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.ROWS)) {
          const rowStore = db.createObjectStore(STORES.ROWS, { keyPath: ['dbName', 'tableName', 'chunkIndex'] });
          rowStore.createIndex('byTable', ['dbName', 'tableName'], { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.INDEXES)) {
          const indexStore = db.createObjectStore(STORES.INDEXES, { keyPath: ['dbName', 'tableName', 'indexName'] });
          indexStore.createIndex('byTable', ['dbName', 'tableName'], { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.WAL)) {
          const walStore = db.createObjectStore(STORES.WAL, { keyPath: 'id', autoIncrement: true });
          walStore.createIndex('byDatabase', 'dbName', { unique: false });
          walStore.createIndex('byTimestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.BACKUPS)) {
          db.createObjectStore(STORES.BACKUPS, { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
        }

        console.log('IndexedDB schema created/upgraded');
      };
    });
  }
  private async ensureReady(): Promise<IDBDatabase> {
    if (!this.isInitialized) {
      await this.initPromise;
    }
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }
    return this.db;
  }

  
  async createDatabase(name: string): Promise<void> {
    const db = await this.ensureReady();
    const meta: DatabaseMeta = {
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.DATABASES, 'readwrite');
      const store = tx.objectStore(STORES.DATABASES);
      const request = store.put(meta);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getDatabase(name: string): Promise<DatabaseMeta | null> {
    const db = await this.ensureReady();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.DATABASES, 'readonly');
      const store = tx.objectStore(STORES.DATABASES);
      const request = store.get(name);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async listDatabases(): Promise<DatabaseMeta[]> {
    const db = await this.ensureReady();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.DATABASES, 'readonly');
      const store = tx.objectStore(STORES.DATABASES);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteDatabase(name: string): Promise<void> {
    const db = await this.ensureReady();
    const tables = await this.listTables(name);
    for (const table of tables) {
      await this.deleteTable(name, table.tableName);
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.DATABASES, 'readwrite');
      const store = tx.objectStore(STORES.DATABASES);
      const request = store.delete(name);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }


  async createTable(dbName: string, tableName: string, schema: any): Promise<void> {
    const db = await this.ensureReady();
    const meta: TableMeta = {
      dbName,
      tableName,
      schema,
      rowCount: 0,
      chunkCount: 0,
      autoIncrementId: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.TABLES, 'readwrite');
      const store = tx.objectStore(STORES.TABLES);
      const request = store.put(meta);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getTable(dbName: string, tableName: string): Promise<TableMeta | null> {
    const db = await this.ensureReady();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.TABLES, 'readonly');
      const store = tx.objectStore(STORES.TABLES);
      const request = store.get([dbName, tableName]);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async updateTable(meta: TableMeta): Promise<void> {
    const db = await this.ensureReady();
    meta.updatedAt = new Date().toISOString();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.TABLES, 'readwrite');
      const store = tx.objectStore(STORES.TABLES);
      const request = store.put(meta);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async listTables(dbName: string): Promise<TableMeta[]> {
    const db = await this.ensureReady();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.TABLES, 'readonly');
      const store = tx.objectStore(STORES.TABLES);
      const index = store.index('byDatabase');
      const request = index.getAll(dbName);
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteTable(dbName: string, tableName: string): Promise<void> {
    const db = await this.ensureReady();
    const tableMeta = await this.getTable(dbName, tableName);
    if (tableMeta) {
      for (let i = 0; i < tableMeta.chunkCount; i++) {
        await this.deleteRowChunk(dbName, tableName, i);
      }
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.TABLES, 'readwrite');
      const store = tx.objectStore(STORES.TABLES);
      const request = store.delete([dbName, tableName]);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }


  async getRowChunk(dbName: string, tableName: string, chunkIndex: number): Promise<Record<string, any>[]> {
    const db = await this.ensureReady();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.ROWS, 'readonly');
      const store = tx.objectStore(STORES.ROWS);
      const request = store.get([dbName, tableName, chunkIndex]);
      
      request.onsuccess = () => {
        const chunk = request.result as RowChunk | undefined;
        resolve(chunk?.rows || []);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveRowChunk(dbName: string, tableName: string, chunkIndex: number, rows: Record<string, any>[]): Promise<void> {
    const db = await this.ensureReady();
    const chunk: RowChunk = { dbName, tableName, chunkIndex, rows };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.ROWS, 'readwrite');
      const store = tx.objectStore(STORES.ROWS);
      const request = store.put(chunk);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteRowChunk(dbName: string, tableName: string, chunkIndex: number): Promise<void> {
    const db = await this.ensureReady();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.ROWS, 'readwrite');
      const store = tx.objectStore(STORES.ROWS);
      const request = store.delete([dbName, tableName, chunkIndex]);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  async getAllRows(dbName: string, tableName: string): Promise<Record<string, any>[]> {
    const tableMeta = await this.getTable(dbName, tableName);
    if (!tableMeta) return [];

    const allRows: Record<string, any>[] = [];
    for (let i = 0; i < tableMeta.chunkCount; i++) {
      const chunk = await this.getRowChunk(dbName, tableName, i);
      allRows.push(...chunk);
    }
    return allRows;
  }
  async saveAllRows(dbName: string, tableName: string, rows: Record<string, any>[]): Promise<void> {
    const tableMeta = await this.getTable(dbName, tableName);
    if (!tableMeta) throw new Error(`Table ${tableName} not found`);
    const chunkCount = Math.ceil(rows.length / CHUNK_SIZE);
    for (let i = chunkCount; i < tableMeta.chunkCount; i++) {
      await this.deleteRowChunk(dbName, tableName, i);
    }
    for (let i = 0; i < chunkCount; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, rows.length);
      const chunkRows = rows.slice(start, end);
      await this.saveRowChunk(dbName, tableName, i, chunkRows);
    }
    tableMeta.rowCount = rows.length;
    tableMeta.chunkCount = chunkCount || 1;
    await this.updateTable(tableMeta);
  }
  async insertRows(dbName: string, tableName: string, newRows: Record<string, any>[]): Promise<void> {
    const tableMeta = await this.getTable(dbName, tableName);
    if (!tableMeta) throw new Error(`Table ${tableName} not found`);
    const lastChunkIndex = Math.max(0, tableMeta.chunkCount - 1);
    let lastChunk = await this.getRowChunk(dbName, tableName, lastChunkIndex);

    let currentChunkIndex = lastChunkIndex;
    
    for (const row of newRows) {
      if (lastChunk.length >= CHUNK_SIZE) {
        await this.saveRowChunk(dbName, tableName, currentChunkIndex, lastChunk);
        currentChunkIndex++;
        lastChunk = [];
      }
      lastChunk.push(row);
    }
    await this.saveRowChunk(dbName, tableName, currentChunkIndex, lastChunk);
    tableMeta.rowCount += newRows.length;
    tableMeta.chunkCount = currentChunkIndex + 1;
    await this.updateTable(tableMeta);
  }


  async appendWAL(entry: Omit<WALEntry, 'id'>): Promise<number> {
    const db = await this.ensureReady();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.WAL, 'readwrite');
      const store = tx.objectStore(STORES.WAL);
      const request = store.add(entry);
      
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  async getWALEntries(dbName: string, since?: string): Promise<WALEntry[]> {
    const db = await this.ensureReady();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.WAL, 'readonly');
      const store = tx.objectStore(STORES.WAL);
      const index = store.index('byDatabase');
      const request = index.getAll(dbName);
      
      request.onsuccess = () => {
        let entries = request.result as WALEntry[];
        if (since) {
          entries = entries.filter(e => e.timestamp > since);
        }
        resolve(entries);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async truncateWAL(dbName: string, beforeTimestamp: string): Promise<void> {
    const db = await this.ensureReady();
    const entries = await this.getWALEntries(dbName);
    const toDelete = entries.filter(e => e.timestamp < beforeTimestamp);

    const tx = db.transaction(STORES.WAL, 'readwrite');
    const store = tx.objectStore(STORES.WAL);
    
    for (const entry of toDelete) {
      if (entry.id) store.delete(entry.id);
    }
  }


  async getSetting(key: string): Promise<any> {
    const db = await this.ensureReady();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SETTINGS, 'readonly');
      const store = tx.objectStore(STORES.SETTINGS);
      const request = store.get(key);
      
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  }

  async setSetting(key: string, value: any): Promise<void> {
    const db = await this.ensureReady();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SETTINGS, 'readwrite');
      const store = tx.objectStore(STORES.SETTINGS);
      const request = store.put({ key, value });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }


  async saveBackup(id: string, data: any): Promise<void> {
    const db = await this.ensureReady();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.BACKUPS, 'readwrite');
      const store = tx.objectStore(STORES.BACKUPS);
      const request = store.put({ id, data, timestamp: new Date().toISOString() });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getBackup(id: string): Promise<any> {
    const db = await this.ensureReady();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.BACKUPS, 'readonly');
      const store = tx.objectStore(STORES.BACKUPS);
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result?.data);
      request.onerror = () => reject(request.error);
    });
  }

  async listBackups(): Promise<{ id: string; timestamp: string }[]> {
    const db = await this.ensureReady();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.BACKUPS, 'readonly');
      const store = tx.objectStore(STORES.BACKUPS);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const backups = (request.result || []).map((b: any) => ({
          id: b.id,
          timestamp: b.timestamp
        }));
        resolve(backups);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteBackup(id: string): Promise<void> {
    const db = await this.ensureReady();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.BACKUPS, 'readwrite');
      const store = tx.objectStore(STORES.BACKUPS);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }


  async migrateFromLocalStorage(): Promise<{ migrated: boolean; databases: number; tables: number; rows: number }> {
    const saved = localStorage.getItem('mycsc_databases');
    if (!saved) {
      return { migrated: false, databases: 0, tables: 0, rows: 0 };
    }

    try {
      const data = JSON.parse(saved);
      let dbCount = 0;
      let tableCount = 0;
      let rowCount = 0;

      for (const [dbName, dbData] of Object.entries(data) as [string, any][]) {
        await this.createDatabase(dbName);
        dbCount++;
        if (dbData.tables) {
          for (const [tableName, tableData] of Object.entries(dbData.tables) as [string, any][]) {
            await this.createTable(dbName, tableName, tableData.schema);
            tableCount++;
            if (tableData.rows && tableData.rows.length > 0) {
              await this.saveAllRows(dbName, tableName, tableData.rows);
              rowCount += tableData.rows.length;
            }
            const meta = await this.getTable(dbName, tableName);
            if (meta && tableData.autoIncrementId) {
              meta.autoIncrementId = tableData.autoIncrementId;
              await this.updateTable(meta);
            }
          }
        }
      }
      await this.setSetting('migratedFromLocalStorage', true);
      await this.setSetting('migrationTimestamp', new Date().toISOString());

      console.log(`Migration complete: ${dbCount} databases, ${tableCount} tables, ${rowCount} rows`);
      return { migrated: true, databases: dbCount, tables: tableCount, rows: rowCount };
    } catch (e) {
      console.error('Migration failed:', e);
      throw e;
    }
  }


  async exportToLocalStorageFormat(dbName: string): Promise<any> {
    const tables = await this.listTables(dbName);
    const result: any = { name: dbName, tables: {} };

    for (const tableMeta of tables) {
      const rows = await this.getAllRows(dbName, tableMeta.tableName);
      result.tables[tableMeta.tableName] = {
        schema: tableMeta.schema,
        rows,
        autoIncrementId: tableMeta.autoIncrementId
      };
    }

    return result;
  }


  async getStorageInfo(): Promise<{ 
    databases: number; 
    tables: number; 
    estimatedSize: string;
    quota?: string;
    usage?: string;
  }> {
    const dbs = await this.listDatabases();
    let tableCount = 0;
    
    for (const db of dbs) {
      const tables = await this.listTables(db.name);
      tableCount += tables.length;
    }

    let quota: string | undefined;
    let usage: string | undefined;
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        if (estimate.quota) {
          quota = this.formatBytes(estimate.quota);
        }
        if (estimate.usage) {
          usage = this.formatBytes(estimate.usage);
        }
      } catch (e) {
      }
    }

    return {
      databases: dbs.length,
      tables: tableCount,
      estimatedSize: usage || 'Unknown',
      quota,
      usage
    };
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  }


  async clearAll(): Promise<void> {
    const db = await this.ensureReady();
    
    const stores = [STORES.DATABASES, STORES.TABLES, STORES.ROWS, STORES.INDEXES, STORES.WAL, STORES.BACKUPS];
    
    for (const storeName of stores) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }
}

export const indexedDBStorage = new IndexedDBStorage();
