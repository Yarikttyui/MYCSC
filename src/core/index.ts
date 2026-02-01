import { StorageEngine } from './storage';
import { QueryExecutor } from './executor';
import { QueryResult, DatabaseConfig, TableSchema } from './types';
import * as path from 'path';
import * as os from 'os';
export * from './ast-types';
export * from './lexer';
export * from './ast-parser';
export * from './sql-executor';

export class MYCSC {
  private storage: StorageEngine;
  private executor: QueryExecutor;
  private config: DatabaseConfig;
  private currentDatabase: string;

  constructor(config?: Partial<DatabaseConfig>) {
    this.config = {
      dataDir: config?.dataDir || path.join(os.homedir(), '.mycsc', 'data'),
      maxConnections: config?.maxConnections || 100,
      cacheSize: config?.cacheSize || 1024 * 1024 * 64, // 64MB
      logLevel: config?.logLevel || 'info',
      enableAuth: config?.enableAuth ?? true,
      enableTransactions: config?.enableTransactions ?? true,
      autoCommit: config?.autoCommit ?? true,
      queryTimeout: config?.queryTimeout ?? 30000,
      maxQuerySize: config?.maxQuerySize ?? 1024 * 1024
    };

    this.currentDatabase = 'default';
    this.storage = new StorageEngine(
      path.join(this.config.dataDir, this.currentDatabase)
    );
    this.executor = new QueryExecutor(this.storage);
  }
  async query(sql: string): Promise<QueryResult> {
    const trimmedSql = sql.trim();
    if (trimmedSql.toUpperCase().startsWith('USE ')) {
      const dbName = trimmedSql.slice(4).trim().replace(/;$/, '');
      return this.useDatabase(dbName);
    }
    if (trimmedSql.toUpperCase() === 'SHOW TABLES' || trimmedSql.toUpperCase() === 'SHOW TABLES;') {
      return this.showTables();
    }
    const descMatch = trimmedSql.match(/^(DESCRIBE|DESC)\s+(\w+);?$/i);
    if (descMatch) {
      return this.describeTable(descMatch[2]);
    }
    if (trimmedSql.toUpperCase() === 'SHOW DATABASES' || trimmedSql.toUpperCase() === 'SHOW DATABASES;') {
      return this.showDatabases();
    }
    const createDbMatch = trimmedSql.match(/^CREATE\s+DATABASE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+);?$/i);
    if (createDbMatch) {
      return this.createDatabase(createDbMatch[1]);
    }
    const dropDbMatch = trimmedSql.match(/^DROP\s+DATABASE\s+(?:IF\s+EXISTS\s+)?(\w+);?$/i);
    if (dropDbMatch) {
      return this.dropDatabase(dropDbMatch[1]);
    }

    return this.executor.execute(sql);
  }
  async queryMultiple(sql: string): Promise<QueryResult[]> {
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const results: QueryResult[] = [];

    for (const statement of statements) {
      const result = await this.query(statement);
      results.push(result);
    }

    return results;
  }
  private useDatabase(name: string): QueryResult {
    const dbPath = path.join(this.config.dataDir, name);
    
    this.currentDatabase = name;
    this.storage = new StorageEngine(dbPath);
    this.executor = new QueryExecutor(this.storage);

    return {
      success: true,
      executionTime: 0
    };
  }
  private showTables(): QueryResult {
    const tables = this.executor.getTables();
    return {
      success: true,
      rows: tables.map(t => ({ Table: t })),
      columns: ['Table'],
      executionTime: 0
    };
  }
  private describeTable(tableName: string): QueryResult {
    const schema = this.executor.getTableSchema(tableName);
    
    if (!schema) {
      return {
        success: false,
        error: `Table "${tableName}" does not exist`,
        executionTime: 0
      };
    }

    const rows = schema.columns.map(col => ({
      Field: col.name,
      Type: col.length ? `${col.type}(${col.length})` : col.type,
      Null: col.nullable ? 'YES' : 'NO',
      Key: col.primaryKey ? 'PRI' : (col.unique ? 'UNI' : ''),
      Default: col.defaultValue ?? 'NULL',
      Extra: col.autoIncrement ? 'auto_increment' : ''
    }));

    return {
      success: true,
      rows,
      columns: ['Field', 'Type', 'Null', 'Key', 'Default', 'Extra'],
      executionTime: 0
    };
  }
  private showDatabases(): QueryResult {
    const fs = require('fs');
    const databases: string[] = [];

    if (fs.existsSync(this.config.dataDir)) {
      const entries = fs.readdirSync(this.config.dataDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          databases.push(entry.name);
        }
      }
    }

    if (databases.length === 0) {
      databases.push('default');
    }

    return {
      success: true,
      rows: databases.map(d => ({ Database: d })),
      columns: ['Database'],
      executionTime: 0
    };
  }
  private createDatabase(name: string): QueryResult {
    const fs = require('fs');
    const dbPath = path.join(this.config.dataDir, name);

    if (!fs.existsSync(dbPath)) {
      fs.mkdirSync(dbPath, { recursive: true });
    }

    return {
      success: true,
      executionTime: 0
    };
  }
  private dropDatabase(name: string): QueryResult {
    const fs = require('fs');
    const dbPath = path.join(this.config.dataDir, name);

    if (fs.existsSync(dbPath)) {
      fs.rmSync(dbPath, { recursive: true });
    }

    return {
      success: true,
      executionTime: 0
    };
  }
  getCurrentDatabase(): string {
    return this.currentDatabase;
  }
  getDatabases(): string[] {
    const fs = require('fs');
    const databases: string[] = [];

    if (fs.existsSync(this.config.dataDir)) {
      const entries = fs.readdirSync(this.config.dataDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          databases.push(entry.name);
        }
      }
    }

    if (databases.length === 0) {
      databases.push('default');
    }

    return databases;
  }
  getTableSchema(tableName: string): TableSchema | undefined {
    return this.executor.getTableSchema(tableName);
  }
  getTables(): string[] {
    return this.executor.getTables();
  }
  getConfig(): DatabaseConfig {
    return this.config;
  }
}
export * from './types';
export { SQLParser } from './parser';
export { StorageEngine } from './storage';
export { QueryExecutor } from './executor';
export { BTree, IndexManager } from './btree';
export { TransactionManager } from './transaction';
export { AuthManager } from './auth';
export { ExportImportManager } from './export';
export { QueryOptimizer } from './query-optimizer';
export * from './parallel-executor';
export * from './connection-pool';
export { default as CollaborationManager, CollaboratorRole, RolePermissions } from './collaboration';
export { 
  MYCSCClient, 
  QueryBuilder, 
  Transaction as ClientTransaction, 
  Model, 
  SchemaBuilder, 
  createClient, 
  connect 
} from '../client';
