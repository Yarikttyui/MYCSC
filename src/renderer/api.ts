export interface ColumnDefinition {
  name: string;
  type: string;
  length?: number;
  nullable?: boolean;
  defaultValue?: any;
  primaryKey?: boolean;
  autoIncrement?: boolean;
  unique?: boolean;
  references?: {
    table: string;
    column: string;
  };
  enumValues?: string[];
  setValues?: string[];
  unsigned?: boolean;
  zerofill?: boolean;
  charset?: string;
  collation?: string;
  precision?: number;
  scale?: number;
  onUpdate?: string;
}

export interface TableSchema {
  name: string;
  columns: ColumnDefinition[];
  primaryKey?: string[];
  indexes?: Array<{
    name: string;
    columns: string[];
    unique?: boolean;
  }>;
  foreignKeys?: Array<{
    column: string;
    refTable: string;
    refColumn: string;
  }>;
}

export interface QueryResult {
  success: boolean;
  rows?: Record<string, any>[];
  columns?: string[];
  rowsAffected?: number;
  affectedRows?: number;
  lastInsertId?: number;
  insertId?: number;
  message?: string;
  error?: string;
  executionTime?: number;
}

const DataTypes = [
  'INT', 'INTEGER', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT',
  'FLOAT', 'DOUBLE', 'REAL', 'DECIMAL', 'NUMERIC',
  'VARCHAR', 'CHAR', 'TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT',
  'BOOLEAN', 'BOOL', 'BIT',
  'DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'YEAR',
  'JSON', 'BLOB', 'TINYBLOB', 'MEDIUMBLOB', 'LONGBLOB',
  'BINARY', 'VARBINARY',
  'ENUM', 'SET',
  'GEOMETRY', 'POINT', 'LINESTRING', 'POLYGON'
] as const;
type DataType = typeof DataTypes[number];

class LocalDatabase {
  private databases: Map<string, LocalDB> = new Map();
  private currentDatabase: string = 'default';

  constructor() {
    this.load();
    if (!this.databases.has('default')) {
      this.databases.set('default', new LocalDB('default'));
    }
  }

  private load() {
    try {
      const saved = localStorage.getItem('mycsc_databases');
      if (saved) {
        const data = JSON.parse(saved);
        for (const [name, dbData] of Object.entries(data)) {
          const db = new LocalDB(name);
          db.loadFromData(dbData as any);
          this.databases.set(name, db);
        }
      }
    } catch (e) {
      console.error('Failed to load databases:', e);
    }
  }

  save() {
    try {
      const data: any = {};
      for (const [name, db] of this.databases) {
        data[name] = db.toData();
      }
      localStorage.setItem('mycsc_databases', JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save databases:', e);
    }
  }

  getCurrentDB(): LocalDB {
    return this.databases.get(this.currentDatabase) || this.databases.get('default')!;
  }

  query(sql: string): QueryResult {
    const startTime = Date.now();
    const trimmed = sql.trim();
    if (!trimmed || trimmed.startsWith('--')) {
      return { success: true, executionTime: Date.now() - startTime };
    }
    
    const upper = trimmed.toUpperCase();

    try {
      if (upper.startsWith('CREATE DATABASE')) {
        const match = trimmed.match(/CREATE\s+DATABASE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?(\w+)[`"]?/i);
        if (match) {
          const dbName = match[1];
          if (!this.databases.has(dbName)) {
            this.databases.set(dbName, new LocalDB(dbName));
            this.save();
          }
          return { success: true, executionTime: Date.now() - startTime };
        }
      }
      if (upper.startsWith('DROP DATABASE')) {
        const match = trimmed.match(/DROP\s+DATABASE\s+(?:IF\s+EXISTS\s+)?[`"]?(\w+)[`"]?/i);
        if (match) {
          const dbName = match[1];
          if (this.databases.has(dbName) && dbName !== 'default') {
            this.databases.delete(dbName);
            if (this.currentDatabase === dbName) {
              this.currentDatabase = 'default';
            }
            this.save();
          }
          return { success: true, executionTime: Date.now() - startTime };
        }
      }
      if (upper.startsWith('USE ')) {
        const match = trimmed.match(/USE\s+[`"]?(\w+)[`"]?/i);
        if (match) {
          const dbName = match[1];
          if (this.databases.has(dbName)) {
            this.currentDatabase = dbName;
            return { success: true, executionTime: Date.now() - startTime };
          }
          return { success: false, error: `Database '${dbName}' does not exist`, executionTime: Date.now() - startTime };
        }
      }
      if (upper.startsWith('SHOW DATABASES')) {
        const rows = Array.from(this.databases.keys()).map(name => ({ Database: name }));
        return { success: true, rows, columns: ['Database'], executionTime: Date.now() - startTime };
      }
      const result = this.getCurrentDB().execute(trimmed);
      this.save();
      return { ...result, executionTime: Date.now() - startTime };
    } catch (e: any) {
      return { success: false, error: e.message, executionTime: Date.now() - startTime };
    }
  }

  queryMultiple(sql: string): QueryResult[] {
    const cleanSql = sql
      .split('\n')
      .map(line => {
        const commentIndex = line.indexOf('--');
        return commentIndex >= 0 ? line.substring(0, commentIndex) : line;
      })
      .join('\n');
    
    const statements = cleanSql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    return statements.map(s => this.query(s));
  }

  getTables(): string[] {
    return this.getCurrentDB().getTableNames();
  }

  getTableSchema(name: string): TableSchema | undefined {
    return this.getCurrentDB().getTableSchema(name);
  }

  getCurrentDatabase(): string {
    return this.currentDatabase;
  }

  getDatabases(): Array<{ name: string; tables: number; size: string }> {
    return Array.from(this.databases.entries()).map(([name, db]) => ({
      name,
      tables: db.getTableNames().length,
      size: db.getSize()
    }));
  }

  getViews(): Array<{ name: string; definition: string; createdAt: string }> {
    return this.getCurrentDB().getViews();
  }

  getProcedures(): Array<{ name: string; definition: string; parameters: string[]; createdAt: string }> {
    return this.getCurrentDB().getProcedures();
  }

  getFunctions(): Array<{ name: string; definition: string; parameters: string[]; returnType: string; createdAt: string }> {
    return this.getCurrentDB().getFunctions();
  }
}

class LocalDB {
  name: string;
  private tables: Map<string, LocalTable> = new Map();
  private views: Map<string, { name: string; definition: string; createdAt: string }> = new Map();
  private procedures: Map<string, { name: string; definition: string; parameters: string[]; createdAt: string }> = new Map();
  private functions: Map<string, { name: string; definition: string; parameters: string[]; returnType: string; createdAt: string }> = new Map();
  private triggers: Map<string, { name: string; table: string; timing: string; event: string; body: string; createdAt: string }> = new Map();
  private users: Map<string, { username: string; passwordHash: string; roles: string[]; privileges: Record<string, string[]>; locked: boolean; createdAt: string }> = new Map();
  private roles: Map<string, { name: string; privileges: Record<string, string[]>; createdAt: string }> = new Map();
  private inTransaction: boolean = false;
  private transactionBackup: any = null;
  private savepoints: Map<string, any> = new Map();

  constructor(name: string) {
    this.name = name;
  }
  private createTransactionBackup(): any {
    const backup: any = { tables: {} };
    for (const [name, table] of this.tables) {
      backup.tables[name] = {
        rows: JSON.parse(JSON.stringify(table.rows)),
        autoIncrementId: table.autoIncrementId
      };
    }
    return backup;
  }
  private restoreTransactionBackup(backup: any): void {
    if (backup.tables) {
      for (const [name, data] of Object.entries(backup.tables) as any) {
        const table = this.tables.get(name);
        if (table) {
          table.rows = JSON.parse(JSON.stringify(data.rows));
          table.autoIncrementId = data.autoIncrementId;
        }
      }
    }
  }

  loadFromData(data: any) {
    if (data.tables) {
      for (const [name, tableData] of Object.entries(data.tables)) {
        const table = new LocalTable(name);
        table.loadFromData(tableData as any);
        this.tables.set(name, table);
      }
    }
    if (data.views) {
      for (const [name, viewData] of Object.entries(data.views)) {
        this.views.set(name, viewData as any);
      }
    }
    if (data.procedures) {
      for (const [name, procData] of Object.entries(data.procedures)) {
        this.procedures.set(name, procData as any);
      }
    }
    if (data.functions) {
      for (const [name, funcData] of Object.entries(data.functions)) {
        this.functions.set(name, funcData as any);
      }
    }
    if (data.triggers) {
      for (const [name, triggerData] of Object.entries(data.triggers)) {
        this.triggers.set(name, triggerData as any);
      }
    }
    if (data.users) {
      for (const [name, userData] of Object.entries(data.users)) {
        this.users.set(name, userData as any);
      }
    }
    if (data.roles) {
      for (const [name, roleData] of Object.entries(data.roles)) {
        this.roles.set(name, roleData as any);
      }
    }
  }

  toData(): any {
    const tables: any = {};
    for (const [name, table] of this.tables) {
      tables[name] = table.toData();
    }
    const views: any = {};
    for (const [name, view] of this.views) {
      views[name] = view;
    }
    const procedures: any = {};
    for (const [name, proc] of this.procedures) {
      procedures[name] = proc;
    }
    const functions: any = {};
    for (const [name, func] of this.functions) {
      functions[name] = func;
    }
    const triggers: any = {};
    for (const [name, trigger] of this.triggers) {
      triggers[name] = trigger;
    }
    const users: any = {};
    for (const [name, user] of this.users) {
      users[name] = user;
    }
    const roles: any = {};
    for (const [name, role] of this.roles) {
      roles[name] = role;
    }
    return { name: this.name, tables, views, procedures, functions, triggers, users, roles };
  }

  getTriggers(): Array<{ name: string; table: string; timing: string; event: string; body: string; createdAt: string }> {
    return Array.from(this.triggers.values());
  }

  getTriggersForTable(tableName: string): Array<{ name: string; table: string; timing: string; event: string; body: string; createdAt: string }> {
    return Array.from(this.triggers.values()).filter(t => t.table === tableName);
  }

  createTrigger(name: string, table: string, timing: string, event: string, body: string) {
    this.triggers.set(name, { name, table, timing, event, body, createdAt: new Date().toISOString() });
  }

  dropTrigger(name: string) {
    this.triggers.delete(name);
  }
  private executeTriggers(table: string, timing: string, event: string, row: Record<string, any>, newRow?: Record<string, any>): void {
    const triggers = this.getTriggersForTable(table).filter(t => t.timing === timing && t.event === event);
    for (const trigger of triggers) {
      try {
        let body = trigger.body;
        if (row) {
          for (const [col, val] of Object.entries(row)) {
            body = body.replace(new RegExp(`OLD\\.${col}`, 'gi'), JSON.stringify(val));
          }
        }
        if (newRow) {
          for (const [col, val] of Object.entries(newRow)) {
            body = body.replace(new RegExp(`NEW\\.${col}`, 'gi'), JSON.stringify(val));
          }
        }
      } catch (e) {
        console.error(`Trigger ${trigger.name} error:`, e);
      }
    }
  }

  getUsers(): Array<{ username: string; roles: string[]; locked: boolean; createdAt: string }> {
    return Array.from(this.users.values()).map(u => ({
      username: u.username,
      roles: u.roles,
      locked: u.locked,
      createdAt: u.createdAt
    }));
  }

  createUser(username: string, password: string) {
    const passwordHash = btoa(password);
    this.users.set(username, {
      username,
      passwordHash,
      roles: [],
      privileges: {},
      locked: false,
      createdAt: new Date().toISOString()
    });
  }

  dropUser(username: string) {
    this.users.delete(username);
  }

  alterUser(username: string, options: { password?: string; locked?: boolean }) {
    const user = this.users.get(username);
    if (user) {
      if (options.password !== undefined) {
        user.passwordHash = btoa(options.password);
      }
      if (options.locked !== undefined) {
        user.locked = options.locked;
      }
    }
  }

  authenticateUser(username: string, password: string): boolean {
    const user = this.users.get(username);
    if (!user || user.locked) return false;
    return user.passwordHash === btoa(password);
  }

  getRoles(): Array<{ name: string; createdAt: string }> {
    return Array.from(this.roles.values()).map(r => ({
      name: r.name,
      createdAt: r.createdAt
    }));
  }

  createRole(name: string) {
    this.roles.set(name, {
      name,
      privileges: {},
      createdAt: new Date().toISOString()
    });
  }

  dropRole(name: string) {
    this.roles.delete(name);
    for (const user of this.users.values()) {
      user.roles = user.roles.filter(r => r !== name);
    }
  }

  grantPrivilege(grantee: string, privileges: string[], objectType: string, objectName?: string) {
    const user = this.users.get(grantee);
    const role = this.roles.get(grantee);
    const target = user || role;
    
    if (target) {
      const key = objectName || '*';
      if (!target.privileges[key]) {
        target.privileges[key] = [];
      }
      for (const priv of privileges) {
        if (!target.privileges[key].includes(priv)) {
          target.privileges[key].push(priv);
        }
      }
    }
  }

  revokePrivilege(grantee: string, privileges: string[], objectType: string, objectName?: string) {
    const user = this.users.get(grantee);
    const role = this.roles.get(grantee);
    const target = user || role;
    
    if (target) {
      const key = objectName || '*';
      if (target.privileges[key]) {
        target.privileges[key] = target.privileges[key].filter(p => !privileges.includes(p));
      }
    }
  }

  grantRole(username: string, roleName: string) {
    const user = this.users.get(username);
    if (user && !user.roles.includes(roleName)) {
      user.roles.push(roleName);
    }
  }

  revokeRole(username: string, roleName: string) {
    const user = this.users.get(username);
    if (user) {
      user.roles = user.roles.filter(r => r !== roleName);
    }
  }
  getViews(): Array<{ name: string; definition: string; createdAt: string }> {
    return Array.from(this.views.values());
  }

  getView(name: string) {
    return this.views.get(name);
  }

  createView(name: string, definition: string) {
    this.views.set(name, { name, definition, createdAt: new Date().toISOString() });
  }

  dropView(name: string) {
    this.views.delete(name);
  }
  getProcedures(): Array<{ name: string; definition: string; parameters: string[]; createdAt: string }> {
    return Array.from(this.procedures.values());
  }

  getProcedure(name: string) {
    return this.procedures.get(name);
  }

  createProcedure(name: string, definition: string, parameters: string[] = []) {
    this.procedures.set(name, { name, definition, parameters, createdAt: new Date().toISOString() });
  }

  dropProcedure(name: string) {
    this.procedures.delete(name);
  }
  getFunctions(): Array<{ name: string; definition: string; parameters: string[]; returnType: string; createdAt: string }> {
    return Array.from(this.functions.values());
  }

  getFunction(name: string) {
    return this.functions.get(name);
  }

  createFunction(name: string, definition: string, parameters: string[] = [], returnType: string = 'VARCHAR') {
    this.functions.set(name, { name, definition, parameters, returnType, createdAt: new Date().toISOString() });
  }

  dropFunction(name: string) {
    this.functions.delete(name);
  }

  getSize(): string {
    const str = JSON.stringify(this.toData());
    const bytes = new Blob([str]).size;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  explain(sql: string, analyze: boolean = false): QueryResult {
    const startTime = Date.now();
    const plan = this.generateQueryPlan(sql, analyze);
    
    if (!plan) {
      return { success: false, error: 'Unable to generate query plan', executionTime: 0 };
    }
    const rows = this.flattenPlan(plan);
    const columns = analyze 
      ? ['id', 'operation', 'table', 'type', 'possible_keys', 'key', 'rows', 'filtered', 'actual_time', 'actual_rows', 'extra']
      : ['id', 'operation', 'table', 'type', 'possible_keys', 'key', 'rows', 'filtered', 'extra'];
    
    return {
      success: true,
      rows,
      columns,
      executionTime: Date.now() - startTime
    };
  }
  
  private generateQueryPlan(sql: string, analyze: boolean): QueryPlan | null {
    const upper = sql.toUpperCase().trim();
    const selectMatch = sql.match(/SELECT\s+.+?\s+FROM\s+[`"]?(\w+)[`"]?/i);
    if (selectMatch) {
      const tableName = selectMatch[1];
      const table = this.tables.get(tableName);
      if (!table) return null;
      
      const plan: QueryPlan = {
        operation: 'SELECT',
        table: tableName,
        type: 'ALL',
        rows: table.rows.length,
        filtered: 100,
        extra: []
      };
      const whereMatch = sql.match(/WHERE\s+([\s\S]+?)(?:ORDER|GROUP|LIMIT|$)/i);
      if (whereMatch) {
        const whereClause = whereMatch[1].trim();
        plan.extra!.push('Using where');
        const indexUsage = this.analyzeIndexUsage(table, whereClause);
        if (indexUsage.canUseIndex) {
          plan.type = indexUsage.type;
          plan.key = indexUsage.indexName;
          plan.possibleKeys = indexUsage.possibleKeys;
          plan.keyLen = indexUsage.keyLen;
          plan.rows = indexUsage.estimatedRows;
          plan.filtered = indexUsage.filtered;
          if (indexUsage.type === 'INDEX') {
            plan.extra!.push('Using index');
          }
        } else {
          plan.possibleKeys = this.getPossibleKeys(table);
        }
      }
      if (/ORDER\s+BY/i.test(sql)) {
        const orderMatch = sql.match(/ORDER\s+BY\s+(\w+)/i);
        if (orderMatch) {
          const orderCol = orderMatch[1];
          const hasIndex = table.schema.indexes?.some(idx => idx.columns[0] === orderCol);
          if (hasIndex) {
            plan.extra!.push('Using index for ORDER BY');
          } else {
            plan.extra!.push('Using filesort');
          }
        }
      }
      if (/GROUP\s+BY/i.test(sql)) {
        plan.extra!.push('Using temporary');
      }
      if (analyze) {
        const queryStart = performance.now();
        const result = this.executeSelectInternal(sql);
        plan.actualTime = performance.now() - queryStart;
        plan.actualRows = result.rows?.length || 0;
      }
      
      return plan;
    }
    
    return null;
  }
  
  private analyzeIndexUsage(table: LocalTable, whereClause: string): {
    canUseIndex: boolean;
    type: 'ALL' | 'INDEX' | 'RANGE' | 'REF' | 'CONST';
    indexName?: string;
    possibleKeys: string[];
    keyLen?: number;
    estimatedRows: number;
    filtered: number;
  } {
    const possibleKeys: string[] = [];
    const indexes = table.schema.indexes || [];
    const colMatches = whereClause.match(/\b(\w+)\s*(?:=|<|>|<=|>=|!=|<>|LIKE|IN|BETWEEN)/gi) || [];
    const whereCols = colMatches.map(m => m.split(/\s/)[0].toLowerCase());
    for (const idx of indexes) {
      const firstCol = idx.columns[0].toLowerCase();
      if (whereCols.includes(firstCol)) {
        possibleKeys.push(idx.name);
      }
    }
    if (table.schema.primaryKey && table.schema.primaryKey.length > 0) {
      const pkCol = table.schema.primaryKey[0].toLowerCase();
      if (whereCols.includes(pkCol)) {
        possibleKeys.push('PRIMARY');
      }
    }
    
    if (possibleKeys.length === 0) {
      return {
        canUseIndex: false,
        type: 'ALL',
        possibleKeys: [],
        estimatedRows: table.rows.length,
        filtered: 100
      };
    }
    const eqMatch = whereClause.match(/(\w+)\s*=\s*['"]?\w+['"]?/i);
    if (eqMatch) {
      const col = eqMatch[1].toLowerCase();
      const colDef = table.schema.columns.find(c => c.name.toLowerCase() === col);
      if (colDef && (colDef.primaryKey || colDef.unique)) {
        return {
          canUseIndex: true,
          type: 'CONST',
          indexName: colDef.primaryKey ? 'PRIMARY' : possibleKeys[0],
          possibleKeys,
          keyLen: 4,
          estimatedRows: 1,
          filtered: 100
        };
      }
    }
    if (/(<|>|<=|>=|BETWEEN)/i.test(whereClause)) {
      return {
        canUseIndex: true,
        type: 'RANGE',
        indexName: possibleKeys[0],
        possibleKeys,
        keyLen: 4,
        estimatedRows: Math.ceil(table.rows.length * 0.3),
        filtered: 30
      };
    }
    return {
      canUseIndex: true,
      type: 'REF',
      indexName: possibleKeys[0],
      possibleKeys,
      keyLen: 4,
      estimatedRows: Math.ceil(table.rows.length * 0.1),
      filtered: 10
    };
  }
  
  private getPossibleKeys(table: LocalTable): string[] {
    const keys: string[] = [];
    if (table.schema.primaryKey && table.schema.primaryKey.length > 0) {
      keys.push('PRIMARY');
    }
    for (const idx of (table.schema.indexes || [])) {
      keys.push(idx.name);
    }
    return keys;
  }
  
  private flattenPlan(plan: QueryPlan, id: number = 1): Record<string, any>[] {
    const row: Record<string, any> = {
      id,
      operation: plan.operation,
      table: plan.table || '',
      type: plan.type,
      possible_keys: plan.possibleKeys?.join(', ') || '',
      key: plan.key || '',
      rows: plan.rows,
      filtered: plan.filtered
    };
    
    if (plan.actualTime !== undefined) {
      row.actual_time = plan.actualTime.toFixed(3) + ' ms';
      row.actual_rows = plan.actualRows;
    }
    
    row.extra = plan.extra?.join('; ') || '';
    
    const rows = [row];
    
    if (plan.children) {
      for (let i = 0; i < plan.children.length; i++) {
        rows.push(...this.flattenPlan(plan.children[i], id * 10 + i + 1));
      }
    }
    
    return rows;
  }
  getIndexStatistics(tableName: string): IndexStatistics[] {
    const table = this.tables.get(tableName);
    if (!table) return [];
    table.updateIndexStats();
    
    return Array.from(table.indexStats.values());
  }
  analyzeTable(tableName: string): QueryResult {
    const table = this.tables.get(tableName);
    if (!table) {
      return { success: false, error: `Table '${tableName}' doesn't exist`, executionTime: 0 };
    }
    
    table.updateIndexStats();
    
    return {
      success: true,
      message: `Table '${tableName}' analyzed successfully`,
      rows: Array.from(table.indexStats.values()).map(s => ({
        index_name: s.indexName,
        columns: s.columns.join(', '),
        cardinality: s.cardinality,
        null_count: s.nullCount,
        total_rows: s.totalRows
      })),
      columns: ['index_name', 'columns', 'cardinality', 'null_count', 'total_rows'],
      executionTime: 0
    };
  }

  createFulltextIndex(tableName: string, indexName: string, columns: string[]): QueryResult {
    const table = this.tables.get(tableName);
    if (!table) {
      return { success: false, error: `Table '${tableName}' doesn't exist`, executionTime: 0 };
    }
    for (const col of columns) {
      if (!table.schema.columns.some(c => c.name === col)) {
        return { success: false, error: `Column '${col}' doesn't exist`, executionTime: 0 };
      }
    }
    
    table.createFulltextIndex(indexName, columns);
    
    return { success: true, message: `Fulltext index '${indexName}' created`, executionTime: 0 };
  }
  
  dropFulltextIndex(tableName: string, indexName: string): QueryResult {
    const table = this.tables.get(tableName);
    if (!table) {
      return { success: false, error: `Table '${tableName}' doesn't exist`, executionTime: 0 };
    }
    
    if (!table.fulltextIndexes.has(indexName)) {
      return { success: false, error: `Fulltext index '${indexName}' doesn't exist`, executionTime: 0 };
    }
    
    table.fulltextIndexes.delete(indexName);
    
    return { success: true, message: `Fulltext index '${indexName}' dropped`, executionTime: 0 };
  }

  partitionTable(tableName: string, info: PartitionInfo): QueryResult {
    const table = this.tables.get(tableName);
    if (!table) {
      return { success: false, error: `Table '${tableName}' doesn't exist`, executionTime: 0 };
    }
    if (!table.schema.columns.some(c => c.name === info.column)) {
      return { success: false, error: `Partition column '${info.column}' doesn't exist`, executionTime: 0 };
    }
    
    table.setupPartitioning(info);
    
    return { 
      success: true, 
      message: `Table '${tableName}' partitioned by ${info.type} on column '${info.column}'`,
      executionTime: 0 
    };
  }
  
  getPartitionInfo(tableName: string): PartitionInfo | null {
    const table = this.tables.get(tableName);
    return table?.partitionInfo || null;
  }
  
  showPartitions(tableName: string): QueryResult {
    const table = this.tables.get(tableName);
    if (!table || !table.partitionInfo) {
      return { success: false, error: `Table '${tableName}' is not partitioned`, executionTime: 0 };
    }
    
    const rows = table.partitionInfo.partitions.map(p => ({
      partition_name: p.name,
      type: table.partitionInfo!.type,
      expression: table.partitionInfo!.column,
      description: p.lessThan !== undefined 
        ? `LESS THAN ${p.lessThan}` 
        : p.values 
          ? `IN (${p.values.join(', ')})` 
          : 'HASH',
      rows: table.partitions.get(p.name)?.length || 0
    }));
    
    return {
      success: true,
      rows,
      columns: ['partition_name', 'type', 'expression', 'description', 'rows'],
      executionTime: 0
    };
  }

  private backups: BackupInfo[] = [];
  private walLog: WALEntry[] = [];
  private walSequence: number = 0;
  private logWAL(operation: string, sql: string): void {
    this.walLog.push({
      id: ++this.walSequence,
      timestamp: new Date().toISOString(),
      operation,
      sql,
      database: this.name
    });
    if (this.walLog.length > 1000) {
      this.walLog = this.walLog.slice(-1000);
    }
    localStorage.setItem(`mycsc_wal_${this.name}`, JSON.stringify(this.walLog));
  }
  
  createBackup(type: 'full' | 'incremental' | 'schema' = 'full'): BackupInfo {
    const id = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let data: any;
    
    if (type === 'schema') {
      data = this.exportSchemaOnly();
    } else if (type === 'incremental') {
      const lastBackup = this.backups[this.backups.length - 1];
      const since = lastBackup?.timestamp || '1970-01-01';
      data = {
        type: 'incremental',
        since,
        wal: this.walLog.filter(e => e.timestamp > since)
      };
    } else {
      data = this.toData();
    }
    
    const jsonStr = JSON.stringify(data);
    const compressed = this.compressData(jsonStr);
    
    const backupInfo: BackupInfo = {
      id,
      timestamp: new Date().toISOString(),
      type,
      size: compressed.length,
      databases: [this.name],
      compressed: true
    };
    localStorage.setItem(`mycsc_backup_${id}`, compressed);
    this.backups.push(backupInfo);
    localStorage.setItem(`mycsc_backups_${this.name}`, JSON.stringify(this.backups));
    
    return backupInfo;
  }
  
  private compressData(data: string): string {
    return btoa(data);
  }
  
  private decompressData(data: string): string {
    return atob(data);
  }
  
  listBackups(): BackupInfo[] {
    const saved = localStorage.getItem(`mycsc_backups_${this.name}`);
    if (saved) {
      this.backups = JSON.parse(saved);
    }
    return this.backups;
  }
  
  restoreBackup(backupId: string): QueryResult {
    const backupData = localStorage.getItem(`mycsc_backup_${backupId}`);
    if (!backupData) {
      return { success: false, error: `Backup '${backupId}' not found`, executionTime: 0 };
    }
    
    try {
      const jsonStr = this.decompressData(backupData);
      const data = JSON.parse(jsonStr);
      
      if (data.type === 'incremental') {
        for (const entry of data.wal) {
          this.execute(entry.sql);
        }
      } else {
        this.loadFromData(data);
      }
      
      return { success: true, message: `Backup '${backupId}' restored successfully`, executionTime: 0 };
    } catch (e) {
      return { success: false, error: `Failed to restore backup: ${e}`, executionTime: 0 };
    }
  }
  
  pointInTimeRecovery(timestamp: string): QueryResult {
    const fullBackups = this.backups.filter(b => b.type === 'full' && b.timestamp <= timestamp);
    if (fullBackups.length === 0) {
      return { success: false, error: 'No backup found before the specified timestamp', executionTime: 0 };
    }
    
    const lastFull = fullBackups[fullBackups.length - 1];
    const restoreResult = this.restoreBackup(lastFull.id);
    if (!restoreResult.success) return restoreResult;
    const walEntries = this.walLog.filter(e => 
      e.timestamp > lastFull.timestamp && e.timestamp <= timestamp
    );
    
    for (const entry of walEntries) {
      this.execute(entry.sql);
    }
    
    return { 
      success: true, 
      message: `Database restored to point-in-time: ${timestamp}`,
      executionTime: 0 
    };
  }
  
  exportSchemaOnly(): any {
    const tables: any = {};
    for (const [name, table] of this.tables) {
      tables[name] = {
        schema: table.schema,
        autoIncrementId: 1
      };
    }
    return { name: this.name, tables, schemaOnly: true };
  }
  
  deleteBackup(backupId: string): QueryResult {
    const idx = this.backups.findIndex(b => b.id === backupId);
    if (idx === -1) {
      return { success: false, error: `Backup '${backupId}' not found`, executionTime: 0 };
    }
    
    localStorage.removeItem(`mycsc_backup_${backupId}`);
    this.backups.splice(idx, 1);
    localStorage.setItem(`mycsc_backups_${this.name}`, JSON.stringify(this.backups));
    
    return { success: true, message: `Backup '${backupId}' deleted`, executionTime: 0 };
  }

  private replicationConfig?: {
    role: 'master' | 'slave';
    masterId?: string;
    slaves: string[];
    lastSyncTime?: string;
  };
  
  setupReplication(role: 'master' | 'slave', masterId?: string): QueryResult {
    this.replicationConfig = {
      role,
      masterId: role === 'slave' ? masterId : undefined,
      slaves: [],
      lastSyncTime: new Date().toISOString()
    };
    localStorage.setItem(`mycsc_replication_${this.name}`, JSON.stringify(this.replicationConfig));
    
    return { 
      success: true, 
      message: `Replication configured as ${role}${masterId ? ` with master '${masterId}'` : ''}`,
      executionTime: 0 
    };
  }
  
  getReplicationStatus(): {
    role: string;
    masterId?: string;
    slaves: string[];
    lastSyncTime?: string;
    lagSeconds?: number;
  } | null {
    if (!this.replicationConfig) {
      const saved = localStorage.getItem(`mycsc_replication_${this.name}`);
      if (saved) {
        this.replicationConfig = JSON.parse(saved);
      }
    }
    
    if (!this.replicationConfig) return null;
    
    const status: any = { ...this.replicationConfig };
    
    if (this.replicationConfig.lastSyncTime) {
      const lastSync = new Date(this.replicationConfig.lastSyncTime);
      status.lagSeconds = Math.floor((Date.now() - lastSync.getTime()) / 1000);
    }
    
    return status;
  }
  syncToSlaves(): QueryResult {
    if (!this.replicationConfig || this.replicationConfig.role !== 'master') {
      return { success: false, error: 'This database is not configured as master', executionTime: 0 };
    }
    
    const data = this.toData();
    const syncPacket = {
      masterId: this.name,
      timestamp: new Date().toISOString(),
      data
    };
    localStorage.setItem(`mycsc_sync_${this.name}`, JSON.stringify(syncPacket));
    
    this.replicationConfig.lastSyncTime = syncPacket.timestamp;
    localStorage.setItem(`mycsc_replication_${this.name}`, JSON.stringify(this.replicationConfig));
    
    return { success: true, message: 'Sync packet published for slaves', executionTime: 0 };
  }
  syncFromMaster(): QueryResult {
    if (!this.replicationConfig || this.replicationConfig.role !== 'slave') {
      return { success: false, error: 'This database is not configured as slave', executionTime: 0 };
    }
    
    const masterId = this.replicationConfig.masterId;
    const syncPacket = localStorage.getItem(`mycsc_sync_${masterId}`);
    
    if (!syncPacket) {
      return { success: false, error: 'No sync packet available from master', executionTime: 0 };
    }
    
    const packet = JSON.parse(syncPacket);
    if (this.replicationConfig.lastSyncTime && packet.timestamp <= this.replicationConfig.lastSyncTime) {
      return { success: true, message: 'Already up to date', executionTime: 0 };
    }
    this.loadFromData(packet.data);
    
    this.replicationConfig.lastSyncTime = packet.timestamp;
    localStorage.setItem(`mycsc_replication_${this.name}`, JSON.stringify(this.replicationConfig));
    
    return { success: true, message: `Synced from master at ${packet.timestamp}`, executionTime: 0 };
  }

  execute(sql: string): QueryResult {
    const trimmed = sql.trim();
    const upper = trimmed.toUpperCase();
    if (upper.startsWith('SHOW TABLES')) {
      const rows = Array.from(this.tables.keys()).map(name => ({ Table: name }));
      return { success: true, rows, columns: ['Table'], executionTime: 0 };
    }
    if (upper.startsWith('CREATE TABLE')) {
      return this.createTable(trimmed);
    }
    if (upper.startsWith('DROP TABLE')) {
      const match = trimmed.match(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?[`"]?(\w+)[`"]?/i);
      if (match) {
        const tableName = match[1];
        for (const [name, t] of this.tables) {
          if (name === tableName) continue;
          for (const col of t.schema.columns) {
            if (col.references?.table === tableName) {
              return { success: false, error: `Cannot drop table '${tableName}': it is referenced by foreign key in '${name}'`, executionTime: 0 };
            }
          }
        }
        this.tables.delete(tableName);
        return { success: true, executionTime: 0 };
      }
    }
    if (upper.startsWith('CREATE INDEX') || upper.startsWith('CREATE UNIQUE INDEX')) {
      const unique = upper.includes('UNIQUE');
      const match = trimmed.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+[`"]?(\w+)[`"]?\s+ON\s+[`"]?(\w+)[`"]?\s*\(([^)]+)\)/i);
      if (match) {
        const [, indexName, tableName, columnsStr] = match;
        const table = this.tables.get(tableName);
        if (!table) {
          return { success: false, error: `Table '${tableName}' doesn't exist`, executionTime: 0 };
        }
        const columns = columnsStr.split(',').map(c => c.trim().replace(/[`"]/g, ''));
        for (const col of columns) {
          if (!table.schema.columns.find(c => c.name === col)) {
            return { success: false, error: `Column '${col}' doesn't exist in table '${tableName}'`, executionTime: 0 };
          }
        }
        if (unique) {
          const seen = new Set<string>();
          for (const row of table.rows) {
            const key = columns.map(c => row[c]).join('|||');
            if (seen.has(key)) {
              return { success: false, error: `Duplicate entry for UNIQUE index '${indexName}'`, executionTime: 0 };
            }
            seen.add(key);
          }
        }
        
        table.schema.indexes = table.schema.indexes || [];
        table.schema.indexes.push({ name: indexName, columns, unique });
        return { success: true, message: `Index '${indexName}' created`, executionTime: 0 };
      }
      return { success: false, error: 'Invalid CREATE INDEX syntax', executionTime: 0 };
    }
    if (upper.startsWith('DROP INDEX')) {
      const match = trimmed.match(/DROP\s+INDEX\s+[`"]?(\w+)[`"]?\s+ON\s+[`"]?(\w+)[`"]?/i);
      if (match) {
        const [, indexName, tableName] = match;
        const table = this.tables.get(tableName);
        if (!table) {
          return { success: false, error: `Table '${tableName}' doesn't exist`, executionTime: 0 };
        }
        table.schema.indexes = (table.schema.indexes || []).filter(i => i.name !== indexName);
        return { success: true, message: `Index '${indexName}' dropped`, executionTime: 0 };
      }
      return { success: false, error: 'Invalid DROP INDEX syntax', executionTime: 0 };
    }
    if (upper.match(/SHOW\s+(?:INDEX(?:ES)?|KEYS)\s+(?:FROM|ON)/i)) {
      const match = trimmed.match(/SHOW\s+(?:INDEX(?:ES)?|KEYS)\s+(?:FROM|ON)\s+[`"]?(\w+)[`"]?/i);
      if (match) {
        const table = this.tables.get(match[1]);
        if (!table) {
          return { success: false, error: `Table '${match[1]}' doesn't exist`, executionTime: 0 };
        }
        const rows = (table.schema.indexes || []).map(idx => ({
          Table: table.name,
          Key_name: idx.name,
          Column_name: idx.columns.join(', '),
          Non_unique: idx.unique ? 0 : 1,
          Index_type: 'BTREE'
        }));
        return { success: true, rows, columns: ['Table', 'Key_name', 'Column_name', 'Non_unique', 'Index_type'], executionTime: 0 };
      }
    }
    if (upper.startsWith('INSERT')) {
      return this.executeInsert(trimmed);
    }
    if (upper.startsWith('SELECT')) {
      return this.executeSelect(trimmed);
    }
    if (upper.startsWith('UPDATE')) {
      return this.executeUpdate(trimmed);
    }
    if (upper.startsWith('DELETE')) {
      return this.executeDelete(trimmed);
    }
    if (upper.startsWith('DESCRIBE') || upper.startsWith('DESC ')) {
      const match = trimmed.match(/(?:DESCRIBE|DESC)\s+[`"]?(\w+)[`"]?/i);
      if (match) {
        const table = this.tables.get(match[1]);
        if (table) {
          const rows = table.schema.columns.map(col => ({
            Field: col.name,
            Type: col.type + (col.length ? `(${col.length})` : ''),
            Null: col.nullable ? 'YES' : 'NO',
            Key: col.primaryKey ? 'PRI' : (col.unique ? 'UNI' : ''),
            Default: col.defaultValue ?? 'NULL',
            Extra: col.autoIncrement ? 'auto_increment' : ''
          }));
          return { success: true, rows, columns: ['Field', 'Type', 'Null', 'Key', 'Default', 'Extra'], executionTime: 0 };
        }
        return { success: false, error: `Table '${match[1]}' doesn't exist`, executionTime: 0 };
      }
    }
    if (upper.startsWith('TRUNCATE')) {
      const match = trimmed.match(/TRUNCATE\s+(?:TABLE\s+)?[`"]?(\w+)[`"]?/i);
      if (match) {
        const table = this.tables.get(match[1]);
        if (table) {
          const count = table.rows.length;
          table.rows = [];
          table.autoIncrementId = 1;
          return { success: true, affectedRows: count, executionTime: 0 };
        }
      }
    }
    if (upper.startsWith('BEGIN') || upper.startsWith('START TRANSACTION')) {
      this.inTransaction = true;
      this.transactionBackup = this.createTransactionBackup();
      this.savepoints = new Map();
      return { success: true, message: 'Transaction started', executionTime: 0 };
    }
    if (upper.startsWith('COMMIT')) {
      this.inTransaction = false;
      this.transactionBackup = null;
      this.savepoints.clear();
      return { success: true, message: 'Transaction committed', executionTime: 0 };
    }
    if (upper.startsWith('ROLLBACK')) {
      const savepointMatch = trimmed.match(/ROLLBACK\s+TO\s+(?:SAVEPOINT\s+)?(\w+)/i);
      if (savepointMatch && this.savepoints.has(savepointMatch[1])) {
        this.restoreTransactionBackup(this.savepoints.get(savepointMatch[1])!);
        return { success: true, message: `Rolled back to savepoint '${savepointMatch[1]}'`, executionTime: 0 };
      } else if (this.transactionBackup) {
        this.restoreTransactionBackup(this.transactionBackup);
        this.inTransaction = false;
        this.transactionBackup = null;
        this.savepoints.clear();
        return { success: true, message: 'Transaction rolled back', executionTime: 0 };
      }
      return { success: true, message: 'Nothing to rollback', executionTime: 0 };
    }
    if (upper.startsWith('SAVEPOINT')) {
      const match = trimmed.match(/SAVEPOINT\s+(\w+)/i);
      if (match) {
        this.savepoints.set(match[1], this.createTransactionBackup());
        return { success: true, message: `Savepoint '${match[1]}' created`, executionTime: 0 };
      }
    }
    if (upper.startsWith('RELEASE')) {
      const match = trimmed.match(/RELEASE\s+(?:SAVEPOINT\s+)?(\w+)/i);
      if (match) {
        this.savepoints.delete(match[1]);
        return { success: true, message: `Savepoint '${match[1]}' released`, executionTime: 0 };
      }
    }
    if (upper.startsWith('CREATE VIEW') || upper.startsWith('CREATE OR REPLACE VIEW')) {
      const match = trimmed.match(/CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+[`"]?(\w+)[`"]?\s+AS\s+(.+)/i);
      if (match) {
        this.createView(match[1], match[2]);
        return { success: true, message: `View '${match[1]}' created`, executionTime: 0 };
      }
      return { success: false, error: 'Invalid CREATE VIEW syntax', executionTime: 0 };
    }
    if (upper.startsWith('DROP VIEW')) {
      const match = trimmed.match(/DROP\s+VIEW\s+(?:IF\s+EXISTS\s+)?[`"]?(\w+)[`"]?/i);
      if (match) {
        this.dropView(match[1]);
        return { success: true, message: `View '${match[1]}' dropped`, executionTime: 0 };
      }
    }
    if (upper.startsWith('CREATE PROCEDURE') || upper.startsWith('CREATE OR REPLACE PROCEDURE')) {
      const match = trimmed.match(/CREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE\s+[`"]?(\w+)[`"]?\s*\(([^)]*)\)\s*(?:BEGIN\s+)?([\s\S]+?)(?:\s*END)?$/i);
      if (match) {
        const name = match[1];
        const params = match[2] ? match[2].split(',').map(p => p.trim()).filter(p => p) : [];
        const body = match[3] || '';
        this.createProcedure(name, body, params);
        return { success: true, message: `Procedure '${name}' created`, executionTime: 0 };
      }
      return { success: false, error: 'Invalid CREATE PROCEDURE syntax', executionTime: 0 };
    }
    if (upper.startsWith('DROP PROCEDURE')) {
      const match = trimmed.match(/DROP\s+PROCEDURE\s+(?:IF\s+EXISTS\s+)?[`"]?(\w+)[`"]?/i);
      if (match) {
        this.dropProcedure(match[1]);
        return { success: true, message: `Procedure '${match[1]}' dropped`, executionTime: 0 };
      }
    }
    if (upper.startsWith('CREATE FUNCTION') || upper.startsWith('CREATE OR REPLACE FUNCTION')) {
      const match = trimmed.match(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+[`"]?(\w+)[`"]?\s*\(([^)]*)\)\s*RETURNS\s+(\w+)/i);
      if (match) {
        const name = match[1];
        const params = match[2] ? match[2].split(',').map(p => p.trim()).filter(p => p) : [];
        const returnType = match[3];
        const bodyMatch = trimmed.match(/(?:DETERMINISTIC\s+)?(?:BEGIN\s+)?([\s\S]+?)(?:\s*END)?$/i);
        const body = bodyMatch ? bodyMatch[1] : '';
        this.createFunction(name, body, params, returnType);
        return { success: true, message: `Function '${name}' created`, executionTime: 0 };
      }
      return { success: false, error: 'Invalid CREATE FUNCTION syntax', executionTime: 0 };
    }
    if (upper.startsWith('DROP FUNCTION')) {
      const match = trimmed.match(/DROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?[`"]?(\w+)[`"]?/i);
      if (match) {
        this.dropFunction(match[1]);
        return { success: true, message: `Function '${match[1]}' dropped`, executionTime: 0 };
      }
    }
    if (upper.includes('SHOW') && upper.includes('PROCEDURE')) {
      const procs = this.getProcedures();
      const rows = procs.map(p => ({
        Name: p.name,
        Type: 'PROCEDURE',
        Created: p.createdAt,
        Parameters: p.parameters.join(', ')
      }));
      return { success: true, rows, columns: ['Name', 'Type', 'Created', 'Parameters'], executionTime: 0 };
    }
    if (upper.includes('SHOW') && upper.includes('FUNCTION')) {
      const funcs = this.getFunctions();
      const rows = funcs.map(f => ({
        Name: f.name,
        Type: 'FUNCTION',
        Returns: f.returnType,
        Created: f.createdAt,
        Parameters: f.parameters.join(', ')
      }));
      return { success: true, rows, columns: ['Name', 'Type', 'Returns', 'Created', 'Parameters'], executionTime: 0 };
    }
    if (upper.includes('SHOW') && upper.includes('FULL') && upper.includes('TABLES')) {
      const tableRows = Array.from(this.tables.keys()).map(name => ({ Name: name, Type: 'BASE TABLE' }));
      const viewRows = Array.from(this.views.keys()).map(name => ({ Name: name, Type: 'VIEW' }));
      const rows = [...tableRows, ...viewRows];
      return { success: true, rows, columns: ['Name', 'Type'], executionTime: 0 };
    }

    if (upper.startsWith('CREATE TRIGGER')) {
      const match = trimmed.match(/CREATE\s+TRIGGER\s+[`"]?(\w+)[`"]?\s+(BEFORE|AFTER)\s+(INSERT|UPDATE|DELETE)\s+ON\s+[`"]?(\w+)[`"]?\s+(?:FOR\s+EACH\s+ROW\s+)?(?:BEGIN\s+)?([\s\S]+?)(?:\s*END)?$/i);
      if (match) {
        const [, name, timing, event, table, body] = match;
        if (!this.tables.has(table)) {
          return { success: false, error: `Table '${table}' doesn't exist`, executionTime: 0 };
        }
        this.createTrigger(name, table, timing.toUpperCase(), event.toUpperCase(), body.trim());
        return { success: true, message: `Trigger '${name}' created`, executionTime: 0 };
      }
      return { success: false, error: 'Invalid CREATE TRIGGER syntax', executionTime: 0 };
    }
    if (upper.startsWith('DROP TRIGGER')) {
      const match = trimmed.match(/DROP\s+TRIGGER\s+(?:IF\s+EXISTS\s+)?[`"]?(\w+)[`"]?/i);
      if (match) {
        this.dropTrigger(match[1]);
        return { success: true, message: `Trigger '${match[1]}' dropped`, executionTime: 0 };
      }
    }
    if (upper.includes('SHOW') && upper.includes('TRIGGERS')) {
      const rows = this.getTriggers().map(t => ({
        Trigger: t.name,
        Event: t.event,
        Table: t.table,
        Timing: t.timing,
        Created: t.createdAt
      }));
      return { success: true, rows, columns: ['Trigger', 'Event', 'Table', 'Timing', 'Created'], executionTime: 0 };
    }

    if (upper.startsWith('CREATE USER')) {
      const match = trimmed.match(/CREATE\s+USER\s+(?:IF\s+NOT\s+EXISTS\s+)?['"]?(\w+)['"]?(?:@['"]?(\w+)['"]?)?\s+IDENTIFIED\s+BY\s+['"]([^'"]+)['"]/i);
      if (match) {
        const [, username, , password] = match;
        if (this.users.has(username)) {
          return { success: false, error: `User '${username}' already exists`, executionTime: 0 };
        }
        this.createUser(username, password);
        return { success: true, message: `User '${username}' created`, executionTime: 0 };
      }
      return { success: false, error: 'Invalid CREATE USER syntax', executionTime: 0 };
    }
    if (upper.startsWith('DROP USER')) {
      const match = trimmed.match(/DROP\s+USER\s+(?:IF\s+EXISTS\s+)?['"]?(\w+)['"]?/i);
      if (match) {
        this.dropUser(match[1]);
        return { success: true, message: `User '${match[1]}' dropped`, executionTime: 0 };
      }
    }
    if (upper.startsWith('ALTER USER')) {
      const match = trimmed.match(/ALTER\s+USER\s+['"]?(\w+)['"]?\s+(.+)/i);
      if (match) {
        const [, username, rest] = match;
        const options: { password?: string; locked?: boolean } = {};
        
        const pwdMatch = rest.match(/IDENTIFIED\s+BY\s+['"]([^'"]+)['"]/i);
        if (pwdMatch) options.password = pwdMatch[1];
        
        if (/ACCOUNT\s+LOCK/i.test(rest)) options.locked = true;
        if (/ACCOUNT\s+UNLOCK/i.test(rest)) options.locked = false;
        
        this.alterUser(username, options);
        return { success: true, message: `User '${username}' altered`, executionTime: 0 };
      }
    }
    if (upper.startsWith('CREATE ROLE')) {
      const match = trimmed.match(/CREATE\s+ROLE\s+(?:IF\s+NOT\s+EXISTS\s+)?['"]?(\w+)['"]?/i);
      if (match) {
        this.createRole(match[1]);
        return { success: true, message: `Role '${match[1]}' created`, executionTime: 0 };
      }
    }
    if (upper.startsWith('DROP ROLE')) {
      const match = trimmed.match(/DROP\s+ROLE\s+(?:IF\s+EXISTS\s+)?['"]?(\w+)['"]?/i);
      if (match) {
        this.dropRole(match[1]);
        return { success: true, message: `Role '${match[1]}' dropped`, executionTime: 0 };
      }
    }
    if (upper.startsWith('GRANT')) {
      const roleMatch = trimmed.match(/GRANT\s+['"]?(\w+)['"]?\s+TO\s+['"]?(\w+)['"]?/i);
      if (roleMatch) {
        this.grantRole(roleMatch[2], roleMatch[1]);
        return { success: true, message: `Role '${roleMatch[1]}' granted to '${roleMatch[2]}'`, executionTime: 0 };
      }
      const privMatch = trimmed.match(/GRANT\s+([\w,\s]+)\s+ON\s+(?:(TABLE|DATABASE)\s+)?[`"]?(\w+|\*)[`"]?\s+TO\s+['"]?(\w+)['"]?/i);
      if (privMatch) {
        const [, privStr, objType, objName, grantee] = privMatch;
        const privileges = privStr.split(',').map(p => p.trim().toUpperCase());
        this.grantPrivilege(grantee, privileges, objType || 'TABLE', objName === '*' ? undefined : objName);
        return { success: true, message: `Privileges granted to '${grantee}'`, executionTime: 0 };
      }
    }
    if (upper.startsWith('REVOKE')) {
      const roleMatch = trimmed.match(/REVOKE\s+['"]?(\w+)['"]?\s+FROM\s+['"]?(\w+)['"]?/i);
      if (roleMatch) {
        this.revokeRole(roleMatch[2], roleMatch[1]);
        return { success: true, message: `Role '${roleMatch[1]}' revoked from '${roleMatch[2]}'`, executionTime: 0 };
      }
      const privMatch = trimmed.match(/REVOKE\s+([\w,\s]+)\s+ON\s+(?:(TABLE|DATABASE)\s+)?[`"]?(\w+|\*)[`"]?\s+FROM\s+['"]?(\w+)['"]?/i);
      if (privMatch) {
        const [, privStr, objType, objName, grantee] = privMatch;
        const privileges = privStr.split(',').map(p => p.trim().toUpperCase());
        this.revokePrivilege(grantee, privileges, objType || 'TABLE', objName === '*' ? undefined : objName);
        return { success: true, message: `Privileges revoked from '${grantee}'`, executionTime: 0 };
      }
    }
    if (upper.includes('SHOW') && upper.includes('USERS')) {
      const rows = this.getUsers().map(u => ({
        User: u.username,
        Roles: u.roles.join(', '),
        Locked: u.locked ? 'YES' : 'NO',
        Created: u.createdAt
      }));
      return { success: true, rows, columns: ['User', 'Roles', 'Locked', 'Created'], executionTime: 0 };
    }
    if (upper.includes('SHOW') && upper.includes('ROLES')) {
      const rows = this.getRoles().map(r => ({
        Role: r.name,
        Created: r.createdAt
      }));
      return { success: true, rows, columns: ['Role', 'Created'], executionTime: 0 };
    }

    if (upper.startsWith('EXPLAIN ANALYZE')) {
      const query = trimmed.replace(/EXPLAIN\s+ANALYZE\s+/i, '');
      return this.explain(query, true);
    }
    
    if (upper.startsWith('EXPLAIN')) {
      const query = trimmed.replace(/EXPLAIN\s+/i, '');
      return this.explain(query, false);
    }
    if (upper.startsWith('ANALYZE TABLE') || upper.startsWith('ANALYZE')) {
      const match = trimmed.match(/ANALYZE\s+(?:TABLE\s+)?[`"]?(\w+)[`"]?/i);
      if (match) {
        return this.analyzeTable(match[1]);
      }
    }
    if (upper.includes('SHOW') && upper.includes('INDEX') && upper.includes('STATISTICS')) {
      const match = trimmed.match(/SHOW\s+INDEX\s+STATISTICS\s+(?:FROM|ON)\s+[`"]?(\w+)[`"]?/i);
      if (match) {
        const stats = this.getIndexStatistics(match[1]);
        const rows = stats.map(s => ({
          Index_name: s.indexName,
          Columns: s.columns.join(', '),
          Cardinality: s.cardinality,
          Null_count: s.nullCount,
          Total_rows: s.totalRows,
          Unique: s.unique ? 'YES' : 'NO',
          Last_analyzed: s.lastAnalyzed
        }));
        return { success: true, rows, columns: ['Index_name', 'Columns', 'Cardinality', 'Null_count', 'Total_rows', 'Unique', 'Last_analyzed'], executionTime: 0 };
      }
    }

    if (upper.includes('CREATE') && upper.includes('FULLTEXT') && upper.includes('INDEX')) {
      const match = trimmed.match(/CREATE\s+FULLTEXT\s+INDEX\s+[`"]?(\w+)[`"]?\s+ON\s+[`"]?(\w+)[`"]?\s*\(([^)]+)\)/i);
      if (match) {
        const [, indexName, tableName, columnsStr] = match;
        const columns = columnsStr.split(',').map(c => c.trim().replace(/[`"]/g, ''));
        return this.createFulltextIndex(tableName, indexName, columns);
      }
      return { success: false, error: 'Invalid CREATE FULLTEXT INDEX syntax', executionTime: 0 };
    }
    if (upper.includes('DROP') && upper.includes('FULLTEXT') && upper.includes('INDEX')) {
      const match = trimmed.match(/DROP\s+FULLTEXT\s+INDEX\s+[`"]?(\w+)[`"]?\s+ON\s+[`"]?(\w+)[`"]?/i);
      if (match) {
        return this.dropFulltextIndex(match[2], match[1]);
      }
    }
    if (upper.includes('SHOW') && upper.includes('FULLTEXT')) {
      const match = trimmed.match(/SHOW\s+FULLTEXT\s+(?:INDEX(?:ES)?)\s+(?:FROM|ON)\s+[`"]?(\w+)[`"]?/i);
      if (match) {
        const table = this.tables.get(match[1]);
        if (!table) {
          return { success: false, error: `Table '${match[1]}' doesn't exist`, executionTime: 0 };
        }
        const rows = Array.from(table.fulltextIndexes.values()).map(idx => ({
          Index_name: idx.name,
          Columns: idx.columns.join(', '),
          Tokens: idx.tokens.size,
          Created: idx.createdAt
        }));
        return { success: true, rows, columns: ['Index_name', 'Columns', 'Tokens', 'Created'], executionTime: 0 };
      }
    }

    if (upper.includes('ALTER TABLE') && upper.includes('PARTITION BY')) {
      const tableMatch = trimmed.match(/ALTER\s+TABLE\s+[`"]?(\w+)[`"]?\s+PARTITION\s+BY\s+(RANGE|LIST|HASH)\s*\(([^)]+)\)\s*\(([\s\S]+)\)/i);
      if (tableMatch) {
        const [, tableName, partType, partColumn, partitionsStr] = tableMatch;
        const partitions: PartitionDefinition[] = [];
        const partDefs = partitionsStr.split(/PARTITION\s+/i).filter(p => p.trim());
        for (const def of partDefs) {
          const nameMatch = def.match(/^[`"]?(\w+)[`"]?\s+VALUES\s+(LESS\s+THAN\s*\(([^)]+)\)|IN\s*\(([^)]+)\))?/i);
          if (nameMatch) {
            const [, pName, , lessThan, inValues] = nameMatch;
            const partition: PartitionDefinition = { name: pName };
            
            if (lessThan) {
              partition.lessThan = lessThan.trim() === 'MAXVALUE' ? 'MAXVALUE' : parseInt(lessThan);
            } else if (inValues) {
              partition.values = inValues.split(',').map(v => v.trim().replace(/^['"]|['"]$/g, ''));
            }
            partitions.push(partition);
          }
        }
        
        if (partitions.length === 0) {
          const hashMatch = partitionsStr.match(/PARTITIONS\s+(\d+)/i);
          if (hashMatch) {
            const n = parseInt(hashMatch[1]);
            for (let i = 0; i < n; i++) {
              partitions.push({ name: `p${i}` });
            }
          }
        }
        
        const partInfo: PartitionInfo = {
          type: partType.toUpperCase() as 'RANGE' | 'LIST' | 'HASH',
          column: partColumn.trim(),
          partitions
        };
        
        return this.partitionTable(tableName, partInfo);
      }
      return { success: false, error: 'Invalid PARTITION BY syntax', executionTime: 0 };
    }
    if (upper.includes('SHOW') && upper.includes('PARTITIONS')) {
      const match = trimmed.match(/SHOW\s+PARTITIONS\s+(?:FROM|ON)\s+[`"]?(\w+)[`"]?/i);
      if (match) {
        return this.showPartitions(match[1]);
      }
    }

    if (upper.startsWith('BACKUP')) {
      let type: 'full' | 'incremental' | 'schema' = 'full';
      if (upper.includes('INCREMENTAL')) type = 'incremental';
      else if (upper.includes('SCHEMA')) type = 'schema';
      
      const backup = this.createBackup(type);
      return {
        success: true,
        message: `Backup created: ${backup.id}`,
        rows: [{
          Backup_id: backup.id,
          Type: backup.type,
          Size: backup.size,
          Timestamp: backup.timestamp
        }],
        columns: ['Backup_id', 'Type', 'Size', 'Timestamp'],
        executionTime: 0
      };
    }
    if (upper.includes('SHOW') && upper.includes('BACKUPS')) {
      const backups = this.listBackups();
      const rows = backups.map(b => ({
        Backup_id: b.id,
        Type: b.type,
        Size: b.size,
        Databases: b.databases.join(', '),
        Timestamp: b.timestamp
      }));
      return { success: true, rows, columns: ['Backup_id', 'Type', 'Size', 'Databases', 'Timestamp'], executionTime: 0 };
    }
    if (upper.startsWith('RESTORE')) {
      const match = trimmed.match(/RESTORE\s+(?:BACKUP\s+)?['"]?([^'"]+)['"]?/i);
      if (match) {
        return this.restoreBackup(match[1]);
      }
      return { success: false, error: 'Invalid RESTORE syntax. Use: RESTORE BACKUP backup_id', executionTime: 0 };
    }
    if (upper.includes('RECOVER') && upper.includes('TO')) {
      const match = trimmed.match(/RECOVER\s+(?:DATABASE\s+)?TO\s+['"]([^'"]+)['"]/i);
      if (match) {
        return this.pointInTimeRecovery(match[1]);
      }
    }
    if (upper.includes('DELETE') && upper.includes('BACKUP')) {
      const match = trimmed.match(/DELETE\s+BACKUP\s+['"]?([^'"]+)['"]?/i);
      if (match) {
        return this.deleteBackup(match[1]);
      }
    }

    if (upper.includes('SET') && upper.includes('REPLICATION')) {
      const masterMatch = trimmed.match(/SET\s+REPLICATION\s+(?:ROLE\s+)?MASTER/i);
      if (masterMatch) {
        return this.setupReplication('master');
      }
      
      const slaveMatch = trimmed.match(/SET\s+REPLICATION\s+(?:ROLE\s+)?SLAVE\s+(?:OF\s+)?['"]?(\w+)['"]?/i);
      if (slaveMatch) {
        return this.setupReplication('slave', slaveMatch[1]);
      }
    }
    if (upper.includes('SHOW') && upper.includes('REPLICATION')) {
      const status = this.getReplicationStatus();
      if (!status) {
        return { success: true, rows: [], columns: ['Status'], message: 'Replication not configured', executionTime: 0 };
      }
      
      const rows = [{
        Role: status.role,
        Master_id: status.masterId || '-',
        Slaves: status.slaves.join(', ') || '-',
        Last_sync: status.lastSyncTime || '-',
        Lag_seconds: status.lagSeconds ?? '-'
      }];
      return { success: true, rows, columns: ['Role', 'Master_id', 'Slaves', 'Last_sync', 'Lag_seconds'], executionTime: 0 };
    }
    if (upper.startsWith('SYNC')) {
      const status = this.getReplicationStatus();
      if (!status) {
        return { success: false, error: 'Replication not configured', executionTime: 0 };
      }
      
      if (status.role === 'master') {
        return this.syncToSlaves();
      } else {
        return this.syncFromMaster();
      }
    }

    if (upper.startsWith('ALTER TABLE')) {
      return this.executeAlterTable(trimmed);
    }

    return { success: false, error: 'Unknown command', executionTime: 0 };
  }
  private executeAlterTable(sql: string): QueryResult {
    const tableMatch = sql.match(/ALTER\s+TABLE\s+[`"]?(\w+)[`"]?\s+(.+)/i);
    if (!tableMatch) {
      return { success: false, error: 'Invalid ALTER TABLE syntax', executionTime: 0 };
    }

    const [, tableName, operations] = tableMatch;
    const table = this.tables.get(tableName);
    if (!table) {
      return { success: false, error: `Table '${tableName}' doesn't exist`, executionTime: 0 };
    }

    const upper = operations.toUpperCase();
    const addColMatch = operations.match(/ADD\s+(?:COLUMN\s+)?[`"]?(\w+)[`"]?\s+(\w+)(?:\(([^)]+)\))?(.*)/i);
    if (addColMatch) {
      const [, colName, colType, length, rest] = addColMatch;
      const newCol: ColumnDefinition = {
        name: colName,
        type: colType.toUpperCase(),
        length: length ? parseInt(length) : undefined,
        nullable: !/NOT\s+NULL/i.test(rest),
        primaryKey: /PRIMARY\s+KEY/i.test(rest),
        unique: /UNIQUE/i.test(rest),
        autoIncrement: /AUTO_INCREMENT/i.test(rest)
      };
      table.schema.columns.push(newCol);
      for (const row of table.rows) {
        row[colName] = newCol.defaultValue ?? null;
      }
      return { success: true, message: `Column '${colName}' added`, executionTime: 0 };
    }
    const dropColMatch = operations.match(/DROP\s+(?:COLUMN\s+)?[`"]?(\w+)[`"]?/i);
    if (dropColMatch && !upper.includes('DROP INDEX') && !upper.includes('DROP CONSTRAINT') && !upper.includes('DROP PRIMARY') && !upper.includes('DROP FOREIGN')) {
      const colName = dropColMatch[1];
      table.schema.columns = table.schema.columns.filter(c => c.name !== colName);
      for (const row of table.rows) {
        delete row[colName];
      }
      return { success: true, message: `Column '${colName}' dropped`, executionTime: 0 };
    }
    const modifyMatch = operations.match(/MODIFY\s+(?:COLUMN\s+)?[`"]?(\w+)[`"]?\s+(\w+)(?:\(([^)]+)\))?(.*)/i);
    if (modifyMatch) {
      const [, colName, colType, length, rest] = modifyMatch;
      const col = table.schema.columns.find(c => c.name === colName);
      if (col) {
        col.type = colType.toUpperCase();
        col.length = length ? parseInt(length) : undefined;
        col.nullable = !/NOT\s+NULL/i.test(rest);
        col.unique = /UNIQUE/i.test(rest);
        return { success: true, message: `Column '${colName}' modified`, executionTime: 0 };
      }
      return { success: false, error: `Column '${colName}' doesn't exist`, executionTime: 0 };
    }
    const renameColMatch = operations.match(/RENAME\s+COLUMN\s+[`"]?(\w+)[`"]?\s+TO\s+[`"]?(\w+)[`"]?/i);
    if (renameColMatch) {
      const [, oldName, newName] = renameColMatch;
      const col = table.schema.columns.find(c => c.name === oldName);
      if (col) {
        col.name = newName;
        for (const row of table.rows) {
          row[newName] = row[oldName];
          delete row[oldName];
        }
        return { success: true, message: `Column '${oldName}' renamed to '${newName}'`, executionTime: 0 };
      }
      return { success: false, error: `Column '${oldName}' doesn't exist`, executionTime: 0 };
    }
    const renameTableMatch = operations.match(/RENAME\s+(?:TO\s+)?[`"]?(\w+)[`"]?/i);
    if (renameTableMatch && !upper.includes('RENAME COLUMN')) {
      const newTableName = renameTableMatch[1];
      table.name = newTableName;
      table.schema.name = newTableName;
      this.tables.delete(tableName);
      this.tables.set(newTableName, table);
      return { success: true, message: `Table '${tableName}' renamed to '${newTableName}'`, executionTime: 0 };
    }
    const addConstraintMatch = operations.match(/ADD\s+CONSTRAINT\s+[`"]?(\w+)[`"]?\s+(PRIMARY\s+KEY|UNIQUE|FOREIGN\s+KEY|CHECK)\s*\(([^)]+)\)(?:\s+REFERENCES\s+[`"]?(\w+)[`"]?\s*\(([^)]+)\))?/i);
    if (addConstraintMatch) {
      const [, constraintName, constraintType, columns, refTable, refColumns] = addConstraintMatch;
      const cols = columns.split(',').map(c => c.trim().replace(/[`"]/g, ''));
      
      if (/PRIMARY\s+KEY/i.test(constraintType)) {
        table.schema.primaryKey = cols;
        for (const colName of cols) {
          const col = table.schema.columns.find(c => c.name === colName);
          if (col) col.primaryKey = true;
        }
      } else if (/UNIQUE/i.test(constraintType)) {
        for (const colName of cols) {
          const col = table.schema.columns.find(c => c.name === colName);
          if (col) col.unique = true;
        }
      } else if (/FOREIGN\s+KEY/i.test(constraintType) && refTable) {
        table.schema.foreignKeys = table.schema.foreignKeys || [];
        table.schema.foreignKeys.push({
          column: cols[0],
          refTable,
          refColumn: refColumns.split(',')[0].trim().replace(/[`"]/g, '')
        });
      }
      return { success: true, message: `Constraint '${constraintName}' added`, executionTime: 0 };
    }
    const dropConstraintMatch = operations.match(/DROP\s+CONSTRAINT\s+[`"]?(\w+)[`"]?/i);
    if (dropConstraintMatch) {
      return { success: true, message: `Constraint '${dropConstraintMatch[1]}' dropped`, executionTime: 0 };
    }
    const addPKMatch = operations.match(/ADD\s+PRIMARY\s+KEY\s*\(([^)]+)\)/i);
    if (addPKMatch) {
      const cols = addPKMatch[1].split(',').map(c => c.trim().replace(/[`"]/g, ''));
      table.schema.primaryKey = cols;
      for (const colName of cols) {
        const col = table.schema.columns.find(c => c.name === colName);
        if (col) col.primaryKey = true;
      }
      return { success: true, message: 'Primary key added', executionTime: 0 };
    }
    if (/DROP\s+PRIMARY\s+KEY/i.test(operations)) {
      for (const col of table.schema.columns) {
        col.primaryKey = false;
      }
      table.schema.primaryKey = [];
      return { success: true, message: 'Primary key dropped', executionTime: 0 };
    }
    const addFKMatch = operations.match(/ADD\s+(?:CONSTRAINT\s+[`"]?\w+[`"]?\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+[`"]?(\w+)[`"]?\s*\(([^)]+)\)/i);
    if (addFKMatch) {
      const [, column, refTable, refColumn] = addFKMatch;
      table.schema.foreignKeys = table.schema.foreignKeys || [];
      table.schema.foreignKeys.push({
        column: column.trim().replace(/[`"]/g, ''),
        refTable,
        refColumn: refColumn.trim().replace(/[`"]/g, '')
      });
      return { success: true, message: 'Foreign key added', executionTime: 0 };
    }
    const dropFKMatch = operations.match(/DROP\s+FOREIGN\s+KEY\s+[`"]?(\w+)[`"]?/i);
    if (dropFKMatch) {
      return { success: true, message: `Foreign key '${dropFKMatch[1]}' dropped`, executionTime: 0 };
    }
    const setDefaultMatch = operations.match(/ALTER\s+(?:COLUMN\s+)?[`"]?(\w+)[`"]?\s+SET\s+DEFAULT\s+(.+)/i);
    if (setDefaultMatch) {
      const [, colName, defaultVal] = setDefaultMatch;
      const col = table.schema.columns.find(c => c.name === colName);
      if (col) {
        col.defaultValue = this.parseValue(defaultVal.trim());
        return { success: true, message: `Default set for column '${colName}'`, executionTime: 0 };
      }
    }
    const dropDefaultMatch = operations.match(/ALTER\s+(?:COLUMN\s+)?[`"]?(\w+)[`"]?\s+DROP\s+DEFAULT/i);
    if (dropDefaultMatch) {
      const col = table.schema.columns.find(c => c.name === dropDefaultMatch[1]);
      if (col) {
        col.defaultValue = undefined;
        return { success: true, message: `Default dropped for column '${dropDefaultMatch[1]}'`, executionTime: 0 };
      }
    }

    return { success: false, error: 'Unknown ALTER TABLE operation', executionTime: 0 };
  }

  private createTable(sql: string): QueryResult {
    const match = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?(\w+)[`"]?\s*\(([\s\S]+)\)/i);
    if (!match) {
      return { success: false, error: 'Invalid CREATE TABLE syntax', executionTime: 0 };
    }

    const tableName = match[1];
    const columnsStr = match[2];

    if (this.tables.has(tableName)) {
      if (sql.toUpperCase().includes('IF NOT EXISTS')) {
        return { success: true, executionTime: 0 };
      }
      return { success: false, error: `Table '${tableName}' already exists`, executionTime: 0 };
    }

    const columns: ColumnDefinition[] = [];
    const columnDefs = this.splitColumns(columnsStr);

    for (const def of columnDefs) {
      const trimDef = def.trim();
      if (!trimDef) continue;
      if (/^(PRIMARY\s+KEY|FOREIGN\s+KEY|KEY|INDEX|UNIQUE|CONSTRAINT)/i.test(trimDef)) {
        continue;
      }
      const col = this.parseColumn(trimDef);
      if (col) columns.push(col);
    }

    if (columns.length === 0) {
      return { success: false, error: 'No columns defined', executionTime: 0 };
    }

    const table = new LocalTable(tableName);
    table.schema = {
      name: tableName,
      columns,
      indexes: [],
      primaryKey: columns.filter(c => c.primaryKey).map(c => c.name),
      foreignKeys: []
    };
    this.tables.set(tableName, table);

    return { success: true, executionTime: 0 };
  }

  private splitColumns(str: string): string[] {
    const result: string[] = [];
    let depth = 0;
    let current = '';
    for (const char of str) {
      if (char === '(') depth++;
      else if (char === ')') depth--;
      else if (char === ',' && depth === 0) {
        result.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }
    if (current.trim()) result.push(current.trim());
    return result;
  }

  private parseColumn(def: string): ColumnDefinition | null {
    const enumMatch = def.match(/^[`"]?(\w+)[`"]?\s+ENUM\s*\(([^)]+)\)(.*)/i);
    if (enumMatch) {
      const [, name, valuesStr, rest] = enumMatch;
      const upperRest = rest.toUpperCase();
      const enumValues = valuesStr.split(',').map(v => v.trim().replace(/^['"]|['"]$/g, ''));
      
      return {
        name,
        type: 'ENUM',
        enumValues,
        nullable: !upperRest.includes('NOT NULL'),
        primaryKey: upperRest.includes('PRIMARY KEY'),
        unique: upperRest.includes('UNIQUE'),
        autoIncrement: false,
        defaultValue: this.parseDefault(rest)
      };
    }
    const setMatch = def.match(/^[`"]?(\w+)[`"]?\s+SET\s*\(([^)]+)\)(.*)/i);
    if (setMatch) {
      const [, name, valuesStr, rest] = setMatch;
      const upperRest = rest.toUpperCase();
      const setValues = valuesStr.split(',').map(v => v.trim().replace(/^['"]|['"]$/g, ''));
      
      return {
        name,
        type: 'SET',
        setValues,
        nullable: !upperRest.includes('NOT NULL'),
        primaryKey: upperRest.includes('PRIMARY KEY'),
        unique: upperRest.includes('UNIQUE'),
        autoIncrement: false,
        defaultValue: this.parseDefault(rest)
      };
    }
    const decimalMatch = def.match(/^[`"]?(\w+)[`"]?\s+(DECIMAL|NUMERIC)\s*\((\d+)(?:,\s*(\d+))?\)(.*)/i);
    if (decimalMatch) {
      const [, name, , precisionStr, scaleStr, rest] = decimalMatch;
      const upperRest = rest.toUpperCase();
      
      return {
        name,
        type: 'DECIMAL',
        precision: parseInt(precisionStr),
        scale: scaleStr ? parseInt(scaleStr) : 0,
        unsigned: upperRest.includes('UNSIGNED'),
        nullable: !upperRest.includes('NOT NULL'),
        primaryKey: upperRest.includes('PRIMARY KEY'),
        unique: upperRest.includes('UNIQUE'),
        autoIncrement: false,
        defaultValue: this.parseDefault(rest)
      };
    }

    const match = def.match(/^[`"]?(\w+)[`"]?\s+(\w+)(?:\(([^)]+)\))?(.*)/i);
    if (!match) return null;

    const [, name, typeStr, lengthStr, rest] = match;
    const upperType = typeStr.toUpperCase();
    const upperRest = rest.toUpperCase();
    const type = DataTypes.includes(upperType as any) ? upperType : 'VARCHAR';

    return {
      name,
      type,
      length: lengthStr ? parseInt(lengthStr.split(',')[0]) : undefined,
      nullable: !upperRest.includes('NOT NULL'),
      primaryKey: upperRest.includes('PRIMARY KEY'),
      unique: upperRest.includes('UNIQUE'),
      autoIncrement: upperRest.includes('AUTO_INCREMENT') || upperRest.includes('AUTOINCREMENT'),
      defaultValue: this.parseDefault(rest),
      unsigned: upperRest.includes('UNSIGNED'),
      zerofill: upperRest.includes('ZEROFILL'),
      charset: this.parseCharset(rest),
      collation: this.parseCollation(rest),
      onUpdate: upperRest.includes('ON UPDATE CURRENT_TIMESTAMP') ? 'CURRENT_TIMESTAMP' : undefined
    };
  }

  private parseCharset(rest: string): string | undefined {
    const match = rest.match(/CHARACTER\s+SET\s+(\w+)/i) || rest.match(/CHARSET\s+(\w+)/i);
    return match ? match[1] : undefined;
  }

  private parseCollation(rest: string): string | undefined {
    const match = rest.match(/COLLATE\s+(\w+)/i);
    return match ? match[1] : undefined;
  }

  private parseDefault(rest: string): any {
    const match = rest.match(/DEFAULT\s+([^\s,]+)/i);
    if (!match) return undefined;
    const val = match[1];
    if (val.toUpperCase() === 'NULL') return null;
    if (val.toUpperCase() === 'CURRENT_TIMESTAMP') return 'CURRENT_TIMESTAMP';
    if (/^['"]/.test(val)) return val.slice(1, -1);
    if (!isNaN(Number(val))) return Number(val);
    return val;
  }

  private executeInsert(sql: string): QueryResult {
    const match = sql.match(/INSERT\s+INTO\s+[`"]?(\w+)[`"]?\s*(?:\(([^)]+)\))?\s*VALUES\s*(.+)/i);
    if (!match) {
      return { success: false, error: 'Invalid INSERT syntax', executionTime: 0 };
    }

    const [, tableName, columnsStr, valuesStr] = match;
    const table = this.tables.get(tableName);
    if (!table) {
      return { success: false, error: `Table '${tableName}' doesn't exist`, executionTime: 0 };
    }

    const columns = columnsStr 
      ? columnsStr.split(',').map(c => c.trim().replace(/[`"]/g, ''))
      : table.schema.columns.map(c => c.name);

    const valuesSets = this.parseValuesSets(valuesStr);
    let insertedCount = 0;

    for (const values of valuesSets) {
      const row: Record<string, any> = {};
      
      for (const col of table.schema.columns) {
        if (col.autoIncrement) {
          row[col.name] = table.autoIncrementId++;
        } else if (col.defaultValue !== undefined) {
          row[col.name] = col.defaultValue === 'CURRENT_TIMESTAMP' 
            ? new Date().toISOString() 
            : col.defaultValue;
        } else {
          row[col.name] = null;
        }
      }

      columns.forEach((col, i) => {
        if (i < values.length) {
          row[col] = values[i];
        }
      });
      const typeError = this.validateDataTypes(row, table.schema);
      if (typeError) {
        return { success: false, error: typeError, executionTime: 0 };
      }
      const fkError = this.validateForeignKeys(row, table.schema);
      if (fkError) {
        return { success: false, error: fkError, executionTime: 0 };
      }
      const uniqueError = this.validateUniqueConstraints(row, table);
      if (uniqueError) {
        return { success: false, error: uniqueError, executionTime: 0 };
      }

      table.rows.push(row);
      insertedCount++;
    }

    return { success: true, affectedRows: insertedCount, insertId: table.autoIncrementId - 1, executionTime: 0 };
  }

  private validateDataTypes(row: Record<string, any>, schema: TableSchema): string | null {
    for (const col of schema.columns) {
      const value = row[col.name];
      if (value === null || value === undefined) {
        if (!col.nullable && !col.autoIncrement && col.defaultValue === undefined) {
          return `Column '${col.name}' cannot be NULL`;
        }
        continue;
      }

      const upperType = col.type.toUpperCase();
      if (upperType === 'ENUM') {
        if (col.enumValues && !col.enumValues.includes(String(value))) {
          return `Data truncated for column '${col.name}' at row 1. Value '${value}' is not in ENUM(${col.enumValues.map(v => `'${v}'`).join(', ')})`;
        }
      }
      if (upperType === 'SET') {
        if (col.setValues) {
          const values = String(value).split(',').map(v => v.trim());
          for (const v of values) {
            if (v && !col.setValues.includes(v)) {
              return `Data truncated for column '${col.name}' at row 1. Value '${v}' is not in SET(${col.setValues.map(v => `'${v}'`).join(', ')})`;
            }
          }
        }
      }
      if (['INT', 'INTEGER', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT'].includes(upperType)) {
        if (isNaN(Number(value))) {
          return `Incorrect integer value '${value}' for column '${col.name}'`;
        }
        if (col.unsigned && Number(value) < 0) {
          return `Out of range value for column '${col.name}' (unsigned)`;
        }
      }
      if (['DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE', 'REAL'].includes(upperType)) {
        if (isNaN(Number(value))) {
          return `Incorrect decimal value '${value}' for column '${col.name}'`;
        }
      }
      if (['VARCHAR', 'CHAR'].includes(upperType)) {
        if (col.length && String(value).length > col.length) {
          return `Data too long for column '${col.name}' at row 1 (max ${col.length} characters)`;
        }
      }
      if (['BINARY', 'VARBINARY', 'BLOB', 'TINYBLOB', 'MEDIUMBLOB', 'LONGBLOB'].includes(upperType)) {
        if (col.length && String(value).length > col.length * 2) {
          return `Data too long for column '${col.name}' at row 1`;
        }
      }
    }
    return null;
  }

  private validateForeignKeys(row: Record<string, any>, schema: TableSchema): string | null {
    for (const col of schema.columns) {
      if (!col.references) continue;
      
      const value = row[col.name];
      if (value === null || value === undefined) continue;
      
      const refTable = this.tables.get(col.references.table);
      if (!refTable) {
        return `Referenced table '${col.references.table}' doesn't exist`;
      }
      
      const refColumn = col.references.column;
      const exists = refTable.rows.some(r => r[refColumn] == value);
      
      if (!exists) {
        return `Foreign key constraint failed: value '${value}' in column '${col.name}' doesn't exist in '${col.references.table}.${refColumn}'`;
      }
    }
    return null;
  }

  private validateUniqueConstraints(row: Record<string, any>, table: LocalTable): string | null {
    for (const col of table.schema.columns) {
      if (col.unique || col.primaryKey) {
        const value = row[col.name];
        if (value === null) continue;
        
        const exists = table.rows.some(r => r[col.name] == value);
        if (exists) {
          return `Duplicate entry '${value}' for key '${col.name}'`;
        }
      }
    }
    for (const idx of (table.schema.indexes || [])) {
      if (idx.unique) {
        const key = idx.columns.map(c => row[c]).join('|||');
        const exists = table.rows.some(r => 
          idx.columns.map(c => r[c]).join('|||') === key
        );
        if (exists) {
          return `Duplicate entry for UNIQUE index '${idx.name}'`;
        }
      }
    }
    return null;
  }

  private parseValuesSets(str: string): any[][] {
    const sets: any[][] = [];
    let depth = 0;
    let currentSet = '';
    
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (char === '(') {
        if (depth === 0) currentSet = '';
        else currentSet += char;
        depth++;
      } else if (char === ')') {
        depth--;
        if (depth === 0) sets.push(this.parseValues(currentSet));
        else currentSet += char;
      } else if (depth > 0) {
        currentSet += char;
      }
    }
    return sets;
  }

  private parseValues(str: string): any[] {
    const values: any[] = [];
    let current = '';
    let inString = false;
    let stringChar = '';
    
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar && str[i-1] !== '\\') {
        inString = false;
        values.push(current);
        current = '';
        while (i < str.length && str[i+1] !== ',') i++;
        continue;
      } else if (!inString && char === ',') {
        const trimmed = current.trim();
        if (trimmed) values.push(this.parseValue(trimmed));
        current = '';
        continue;
      } else if (inString || char !== ' ' || current) {
        current += char;
      }
    }
    if (current.trim()) values.push(this.parseValue(current.trim()));
    return values;
  }

  private parseValue(val: string): any {
    if (val.toUpperCase() === 'NULL') return null;
    if (val.toUpperCase() === 'TRUE') return true;
    if (val.toUpperCase() === 'FALSE') return false;
    if (/^['"]/.test(val)) return val.slice(1, -1);
    if (!isNaN(Number(val))) return Number(val);
    const funcResult = this.evaluateSQLFunction(val);
    if (funcResult !== undefined) return funcResult;
    return val;
  }

  private evaluateSQLFunction(expr: string, row?: Record<string, any>): any {
    const upper = expr.toUpperCase().trim();
    if (upper === 'NOW()' || upper === 'CURRENT_TIMESTAMP' || upper === 'CURRENT_TIMESTAMP()') {
      return new Date().toISOString().replace('T', ' ').substring(0, 19);
    }
    if (upper === 'CURDATE()' || upper === 'CURRENT_DATE' || upper === 'CURRENT_DATE()') {
      return new Date().toISOString().substring(0, 10);
    }
    if (upper === 'CURTIME()' || upper === 'CURRENT_TIME' || upper === 'CURRENT_TIME()') {
      return new Date().toISOString().substring(11, 19);
    }
    const concatMatch = expr.match(/CONCAT\s*\((.+)\)/i);
    if (concatMatch) {
      const args = this.parseFunctionArgs(concatMatch[1]);
      return args.map(a => this.resolveArg(a, row)).join('');
    }
    const concatWsMatch = expr.match(/CONCAT_WS\s*\((.+)\)/i);
    if (concatWsMatch) {
      const args = this.parseFunctionArgs(concatWsMatch[1]);
      const sep = this.resolveArg(args[0], row);
      return args.slice(1).map(a => this.resolveArg(a, row)).join(sep);
    }
    const substringMatch = expr.match(/(?:SUBSTRING|SUBSTR)\s*\((.+)\)/i);
    if (substringMatch) {
      const args = this.parseFunctionArgs(substringMatch[1]);
      const str = String(this.resolveArg(args[0], row));
      const start = parseInt(this.resolveArg(args[1], row)) - 1;
      const len = args[2] ? parseInt(this.resolveArg(args[2], row)) : undefined;
      return len !== undefined ? str.substring(start, start + len) : str.substring(start);
    }
    const upperMatch = expr.match(/(?:UPPER|UCASE)\s*\((.+)\)/i);
    if (upperMatch) {
      return String(this.resolveArg(upperMatch[1], row)).toUpperCase();
    }
    const lowerMatch = expr.match(/(?:LOWER|LCASE)\s*\((.+)\)/i);
    if (lowerMatch) {
      return String(this.resolveArg(lowerMatch[1], row)).toLowerCase();
    }
    const trimMatch = expr.match(/TRIM\s*\((.+)\)/i);
    if (trimMatch) {
      return String(this.resolveArg(trimMatch[1], row)).trim();
    }
    const ltrimMatch = expr.match(/LTRIM\s*\((.+)\)/i);
    if (ltrimMatch) {
      return String(this.resolveArg(ltrimMatch[1], row)).trimStart();
    }
    const rtrimMatch = expr.match(/RTRIM\s*\((.+)\)/i);
    if (rtrimMatch) {
      return String(this.resolveArg(rtrimMatch[1], row)).trimEnd();
    }
    const lengthMatch = expr.match(/(?:LENGTH|CHAR_LENGTH|CHARACTER_LENGTH)\s*\((.+)\)/i);
    if (lengthMatch) {
      return String(this.resolveArg(lengthMatch[1], row)).length;
    }
    const replaceMatch = expr.match(/REPLACE\s*\((.+)\)/i);
    if (replaceMatch) {
      const args = this.parseFunctionArgs(replaceMatch[1]);
      const str = String(this.resolveArg(args[0], row));
      const from = String(this.resolveArg(args[1], row));
      const to = String(this.resolveArg(args[2], row));
      return str.split(from).join(to);
    }
    const leftMatch = expr.match(/LEFT\s*\((.+)\)/i);
    if (leftMatch) {
      const args = this.parseFunctionArgs(leftMatch[1]);
      return String(this.resolveArg(args[0], row)).substring(0, parseInt(this.resolveArg(args[1], row)));
    }
    const rightMatch = expr.match(/RIGHT\s*\((.+)\)/i);
    if (rightMatch) {
      const args = this.parseFunctionArgs(rightMatch[1]);
      const str = String(this.resolveArg(args[0], row));
      const len = parseInt(this.resolveArg(args[1], row));
      return str.substring(str.length - len);
    }
    const reverseMatch = expr.match(/REVERSE\s*\((.+)\)/i);
    if (reverseMatch) {
      return String(this.resolveArg(reverseMatch[1], row)).split('').reverse().join('');
    }
    const repeatMatch = expr.match(/REPEAT\s*\((.+)\)/i);
    if (repeatMatch) {
      const args = this.parseFunctionArgs(repeatMatch[1]);
      return String(this.resolveArg(args[0], row)).repeat(parseInt(this.resolveArg(args[1], row)));
    }
    const lpadMatch = expr.match(/LPAD\s*\((.+)\)/i);
    if (lpadMatch) {
      const args = this.parseFunctionArgs(lpadMatch[1]);
      const str = String(this.resolveArg(args[0], row));
      const len = parseInt(this.resolveArg(args[1], row));
      const pad = String(this.resolveArg(args[2], row) || ' ');
      return str.padStart(len, pad);
    }

    const rpadMatch = expr.match(/RPAD\s*\((.+)\)/i);
    if (rpadMatch) {
      const args = this.parseFunctionArgs(rpadMatch[1]);
      const str = String(this.resolveArg(args[0], row));
      const len = parseInt(this.resolveArg(args[1], row));
      const pad = String(this.resolveArg(args[2], row) || ' ');
      return str.padEnd(len, pad);
    }
    const absMatch = expr.match(/ABS\s*\((.+)\)/i);
    if (absMatch) {
      return Math.abs(Number(this.resolveArg(absMatch[1], row)));
    }
    const roundMatch = expr.match(/ROUND\s*\((.+)\)/i);
    if (roundMatch) {
      const args = this.parseFunctionArgs(roundMatch[1]);
      const num = Number(this.resolveArg(args[0], row));
      const decimals = args[1] ? parseInt(this.resolveArg(args[1], row)) : 0;
      const factor = Math.pow(10, decimals);
      return Math.round(num * factor) / factor;
    }
    const ceilMatch = expr.match(/(?:CEIL|CEILING)\s*\((.+)\)/i);
    if (ceilMatch) {
      return Math.ceil(Number(this.resolveArg(ceilMatch[1], row)));
    }
    const floorMatch = expr.match(/FLOOR\s*\((.+)\)/i);
    if (floorMatch) {
      return Math.floor(Number(this.resolveArg(floorMatch[1], row)));
    }
    const modMatch = expr.match(/MOD\s*\((.+)\)/i);
    if (modMatch) {
      const args = this.parseFunctionArgs(modMatch[1]);
      return Number(this.resolveArg(args[0], row)) % Number(this.resolveArg(args[1], row));
    }
    const powerMatch = expr.match(/(?:POWER|POW)\s*\((.+)\)/i);
    if (powerMatch) {
      const args = this.parseFunctionArgs(powerMatch[1]);
      return Math.pow(Number(this.resolveArg(args[0], row)), Number(this.resolveArg(args[1], row)));
    }
    const sqrtMatch = expr.match(/SQRT\s*\((.+)\)/i);
    if (sqrtMatch) {
      return Math.sqrt(Number(this.resolveArg(sqrtMatch[1], row)));
    }
    if (upper === 'RAND()') {
      return Math.random();
    }
    const signMatch = expr.match(/SIGN\s*\((.+)\)/i);
    if (signMatch) {
      return Math.sign(Number(this.resolveArg(signMatch[1], row)));
    }
    const truncateMatch = expr.match(/TRUNCATE\s*\((.+)\)/i);
    if (truncateMatch) {
      const args = this.parseFunctionArgs(truncateMatch[1]);
      const num = Number(this.resolveArg(args[0], row));
      const decimals = parseInt(this.resolveArg(args[1], row));
      const factor = Math.pow(10, decimals);
      return Math.trunc(num * factor) / factor;
    }
    const dateMatch = expr.match(/DATE\s*\((.+)\)/i);
    if (dateMatch) {
      const val = this.resolveArg(dateMatch[1], row);
      return new Date(val).toISOString().substring(0, 10);
    }
    const yearMatch = expr.match(/YEAR\s*\((.+)\)/i);
    if (yearMatch) {
      return new Date(this.resolveArg(yearMatch[1], row)).getFullYear();
    }

    const monthMatch = expr.match(/MONTH\s*\((.+)\)/i);
    if (monthMatch) {
      return new Date(this.resolveArg(monthMatch[1], row)).getMonth() + 1;
    }

    const dayMatch = expr.match(/(?:DAY|DAYOFMONTH)\s*\((.+)\)/i);
    if (dayMatch) {
      return new Date(this.resolveArg(dayMatch[1], row)).getDate();
    }
    const hourMatch = expr.match(/HOUR\s*\((.+)\)/i);
    if (hourMatch) {
      return new Date(this.resolveArg(hourMatch[1], row)).getHours();
    }

    const minuteMatch = expr.match(/MINUTE\s*\((.+)\)/i);
    if (minuteMatch) {
      return new Date(this.resolveArg(minuteMatch[1], row)).getMinutes();
    }

    const secondMatch = expr.match(/SECOND\s*\((.+)\)/i);
    if (secondMatch) {
      return new Date(this.resolveArg(secondMatch[1], row)).getSeconds();
    }
    const datediffMatch = expr.match(/DATEDIFF\s*\((.+)\)/i);
    if (datediffMatch) {
      const args = this.parseFunctionArgs(datediffMatch[1]);
      const date1 = new Date(this.resolveArg(args[0], row));
      const date2 = new Date(this.resolveArg(args[1], row));
      return Math.floor((date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24));
    }
    const dateAddMatch = expr.match(/(?:DATE_ADD|ADDDATE)\s*\((.+)\)/i);
    if (dateAddMatch) {
      const args = this.parseFunctionArgs(dateAddMatch[1]);
      const date = new Date(this.resolveArg(args[0], row));
      const intervalMatch = args[1].match(/INTERVAL\s+(\d+)\s+(\w+)/i);
      if (intervalMatch) {
        const [, amount, unit] = intervalMatch;
        const n = parseInt(amount);
        switch (unit.toUpperCase()) {
          case 'DAY': date.setDate(date.getDate() + n); break;
          case 'MONTH': date.setMonth(date.getMonth() + n); break;
          case 'YEAR': date.setFullYear(date.getFullYear() + n); break;
          case 'HOUR': date.setHours(date.getHours() + n); break;
          case 'MINUTE': date.setMinutes(date.getMinutes() + n); break;
          case 'SECOND': date.setSeconds(date.getSeconds() + n); break;
        }
      }
      return date.toISOString().replace('T', ' ').substring(0, 19);
    }
    const dateSubMatch = expr.match(/(?:DATE_SUB|SUBDATE)\s*\((.+)\)/i);
    if (dateSubMatch) {
      const args = this.parseFunctionArgs(dateSubMatch[1]);
      const date = new Date(this.resolveArg(args[0], row));
      const intervalMatch = args[1].match(/INTERVAL\s+(\d+)\s+(\w+)/i);
      if (intervalMatch) {
        const [, amount, unit] = intervalMatch;
        const n = parseInt(amount);
        switch (unit.toUpperCase()) {
          case 'DAY': date.setDate(date.getDate() - n); break;
          case 'MONTH': date.setMonth(date.getMonth() - n); break;
          case 'YEAR': date.setFullYear(date.getFullYear() - n); break;
          case 'HOUR': date.setHours(date.getHours() - n); break;
          case 'MINUTE': date.setMinutes(date.getMinutes() - n); break;
          case 'SECOND': date.setSeconds(date.getSeconds() - n); break;
        }
      }
      return date.toISOString().replace('T', ' ').substring(0, 19);
    }
    const dateFormatMatch = expr.match(/DATE_FORMAT\s*\((.+)\)/i);
    if (dateFormatMatch) {
      const args = this.parseFunctionArgs(dateFormatMatch[1]);
      const date = new Date(this.resolveArg(args[0], row));
      let format = String(this.resolveArg(args[1], row));
      format = format.replace(/%Y/g, String(date.getFullYear()));
      format = format.replace(/%m/g, String(date.getMonth() + 1).padStart(2, '0'));
      format = format.replace(/%d/g, String(date.getDate()).padStart(2, '0'));
      format = format.replace(/%H/g, String(date.getHours()).padStart(2, '0'));
      format = format.replace(/%i/g, String(date.getMinutes()).padStart(2, '0'));
      format = format.replace(/%s/g, String(date.getSeconds()).padStart(2, '0'));
      return format;
    }
    const ifMatch = expr.match(/IF\s*\((.+)\)/i);
    if (ifMatch) {
      const args = this.parseFunctionArgs(ifMatch[1]);
      const condition = this.resolveArg(args[0], row);
      return condition && condition !== 0 && condition !== '0' && condition !== ''
        ? this.resolveArg(args[1], row)
        : this.resolveArg(args[2], row);
    }
    const ifnullMatch = expr.match(/IFNULL\s*\((.+)\)/i);
    if (ifnullMatch) {
      const args = this.parseFunctionArgs(ifnullMatch[1]);
      const val = this.resolveArg(args[0], row);
      return val !== null && val !== undefined ? val : this.resolveArg(args[1], row);
    }
    const nullifMatch = expr.match(/NULLIF\s*\((.+)\)/i);
    if (nullifMatch) {
      const args = this.parseFunctionArgs(nullifMatch[1]);
      const val1 = this.resolveArg(args[0], row);
      const val2 = this.resolveArg(args[1], row);
      return val1 == val2 ? null : val1;
    }
    const coalesceMatch = expr.match(/COALESCE\s*\((.+)\)/i);
    if (coalesceMatch) {
      const args = this.parseFunctionArgs(coalesceMatch[1]);
      for (const arg of args) {
        const val = this.resolveArg(arg, row);
        if (val !== null && val !== undefined) return val;
      }
      return null;
    }
    const nvlMatch = expr.match(/NVL\s*\((.+)\)/i);
    if (nvlMatch) {
      const args = this.parseFunctionArgs(nvlMatch[1]);
      const val = this.resolveArg(args[0], row);
      return val !== null && val !== undefined ? val : this.resolveArg(args[1], row);
    }
    const greatestMatch = expr.match(/GREATEST\s*\((.+)\)/i);
    if (greatestMatch) {
      const args = this.parseFunctionArgs(greatestMatch[1]);
      const values = args.map(a => this.resolveArg(a, row)).filter(v => v !== null);
      return values.length > 0 ? Math.max(...values.map(Number)) : null;
    }

    const leastMatch = expr.match(/LEAST\s*\((.+)\)/i);
    if (leastMatch) {
      const args = this.parseFunctionArgs(leastMatch[1]);
      const values = args.map(a => this.resolveArg(a, row)).filter(v => v !== null);
      return values.length > 0 ? Math.min(...values.map(Number)) : null;
    }

    return undefined;
  }

  private parseFunctionArgs(argsStr: string): string[] {
    const args: string[] = [];
    let depth = 0;
    let current = '';
    
    for (const char of argsStr) {
      if (char === '(') depth++;
      else if (char === ')') depth--;
      else if (char === ',' && depth === 0) {
        args.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }
    if (current.trim()) args.push(current.trim());
    return args;
  }

  private resolveArg(arg: string, row?: Record<string, any>): any {
    const trimmed = arg.trim();
    if (/^['"]/.test(trimmed)) {
      return trimmed.slice(1, -1);
    }
    if (!isNaN(Number(trimmed))) {
      return Number(trimmed);
    }
    if (trimmed.toUpperCase() === 'NULL') {
      return null;
    }
    const funcResult = this.evaluateSQLFunction(trimmed, row);
    if (funcResult !== undefined) return funcResult;
    if (row && row[trimmed] !== undefined) {
      return row[trimmed];
    }
    
    return trimmed;
  }

  private executeSelect(sql: string): QueryResult {
    if (/\bUNION\b|\bINTERSECT\b|\bEXCEPT\b/i.test(sql)) {
      return this.executeSetOperation(sql);
    }
    const upper = sql.toUpperCase();
    if (!/\bFROM\b/i.test(sql)) {
      const selectMatch = sql.match(/SELECT\s+(.+)/i);
      if (selectMatch) {
        const expr = selectMatch[1].trim();
        if (/^\d+$/.test(expr)) {
          return { success: true, rows: [{ result: parseInt(expr) }], columns: ['result'], executionTime: 0 };
        }
        return { success: true, rows: [{ result: expr }], columns: ['result'], executionTime: 0 };
      }
    }
    const hasJoin = /\b(INNER|LEFT|RIGHT|FULL|CROSS)?\s*JOIN\b/i.test(sql);
    const hasSubquery = /\(\s*SELECT\b/i.test(sql);

    if (hasJoin) {
      return this.executeSelectWithJoin(sql);
    }
    
    if (hasSubquery) {
      return this.executeSelectWithSubquery(sql);
    }
    const match = sql.match(/SELECT\s+(DISTINCT\s+)?([\s\S]+?)\s+FROM\s+[`"]?(\w+)[`"]?(?:\s+(?:AS\s+)?(\w+))?(?:\s+WHERE\s+([\s\S]+?))?(?:\s+GROUP\s+BY\s+([\s\S]+?))?(?:\s+HAVING\s+([\s\S]+?))?(?:\s+ORDER\s+BY\s+([\s\S]+?))?(?:\s+LIMIT\s+(\d+)(?:\s+OFFSET\s+(\d+))?)?$/i);
    
    if (!match) {
      return { success: false, error: 'Invalid SELECT syntax', executionTime: 0 };
    }

    const [, distinctStr, columnsStr, tableName, tableAlias, whereStr, groupByStr, havingStr, orderStr, limitStr, offsetStr] = match;
    const table = this.tables.get(tableName);
    
    if (!table) {
      return { success: false, error: `Table '${tableName}' doesn't exist`, executionTime: 0 };
    }

    let rows = [...table.rows];
    if (whereStr) {
      rows = rows.filter(row => this.evaluateWhere(whereStr, row, this.tables));
    }
    const hasAggregate = /\b(COUNT|SUM|AVG|MIN|MAX|GROUP_CONCAT)\s*\(/i.test(columnsStr);
    if (groupByStr || hasAggregate) {
      rows = this.executeGroupBy(rows, columnsStr, groupByStr);
    }
    if (havingStr) {
      rows = rows.filter(row => this.evaluateWhere(havingStr, row, this.tables));
    }
    if (orderStr) {
      rows = this.sortRows(rows, orderStr);
    }
    if (distinctStr) {
      const seen = new Set<string>();
      rows = rows.filter(row => {
        const key = JSON.stringify(row);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    if (offsetStr) rows = rows.slice(parseInt(offsetStr));
    if (limitStr) rows = rows.slice(0, parseInt(limitStr));
    let columns: string[];
    if (columnsStr.trim() === '*') {
      columns = table.schema.columns.map(c => c.name);
    } else {
      columns = this.parseSelectColumns(columnsStr);
      const allRowsCopy = [...rows];
      rows = rows.map((row, idx) => this.selectColumns(row, columnsStr, table, allRowsCopy, idx));
    }

    return { success: true, rows, columns, executionTime: 0 };
  }
  private executeSetOperation(sql: string): QueryResult {
    const parts: Array<{ sql: string; op: string }> = [];
    let remaining = sql;
    const setOpRegex = /\b(UNION\s+ALL|UNION|INTERSECT|EXCEPT)\b/gi;
    let lastIndex = 0;
    let match;
    
    while ((match = setOpRegex.exec(sql)) !== null) {
      if (lastIndex === 0) {
        parts.push({ sql: sql.substring(0, match.index).trim(), op: '' });
      }
      lastIndex = match.index + match[0].length;
      const nextMatch = setOpRegex.exec(sql);
      const endIndex = nextMatch ? nextMatch.index : sql.length;
      if (nextMatch) setOpRegex.lastIndex = nextMatch.index;
      
      parts.push({ 
        sql: sql.substring(lastIndex, endIndex).trim(), 
        op: match[1].toUpperCase().replace(/\s+/g, ' ')
      });
    }

    if (parts.length === 0) {
      return this.executeSelectInternal(sql);
    }
    let result = this.executeSelectInternal(parts[0].sql);
    if (!result.success) return result;
    
    let rows = result.rows || [];
    const columns = result.columns || [];
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      const otherResult = this.executeSelectInternal(part.sql);
      if (!otherResult.success) return otherResult;
      const otherRows = otherResult.rows || [];

      switch (part.op) {
        case 'UNION':
          rows = this.unionRows(rows, otherRows, true);
          break;
        case 'UNION ALL':
          rows = this.unionRows(rows, otherRows, false);
          break;
        case 'INTERSECT':
          rows = this.intersectRows(rows, otherRows);
          break;
        case 'EXCEPT':
          rows = this.exceptRows(rows, otherRows);
          break;
      }
    }

    return { success: true, rows, columns, executionTime: 0 };
  }

  private executeSelectInternal(sql: string): QueryResult {
    const upper = sql.toUpperCase();
    if (!/\bFROM\b/i.test(sql)) {
      const selectMatch = sql.match(/SELECT\s+(.+)/i);
      if (selectMatch) {
        const expr = selectMatch[1].trim();
        const funcResult = this.evaluateSQLFunction(expr, {});
        if (funcResult !== undefined) {
          const col = expr.replace(/\s+/g, '_').replace(/[(),']/g, '').toLowerCase();
          return { success: true, rows: [{ [col]: funcResult }], columns: [col], executionTime: 0 };
        }
        if (/^\d+$/.test(expr)) {
          return { success: true, rows: [{ result: parseInt(expr) }], columns: ['result'], executionTime: 0 };
        }
        const parts = this.splitSelectColumns(expr);
        const row: Record<string, any> = {};
        const columns: string[] = [];
        for (const part of parts) {
          const aliasMatch = part.trim().match(/^(.+?)\s+AS\s+(\w+)$/i);
          if (aliasMatch) {
            const [, val, alias] = aliasMatch;
            const funcRes = this.evaluateSQLFunction(val.trim(), {});
            row[alias] = funcRes !== undefined ? funcRes : this.parseValue(val.trim());
            columns.push(alias);
          } else {
            const funcRes = this.evaluateSQLFunction(part.trim(), {});
            const col = part.trim().replace(/\s+/g, '_').replace(/[(),']/g, '').toLowerCase() || 'result';
            row[col] = funcRes !== undefined ? funcRes : this.parseValue(part.trim());
            columns.push(col);
          }
        }
        return { success: true, rows: [row], columns, executionTime: 0 };
      }
    }

    const hasJoin = /\b(INNER|LEFT|RIGHT|FULL|CROSS)?\s*JOIN\b/i.test(sql);
    const hasSubquery = /\(\s*SELECT\b/i.test(sql);

    if (hasJoin) {
      return this.executeSelectWithJoin(sql);
    }
    
    if (hasSubquery) {
      return this.executeSelectWithSubquery(sql);
    }

    const match = sql.match(/SELECT\s+(DISTINCT\s+)?([\s\S]+?)\s+FROM\s+[`"]?(\w+)[`"]?(?:\s+(?:AS\s+)?(\w+))?(?:\s+WHERE\s+([\s\S]+?))?(?:\s+GROUP\s+BY\s+([\s\S]+?))?(?:\s+HAVING\s+([\s\S]+?))?(?:\s+ORDER\s+BY\s+([\s\S]+?))?(?:\s+LIMIT\s+(\d+)(?:\s+OFFSET\s+(\d+))?)?$/i);
    
    if (!match) {
      return { success: false, error: 'Invalid SELECT syntax', executionTime: 0 };
    }

    const [, distinctStr, columnsStr, tableName, tableAlias, whereStr, groupByStr, havingStr, orderStr, limitStr, offsetStr] = match;
    const table = this.tables.get(tableName);
    
    if (!table) {
      return { success: false, error: `Table '${tableName}' doesn't exist`, executionTime: 0 };
    }

    let rows = [...table.rows];

    if (whereStr) {
      rows = rows.filter(row => this.evaluateWhere(whereStr, row, this.tables));
    }

    const hasAggregate = /\b(COUNT|SUM|AVG|MIN|MAX|GROUP_CONCAT)\s*\(/i.test(columnsStr);
    if (groupByStr || hasAggregate) {
      rows = this.executeGroupBy(rows, columnsStr, groupByStr);
    }

    if (havingStr) {
      rows = rows.filter(row => this.evaluateWhere(havingStr, row, this.tables));
    }

    if (orderStr) {
      rows = this.sortRows(rows, orderStr);
    }

    if (distinctStr) {
      const seen = new Set<string>();
      rows = rows.filter(row => {
        const key = JSON.stringify(row);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    if (offsetStr) rows = rows.slice(parseInt(offsetStr));
    if (limitStr) rows = rows.slice(0, parseInt(limitStr));

    let columns: string[];
    if (columnsStr.trim() === '*') {
      columns = table.schema.columns.map(c => c.name);
    } else {
      columns = this.parseSelectColumns(columnsStr);
      const allRowsCopy = [...rows];
      rows = rows.map((row, idx) => this.selectColumns(row, columnsStr, table, allRowsCopy, idx));
    }

    return { success: true, rows, columns, executionTime: 0 };
  }

  private unionRows(rows1: Record<string, any>[], rows2: Record<string, any>[], distinct: boolean): Record<string, any>[] {
    const combined = [...rows1, ...rows2];
    if (!distinct) return combined;

    const seen = new Set<string>();
    return combined.filter(row => {
      const key = JSON.stringify(row);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private intersectRows(rows1: Record<string, any>[], rows2: Record<string, any>[]): Record<string, any>[] {
    const set2 = new Set(rows2.map(r => JSON.stringify(r)));
    const seen = new Set<string>();
    return rows1.filter(row => {
      const key = JSON.stringify(row);
      if (seen.has(key) || !set2.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private exceptRows(rows1: Record<string, any>[], rows2: Record<string, any>[]): Record<string, any>[] {
    const set2 = new Set(rows2.map(r => JSON.stringify(r)));
    const seen = new Set<string>();
    return rows1.filter(row => {
      const key = JSON.stringify(row);
      if (seen.has(key) || set2.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private executeSelectWithJoin(sql: string): QueryResult {
    const fromMatch = sql.match(/FROM\s+[`"]?(\w+)[`"]?(?:\s+(?:AS\s+)?(\w+))?/i);
    if (!fromMatch) return { success: false, error: 'Invalid FROM clause', executionTime: 0 };
    
    const primaryTable = fromMatch[1];
    const primaryAlias = fromMatch[2] || primaryTable;
    const table = this.tables.get(primaryTable);
    if (!table) return { success: false, error: `Table '${primaryTable}' doesn't exist`, executionTime: 0 };
    let resultRows = table.rows.map(row => {
      const prefixed: Record<string, any> = {};
      for (const [key, value] of Object.entries(row)) {
        prefixed[`${primaryAlias}.${key}`] = value;
        prefixed[key] = value;
      }
      return prefixed;
    });
    const joinRegex = /\b(INNER|LEFT|RIGHT|FULL|CROSS)?\s*JOIN\s+[`"]?(\w+)[`"]?(?:\s+(?:AS\s+)?(\w+))?\s+(?:ON\s+([^JWLRFCI]+?)(?=\s+(?:INNER|LEFT|RIGHT|FULL|CROSS|JOIN|WHERE|GROUP|ORDER|LIMIT|$))|USING\s*\(([^)]+)\))?/gi;
    
    let joinMatch;
    while ((joinMatch = joinRegex.exec(sql)) !== null) {
      const [, joinType = 'INNER', joinTable, joinAlias, onCondition, usingCols] = joinMatch;
      const rightTable = this.tables.get(joinTable);
      if (!rightTable) return { success: false, error: `Table '${joinTable}' doesn't exist`, executionTime: 0 };
      
      const rightAlias = joinAlias || joinTable;
      resultRows = this.performJoin(resultRows, rightTable.rows, rightAlias, joinType.toUpperCase(), onCondition, usingCols);
    }
    const whereMatch = sql.match(/WHERE\s+([\s\S]+?)(?=\s+(?:GROUP|ORDER|LIMIT|$))/i);
    if (whereMatch) {
      resultRows = resultRows.filter(row => this.evaluateWhere(whereMatch[1], row, this.tables));
    }
    const groupMatch = sql.match(/GROUP\s+BY\s+([\s\S]+?)(?=\s+(?:HAVING|ORDER|LIMIT|$))/i);
    const selectMatch = sql.match(/SELECT\s+([\s\S]+?)\s+FROM/i);
    const columnsStr = selectMatch ? selectMatch[1] : '*';
    
    if (groupMatch) {
      resultRows = this.executeGroupBy(resultRows, columnsStr, groupMatch[1]);
    }
    const orderMatch = sql.match(/ORDER\s+BY\s+([\s\S]+?)(?=\s+(?:LIMIT|$))/i);
    if (orderMatch) {
      resultRows = this.sortRows(resultRows, orderMatch[1]);
    }
    const limitMatch = sql.match(/LIMIT\s+(\d+)(?:\s+OFFSET\s+(\d+))?/i);
    if (limitMatch) {
      if (limitMatch[2]) resultRows = resultRows.slice(parseInt(limitMatch[2]));
      resultRows = resultRows.slice(0, parseInt(limitMatch[1]));
    }
    let columns: string[];
    if (columnsStr.trim() === '*') {
      const colSet = new Set<string>();
      for (const row of resultRows) {
        for (const key of Object.keys(row)) {
          if (!key.includes('.')) colSet.add(key);
        }
      }
      columns = Array.from(colSet);
    } else {
      columns = this.parseSelectColumns(columnsStr);
      resultRows = resultRows.map(row => {
        const newRow: Record<string, any> = {};
        for (const col of columns) {
          newRow[col] = row[col] ?? row[`${primaryAlias}.${col}`];
        }
        return newRow;
      });
    }

    return { success: true, rows: resultRows, columns, executionTime: 0 };
  }

  private performJoin(
    leftRows: Record<string, any>[], 
    rightRows: Record<string, any>[], 
    rightAlias: string,
    joinType: string,
    onCondition?: string,
    usingCols?: string
  ): Record<string, any>[] {
    const result: Record<string, any>[] = [];
    const preparedRight = rightRows.map(row => {
      const prefixed: Record<string, any> = {};
      for (const [key, value] of Object.entries(row)) {
        prefixed[`${rightAlias}.${key}`] = value;
        prefixed[key] = value;
      }
      return prefixed;
    });

    switch (joinType) {
      case 'INNER':
        for (const leftRow of leftRows) {
          for (const rightRow of preparedRight) {
            const combined = { ...leftRow, ...rightRow };
            if (this.evaluateJoinCondition(combined, onCondition, usingCols)) {
              result.push(combined);
            }
          }
        }
        break;

      case 'LEFT':
        for (const leftRow of leftRows) {
          let matched = false;
          for (const rightRow of preparedRight) {
            const combined = { ...leftRow, ...rightRow };
            if (this.evaluateJoinCondition(combined, onCondition, usingCols)) {
              result.push(combined);
              matched = true;
            }
          }
          if (!matched) {
            const nullRight: Record<string, any> = {};
            if (preparedRight.length > 0) {
              for (const key of Object.keys(preparedRight[0])) {
                nullRight[key] = null;
              }
            }
            result.push({ ...leftRow, ...nullRight });
          }
        }
        break;

      case 'RIGHT':
        for (const rightRow of preparedRight) {
          let matched = false;
          for (const leftRow of leftRows) {
            const combined = { ...leftRow, ...rightRow };
            if (this.evaluateJoinCondition(combined, onCondition, usingCols)) {
              result.push(combined);
              matched = true;
            }
          }
          if (!matched) {
            const nullLeft: Record<string, any> = {};
            if (leftRows.length > 0) {
              for (const key of Object.keys(leftRows[0])) {
                nullLeft[key] = null;
              }
            }
            result.push({ ...nullLeft, ...rightRow });
          }
        }
        break;

      case 'FULL':
        const matchedRight = new Set<number>();
        for (const leftRow of leftRows) {
          let matched = false;
          for (let i = 0; i < preparedRight.length; i++) {
            const combined = { ...leftRow, ...preparedRight[i] };
            if (this.evaluateJoinCondition(combined, onCondition, usingCols)) {
              result.push(combined);
              matched = true;
              matchedRight.add(i);
            }
          }
          if (!matched) {
            const nullRight: Record<string, any> = {};
            if (preparedRight.length > 0) {
              for (const key of Object.keys(preparedRight[0])) {
                nullRight[key] = null;
              }
            }
            result.push({ ...leftRow, ...nullRight });
          }
        }
        for (let i = 0; i < preparedRight.length; i++) {
          if (!matchedRight.has(i)) {
            const nullLeft: Record<string, any> = {};
            if (leftRows.length > 0) {
              for (const key of Object.keys(leftRows[0])) {
                nullLeft[key] = null;
              }
            }
            result.push({ ...nullLeft, ...preparedRight[i] });
          }
        }
        break;

      case 'CROSS':
        for (const leftRow of leftRows) {
          for (const rightRow of preparedRight) {
            result.push({ ...leftRow, ...rightRow });
          }
        }
        break;
    }

    return result;
  }

  private evaluateJoinCondition(row: Record<string, any>, onCondition?: string, usingCols?: string): boolean {
    if (usingCols) {
      const cols = usingCols.split(',').map(c => c.trim());
      for (const col of cols) {
        const leftVal = row[col];
        let rightVal;
        for (const [key, val] of Object.entries(row)) {
          if (key.endsWith(`.${col}`) && key !== col) {
            rightVal = val;
            break;
          }
        }
        if (leftVal !== rightVal) return false;
      }
      return true;
    }
    
    if (onCondition) {
      return this.evaluateWhere(onCondition.trim(), row, this.tables);
    }
    
    return true;
  }

  private executeSelectWithSubquery(sql: string): QueryResult {
    let processedSql = sql;
    const inSubqueryMatch = sql.match(/WHERE\s+([\w.]+)\s+IN\s*\(\s*(SELECT[\s\S]+?)\s*\)/i);
    if (inSubqueryMatch) {
      const [fullMatch, column, subquery] = inSubqueryMatch;
      const subResult = this.execute(subquery);
      if (!subResult.success || !subResult.rows) {
        return { success: false, error: 'Subquery failed: ' + subResult.error, executionTime: 0 };
      }
      const values = subResult.rows.map(r => Object.values(r)[0]);
      const valuesList = values.map(v => typeof v === 'string' ? `'${v}'` : v).join(',');
      processedSql = sql.replace(fullMatch, `WHERE ${column} IN (${valuesList})`);
      return this.execute(processedSql);
    }
    const notInSubqueryMatch = sql.match(/WHERE\s+([\w.]+)\s+NOT\s+IN\s*\(\s*(SELECT[\s\S]+?)\s*\)/i);
    if (notInSubqueryMatch) {
      const [fullMatch, column, subquery] = notInSubqueryMatch;
      const subResult = this.execute(subquery);
      if (!subResult.success || !subResult.rows) {
        return { success: false, error: 'Subquery failed: ' + subResult.error, executionTime: 0 };
      }
      const values = subResult.rows.map(r => Object.values(r)[0]);
      const valuesList = values.map(v => typeof v === 'string' ? `'${v}'` : v).join(',');
      processedSql = sql.replace(fullMatch, `WHERE ${column} NOT IN (${valuesList})`);
      return this.execute(processedSql);
    }
    const existsMatch = sql.match(/WHERE\s+EXISTS\s*\(\s*(SELECT[\s\S]+?)\s*\)/i);
    if (existsMatch) {
      const subResult = this.execute(existsMatch[1]);
      if (subResult.success && subResult.rows && subResult.rows.length > 0) {
        processedSql = sql.replace(/WHERE\s+EXISTS\s*\([^)]+\)/i, '');
        if (!/WHERE/i.test(processedSql)) {
          return this.execute(processedSql);
        }
      }
      return { success: true, rows: [], columns: [], executionTime: 0 };
    }
    const notExistsMatch = sql.match(/WHERE\s+NOT\s+EXISTS\s*\(\s*(SELECT[\s\S]+?)\s*\)/i);
    if (notExistsMatch) {
      const subResult = this.execute(notExistsMatch[1]);
      if (subResult.success && subResult.rows && subResult.rows.length === 0) {
        processedSql = sql.replace(/WHERE\s+NOT\s+EXISTS\s*\([^)]+\)/i, '');
        return this.execute(processedSql);
      }
      return { success: true, rows: [], columns: [], executionTime: 0 };
    }
    const fromSubqueryMatch = sql.match(/FROM\s*\(\s*(SELECT[\s\S]+?)\s*\)\s+(?:AS\s+)?(\w+)/i);
    if (fromSubqueryMatch) {
      const [fullMatch, subquery, alias] = fromSubqueryMatch;
      const subResult = this.execute(subquery);
      if (!subResult.success || !subResult.rows) {
        return { success: false, error: 'Subquery failed: ' + subResult.error, executionTime: 0 };
      }
      const tempTableName = `__temp_${alias}_${Date.now()}`;
      const tempTable = new LocalTable(tempTableName);
      tempTable.rows = subResult.rows;
      tempTable.schema = {
        name: tempTableName,
        columns: (subResult.columns || Object.keys(subResult.rows[0] || {})).map(name => ({
          name,
          type: 'VARCHAR'
        }))
      };
      this.tables.set(tempTableName, tempTable);
      processedSql = sql.replace(fullMatch, `FROM ${tempTableName} ${alias}`);
      const result = this.execute(processedSql);
      this.tables.delete(tempTableName);
      
      return result;
    }
    return { success: false, error: 'Unsupported subquery type', executionTime: 0 };
  }

  private executeGroupBy(rows: Record<string, any>[], columnsStr: string, groupByStr?: string): Record<string, any>[] {
    const groupByCols = groupByStr ? groupByStr.split(',').map(c => c.trim()) : [];
    const groups = new Map<string, Record<string, any>[]>();
    
    for (const row of rows) {
      const key = groupByCols.length > 0 
        ? groupByCols.map(col => row[col]).join('|||')
        : '___all___';
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(row);
    }
    const result: Record<string, any>[] = [];
    
    for (const [_, groupRows] of groups) {
      const aggregatedRow = this.aggregateGroup(groupRows, columnsStr, groupByCols);
      result.push(aggregatedRow);
    }

    return result;
  }

  private aggregateGroup(rows: Record<string, any>[], columnsStr: string, groupByCols: string[]): Record<string, any> {
    const result: Record<string, any> = {};
    for (const col of groupByCols) {
      result[col] = rows[0][col];
    }
    const aggRegex = /(COUNT|SUM|AVG|MIN|MAX|GROUP_CONCAT)\s*\(\s*(DISTINCT\s+)?([^)]+)\s*\)(?:\s+AS\s+(\w+))?/gi;
    let aggMatch;
    
    while ((aggMatch = aggRegex.exec(columnsStr)) !== null) {
      const [, func, distinct, expr, alias] = aggMatch;
      const funcUpper = func.toUpperCase();
      const colName = expr.trim();
      const resultKey = alias || `${funcUpper}(${colName})`;
      
      let values = rows.map(r => colName === '*' ? 1 : r[colName]);
      
      if (distinct) {
        values = [...new Set(values)];
      }
      
      switch (funcUpper) {
        case 'COUNT':
          result[resultKey] = colName === '*' 
            ? rows.length 
            : values.filter(v => v !== null && v !== undefined).length;
          break;
        case 'SUM':
          result[resultKey] = values.reduce((sum, v) => sum + (Number(v) || 0), 0);
          break;
        case 'AVG':
          const nums = values.filter(v => v !== null && v !== undefined);
          result[resultKey] = nums.length > 0 
            ? nums.reduce((sum, v) => sum + Number(v), 0) / nums.length 
            : null;
          break;
        case 'MIN':
          const mins = values.filter(v => v !== null);
          result[resultKey] = mins.length > 0 ? Math.min(...mins.map(Number)) : null;
          break;
        case 'MAX':
          const maxs = values.filter(v => v !== null);
          result[resultKey] = maxs.length > 0 ? Math.max(...maxs.map(Number)) : null;
          break;
        case 'GROUP_CONCAT':
          result[resultKey] = values.filter(v => v !== null).join(',');
          break;
      }
    }

    return result;
  }

  private sortRows(rows: Record<string, any>[], orderStr: string): Record<string, any>[] {
    const orderParts = orderStr.split(',').map(p => {
      const match = p.trim().match(/([\w.]+)(?:\s+(ASC|DESC))?/i);
      return match ? { col: match[1], desc: match[2]?.toUpperCase() === 'DESC' } : null;
    }).filter(Boolean) as Array<{ col: string; desc: boolean }>;

    return [...rows].sort((a, b) => {
      for (const { col, desc } of orderParts) {
        const va = a[col], vb = b[col];
        let cmp = 0;
        if (va < vb) cmp = -1;
        else if (va > vb) cmp = 1;
        if (cmp !== 0) return desc ? -cmp : cmp;
      }
      return 0;
    });
  }

  private parseSelectColumns(columnsStr: string): string[] {
    const columns: string[] = [];
    const parts = this.splitSelectColumns(columnsStr);
    
    for (const part of parts) {
      const trimmed = part.trim();
      const windowMatch = trimmed.match(/(?:ROW_NUMBER|RANK|DENSE_RANK|NTILE|LEAD|LAG|FIRST_VALUE|LAST_VALUE)\s*\([^)]*\)\s*OVER\s*\([^)]*\)(?:\s+AS\s+(\w+))?/i);
      if (windowMatch) {
        columns.push(windowMatch[1] || trimmed.split(/\s+AS\s+/i)[1] || 'window_result');
        continue;
      }
      const aggWindowMatch = trimmed.match(/(?:COUNT|SUM|AVG|MIN|MAX)\s*\([^)]+\)\s*OVER\s*\([^)]*\)(?:\s+AS\s+(\w+))?/i);
      if (aggWindowMatch) {
        columns.push(aggWindowMatch[1] || 'agg_window_result');
        continue;
      }
      const caseMatch = trimmed.match(/CASE\s+[\s\S]+?END(?:\s+AS\s+(\w+))?/i);
      if (caseMatch) {
        columns.push(caseMatch[1] || 'case_result');
        continue;
      }
      const aggMatch = trimmed.match(/(?:COUNT|SUM|AVG|MIN|MAX|GROUP_CONCAT)\s*\([^)]+\)(?:\s+AS\s+(\w+))?/i);
      if (aggMatch) {
        columns.push(aggMatch[1] || trimmed.replace(/\s+AS\s+\w+$/i, ''));
        continue;
      }
      const colMatch = trimmed.match(/(?:(\w+)\.)?(\w+)(?:\s+AS\s+(\w+))?/i);
      if (colMatch) {
        columns.push(colMatch[3] || colMatch[2]);
      }
    }
    return columns;
  }
  private splitSelectColumns(str: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let current = '';
    let inCase = false;
    
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (str.substring(i, i + 4).toUpperCase() === 'CASE') {
        inCase = true;
      }
      if (str.substring(i, i + 3).toUpperCase() === 'END' && inCase) {
        inCase = false;
        current += str.substring(i, i + 3);
        i += 2;
        continue;
      }
      
      if (char === '(') depth++;
      else if (char === ')') depth--;
      else if (char === ',' && depth === 0 && !inCase) {
        parts.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }
    if (current.trim()) parts.push(current.trim());
    return parts;
  }

  private selectColumns(row: Record<string, any>, columnsStr: string, table: LocalTable, allRows?: Record<string, any>[], rowIndex?: number): Record<string, any> {
    const result: Record<string, any> = {};
    const parts = this.splitSelectColumns(columnsStr);
    
    for (const part of parts) {
      const trimmed = part.trim();
      const windowMatch = trimmed.match(/(ROW_NUMBER|RANK|DENSE_RANK|NTILE|LEAD|LAG|FIRST_VALUE|LAST_VALUE)\s*\(([^)]*)\)\s*OVER\s*\(([^)]*)\)(?:\s+AS\s+(\w+))?/i);
      if (windowMatch && allRows && rowIndex !== undefined) {
        const [, funcName, args, overClause, alias] = windowMatch;
        const col = alias || 'window_result';
        result[col] = this.evaluateWindowFunction(funcName.toUpperCase(), args, overClause, allRows, rowIndex);
        continue;
      }
      const aggWindowMatch = trimmed.match(/(COUNT|SUM|AVG|MIN|MAX)\s*\(([^)]+)\)\s*OVER\s*\(([^)]*)\)(?:\s+AS\s+(\w+))?/i);
      if (aggWindowMatch && allRows && rowIndex !== undefined) {
        const [, funcName, argCol, overClause, alias] = aggWindowMatch;
        const col = alias || 'agg_window_result';
        result[col] = this.evaluateAggregateWindowFunction(funcName.toUpperCase(), argCol, overClause, allRows, rowIndex);
        continue;
      }
      const caseMatch = trimmed.match(/CASE\s+([\s\S]+?)END(?:\s+AS\s+(\w+))?/i);
      if (caseMatch) {
        const [, caseBody, alias] = caseMatch;
        const col = alias || 'case_result';
        result[col] = this.evaluateCaseExpression(caseBody, row);
        continue;
      }
      const funcWithAliasMatch = trimmed.match(/^(\w+\s*\([^)]*\))(?:\s+AS\s+(\w+))?$/i);
      if (funcWithAliasMatch) {
        const [, funcExpr, alias] = funcWithAliasMatch;
        const funcResult = this.evaluateSQLFunction(funcExpr, row);
        if (funcResult !== undefined) {
          const col = alias || funcExpr.replace(/\s+/g, '_').replace(/[(),']/g, '').toLowerCase();
          result[col] = funcResult;
          continue;
        }
      }
      const aliasMatch = trimmed.match(/(?:(.+)\s+AS\s+)?(\w+)$/i);
      if (aliasMatch) {
        const [, expr, alias] = aliasMatch;
        if (expr) {
          const funcResult = this.evaluateSQLFunction(expr.trim(), row);
          if (funcResult !== undefined) {
            result[alias] = funcResult;
          } else {
            result[alias] = row[expr.trim()] ?? row[alias];
          }
        } else {
          result[alias] = row[alias];
        }
      }
    }
    return result;
  }
  private evaluateWindowFunction(func: string, args: string, overClause: string, rows: Record<string, any>[], currentIndex: number): any {
    const partitionBy = this.parseOverPartitionBy(overClause);
    const orderBy = this.parseOverOrderBy(overClause);
    const partition = partitionBy.length > 0
      ? rows.filter(r => partitionBy.every(col => r[col] === rows[currentIndex][col]))
      : rows;
    let sortedPartition = partition;
    if (orderBy.length > 0) {
      sortedPartition = [...partition].sort((a, b) => {
        for (const { col, desc } of orderBy) {
          const cmp = a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0;
          if (cmp !== 0) return desc ? -cmp : cmp;
        }
        return 0;
      });
    }
    const currentRow = rows[currentIndex];
    const posInPartition = sortedPartition.findIndex(r => r === currentRow || JSON.stringify(r) === JSON.stringify(currentRow));
    
    switch (func) {
      case 'ROW_NUMBER':
        return posInPartition + 1;
        
      case 'RANK': {
        if (orderBy.length === 0) return 1;
        let rank = 1;
        for (let i = 0; i < posInPartition; i++) {
          const same = orderBy.every(({ col }) => sortedPartition[i][col] === currentRow[col]);
          if (!same) rank = i + 1;
        }
        for (let i = 0; i <= posInPartition; i++) {
          const same = orderBy.every(({ col }) => sortedPartition[i][col] === currentRow[col]);
          if (same) return i + 1;
        }
        return rank;
      }
        
      case 'DENSE_RANK': {
        if (orderBy.length === 0) return 1;
        const uniqueVals = new Set<string>();
        for (let i = 0; i <= posInPartition; i++) {
          const key = orderBy.map(({ col }) => sortedPartition[i][col]).join('|||');
          uniqueVals.add(key);
        }
        return uniqueVals.size;
      }
        
      case 'NTILE': {
        const n = parseInt(args) || 1;
        const bucketSize = Math.ceil(sortedPartition.length / n);
        return Math.floor(posInPartition / bucketSize) + 1;
      }
        
      case 'LEAD': {
        const parts = args.split(',').map(s => s.trim());
        const col = parts[0];
        const offset = parseInt(parts[1]) || 1;
        const defaultVal = parts[2] ? this.parseValue(parts[2]) : null;
        const targetIdx = posInPartition + offset;
        return targetIdx < sortedPartition.length ? sortedPartition[targetIdx][col] : defaultVal;
      }
        
      case 'LAG': {
        const parts = args.split(',').map(s => s.trim());
        const col = parts[0];
        const offset = parseInt(parts[1]) || 1;
        const defaultVal = parts[2] ? this.parseValue(parts[2]) : null;
        const targetIdx = posInPartition - offset;
        return targetIdx >= 0 ? sortedPartition[targetIdx][col] : defaultVal;
      }
        
      case 'FIRST_VALUE':
        return sortedPartition.length > 0 ? sortedPartition[0][args.trim()] : null;
        
      case 'LAST_VALUE':
        return sortedPartition.length > 0 ? sortedPartition[sortedPartition.length - 1][args.trim()] : null;
    }
    
    return null;
  }
  private evaluateAggregateWindowFunction(func: string, argCol: string, overClause: string, rows: Record<string, any>[], currentIndex: number): any {
    const partitionBy = this.parseOverPartitionBy(overClause);
    const col = argCol.trim();
    const partition = partitionBy.length > 0
      ? rows.filter(r => partitionBy.every(c => r[c] === rows[currentIndex][c]))
      : rows;
    
    const values = partition.map(r => col === '*' ? 1 : r[col]).filter(v => v !== null && v !== undefined);
    
    switch (func) {
      case 'COUNT':
        return col === '*' ? partition.length : values.length;
      case 'SUM':
        return values.reduce((sum, v) => sum + Number(v), 0);
      case 'AVG':
        return values.length > 0 ? values.reduce((sum, v) => sum + Number(v), 0) / values.length : null;
      case 'MIN':
        return values.length > 0 ? Math.min(...values.map(Number)) : null;
      case 'MAX':
        return values.length > 0 ? Math.max(...values.map(Number)) : null;
    }
    return null;
  }

  private parseOverPartitionBy(overClause: string): string[] {
    const match = overClause.match(/PARTITION\s+BY\s+([^ORDER]+)/i);
    if (!match) return [];
    return match[1].split(',').map(c => c.trim().replace(/[`"]/g, ''));
  }

  private parseOverOrderBy(overClause: string): Array<{ col: string; desc: boolean }> {
    const match = overClause.match(/ORDER\s+BY\s+(.+)/i);
    if (!match) return [];
    return match[1].split(',').map(part => {
      const p = part.trim();
      const desc = /\bDESC\b/i.test(p);
      const col = p.replace(/\s+(ASC|DESC)\b/gi, '').trim().replace(/[`"]/g, '');
      return { col, desc };
    });
  }
  private evaluateCaseExpression(caseBody: string, row: Record<string, any>): any {
    const simpleMatch = caseBody.match(/^(\w+)\s+WHEN/i);
    if (simpleMatch) {
      const operand = row[simpleMatch[1]];
      const whenRegex = /WHEN\s+([^\s]+)\s+THEN\s+([^\s]+)/gi;
      let match;
      while ((match = whenRegex.exec(caseBody)) !== null) {
        const whenVal = this.parseValue(match[1]);
        if (operand == whenVal) {
          return this.parseValue(match[2]);
        }
      }
    } else {
      const whenRegex = /WHEN\s+(.+?)\s+THEN\s+([^\s]+)/gi;
      let match;
      while ((match = whenRegex.exec(caseBody)) !== null) {
        if (this.evaluateWhere(match[1], row)) {
          return this.parseValue(match[2]);
        }
      }
    }
    const elseMatch = caseBody.match(/ELSE\s+([^\s]+)\s*$/i);
    if (elseMatch) {
      return this.parseValue(elseMatch[1]);
    }
    
    return null;
  }

  private evaluateWhere(whereStr: string, row: Record<string, any>, tables?: Map<string, LocalTable>): boolean {
    const matchAgainstMatch = whereStr.match(/MATCH\s*\(([^)]+)\)\s*AGAINST\s*\(['"]([^'"]+)['"](?:\s+IN\s+(NATURAL\s+LANGUAGE|BOOLEAN)\s+MODE)?\)/i);
    if (matchAgainstMatch) {
      const [fullMatch, columnsStr, searchQuery, mode] = matchAgainstMatch;
      const columns = columnsStr.split(',').map(c => c.trim());
      const searchMode = mode?.toUpperCase().includes('BOOLEAN') ? 'BOOLEAN' : 'NATURAL';
      if (tables) {
        for (const table of tables.values()) {
          const hasAllColumns = columns.every(c => table.schema.columns.some(col => col.name === c));
          if (hasAllColumns && table.fulltextIndexes.size > 0) {
            try {
              const rowIndex = table.rows.findIndex(r => 
                Object.keys(row).every(k => r[k] === row[k])
              );
              if (rowIndex !== -1) {
                const results = table.fulltextSearch(columns, searchQuery, searchMode);
                const matchResult = results.some(r => r.rowIndex === rowIndex);
                const restWhere = whereStr.replace(fullMatch, matchResult ? '1=1' : '1=0');
                if (restWhere.trim() !== (matchResult ? '1=1' : '1=0')) {
                  return this.evaluateWhere(restWhere, row, tables);
                }
                return matchResult;
              }
            } catch {
            }
          }
        }
      }
      const searchWords = searchQuery.toLowerCase().split(/\s+/).filter(w => w.length > 1);
      const rowText = columns.map(c => String(row[c] || '')).join(' ').toLowerCase();
      const matchResult = searchWords.some(word => rowText.includes(word));
      const restWhere = whereStr.replace(fullMatch, matchResult ? '1=1' : '1=0');
      if (restWhere.trim() !== (matchResult ? '1=1' : '1=0')) {
        return this.evaluateWhere(restWhere, row, tables);
      }
      return matchResult;
    }
    const inMatch = whereStr.match(/(\w+)\s+IN\s*\(([^)]+)\)/i);
    if (inMatch) {
      const [fullMatch, col, valuesList] = inMatch;
      const values = valuesList.split(',').map(v => this.parseValue(v.trim()));
      const rowVal = row[col];
      const inResult = values.some(v => rowVal == v);
      const restWhere = whereStr.replace(fullMatch, inResult ? '1=1' : '1=0');
      if (restWhere.trim() !== (inResult ? '1=1' : '1=0')) {
        return this.evaluateWhere(restWhere, row, tables);
      }
      return inResult;
    }
    const notInMatch = whereStr.match(/(\w+)\s+NOT\s+IN\s*\(([^)]+)\)/i);
    if (notInMatch) {
      const [fullMatch, col, valuesList] = notInMatch;
      const values = valuesList.split(',').map(v => this.parseValue(v.trim()));
      const rowVal = row[col];
      const notInResult = !values.some(v => rowVal == v);
      const restWhere = whereStr.replace(fullMatch, notInResult ? '1=1' : '1=0');
      if (restWhere.trim() !== (notInResult ? '1=1' : '1=0')) {
        return this.evaluateWhere(restWhere, row, tables);
      }
      return notInResult;
    }
    const betweenMatch = whereStr.match(/(\w+)\s+BETWEEN\s+(\S+)\s+AND\s+(\S+)/i);
    if (betweenMatch) {
      const [fullMatch, col, minStr, maxStr] = betweenMatch;
      const val = row[col];
      const min = this.parseValue(minStr);
      const max = this.parseValue(maxStr);
      const betweenResult = val >= min && val <= max;
      const restWhere = whereStr.replace(fullMatch, betweenResult ? '1=1' : '1=0');
      if (restWhere.trim() !== (betweenResult ? '1=1' : '1=0')) {
        return this.evaluateWhere(restWhere, row, tables);
      }
      return betweenResult;
    }

    if (/\s+AND\s+/i.test(whereStr)) {
      const parts = whereStr.split(/\s+AND\s+/i);
      return parts.every(p => this.evaluateWhere(p, row, tables));
    }
    if (/\s+OR\s+/i.test(whereStr)) {
      const parts = whereStr.split(/\s+OR\s+/i);
      return parts.some(p => this.evaluateWhere(p, row, tables));
    }

    const isNullMatch = whereStr.match(/([\w.]+)\s+IS\s+NULL/i);
    if (isNullMatch) return row[isNullMatch[1]] === null || row[isNullMatch[1]] === undefined;

    const isNotNullMatch = whereStr.match(/([\w.]+)\s+IS\s+NOT\s+NULL/i);
    if (isNotNullMatch) return row[isNotNullMatch[1]] !== null && row[isNotNullMatch[1]] !== undefined;

    const likeMatch = whereStr.match(/([\w.]+)\s+LIKE\s+['"]([^'"]+)['"]/i);
    if (likeMatch) {
      const [, col, pattern] = likeMatch;
      const regex = new RegExp('^' + pattern.replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i');
      return regex.test(String(row[col] ?? ''));
    }

    const notLikeMatch = whereStr.match(/([\w.]+)\s+NOT\s+LIKE\s+['"]([^'"]+)['"]/i);
    if (notLikeMatch) {
      const [, col, pattern] = notLikeMatch;
      const regex = new RegExp('^' + pattern.replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i');
      return !regex.test(String(row[col] ?? ''));
    }
    const regexpMatch = whereStr.match(/([\w.]+)\s+REGEXP\s+['"]([^'"]+)['"]/i);
    if (regexpMatch) {
      const [, col, pattern] = regexpMatch;
      try {
        const regex = new RegExp(pattern);
        return regex.test(String(row[col] ?? ''));
      } catch {
        return false;
      }
    }
    const notRegexpMatch = whereStr.match(/([\w.]+)\s+NOT\s+REGEXP\s+['"]([^'"]+)['"]/i);
    if (notRegexpMatch) {
      const [, col, pattern] = notRegexpMatch;
      try {
        const regex = new RegExp(pattern);
        return !regex.test(String(row[col] ?? ''));
      } catch {
        return false;
      }
    }
    const funcCmpMatch = whereStr.match(/(\w+\s*\([^)]+\))\s*(=|!=|<>|<=|>=|<|>)\s*(['"]?)([^'"]+)\3/i);
    if (funcCmpMatch) {
      const [, funcExpr, op, , valStr] = funcCmpMatch;
      const funcResult = this.evaluateSQLFunction(funcExpr, row);
      if (funcResult !== undefined) {
        let cmpVal: any = valStr;
        if (valStr.toUpperCase() === 'NULL') cmpVal = null;
        else if (valStr.toUpperCase() === 'TRUE') cmpVal = true;
        else if (valStr.toUpperCase() === 'FALSE') cmpVal = false;
        else if (!isNaN(Number(valStr))) cmpVal = Number(valStr);

        switch (op) {
          case '=': return funcResult == cmpVal;
          case '!=':
          case '<>': return funcResult != cmpVal;
          case '<': return funcResult < cmpVal;
          case '>': return funcResult > cmpVal;
          case '<=': return funcResult <= cmpVal;
          case '>=': return funcResult >= cmpVal;
        }
      }
    }
    const colCmpMatch = whereStr.match(/([\w.]+)\s*(=|!=|<>|<=|>=|<|>)\s*([\w.]+)/);
    if (colCmpMatch) {
      const [, leftCol, op, rightCol] = colCmpMatch;
      let leftVal = row[leftCol];
      let rightVal = row[rightCol];
      if (leftVal === undefined) {
        leftVal = this.parseValue(leftCol);
      }
      if (rightVal === undefined) {
        rightVal = this.parseValue(rightCol);
      }

      switch (op) {
        case '=': return leftVal == rightVal;
        case '!=':
        case '<>': return leftVal != rightVal;
        case '<': return leftVal < rightVal;
        case '>': return leftVal > rightVal;
        case '<=': return leftVal <= rightVal;
        case '>=': return leftVal >= rightVal;
      }
    }

    const cmpMatch = whereStr.match(/([\w.]+)\s*(=|!=|<>|<=|>=|<|>)\s*(['"]?)([^'"]+)\3/);
    if (cmpMatch) {
      const [, col, op, , valStr] = cmpMatch;
      const rowVal = row[col];
      let cmpVal: any = valStr;
      if (valStr.toUpperCase() === 'NULL') cmpVal = null;
      else if (valStr.toUpperCase() === 'TRUE') cmpVal = true;
      else if (valStr.toUpperCase() === 'FALSE') cmpVal = false;
      else if (!isNaN(Number(valStr))) cmpVal = Number(valStr);

      switch (op) {
        case '=': return rowVal == cmpVal;
        case '!=':
        case '<>': return rowVal != cmpVal;
        case '<': return rowVal < cmpVal;
        case '>': return rowVal > cmpVal;
        case '<=': return rowVal <= cmpVal;
        case '>=': return rowVal >= cmpVal;
      }
    }
    return true;
  }

  private executeUpdate(sql: string): QueryResult {
    const match = sql.match(/UPDATE\s+[`"]?(\w+)[`"]?\s+SET\s+([\s\S]+?)(?:\s+WHERE\s+([\s\S]+))?$/i);
    if (!match) return { success: false, error: 'Invalid UPDATE syntax', executionTime: 0 };

    const [, tableName, setStr, whereStr] = match;
    const table = this.tables.get(tableName);
    if (!table) return { success: false, error: `Table '${tableName}' doesn't exist`, executionTime: 0 };

    const updates: Record<string, any> = {};
    const setParts = setStr.split(',');
    for (const part of setParts) {
      const m = part.match(/(\w+)\s*=\s*(['"]?)([^'"]*)\2/);
      if (m) updates[m[1]] = this.parseValue(m[3] || m[2] + m[3] + m[2]);
    }

    let count = 0;
    for (const row of table.rows) {
      if (!whereStr || this.evaluateWhere(whereStr, row, this.tables)) {
        const newRow = { ...row, ...updates };
        const fkError = this.validateForeignKeys(newRow, table.schema);
        if (fkError) {
          return { success: false, error: fkError, executionTime: 0 };
        }
        const uniqueError = this.validateUniqueConstraintsForUpdate(updates, row, table);
        if (uniqueError) {
          return { success: false, error: uniqueError, executionTime: 0 };
        }
        
        for (const [key, value] of Object.entries(updates)) row[key] = value;
        count++;
      }
    }
    return { success: true, affectedRows: count, executionTime: 0 };
  }

  private validateUniqueConstraintsForUpdate(updates: Record<string, any>, currentRow: Record<string, any>, table: LocalTable): string | null {
    for (const col of table.schema.columns) {
      if ((col.unique || col.primaryKey) && updates[col.name] !== undefined) {
        const newValue = updates[col.name];
        if (newValue === null) continue;
        
        const exists = table.rows.some(r => r !== currentRow && r[col.name] == newValue);
        if (exists) {
          return `Duplicate entry '${newValue}' for key '${col.name}'`;
        }
      }
    }
    return null;
  }

  private executeDelete(sql: string): QueryResult {
    const match = sql.match(/DELETE\s+FROM\s+[`"]?(\w+)[`"]?(?:\s+WHERE\s+([\s\S]+))?$/i);
    if (!match) return { success: false, error: 'Invalid DELETE syntax', executionTime: 0 };

    const [, tableName, whereStr] = match;
    const table = this.tables.get(tableName);
    if (!table) return { success: false, error: `Table '${tableName}' doesn't exist`, executionTime: 0 };
    const rowsToDelete = whereStr 
      ? table.rows.filter(row => this.evaluateWhere(whereStr, row, this.tables))
      : [...table.rows];
    for (const row of rowsToDelete) {
      const fkError = this.checkChildReferencesOnDelete(tableName, row);
      if (fkError) {
        return { success: false, error: fkError, executionTime: 0 };
      }
    }

    const initialCount = table.rows.length;
    if (whereStr) table.rows = table.rows.filter(row => !this.evaluateWhere(whereStr, row, this.tables));
    else table.rows = [];

    return { success: true, affectedRows: initialCount - table.rows.length, executionTime: 0 };
  }

  private checkChildReferencesOnDelete(tableName: string, row: Record<string, any>): string | null {
    for (const [childName, childTable] of this.tables) {
      if (childName === tableName) continue;
      
      for (const col of childTable.schema.columns) {
        if (col.references?.table === tableName) {
          const refColumn = col.references.column;
          const pkValue = row[refColumn];
          
          if (pkValue === undefined || pkValue === null) continue;
          
          const childRows = childTable.rows.filter(r => r[col.name] == pkValue);
          
          if (childRows.length > 0) {
            return `Foreign key constraint failed: Cannot delete from '${tableName}' ` +
                   `because value '${pkValue}' is referenced by '${childName}.${col.name}'`;
          }
        }
      }
    }
    return null;
  }

  getTableNames(): string[] {
    return Array.from(this.tables.keys());
  }

  getTableSchema(name: string): TableSchema | undefined {
    return this.tables.get(name)?.schema;
  }

  getTableData(name: string): any[] {
    return this.tables.get(name)?.rows || [];
  }
}

class LocalTable {
  name: string;
  schema!: TableSchema;
  rows: Record<string, any>[] = [];
  autoIncrementId: number = 1;
  indexStats: Map<string, IndexStatistics> = new Map();
  fulltextIndexes: Map<string, FulltextIndex> = new Map();
  partitionInfo?: PartitionInfo;
  partitions: Map<string, Record<string, any>[]> = new Map();

  constructor(name: string) {
    this.name = name;
  }

  loadFromData(data: any) {
    this.schema = data.schema;
    this.rows = data.rows || [];
    this.autoIncrementId = data.autoIncrementId || 1;
    if (data.indexStats) {
      this.indexStats = new Map(Object.entries(data.indexStats));
    }
    if (data.fulltextIndexes) {
      for (const [name, idx] of Object.entries(data.fulltextIndexes) as any) {
        this.fulltextIndexes.set(name, {
          ...idx,
          tokens: new Map(Object.entries(idx.tokens || {}))
        });
      }
    }
    if (data.partitionInfo) {
      this.partitionInfo = data.partitionInfo;
      if (data.partitions) {
        this.partitions = new Map(Object.entries(data.partitions));
      }
    }
  }

  toData(): any {
    const fulltextIndexesData: any = {};
    for (const [name, idx] of this.fulltextIndexes) {
      fulltextIndexesData[name] = {
        ...idx,
        tokens: Object.fromEntries(idx.tokens)
      };
    }
    
    return { 
      schema: this.schema, 
      rows: this.rows, 
      autoIncrementId: this.autoIncrementId,
      indexStats: Object.fromEntries(this.indexStats),
      fulltextIndexes: fulltextIndexesData,
      partitionInfo: this.partitionInfo,
      partitions: this.partitions.size > 0 ? Object.fromEntries(this.partitions) : undefined
    };
  }
  updateIndexStats(): void {
    for (const idx of (this.schema.indexes || [])) {
      const stats = this.calculateIndexStats(idx);
      this.indexStats.set(idx.name, stats);
    }
  }
  
  private calculateIndexStats(idx: { name: string; columns: string[]; unique?: boolean }): IndexStatistics {
    const uniqueValues = new Set<string>();
    let nullCount = 0;
    
    for (const row of this.rows) {
      const key = idx.columns.map(c => row[c]).join('|||');
      if (idx.columns.some(c => row[c] === null || row[c] === undefined)) {
        nullCount++;
      } else {
        uniqueValues.add(key);
      }
    }
    
    return {
      indexName: idx.name,
      columns: idx.columns,
      cardinality: uniqueValues.size,
      nullCount,
      avgKeyLength: idx.columns.length,
      totalRows: this.rows.length,
      unique: idx.unique || false,
      lastAnalyzed: new Date().toISOString()
    };
  }
  createFulltextIndex(name: string, columns: string[]): void {
    const ftIdx: FulltextIndex = {
      name,
      columns,
      tokens: new Map(),
      createdAt: new Date().toISOString()
    };
    this.rows.forEach((row, rowIdx) => {
      for (const col of columns) {
        const text = String(row[col] || '');
        const words = this.tokenize(text);
        for (const word of words) {
          if (!ftIdx.tokens.has(word)) {
            ftIdx.tokens.set(word, []);
          }
          ftIdx.tokens.get(word)!.push(rowIdx);
        }
      }
    });
    
    this.fulltextIndexes.set(name, ftIdx);
  }
  
  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^\w\s\u0400-\u04FF]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1);
  }
  fulltextSearch(columns: string[], query: string, mode: 'NATURAL' | 'BOOLEAN' = 'NATURAL'): { rowIndex: number; score: number }[] {
    let ftIdx: FulltextIndex | undefined;
    for (const idx of this.fulltextIndexes.values()) {
      if (columns.every(c => idx.columns.includes(c))) {
        ftIdx = idx;
        break;
      }
    }
    
    if (!ftIdx) {
      throw new Error(`No FULLTEXT index found for columns: ${columns.join(', ')}`);
    }
    
    const searchWords = this.tokenize(query);
    const scores = new Map<number, number>();
    
    if (mode === 'BOOLEAN') {
      const mustHave: string[] = [];
      const mustNotHave: string[] = [];
      const optional: string[] = [];
      
      for (const word of query.split(/\s+/)) {
        if (word.startsWith('+')) mustHave.push(word.slice(1).toLowerCase());
        else if (word.startsWith('-')) mustNotHave.push(word.slice(1).toLowerCase());
        else if (word.length > 1) optional.push(word.toLowerCase());
      }
      
      for (let i = 0; i < this.rows.length; i++) {
        let valid = true;
        let score = 0;
        for (const word of mustHave) {
          if (!ftIdx.tokens.get(word)?.includes(i)) {
            valid = false;
            break;
          }
          score += 2;
        }
        if (valid) {
          for (const word of mustNotHave) {
            if (ftIdx.tokens.get(word)?.includes(i)) {
              valid = false;
              break;
            }
          }
        }
        if (valid) {
          for (const word of optional) {
            if (ftIdx.tokens.get(word)?.includes(i)) {
              score += 1;
            }
          }
          if (score > 0 || mustHave.length > 0) {
            scores.set(i, score);
          }
        }
      }
    } else {
      for (const word of searchWords) {
        const rowIndexes = ftIdx.tokens.get(word) || [];
        for (const idx of rowIndexes) {
          scores.set(idx, (scores.get(idx) || 0) + 1);
        }
      }
    }
    
    return Array.from(scores.entries())
      .map(([rowIndex, score]) => ({ rowIndex, score }))
      .sort((a, b) => b.score - a.score);
  }
  setupPartitioning(info: PartitionInfo): void {
    this.partitionInfo = info;
    this.redistributeRows();
  }
  
  private redistributeRows(): void {
    if (!this.partitionInfo) return;
    
    this.partitions.clear();
    
    for (const p of this.partitionInfo.partitions) {
      this.partitions.set(p.name, []);
    }
    
    for (const row of this.rows) {
      const partitionName = this.getPartitionForRow(row);
      if (partitionName && this.partitions.has(partitionName)) {
        this.partitions.get(partitionName)!.push(row);
      }
    }
  }
  
  private getPartitionForRow(row: Record<string, any>): string | null {
    if (!this.partitionInfo) return null;
    
    const value = row[this.partitionInfo.column];
    
    switch (this.partitionInfo.type) {
      case 'RANGE':
        for (const p of this.partitionInfo.partitions) {
          if (p.lessThan !== undefined) {
            if (p.lessThan === 'MAXVALUE' || value < p.lessThan) {
              return p.name;
            }
          }
        }
        break;
        
      case 'LIST':
        for (const p of this.partitionInfo.partitions) {
          if (p.values?.includes(value)) {
            return p.name;
          }
        }
        break;
        
      case 'HASH':
        const hash = this.hashValue(value);
        const partCount = this.partitionInfo.partitions.length;
        const idx = Math.abs(hash) % partCount;
        return this.partitionInfo.partitions[idx]?.name || null;
    }
    
    return null;
  }
  
  private hashValue(value: any): number {
    const str = String(value);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }
  
  getPartitionedRows(partitionName?: string): Record<string, any>[] {
    if (!this.partitionInfo || !partitionName) return this.rows;
    return this.partitions.get(partitionName) || [];
  }
}
interface IndexStatistics {
  indexName: string;
  columns: string[];
  cardinality: number;
  nullCount: number;
  avgKeyLength: number;
  totalRows: number;
  unique: boolean;
  lastAnalyzed: string;
}
interface FulltextIndex {
  name: string;
  columns: string[];
  tokens: Map<string, number[]>;
  createdAt: string;
}
interface PartitionInfo {
  type: 'RANGE' | 'LIST' | 'HASH';
  column: string;
  partitions: PartitionDefinition[];
}

interface PartitionDefinition {
  name: string;
  lessThan?: number | string | 'MAXVALUE';
  values?: any[];
}
interface QueryPlan {
  operation: string;
  table?: string;
  type: 'ALL' | 'INDEX' | 'RANGE' | 'REF' | 'CONST' | 'SYSTEM';
  possibleKeys?: string[];
  key?: string;
  keyLen?: number;
  rows: number;
  filtered: number;
  extra?: string[];
  children?: QueryPlan[];
  cost?: number;
  actualTime?: number;
  actualRows?: number;
}
interface BackupInfo {
  id: string;
  timestamp: string;
  type: 'full' | 'incremental' | 'schema';
  size: number;
  databases: string[];
  compressed: boolean;
}

interface WALEntry {
  id: number;
  timestamp: string;
  operation: string;
  sql: string;
  database: string;
}

const localDB = new LocalDatabase();
if (!localStorage.getItem('mycsc_start_time')) {
  localStorage.setItem('mycsc_start_time', Date.now().toString());
}

export const dbAPI = {
  async query(sql: string): Promise<QueryResult> {
    const count = parseInt(localStorage.getItem('mycsc_query_count') || '0');
    localStorage.setItem('mycsc_query_count', (count + 1).toString());
    return localDB.query(sql);
  },

  async queryMultiple(sql: string): Promise<QueryResult[]> {
    return localDB.queryMultiple(sql);
  },

  async getTables(): Promise<string[]> {
    return localDB.getTables();
  },

  async getTableSchema(tableName: string): Promise<TableSchema | undefined> {
    return localDB.getTableSchema(tableName);
  },

  async getCurrentDatabase(): Promise<string> {
    return localDB.getCurrentDatabase();
  },

  getDatabases(): Array<{ name: string; tables: number; size: string }> {
    return localDB.getDatabases();
  },

  getTableData(tableName: string): any[] {
    return localDB.getCurrentDB().getTableData(tableName);
  },

  getViews(): Array<{ name: string; definition: string; createdAt: string }> {
    return localDB.getViews();
  },

  getProcedures(): Array<{ name: string; definition: string; parameters: string[]; createdAt: string }> {
    return localDB.getProcedures();
  },

  getFunctions(): Array<{ name: string; definition: string; parameters: string[]; returnType: string; createdAt: string }> {
    return localDB.getFunctions();
  },

  isElectron: false,

  auth: {
    async login(username: string, password: string): Promise<{ success: boolean; sessionId?: string; error?: string }> {
      const users = JSON.parse(localStorage.getItem('mycsc_users') || '{}');
      if (users[username]) {
        if (users[username].password === password) {
          const sessionId = 'session-' + Date.now();
          localStorage.setItem('mycsc_session', JSON.stringify({ username, sessionId }));
          return { success: true, sessionId };
        }
        return { success: false, error: '�������� ������' };
      }
      if (username === 'demo' && password === 'demo123') {
        const sessionId = 'demo-session-' + Date.now();
        localStorage.setItem('mycsc_session', JSON.stringify({ username, sessionId }));
        return { success: true, sessionId };
      }
      return { success: false, error: '������������ �� ������' };
    },

    async register(username: string, password: string): Promise<{ success: boolean; error?: string }> {
      if (!username || username.length < 3) return { success: false, error: '��� ������������ ������ ���� �� ����� 3 ��������' };
      if (!password || password.length < 6) return { success: false, error: '������ ������ ���� �� ����� 6 ��������' };
      const users = JSON.parse(localStorage.getItem('mycsc_users') || '{}');
      if (users[username]) return { success: false, error: '������������ ��� ����������' };
      users[username] = { password, createdAt: new Date().toISOString() };
      localStorage.setItem('mycsc_users', JSON.stringify(users));
      return { success: true };
    },

    async logout(): Promise<void> {
      localStorage.removeItem('mycsc_session');
    },

    getSession(): { username: string; sessionId: string } | null {
      const session = localStorage.getItem('mycsc_session');
      return session ? JSON.parse(session) : null;
    }
  }
};
