export enum DataType {
  TINYINT = 'TINYINT',
  SMALLINT = 'SMALLINT',
  INTEGER = 'INTEGER',
  BIGINT = 'BIGINT',
  FLOAT = 'FLOAT',
  DOUBLE = 'DOUBLE',
  DECIMAL = 'DECIMAL',
  CHAR = 'CHAR',
  VARCHAR = 'VARCHAR',
  TEXT = 'TEXT',
  MEDIUMTEXT = 'MEDIUMTEXT',
  LONGTEXT = 'LONGTEXT',
  BINARY = 'BINARY',
  VARBINARY = 'VARBINARY',
  BLOB = 'BLOB',
  MEDIUMBLOB = 'MEDIUMBLOB',
  LONGBLOB = 'LONGBLOB',
  DATE = 'DATE',
  TIME = 'TIME',
  DATETIME = 'DATETIME',
  TIMESTAMP = 'TIMESTAMP',
  YEAR = 'YEAR',
  BOOLEAN = 'BOOLEAN',
  JSON = 'JSON',
  UUID = 'UUID',
  ENUM = 'ENUM',
  SET = 'SET'
}

export enum ConstraintType {
  PRIMARY_KEY = 'PRIMARY_KEY',
  FOREIGN_KEY = 'FOREIGN_KEY',
  UNIQUE = 'UNIQUE',
  NOT_NULL = 'NOT_NULL',
  CHECK = 'CHECK',
  DEFAULT = 'DEFAULT'
}

export enum RelationType {
  ONE_TO_ONE = 'ONE_TO_ONE',       // 1:1
  ONE_TO_MANY = 'ONE_TO_MANY',     // 1:N
  MANY_TO_MANY = 'MANY_TO_MANY'
}

export type ReferentialAction = 'CASCADE' | 'SET NULL' | 'SET DEFAULT' | 'RESTRICT' | 'NO ACTION';

export interface ForeignKeyReference {
  name?: string;
  table: string;
  column: string;
  onDelete: ReferentialAction;
  onUpdate: ReferentialAction;
}

export interface CheckConstraint {
  name: string;
  expression: string;
}

export interface ColumnDefinition {
  name: string;
  type: DataType;
  length?: number;
  precision?: number;
  scale?: number;
  nullable: boolean;
  defaultValue?: any;
  primaryKey: boolean;
  unique: boolean;
  autoIncrement: boolean;
  references?: ForeignKeyReference;
  check?: CheckConstraint;
  comment?: string;
  enumValues?: string[];
}

export enum IndexType {
  BTREE = 'BTREE',
  HASH = 'HASH',
  FULLTEXT = 'FULLTEXT',
  SPATIAL = 'SPATIAL'
}

export interface IndexDefinition {
  name: string;
  columns: string[];
  unique: boolean;
  type: IndexType;
  comment?: string;
}

export interface TableRelation {
  id: string;
  name: string;
  type: RelationType;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  junctionTable?: string;
  onDelete: ReferentialAction;
  onUpdate: ReferentialAction;
}

export interface TableSchema {
  name: string;
  columns: ColumnDefinition[];
  indexes: IndexDefinition[];
  primaryKey: string[];
  foreignKeys: ForeignKeyReference[];
  relations: TableRelation[];
  comment?: string;
  engine?: 'InnoDB' | 'MyISAM' | 'Memory';
  charset?: string;
  collation?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatabaseSchema {
  name: string;
  tables: Map<string, TableSchema>;
  charset?: string;
  collation?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'user' | 'readonly';
  createdAt: Date;
  lastLogin?: Date;
  databases: string[];
  oauthProvider?: 'google' | 'github';
  oauthProviderId?: string;
  avatar?: string;
  emailVerified?: boolean;
  verificationCode?: string;
  verificationCodeExpires?: Date;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export type Row = Record<string, any>;

export interface QueryResult {
  success: boolean;
  rows?: Row[];
  affectedRows?: number;
  insertId?: number;
  error?: string;
  executionTime: number;
  columns?: string[];
  warnings?: string[];
  errorLine?: number;
  errorPosition?: number;
  query?: string;
}

export enum SQLOperation {
  SELECT = 'SELECT',
  INSERT = 'INSERT',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  CREATE_TABLE = 'CREATE_TABLE',
  DROP_TABLE = 'DROP_TABLE',
  ALTER_TABLE = 'ALTER_TABLE',
  CREATE_INDEX = 'CREATE_INDEX',
  DROP_INDEX = 'DROP_INDEX',
  CREATE_DATABASE = 'CREATE_DATABASE',
  DROP_DATABASE = 'DROP_DATABASE',
  USE = 'USE',
  BEGIN = 'BEGIN',
  COMMIT = 'COMMIT',
  ROLLBACK = 'ROLLBACK',
  TRUNCATE = 'TRUNCATE',
  SAVEPOINT = 'SAVEPOINT',
  RELEASE_SAVEPOINT = 'RELEASE_SAVEPOINT',
  CREATE_TRIGGER = 'CREATE_TRIGGER',
  DROP_TRIGGER = 'DROP_TRIGGER',
  CREATE_USER = 'CREATE_USER',
  DROP_USER = 'DROP_USER',
  ALTER_USER = 'ALTER_USER',
  GRANT = 'GRANT',
  REVOKE = 'REVOKE',
  CREATE_ROLE = 'CREATE_ROLE',
  DROP_ROLE = 'DROP_ROLE'
}

export interface SQLStatement {
  type: SQLOperation;
  raw: string;
}

export interface SelectColumn {
  expression: string;
  alias?: string;
  aggregate?: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'GROUP_CONCAT';
  distinct?: boolean;
  windowFunction?: WindowFunction;
  caseExpression?: CaseExpression;
}

export interface WindowFunction {
  type: 'ROW_NUMBER' | 'RANK' | 'DENSE_RANK' | 'NTILE' | 'LEAD' | 'LAG' | 'FIRST_VALUE' | 'LAST_VALUE' | 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX';
  partitionBy?: string[];
  orderBy?: OrderByClause[];
  argument?: string;
  offset?: number;
  defaultValue?: any;
}

export interface CaseExpression {
  operand?: string;
  whenClauses: Array<{
    condition: WhereCondition | any;
    result: any;
  }>;
  elseResult?: any;
}

export type SetOperationType = 'UNION' | 'UNION ALL' | 'INTERSECT' | 'EXCEPT';

export interface SetOperation {
  type: SetOperationType;
  select: SelectStatement;
}

export interface TableReference {
  table: string;
  alias?: string;
  database?: string;
  subquery?: SelectStatement;
}

export interface JoinClause {
  type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' | 'CROSS';
  table: TableReference;
  on?: WhereCondition;
  using?: string[];
}

export interface WhereCondition {
  type: 'AND' | 'OR' | 'NOT' | 'COMPARISON' | 'IN' | 'BETWEEN' | 'LIKE' | 'IS_NULL' | 'IS_NOT_NULL' | 'EXISTS' | 'NOT_EXISTS' | 'SUBQUERY' | 'IN_SUBQUERY' | 'NOT_IN_SUBQUERY' | 'SCALAR_SUBQUERY' | 'REGEXP' | 'NOT_REGEXP' | 'CASE';
  left?: WhereCondition | string;
  right?: WhereCondition | string | any[];
  operator?: '=' | '!=' | '<>' | '<' | '>' | '<=' | '>=' | 'LIKE' | 'NOT LIKE' | 'REGEXP' | 'NOT REGEXP' | 'ANY' | 'ALL';
  value?: any;
  subquery?: SelectStatement;
  correlatedColumn?: string;
  caseExpression?: CaseExpression;
}

export interface OrderByClause {
  column: string;
  direction: 'ASC' | 'DESC';
  nullsFirst?: boolean;
}

export interface GroupByClause {
  columns: string[];
  having?: WhereCondition;
}

export interface SelectStatement extends SQLStatement {
  type: SQLOperation.SELECT;
  distinct?: boolean;
  columns: SelectColumn[];
  from: TableReference;
  joins?: JoinClause[];
  where?: WhereCondition;
  groupBy?: GroupByClause;
  orderBy?: OrderByClause[];
  limit?: number;
  offset?: number;
  forUpdate?: boolean;
  setOperations?: SetOperation[];
}

export interface InsertStatement extends SQLStatement {
  type: SQLOperation.INSERT;
  table: string;
  columns: string[];
  values: any[][];
  onDuplicateKey?: Record<string, any>;
  ignore?: boolean;
}

export interface UpdateStatement extends SQLStatement {
  type: SQLOperation.UPDATE;
  table: string;
  set: Record<string, any>;
  where?: WhereCondition;
  orderBy?: OrderByClause[];
  limit?: number;
}

export interface DeleteStatement extends SQLStatement {
  type: SQLOperation.DELETE;
  table: string;
  where?: WhereCondition;
  orderBy?: OrderByClause[];
  limit?: number;
}

export interface CreateTableStatement extends SQLStatement {
  type: SQLOperation.CREATE_TABLE;
  table: string;
  columns: ColumnDefinition[];
  ifNotExists: boolean;
  engine?: string;
  charset?: string;
}

export interface DropTableStatement extends SQLStatement {
  type: SQLOperation.DROP_TABLE;
  table: string;
  ifExists: boolean;
}

export interface AlterTableStatement extends SQLStatement {
  type: SQLOperation.ALTER_TABLE;
  table: string;
  operations: AlterOperation[];
}

export interface AlterOperation {
  type: 'ADD_COLUMN' | 'DROP_COLUMN' | 'MODIFY_COLUMN' | 'RENAME_COLUMN' | 
        'ADD_INDEX' | 'DROP_INDEX' | 'ADD_FOREIGN_KEY' | 'DROP_FOREIGN_KEY' |
        'RENAME_TABLE' | 'ADD_PRIMARY_KEY' | 'DROP_PRIMARY_KEY' |
        'ADD_CONSTRAINT' | 'DROP_CONSTRAINT' | 'SET_DEFAULT' | 'DROP_DEFAULT';
  column?: ColumnDefinition;
  oldName?: string;
  newName?: string;
  index?: IndexDefinition;
  foreignKey?: ForeignKeyReference;
  constraint?: ConstraintDefinition;
  defaultValue?: any;
}

export type TriggerTiming = 'BEFORE' | 'AFTER';
export type TriggerEvent = 'INSERT' | 'UPDATE' | 'DELETE';

export interface TriggerDefinition {
  name: string;
  table: string;
  timing: TriggerTiming;
  event: TriggerEvent;
  forEachRow: boolean;
  body: string;
  condition?: string;
  createdAt: Date;
}

export interface CreateTriggerStatement extends SQLStatement {
  type: SQLOperation.CREATE_TRIGGER;
  trigger: TriggerDefinition;
}

export type Privilege = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'CREATE' | 'DROP' | 'ALTER' | 'INDEX' | 'GRANT' | 'ALL';

export interface UserDefinition {
  username: string;
  password?: string;
  host?: string;
  roles: string[];
  privileges: Map<string, Privilege[]>;
  createdAt: Date;
  lastLogin?: Date;
  locked: boolean;
  maxConnections?: number;
}

export interface RoleDefinition {
  name: string;
  privileges: Map<string, Privilege[]>;
  createdAt: Date;
}

export interface GrantStatement extends SQLStatement {
  type: SQLOperation.GRANT;
  privileges: Privilege[];
  objectType: 'TABLE' | 'DATABASE' | 'ALL';
  objectName?: string;
  grantee: string;
  withGrantOption: boolean;
}

export interface RevokeStatement extends SQLStatement {
  type: SQLOperation.REVOKE;
  privileges: Privilege[];
  objectType: 'TABLE' | 'DATABASE' | 'ALL';
  objectName?: string;
  grantee: string;
}

export interface ConstraintDefinition {
  name: string;
  type: ConstraintType;
  columns?: string[];
  checkExpression?: string;
  foreignKey?: ForeignKeyReference;
}

export interface Transaction {
  id: string;
  startedAt: Date;
  operations: TransactionOperation[];
  status: 'active' | 'committed' | 'rolledback';
}

export interface TransactionOperation {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  data: Row | Row[];
  originalData?: Row | Row[];
}

export interface DatabaseConfig {
  dataDir: string;
  maxConnections: number;
  cacheSize: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableAuth: boolean;
  enableTransactions: boolean;
  autoCommit: boolean;
  queryTimeout: number;
  maxQuerySize: number;
}

export interface ExportOptions {
  format: 'sql' | 'json' | 'csv' | 'xml';
  tables?: string[];
  includeSchema: boolean;
  includeData: boolean;
  includeIndexes: boolean;
  includeForeignKeys: boolean;
  compress?: boolean;
}

export interface ImportOptions {
  format: 'sql' | 'json' | 'csv' | 'xml';
  table?: string;
  truncateFirst?: boolean;
  ignoreErrors?: boolean;
}

export interface ExportResult {
  success: boolean;
  data?: string;
  filename?: string;
  size?: number;
  error?: string;
}

export interface ImportResult {
  success: boolean;
  tablesImported: number;
  rowsImported: number;
  errors: string[];
}

export interface DatabaseEvent {
  type: 'query' | 'error' | 'connect' | 'disconnect' | 'transaction' | 'schema_change';
  timestamp: Date;
  data: any;
  userId?: string;
}

export interface BTreeNode<K, V> {
  keys: K[];
  values: V[];
  children: BTreeNode<K, V>[];
  isLeaf: boolean;
  parent?: BTreeNode<K, V>;
}

export interface BTreeIndex {
  name: string;
  column: string;
  order: number;
  root: BTreeNode<any, number[]>;
  unique: boolean;
}

export interface TableStatistics {
  tableName: string;
  rowCount: number;
  dataSize: number;
  indexSize: number;
  avgRowLength: number;
  createdAt: Date;
  updatedAt: Date;
  lastAnalyzed?: Date;
}

export interface QueryStatistics {
  query: string;
  executionTime: number;
  rowsExamined: number;
  rowsReturned: number;
  indexUsed?: string;
  timestamp: Date;
}
