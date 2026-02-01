import { indexedDBStorage, TableMeta, DatabaseMeta } from './storage-indexeddb';

export type StorageBackend = 'localStorage' | 'indexedDB';

export interface StorageConfig {
  preferredBackend: StorageBackend;
  autoMigrate: boolean;
  enableWAL: boolean;
}

const DEFAULT_CONFIG: StorageConfig = {
  preferredBackend: 'indexedDB',
  autoMigrate: true,
  enableWAL: true
};

export class StorageAdapter {
  private config: StorageConfig;
  private backend: StorageBackend;
  private isReady: boolean = false;
  private readyPromise: Promise<void>;

  constructor(config: Partial<StorageConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.backend = this.detectBestBackend();
    this.readyPromise = this.initialize();
  }

  private detectBestBackend(): StorageBackend {
    if (typeof indexedDB !== 'undefined') {
      return 'indexedDB';
    }
    return 'localStorage';
  }

  private async initialize(): Promise<void> {
    if (this.backend === 'indexedDB') {
      try {
        await indexedDBStorage.init();
        if (this.config.autoMigrate) {
          const migrated = await indexedDBStorage.getSetting('migratedFromLocalStorage');
          if (!migrated && localStorage.getItem('mycsc_databases')) {
            console.log('Starting automatic migration from localStorage...');
            const result = await indexedDBStorage.migrateFromLocalStorage();
            console.log('Migration result:', result);
          }
        }
        
        this.isReady = true;
        console.log('Storage adapter ready with IndexedDB backend');
      } catch (e) {
        console.error('IndexedDB initialization failed, falling back to localStorage:', e);
        this.backend = 'localStorage';
        this.isReady = true;
      }
    } else {
      this.isReady = true;
      console.log('Storage adapter ready with localStorage backend');
    }
  }

  async ensureReady(): Promise<void> {
    if (!this.isReady) {
      await this.readyPromise;
    }
  }

  getBackend(): StorageBackend {
    return this.backend;
  }


  async listDatabases(): Promise<string[]> {
    await this.ensureReady();
    
    if (this.backend === 'indexedDB') {
      const dbs = await indexedDBStorage.listDatabases();
      return dbs.map(db => db.name);
    } else {
      const saved = localStorage.getItem('mycsc_databases');
      if (!saved) return [];
      const data = JSON.parse(saved);
      return Object.keys(data);
    }
  }

  async createDatabase(name: string): Promise<void> {
    await this.ensureReady();
    
    if (this.backend === 'indexedDB') {
      await indexedDBStorage.createDatabase(name);
    } else {
      const saved = localStorage.getItem('mycsc_databases');
      const data = saved ? JSON.parse(saved) : {};
      data[name] = { tables: {}, views: {}, procedures: {}, functions: {}, triggers: {}, users: {}, roles: {} };
      localStorage.setItem('mycsc_databases', JSON.stringify(data));
    }
  }

  async deleteDatabase(name: string): Promise<void> {
    await this.ensureReady();
    
    if (this.backend === 'indexedDB') {
      await indexedDBStorage.deleteDatabase(name);
    } else {
      const saved = localStorage.getItem('mycsc_databases');
      if (!saved) return;
      const data = JSON.parse(saved);
      delete data[name];
      localStorage.setItem('mycsc_databases', JSON.stringify(data));
    }
  }

  async databaseExists(name: string): Promise<boolean> {
    const dbs = await this.listDatabases();
    return dbs.includes(name);
  }


  async listTables(dbName: string): Promise<string[]> {
    await this.ensureReady();
    
    if (this.backend === 'indexedDB') {
      const tables = await indexedDBStorage.listTables(dbName);
      return tables.map(t => t.tableName);
    } else {
      const saved = localStorage.getItem('mycsc_databases');
      if (!saved) return [];
      const data = JSON.parse(saved);
      if (!data[dbName]?.tables) return [];
      return Object.keys(data[dbName].tables);
    }
  }

  async createTable(dbName: string, tableName: string, schema: any): Promise<void> {
    await this.ensureReady();
    
    if (this.backend === 'indexedDB') {
      await indexedDBStorage.createTable(dbName, tableName, schema);
      await indexedDBStorage.saveRowChunk(dbName, tableName, 0, []);
      const meta = await indexedDBStorage.getTable(dbName, tableName);
      if (meta) {
        meta.chunkCount = 1;
        await indexedDBStorage.updateTable(meta);
      }
    } else {
      const saved = localStorage.getItem('mycsc_databases');
      const data = saved ? JSON.parse(saved) : {};
      if (!data[dbName]) {
        data[dbName] = { tables: {} };
      }
      data[dbName].tables[tableName] = { schema, rows: [], autoIncrementId: 1 };
      localStorage.setItem('mycsc_databases', JSON.stringify(data));
    }
  }

  async deleteTable(dbName: string, tableName: string): Promise<void> {
    await this.ensureReady();
    
    if (this.backend === 'indexedDB') {
      await indexedDBStorage.deleteTable(dbName, tableName);
    } else {
      const saved = localStorage.getItem('mycsc_databases');
      if (!saved) return;
      const data = JSON.parse(saved);
      if (data[dbName]?.tables) {
        delete data[dbName].tables[tableName];
        localStorage.setItem('mycsc_databases', JSON.stringify(data));
      }
    }
  }

  async getTableSchema(dbName: string, tableName: string): Promise<any> {
    await this.ensureReady();
    
    if (this.backend === 'indexedDB') {
      const meta = await indexedDBStorage.getTable(dbName, tableName);
      return meta?.schema || null;
    } else {
      const saved = localStorage.getItem('mycsc_databases');
      if (!saved) return null;
      const data = JSON.parse(saved);
      return data[dbName]?.tables?.[tableName]?.schema || null;
    }
  }

  async updateTableSchema(dbName: string, tableName: string, schema: any): Promise<void> {
    await this.ensureReady();
    
    if (this.backend === 'indexedDB') {
      const meta = await indexedDBStorage.getTable(dbName, tableName);
      if (meta) {
        meta.schema = schema;
        await indexedDBStorage.updateTable(meta);
      }
    } else {
      const saved = localStorage.getItem('mycsc_databases');
      if (!saved) return;
      const data = JSON.parse(saved);
      if (data[dbName]?.tables?.[tableName]) {
        data[dbName].tables[tableName].schema = schema;
        localStorage.setItem('mycsc_databases', JSON.stringify(data));
      }
    }
  }

  async getTableMeta(dbName: string, tableName: string): Promise<TableMeta | null> {
    await this.ensureReady();
    
    if (this.backend === 'indexedDB') {
      return await indexedDBStorage.getTable(dbName, tableName);
    } else {
      const saved = localStorage.getItem('mycsc_databases');
      if (!saved) return null;
      const data = JSON.parse(saved);
      const tableData = data[dbName]?.tables?.[tableName];
      if (!tableData) return null;
      
      return {
        dbName,
        tableName,
        schema: tableData.schema,
        rowCount: tableData.rows?.length || 0,
        chunkCount: 1,
        autoIncrementId: tableData.autoIncrementId || 1,
        createdAt: tableData.createdAt || '',
        updatedAt: tableData.updatedAt || ''
      };
    }
  }


  async getRows(dbName: string, tableName: string): Promise<Record<string, any>[]> {
    await this.ensureReady();
    
    if (this.backend === 'indexedDB') {
      return await indexedDBStorage.getAllRows(dbName, tableName);
    } else {
      const saved = localStorage.getItem('mycsc_databases');
      if (!saved) return [];
      const data = JSON.parse(saved);
      return data[dbName]?.tables?.[tableName]?.rows || [];
    }
  }

  async saveRows(dbName: string, tableName: string, rows: Record<string, any>[]): Promise<void> {
    await this.ensureReady();
    
    if (this.backend === 'indexedDB') {
      await indexedDBStorage.saveAllRows(dbName, tableName, rows);
    } else {
      const saved = localStorage.getItem('mycsc_databases');
      const data = saved ? JSON.parse(saved) : {};
      if (!data[dbName]?.tables?.[tableName]) {
        throw new Error(`Table ${tableName} not found`);
      }
      data[dbName].tables[tableName].rows = rows;
      localStorage.setItem('mycsc_databases', JSON.stringify(data));
    }
  }

  async insertRows(dbName: string, tableName: string, newRows: Record<string, any>[]): Promise<void> {
    await this.ensureReady();
    
    if (this.backend === 'indexedDB') {
      await indexedDBStorage.insertRows(dbName, tableName, newRows);
    } else {
      const rows = await this.getRows(dbName, tableName);
      rows.push(...newRows);
      await this.saveRows(dbName, tableName, rows);
    }
  }

  async getAutoIncrementId(dbName: string, tableName: string): Promise<number> {
    await this.ensureReady();
    
    if (this.backend === 'indexedDB') {
      const meta = await indexedDBStorage.getTable(dbName, tableName);
      return meta?.autoIncrementId || 1;
    } else {
      const saved = localStorage.getItem('mycsc_databases');
      if (!saved) return 1;
      const data = JSON.parse(saved);
      return data[dbName]?.tables?.[tableName]?.autoIncrementId || 1;
    }
  }

  async setAutoIncrementId(dbName: string, tableName: string, id: number): Promise<void> {
    await this.ensureReady();
    
    if (this.backend === 'indexedDB') {
      const meta = await indexedDBStorage.getTable(dbName, tableName);
      if (meta) {
        meta.autoIncrementId = id;
        await indexedDBStorage.updateTable(meta);
      }
    } else {
      const saved = localStorage.getItem('mycsc_databases');
      if (!saved) return;
      const data = JSON.parse(saved);
      if (data[dbName]?.tables?.[tableName]) {
        data[dbName].tables[tableName].autoIncrementId = id;
        localStorage.setItem('mycsc_databases', JSON.stringify(data));
      }
    }
  }


  async exportDatabase(dbName: string): Promise<any> {
    await this.ensureReady();
    
    if (this.backend === 'indexedDB') {
      return await indexedDBStorage.exportToLocalStorageFormat(dbName);
    } else {
      const saved = localStorage.getItem('mycsc_databases');
      if (!saved) return null;
      const data = JSON.parse(saved);
      return data[dbName] || null;
    }
  }

  async importDatabase(dbName: string, dbData: any): Promise<void> {
    await this.ensureReady();
    if (await this.databaseExists(dbName)) {
      await this.deleteDatabase(dbName);
    }

    await this.createDatabase(dbName);

    if (dbData.tables) {
      for (const [tableName, tableData] of Object.entries(dbData.tables) as [string, any][]) {
        await this.createTable(dbName, tableName, tableData.schema);
        if (tableData.rows && tableData.rows.length > 0) {
          await this.saveRows(dbName, tableName, tableData.rows);
        }
        if (tableData.autoIncrementId) {
          await this.setAutoIncrementId(dbName, tableName, tableData.autoIncrementId);
        }
      }
    }
  }


  async exportAll(): Promise<any> {
    await this.ensureReady();
    
    const dbs = await this.listDatabases();
    const result: any = {};
    
    for (const dbName of dbs) {
      result[dbName] = await this.exportDatabase(dbName);
    }
    
    return result;
  }

  async importAll(data: any): Promise<void> {
    await this.ensureReady();
    
    for (const [dbName, dbData] of Object.entries(data)) {
      await this.importDatabase(dbName, dbData);
    }
  }


  async appendWAL(dbName: string, operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'DDL', sql: string, tableName?: string, data?: any): Promise<void> {
    if (!this.config.enableWAL || this.backend !== 'indexedDB') return;
    
    await indexedDBStorage.appendWAL({
      dbName,
      timestamp: new Date().toISOString(),
      operation,
      tableName,
      sql,
      data
    });
  }

  async getWAL(dbName: string, since?: string): Promise<any[]> {
    if (this.backend !== 'indexedDB') return [];
    return await indexedDBStorage.getWALEntries(dbName, since);
  }


  async getStorageInfo(): Promise<{
    backend: StorageBackend;
    databases: number;
    tables: number;
    estimatedSize: string;
    quota?: string;
    usage?: string;
  }> {
    await this.ensureReady();
    
    if (this.backend === 'indexedDB') {
      const info = await indexedDBStorage.getStorageInfo();
      return { backend: 'indexedDB', ...info };
    } else {
      const dbs = await this.listDatabases();
      let tableCount = 0;
      for (const db of dbs) {
        const tables = await this.listTables(db);
        tableCount += tables.length;
      }
      const saved = localStorage.getItem('mycsc_databases');
      const size = saved ? new Blob([saved]).size : 0;
      
      return {
        backend: 'localStorage',
        databases: dbs.length,
        tables: tableCount,
        estimatedSize: this.formatBytes(size),
        quota: '5-10 MB (browser limit)'
      };
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  }


  async saveBackup(id: string, data: any): Promise<void> {
    await this.ensureReady();
    
    if (this.backend === 'indexedDB') {
      await indexedDBStorage.saveBackup(id, data);
    } else {
      const backups = JSON.parse(localStorage.getItem('mycsc_backups') || '{}');
      backups[id] = { data, timestamp: new Date().toISOString() };
      localStorage.setItem('mycsc_backups', JSON.stringify(backups));
    }
  }

  async getBackup(id: string): Promise<any> {
    await this.ensureReady();
    
    if (this.backend === 'indexedDB') {
      return await indexedDBStorage.getBackup(id);
    } else {
      const backups = JSON.parse(localStorage.getItem('mycsc_backups') || '{}');
      return backups[id]?.data;
    }
  }

  async listBackups(): Promise<{ id: string; timestamp: string }[]> {
    await this.ensureReady();
    
    if (this.backend === 'indexedDB') {
      return await indexedDBStorage.listBackups();
    } else {
      const backups = JSON.parse(localStorage.getItem('mycsc_backups') || '{}');
      return Object.entries(backups).map(([id, b]: [string, any]) => ({
        id,
        timestamp: b.timestamp
      }));
    }
  }

  async deleteBackup(id: string): Promise<void> {
    await this.ensureReady();
    
    if (this.backend === 'indexedDB') {
      await indexedDBStorage.deleteBackup(id);
    } else {
      const backups = JSON.parse(localStorage.getItem('mycsc_backups') || '{}');
      delete backups[id];
      localStorage.setItem('mycsc_backups', JSON.stringify(backups));
    }
  }


  async forceMigrationToIndexedDB(): Promise<{ success: boolean; error?: string }> {
    if (this.backend === 'indexedDB') {
      try {
        const result = await indexedDBStorage.migrateFromLocalStorage();
        return { success: true };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    }
    return { success: false, error: 'IndexedDB not available' };
  }
}

export const storage = new StorageAdapter();
