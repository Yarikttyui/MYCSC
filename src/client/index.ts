import { EventEmitter } from 'events';


export interface ClientConfig {
  host: string;
  port: number;
  protocol: 'http' | 'https' | 'ws' | 'wss';
  username?: string;
  password?: string;
  token?: string;
  database?: string;
  autoConnect: boolean;
  reconnect: boolean;
  reconnectInterval: number;
  reconnectAttempts: number;
  timeout: number;
  keepAlive: boolean;
  keepAliveInterval: number;
  poolSize: number;
  debug: boolean;
}

export interface QueryResult<T = any> {
  rows: T[];
  fields?: FieldInfo[];
  affectedRows?: number;
  insertId?: number;
  changedRows?: number;
  warningCount?: number;
  message?: string;
  executionTime?: number;
}

export interface FieldInfo {
  name: string;
  type: string;
  table?: string;
  length?: number;
  nullable?: boolean;
}

export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  rowCount?: number;
  indexes?: IndexInfo[];
}

export interface ColumnInfo {
  name: string;
  type: string;
  length?: number;
  nullable: boolean;
  primaryKey: boolean;
  autoIncrement: boolean;
  defaultValue?: any;
  unique: boolean;
}

export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface TransactionOptions {
  isolationLevel?: 'READ_UNCOMMITTED' | 'READ_COMMITTED' | 'REPEATABLE_READ' | 'SERIALIZABLE';
  readOnly?: boolean;
}

export interface PreparedStatement {
  sql: string;
  params: any[];
  execute(params?: any[]): Promise<QueryResult>;
  close(): void;
}

export type EventType = 
  | 'connect'
  | 'disconnect'
  | 'error'
  | 'reconnect'
  | 'query'
  | 'result';


const DEFAULT_CONFIG: ClientConfig = {
  host: 'localhost',
  port: 3001,
  protocol: 'http',
  autoConnect: true,
  reconnect: true,
  reconnectInterval: 3000,
  reconnectAttempts: 5,
  timeout: 30000,
  keepAlive: true,
  keepAliveInterval: 30000,
  poolSize: 10,
  debug: false
};


export class QueryBuilder {
  private _table: string = '';
  private _select: string[] = ['*'];
  private _where: string[] = [];
  private _whereParams: any[] = [];
  private _orderBy: string[] = [];
  private _groupBy: string[] = [];
  private _having: string[] = [];
  private _limit?: number;
  private _offset?: number;
  private _joins: string[] = [];
  private _distinct: boolean = false;

  constructor(private client: MYCSCClient) {}

  table(name: string): this {
    this._table = name;
    return this;
  }

  select(...columns: string[]): this {
    this._select = columns.length > 0 ? columns : ['*'];
    return this;
  }

  distinct(): this {
    this._distinct = true;
    return this;
  }

  where(condition: string, ...params: any[]): this {
    this._where.push(condition);
    this._whereParams.push(...params);
    return this;
  }

  andWhere(condition: string, ...params: any[]): this {
    return this.where(condition, ...params);
  }

  orWhere(condition: string, ...params: any[]): this {
    if (this._where.length > 0) {
      this._where.push(`OR ${condition}`);
    } else {
      this._where.push(condition);
    }
    this._whereParams.push(...params);
    return this;
  }

  whereIn(column: string, values: any[]): this {
    const placeholders = values.map(() => '?').join(', ');
    this._where.push(`${column} IN (${placeholders})`);
    this._whereParams.push(...values);
    return this;
  }

  whereNotIn(column: string, values: any[]): this {
    const placeholders = values.map(() => '?').join(', ');
    this._where.push(`${column} NOT IN (${placeholders})`);
    this._whereParams.push(...values);
    return this;
  }

  whereNull(column: string): this {
    this._where.push(`${column} IS NULL`);
    return this;
  }

  whereNotNull(column: string): this {
    this._where.push(`${column} IS NOT NULL`);
    return this;
  }

  whereBetween(column: string, min: any, max: any): this {
    this._where.push(`${column} BETWEEN ? AND ?`);
    this._whereParams.push(min, max);
    return this;
  }

  whereLike(column: string, pattern: string): this {
    this._where.push(`${column} LIKE ?`);
    this._whereParams.push(pattern);
    return this;
  }

  orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this._orderBy.push(`${column} ${direction}`);
    return this;
  }

  groupBy(...columns: string[]): this {
    this._groupBy.push(...columns);
    return this;
  }

  having(condition: string): this {
    this._having.push(condition);
    return this;
  }

  limit(count: number): this {
    this._limit = count;
    return this;
  }

  offset(count: number): this {
    this._offset = count;
    return this;
  }

  join(table: string, condition: string, type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' = 'INNER'): this {
    this._joins.push(`${type} JOIN ${table} ON ${condition}`);
    return this;
  }

  leftJoin(table: string, condition: string): this {
    return this.join(table, condition, 'LEFT');
  }

  rightJoin(table: string, condition: string): this {
    return this.join(table, condition, 'RIGHT');
  }

  innerJoin(table: string, condition: string): this {
    return this.join(table, condition, 'INNER');
  }
  toSQL(): string {
    let sql = 'SELECT ';
    
    if (this._distinct) {
      sql += 'DISTINCT ';
    }
    
    sql += this._select.join(', ');
    sql += ` FROM ${this._table}`;
    
    if (this._joins.length > 0) {
      sql += ' ' + this._joins.join(' ');
    }
    
    if (this._where.length > 0) {
      sql += ' WHERE ' + this._where.join(' AND ');
    }
    
    if (this._groupBy.length > 0) {
      sql += ' GROUP BY ' + this._groupBy.join(', ');
    }
    
    if (this._having.length > 0) {
      sql += ' HAVING ' + this._having.join(' AND ');
    }
    
    if (this._orderBy.length > 0) {
      sql += ' ORDER BY ' + this._orderBy.join(', ');
    }
    
    if (this._limit !== undefined) {
      sql += ` LIMIT ${this._limit}`;
    }
    
    if (this._offset !== undefined) {
      sql += ` OFFSET ${this._offset}`;
    }
    
    return sql;
  }

  getParams(): any[] {
    return [...this._whereParams];
  }

  async get<T = any>(): Promise<T[]> {
    const result = await this.client.query<T>(this.toSQL(), this.getParams());
    return result.rows;
  }

  async first<T = any>(): Promise<T | null> {
    this._limit = 1;
    const rows = await this.get<T>();
    return rows[0] || null;
  }

  async count(): Promise<number> {
    const originalSelect = this._select;
    this._select = ['COUNT(*) as count'];
    const result = await this.first<{ count: number }>();
    this._select = originalSelect;
    return result?.count || 0;
  }

  async exists(): Promise<boolean> {
    return (await this.count()) > 0;
  }

  async pluck<T = any>(column: string): Promise<T[]> {
    this._select = [column];
    const rows = await this.get<any>();
    return rows.map(row => row[column]);
  }
  async insert(data: Record<string, any> | Record<string, any>[]): Promise<QueryResult> {
    const rows = Array.isArray(data) ? data : [data];
    if (rows.length === 0) {
      throw new Error('No data to insert');
    }

    const columns = Object.keys(rows[0]);
    const placeholders = rows.map(
      () => `(${columns.map(() => '?').join(', ')})`
    ).join(', ');
    
    const values = rows.flatMap(row => columns.map(col => row[col]));
    
    const sql = `INSERT INTO ${this._table} (${columns.join(', ')}) VALUES ${placeholders}`;
    return this.client.query(sql, values);
  }
  async update(data: Record<string, any>): Promise<QueryResult> {
    const columns = Object.keys(data);
    const setClause = columns.map(col => `${col} = ?`).join(', ');
    const values = columns.map(col => data[col]);
    
    let sql = `UPDATE ${this._table} SET ${setClause}`;
    
    if (this._where.length > 0) {
      sql += ' WHERE ' + this._where.join(' AND ');
      values.push(...this._whereParams);
    }
    
    return this.client.query(sql, values);
  }
  async delete(): Promise<QueryResult> {
    let sql = `DELETE FROM ${this._table}`;
    
    if (this._where.length > 0) {
      sql += ' WHERE ' + this._where.join(' AND ');
    }
    
    return this.client.query(sql, this._whereParams);
  }
  reset(): this {
    this._select = ['*'];
    this._where = [];
    this._whereParams = [];
    this._orderBy = [];
    this._groupBy = [];
    this._having = [];
    this._limit = undefined;
    this._offset = undefined;
    this._joins = [];
    this._distinct = false;
    return this;
  }
}


export class Transaction {
  private committed = false;
  private rolledBack = false;

  constructor(
    private client: MYCSCClient,
    private options: TransactionOptions = {}
  ) {}

  async begin(): Promise<void> {
    let sql = 'BEGIN';
    if (this.options.isolationLevel) {
      sql = `SET TRANSACTION ISOLATION LEVEL ${this.options.isolationLevel}; BEGIN`;
    }
    await this.client.query(sql);
  }

  async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    if (this.committed || this.rolledBack) {
      throw new Error('Transaction already ended');
    }
    return this.client.query<T>(sql, params);
  }

  table(name: string): QueryBuilder {
    return this.client.table(name);
  }

  async commit(): Promise<void> {
    if (this.committed || this.rolledBack) {
      throw new Error('Transaction already ended');
    }
    await this.client.query('COMMIT');
    this.committed = true;
  }

  async rollback(): Promise<void> {
    if (this.committed || this.rolledBack) {
      throw new Error('Transaction already ended');
    }
    await this.client.query('ROLLBACK');
    this.rolledBack = true;
  }

  async savepoint(name: string): Promise<void> {
    await this.client.query(`SAVEPOINT ${name}`);
  }

  async rollbackTo(name: string): Promise<void> {
    await this.client.query(`ROLLBACK TO SAVEPOINT ${name}`);
  }

  async releaseSavepoint(name: string): Promise<void> {
    await this.client.query(`RELEASE SAVEPOINT ${name}`);
  }

  isActive(): boolean {
    return !this.committed && !this.rolledBack;
  }
}


export abstract class Model {
  static tableName: string;
  static primaryKey: string = 'id';
  static client: MYCSCClient;

  [key: string]: any;

  static table(): QueryBuilder {
    return this.client.table(this.tableName);
  }

  static async find<T extends Model>(id: any): Promise<T | null> {
    return this.table().where(`${this.primaryKey} = ?`, id).first<T>();
  }

  static async findMany<T extends Model>(ids: any[]): Promise<T[]> {
    return this.table().whereIn(this.primaryKey, ids).get<T>();
  }

  static async all<T extends Model>(): Promise<T[]> {
    return this.table().get<T>();
  }

  static async create<T extends Model>(data: Partial<T>): Promise<QueryResult> {
    return this.table().insert(data as Record<string, any>);
  }

  static async updateWhere(where: Record<string, any>, data: Partial<Model>): Promise<QueryResult> {
    let builder = this.table();
    for (const [key, value] of Object.entries(where)) {
      builder = builder.where(`${key} = ?`, value);
    }
    return builder.update(data as Record<string, any>);
  }

  static async deleteWhere(where: Record<string, any>): Promise<QueryResult> {
    let builder = this.table();
    for (const [key, value] of Object.entries(where)) {
      builder = builder.where(`${key} = ?`, value);
    }
    return builder.delete();
  }

  static where(condition: string, ...params: any[]): QueryBuilder {
    return this.table().where(condition, ...params);
  }

  static orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): QueryBuilder {
    return this.table().orderBy(column, direction);
  }

  static limit(count: number): QueryBuilder {
    return this.table().limit(count);
  }

  async save(): Promise<QueryResult> {
    const constructor = this.constructor as typeof Model;
    const pk = constructor.primaryKey;
    const data: Record<string, any> = {};
    
    for (const key of Object.keys(this)) {
      if (key !== pk || this[pk] === undefined) {
        data[key] = this[key];
      }
    }

    if (this[pk]) {
      return constructor.table()
        .where(`${pk} = ?`, this[pk])
        .update(data);
    } else {
      return constructor.table().insert(data);
    }
  }

  async delete(): Promise<QueryResult> {
    const constructor = this.constructor as typeof Model;
    const pk = constructor.primaryKey;
    
    if (!this[pk]) {
      throw new Error('Cannot delete model without primary key');
    }
    
    return constructor.table()
      .where(`${pk} = ?`, this[pk])
      .delete();
  }

  async refresh(): Promise<this | null> {
    const constructor = this.constructor as typeof Model;
    const pk = constructor.primaryKey;
    
    if (!this[pk]) {
      return null;
    }
    
    const fresh = await constructor.find(this[pk]);
    if (fresh) {
      Object.assign(this, fresh);
    }
    return this;
  }
}


export class SchemaBuilder {
  private columns: string[] = [];
  private indexes: string[] = [];
  private foreignKeys: string[] = [];
  private tableOptions: string[] = [];

  constructor(
    private client: MYCSCClient,
    private tableName: string
  ) {}
  id(name: string = 'id'): this {
    this.columns.push(`${name} INT PRIMARY KEY AUTO_INCREMENT`);
    return this;
  }

  string(name: string, length: number = 255): this {
    this.columns.push(`${name} VARCHAR(${length})`);
    return this;
  }

  text(name: string): this {
    this.columns.push(`${name} TEXT`);
    return this;
  }

  integer(name: string): this {
    this.columns.push(`${name} INT`);
    return this;
  }

  bigInteger(name: string): this {
    this.columns.push(`${name} BIGINT`);
    return this;
  }

  float(name: string): this {
    this.columns.push(`${name} FLOAT`);
    return this;
  }

  decimal(name: string, precision: number = 10, scale: number = 2): this {
    this.columns.push(`${name} DECIMAL(${precision}, ${scale})`);
    return this;
  }

  boolean(name: string): this {
    this.columns.push(`${name} BOOLEAN`);
    return this;
  }

  date(name: string): this {
    this.columns.push(`${name} DATE`);
    return this;
  }

  datetime(name: string): this {
    this.columns.push(`${name} DATETIME`);
    return this;
  }

  timestamp(name: string): this {
    this.columns.push(`${name} TIMESTAMP`);
    return this;
  }

  json(name: string): this {
    this.columns.push(`${name} JSON`);
    return this;
  }

  blob(name: string): this {
    this.columns.push(`${name} BLOB`);
    return this;
  }
  nullable(): this {
    const last = this.columns.length - 1;
    if (last >= 0) {
      this.columns[last] += ' NULL';
    }
    return this;
  }

  notNull(): this {
    const last = this.columns.length - 1;
    if (last >= 0) {
      this.columns[last] += ' NOT NULL';
    }
    return this;
  }

  default(value: any): this {
    const last = this.columns.length - 1;
    if (last >= 0) {
      const defaultVal = typeof value === 'string' ? `'${value}'` : value;
      this.columns[last] += ` DEFAULT ${defaultVal}`;
    }
    return this;
  }

  unique(): this {
    const last = this.columns.length - 1;
    if (last >= 0) {
      this.columns[last] += ' UNIQUE';
    }
    return this;
  }

  primaryKey(): this {
    const last = this.columns.length - 1;
    if (last >= 0) {
      this.columns[last] += ' PRIMARY KEY';
    }
    return this;
  }

  autoIncrement(): this {
    const last = this.columns.length - 1;
    if (last >= 0) {
      this.columns[last] += ' AUTO_INCREMENT';
    }
    return this;
  }
  timestamps(): this {
    this.timestamp('created_at').default('CURRENT_TIMESTAMP');
    this.timestamp('updated_at').default('CURRENT_TIMESTAMP');
    return this;
  }

  softDeletes(): this {
    this.timestamp('deleted_at').nullable();
    return this;
  }
  index(columns: string | string[], name?: string): this {
    const cols = Array.isArray(columns) ? columns : [columns];
    const indexName = name || `idx_${this.tableName}_${cols.join('_')}`;
    this.indexes.push(`INDEX ${indexName} (${cols.join(', ')})`);
    return this;
  }

  uniqueIndex(columns: string | string[], name?: string): this {
    const cols = Array.isArray(columns) ? columns : [columns];
    const indexName = name || `idx_${this.tableName}_${cols.join('_')}`;
    this.indexes.push(`UNIQUE INDEX ${indexName} (${cols.join(', ')})`);
    return this;
  }
  foreign(column: string, references: string, on: string): this {
    this.foreignKeys.push(
      `FOREIGN KEY (${column}) REFERENCES ${on}(${references})`
    );
    return this;
  }

  onDelete(action: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION'): this {
    const last = this.foreignKeys.length - 1;
    if (last >= 0) {
      this.foreignKeys[last] += ` ON DELETE ${action}`;
    }
    return this;
  }

  onUpdate(action: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION'): this {
    const last = this.foreignKeys.length - 1;
    if (last >= 0) {
      this.foreignKeys[last] += ` ON UPDATE ${action}`;
    }
    return this;
  }
  toSQL(): string {
    const parts = [
      ...this.columns,
      ...this.indexes,
      ...this.foreignKeys
    ];
    
    let sql = `CREATE TABLE ${this.tableName} (\n  ${parts.join(',\n  ')}\n)`;
    
    if (this.tableOptions.length > 0) {
      sql += ' ' + this.tableOptions.join(' ');
    }
    
    return sql;
  }

  async create(): Promise<QueryResult> {
    return this.client.query(this.toSQL());
  }

  async createIfNotExists(): Promise<QueryResult> {
    const sql = this.toSQL().replace('CREATE TABLE', 'CREATE TABLE IF NOT EXISTS');
    return this.client.query(sql);
  }
}


export class MYCSCClient extends EventEmitter {
  private config: ClientConfig;
  private token: string | null = null;
  private connected = false;
  private reconnectAttempt = 0;
  private keepAliveTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<ClientConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    if (this.config.autoConnect) {
      this.connect().catch(err => {
        this.emit('error', err);
      });
    }
  }


  async connect(): Promise<void> {
    try {
      if (this.config.username && this.config.password) {
        await this.login(this.config.username, this.config.password);
      } else if (this.config.token) {
        this.token = this.config.token;
      }

      if (this.config.database) {
        await this.useDatabase(this.config.database);
      }

      this.connected = true;
      this.reconnectAttempt = 0;
      
      if (this.config.keepAlive) {
        this.startKeepAlive();
      }

      this.emit('connect');
      this.log('Connected to MYCSC server');
    } catch (error) {
      this.emit('error', error);
      
      if (this.config.reconnect && this.reconnectAttempt < this.config.reconnectAttempts) {
        this.reconnectAttempt++;
        this.emit('reconnect', { attempt: this.reconnectAttempt });
        
        setTimeout(() => {
          this.connect();
        }, this.config.reconnectInterval);
      } else {
        throw error;
      }
    }
  }

  async disconnect(): Promise<void> {
    this.stopKeepAlive();
    
    if (this.token) {
      try {
        await this.logout();
      } catch (e) {
      }
    }
    
    this.connected = false;
    this.token = null;
    this.emit('disconnect');
    this.log('Disconnected from MYCSC server');
  }

  isConnected(): boolean {
    return this.connected;
  }


  async login(username: string, password: string): Promise<void> {
    const response = await this.request('POST', '/auth/login', {
      username,
      password
    });
    
    if (response.success && response.data?.token) {
      this.token = response.data.token;
    } else {
      throw new Error(response.error || 'Login failed');
    }
  }

  async logout(): Promise<void> {
    await this.request('POST', '/auth/logout');
    this.token = null;
  }

  async register(username: string, password: string): Promise<void> {
    const response = await this.request('POST', '/auth/register', {
      username,
      password
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Registration failed');
    }
  }


  async useDatabase(name: string): Promise<void> {
    await this.request('POST', `/databases/${name}/use`);
    this.config.database = name;
  }

  async createDatabase(name: string): Promise<void> {
    await this.request('POST', '/databases', { name });
  }

  async dropDatabase(name: string): Promise<void> {
    await this.request('DELETE', `/databases/${name}`);
  }

  async listDatabases(): Promise<string[]> {
    const response = await this.request('GET', '/databases');
    return response.data?.databases || [];
  }

  async getCurrentDatabase(): Promise<string> {
    const response = await this.request('GET', '/databases/current');
    return response.data?.database || '';
  }


  async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    const startTime = Date.now();
    let processedSql = sql;
    if (params && params.length > 0) {
      let paramIndex = 0;
      processedSql = sql.replace(/\?/g, () => {
        const value = params[paramIndex++];
        if (value === null) return 'NULL';
        if (typeof value === 'string') return `'${this.escape(value)}'`;
        if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
        if (value instanceof Date) return `'${value.toISOString()}'`;
        return String(value);
      });
    }

    const response = await this.request('POST', '/query', { sql: processedSql });
    
    const executionTime = Date.now() - startTime;
    
    this.emit('query', { sql: processedSql, executionTime });
    
    if (!response.success) {
      throw new Error(response.error || 'Query failed');
    }

    const result: QueryResult<T> = {
      rows: response.data?.rows || [],
      fields: response.data?.fields,
      affectedRows: response.data?.affectedRows,
      insertId: response.data?.insertId,
      changedRows: response.data?.changedRows,
      executionTime
    };

    this.emit('result', result);
    return result;
  }

  async queryBatch(queries: string[]): Promise<QueryResult[]> {
    const response = await this.request('POST', '/query/batch', { queries });
    
    if (!response.success) {
      throw new Error(response.error || 'Batch query failed');
    }

    return response.data?.results || [];
  }

  async execute(sql: string, params?: any[]): Promise<QueryResult> {
    return this.query(sql, params);
  }


  table(name: string): QueryBuilder {
    return new QueryBuilder(this).table(name);
  }

  select(...columns: string[]): QueryBuilder {
    return new QueryBuilder(this).select(...columns);
  }

  raw(sql: string, params?: any[]): Promise<QueryResult> {
    return this.query(sql, params);
  }


  async transaction<T>(
    callback: (trx: Transaction) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    const trx = new Transaction(this, options);
    
    try {
      await trx.begin();
      const result = await callback(trx);
      await trx.commit();
      return result;
    } catch (error) {
      if (trx.isActive()) {
        await trx.rollback();
      }
      throw error;
    }
  }

  async beginTransaction(options?: TransactionOptions): Promise<Transaction> {
    const trx = new Transaction(this, options);
    await trx.begin();
    return trx;
  }


  async listTables(): Promise<string[]> {
    const response = await this.request('GET', '/tables');
    return response.data?.tables || [];
  }

  async tableExists(name: string): Promise<boolean> {
    const tables = await this.listTables();
    return tables.includes(name);
  }

  async getTableInfo(name: string): Promise<TableInfo | null> {
    const response = await this.request('GET', `/tables/${name}`);
    return response.data?.table || null;
  }

  async createTable(name: string, callback: (table: SchemaBuilder) => void): Promise<QueryResult> {
    const schema = new SchemaBuilder(this, name);
    callback(schema);
    return schema.create();
  }

  async dropTable(name: string): Promise<void> {
    await this.request('DELETE', `/tables/${name}`);
  }

  async truncateTable(name: string): Promise<void> {
    await this.request('POST', `/tables/${name}/truncate`);
  }

  async renameTable(oldName: string, newName: string): Promise<void> {
    await this.request('PATCH', `/schema/${oldName}/rename`, { newName });
  }


  async addColumn(table: string, column: string, type: string): Promise<void> {
    await this.request('POST', `/schema/${table}/columns`, {
      name: column,
      type
    });
  }

  async dropColumn(table: string, column: string): Promise<void> {
    await this.request('DELETE', `/schema/${table}/columns/${column}`);
  }


  async createIndex(
    name: string,
    table: string,
    columns: string[],
    unique: boolean = false
  ): Promise<void> {
    await this.request('POST', '/indexes', {
      name,
      table,
      columns,
      unique
    });
  }

  async dropIndex(name: string, table?: string): Promise<void> {
    const params = table ? `?table=${table}` : '';
    await this.request('DELETE', `/indexes/${name}${params}`);
  }


  escape(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  escapeId(identifier: string): string {
    return `\`${identifier.replace(/`/g, '``')}\``;
  }


  prepare(sql: string): PreparedStatement {
    const client = this;
    let params: any[] = [];

    return {
      sql,
      params,
      async execute(newParams?: any[]): Promise<QueryResult> {
        return client.query(sql, newParams || params);
      },
      close(): void {
      }
    };
  }


  model<T extends typeof Model>(modelClass: T): T {
    modelClass.client = this;
    return modelClass;
  }


  async ping(): Promise<boolean> {
    try {
      const response = await this.request('GET', '/health');
      return response.success === true;
    } catch {
      return false;
    }
  }

  async getServerInfo(): Promise<any> {
    const response = await this.request('GET', '/health');
    return response.data || {};
  }


  private async request(method: string, path: string, body?: any): Promise<any> {
    const baseUrl = `${this.config.protocol}://${this.config.host}:${this.config.port}/api/v1`;
    const url = `${baseUrl}${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeout);
      return await response.json();
    } catch (error: any) {
      clearTimeout(timeout);
      
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      
      throw error;
    }
  }

  private startKeepAlive(): void {
    this.stopKeepAlive();
    
    this.keepAliveTimer = setInterval(async () => {
      try {
        await this.ping();
      } catch (error) {
        this.emit('error', error);
      }
    }, this.config.keepAliveInterval);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[MYCSC Client] ${message}`);
    }
  }
}


export function createClient(config: Partial<ClientConfig> = {}): MYCSCClient {
  return new MYCSCClient(config);
}

export function connect(connectionString: string): MYCSCClient {
  const match = connectionString.match(
    /^mycsc:\/\/(?:([^:]+):([^@]+)@)?([^:\/]+)(?::(\d+))?(?:\/(.+))?$/
  );

  if (!match) {
    throw new Error('Invalid connection string');
  }

  const [, username, password, host, port, database] = match;

  return createClient({
    host,
    port: port ? parseInt(port) : undefined,
    username,
    password,
    database,
    autoConnect: false
  });
}

export default MYCSCClient;
