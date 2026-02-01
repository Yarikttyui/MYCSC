export type TokenType =
  | 'SELECT' | 'FROM' | 'WHERE' | 'INSERT' | 'INTO' | 'VALUES' | 'UPDATE' | 'SET'
  | 'DELETE' | 'CREATE' | 'DROP' | 'ALTER' | 'TABLE' | 'DATABASE' | 'INDEX'
  | 'VIEW' | 'TRIGGER' | 'PROCEDURE' | 'FUNCTION'
  | 'JOIN' | 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' | 'OUTER' | 'CROSS' | 'ON'
  | 'AND' | 'OR' | 'NOT' | 'IN' | 'EXISTS' | 'BETWEEN' | 'LIKE' | 'REGEXP'
  | 'IS' | 'NULL' | 'TRUE' | 'FALSE'
  | 'AS' | 'DISTINCT' | 'ALL' | 'UNION' | 'INTERSECT' | 'EXCEPT'
  | 'ORDER' | 'BY' | 'ASC' | 'DESC' | 'LIMIT' | 'OFFSET'
  | 'GROUP' | 'HAVING' | 'CASE' | 'WHEN' | 'THEN' | 'ELSE' | 'END'
  | 'IF' | 'PRIMARY' | 'KEY' | 'FOREIGN' | 'REFERENCES' | 'UNIQUE'
  | 'DEFAULT' | 'AUTO_INCREMENT' | 'CHECK' | 'CONSTRAINT'
  | 'ADD' | 'MODIFY' | 'CHANGE' | 'COLUMN' | 'RENAME' | 'TO'
  | 'GRANT' | 'REVOKE' | 'ROLE' | 'USER' | 'IDENTIFIED'
  | 'BEGIN' | 'COMMIT' | 'ROLLBACK' | 'TRANSACTION' | 'SAVEPOINT'
  | 'EXPLAIN' | 'ANALYZE' | 'SHOW' | 'DESCRIBE' | 'USE'
  | 'PARTITION' | 'PARTITIONS' | 'RANGE' | 'LIST' | 'HASH'
  | 'FULLTEXT' | 'MATCH' | 'AGAINST' | 'NATURAL' | 'LANGUAGE' | 'MODE' | 'BOOLEAN'
  | 'OVER' | 'WINDOW' | 'ROWS' | 'PRECEDING' | 'FOLLOWING' | 'UNBOUNDED' | 'CURRENT' | 'ROW'
  | 'WITH' | 'RECURSIVE' | 'CASCADE' | 'RESTRICT' | 'NO' | 'ACTION'
  | 'TRUNCATE' | 'START' | 'RELEASE' | 'TABLES' | 'DATABASES' | 'COLUMNS' | 'INDEXES'
  | 'INT' | 'INTEGER' | 'TINYINT' | 'SMALLINT' | 'MEDIUMINT' | 'BIGINT'
  | 'FLOAT' | 'DOUBLE' | 'REAL' | 'DECIMAL' | 'NUMERIC'
  | 'VARCHAR' | 'CHAR' | 'TEXT' | 'TINYTEXT' | 'MEDIUMTEXT' | 'LONGTEXT'
  | 'BOOL' | 'BIT' | 'DATE' | 'DATETIME' | 'TIMESTAMP' | 'TIME' | 'YEAR'
  | 'JSON' | 'BLOB' | 'TINYBLOB' | 'MEDIUMBLOB' | 'LONGBLOB'
  | 'BINARY' | 'VARBINARY' | 'ENUM' | 'GEOMETRY' | 'POINT'
  | 'NUMBER' | 'STRING' | 'IDENTIFIER' | 'PARAMETER' | 'PLACEHOLDER'
  | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH' | 'PERCENT' | 'CARET'
  | 'EQ' | 'NEQ' | 'LT' | 'GT' | 'LTE' | 'GTE' | 'SPACESHIP'
  | 'CONCAT' | 'BIT_AND' | 'BIT_OR' | 'BIT_XOR' | 'BIT_NOT'
  | 'DOUBLE_PIPE' | 'LSHIFT' | 'RSHIFT'
  | 'LPAREN' | 'RPAREN' | 'LBRACKET' | 'RBRACKET' | 'LBRACE' | 'RBRACE'
  | 'COMMA' | 'DOT' | 'SEMICOLON' | 'COLON' | 'QUESTION'
  | 'BACKTICK'
  | 'TYPE' | 'STATUS' | 'NAME' | 'VALUE' | 'DATA' 
  | 'FIRST' | 'LAST' | 'NEXT' | 'OPEN' | 'CLOSE' | 'USING'
  | 'EOF' | 'NEWLINE' | 'COMMENT';

export interface Token {
  type: TokenType;
  value: string;
  position: number;
  line: number;
  column: number;
}

export interface SourceLocation {
  start: { line: number; column: number; offset: number };
  end: { line: number; column: number; offset: number };
}


export interface ASTLiteral {
  type: 'Literal';
  value: string | number | boolean | null;
  raw: string;
  dataType: 'string' | 'number' | 'boolean' | 'null' | 'date';
  loc?: SourceLocation;
}

export interface ASTIdentifier {
  type: 'Identifier';
  name: string;
  quoted?: boolean;
  loc?: SourceLocation;
}

export interface ASTColumnRef {
  type: 'ColumnRef';
  table?: string;
  column: string;
  alias?: string;
  loc?: SourceLocation;
}

export interface ASTTableRef {
  type: 'TableRef';
  database?: string;
  table: string;
  alias?: string;
  loc?: SourceLocation;
}

export interface ASTBinaryExpr {
  type: 'BinaryExpression';
  operator: string;
  left: ASTExpression;
  right: ASTExpression;
  loc?: SourceLocation;
}

export interface ASTUnaryExpr {
  type: 'UnaryExpression';
  operator: string;
  argument: ASTExpression;
  prefix: boolean;
  loc?: SourceLocation;
}

export interface ASTFunctionCall {
  type: 'FunctionCall';
  name: string;
  args: ASTExpression[];
  distinct?: boolean;
  over?: ASTWindowSpec;
  loc?: SourceLocation;
}

export interface ASTWindowSpec {
  partitionBy?: ASTExpression[];
  orderBy?: ASTOrderByItem[];
  frame?: ASTWindowFrame;
}

export interface ASTWindowFrame {
  type: 'ROWS' | 'RANGE' | 'GROUPS';
  start: ASTFrameBound;
  end?: ASTFrameBound;
}

export interface ASTFrameBound {
  type: 'UNBOUNDED_PRECEDING' | 'CURRENT_ROW' | 'UNBOUNDED_FOLLOWING' | 'PRECEDING' | 'FOLLOWING';
  value?: number;
}

export interface ASTCaseExpr {
  type: 'CaseExpression';
  discriminant?: ASTExpression;
  cases: Array<{ when: ASTExpression; then: ASTExpression }>;
  else?: ASTExpression;
  loc?: SourceLocation;
}

export interface ASTSubQuery {
  type: 'SubQuery';
  query: ASTSelectStmt;
  alias?: string;
  loc?: SourceLocation;
}

export interface ASTExprList {
  type: 'ExpressionList';
  expressions: ASTExpression[];
  loc?: SourceLocation;
}

export interface ASTBetweenExpr {
  type: 'BetweenExpression';
  value: ASTExpression;
  low: ASTExpression;
  high: ASTExpression;
  not?: boolean;
  loc?: SourceLocation;
}

export interface ASTInExpr {
  type: 'InExpression';
  value: ASTExpression;
  list: ASTExpression[] | ASTSubQuery;
  not?: boolean;
  loc?: SourceLocation;
}

export interface ASTLikeExpr {
  type: 'LikeExpression';
  value: ASTExpression;
  pattern: ASTExpression;
  escape?: string;
  not?: boolean;
  regexp?: boolean;
  loc?: SourceLocation;
}

export interface ASTIsNullExpr {
  type: 'IsNullExpression';
  value: ASTExpression;
  not?: boolean;
  loc?: SourceLocation;
}

export interface ASTExistsExpr {
  type: 'ExistsExpression';
  subquery: ASTSubQuery;
  not?: boolean;
  loc?: SourceLocation;
}

export interface ASTMatchAgainst {
  type: 'MatchAgainst';
  columns: ASTColumnRef[];
  against: ASTExpression;
  modifier?: 'NATURAL LANGUAGE MODE' | 'BOOLEAN MODE' | 'WITH QUERY EXPANSION';
  loc?: SourceLocation;
}

export type ASTExpression =
  | ASTLiteral
  | ASTIdentifier
  | ASTColumnRef
  | ASTBinaryExpr
  | ASTUnaryExpr
  | ASTFunctionCall
  | ASTCaseExpr
  | ASTSubQuery
  | ASTExprList
  | ASTBetweenExpr
  | ASTInExpr
  | ASTLikeExpr
  | ASTIsNullExpr
  | ASTExistsExpr
  | ASTMatchAgainst;


export interface ASTSelectItem {
  expression: ASTExpression;
  alias?: string;
  all?: boolean;
}

export interface ASTJoinClause {
  type: 'JoinClause';
  joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' | 'CROSS' | 'NATURAL';
  table: ASTTableRef | ASTSubQuery;
  on?: ASTExpression;
  using?: string[];
  loc?: SourceLocation;
}

export interface ASTOrderByItem {
  expression: ASTExpression;
  direction: 'ASC' | 'DESC';
  nulls?: 'FIRST' | 'LAST';
}

export interface ASTGroupByItem {
  expression: ASTExpression;
  withRollup?: boolean;
}


export interface ASTSelectStmt {
  type: 'SelectStatement';
  distinct?: boolean;
  columns: ASTSelectItem[];
  from?: ASTTableRef | ASTSubQuery;
  joins?: ASTJoinClause[];
  where?: ASTExpression;
  groupBy?: ASTGroupByItem[];
  having?: ASTExpression;
  orderBy?: ASTOrderByItem[];
  limit?: number;
  offset?: number;
  forUpdate?: boolean;
  loc?: SourceLocation;
}

export interface ASTInsertStmt {
  type: 'InsertStatement';
  table: ASTTableRef;
  columns?: string[];
  values?: ASTExpression[][];
  select?: ASTSelectStmt;
  onDuplicateKey?: Array<{ column: string; value: ASTExpression }>;
  ignore?: boolean;
  loc?: SourceLocation;
}

export interface ASTUpdateStmt {
  type: 'UpdateStatement';
  table: ASTTableRef;
  set: Array<{ column: string; value: ASTExpression }>;
  where?: ASTExpression;
  orderBy?: ASTOrderByItem[];
  limit?: number;
  loc?: SourceLocation;
}

export interface ASTDeleteStmt {
  type: 'DeleteStatement';
  table: ASTTableRef;
  where?: ASTExpression;
  orderBy?: ASTOrderByItem[];
  limit?: number;
  loc?: SourceLocation;
}

export interface ASTColumnDef {
  type: 'ColumnDefinition';
  name: string;
  dataType: string;
  length?: number;
  precision?: number;
  scale?: number;
  nullable?: boolean;
  defaultValue?: ASTExpression;
  primaryKey?: boolean;
  autoIncrement?: boolean;
  unique?: boolean;
  references?: {
    table: string;
    column: string;
    onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
    onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  };
  check?: ASTExpression;
  comment?: string;
  collation?: string;
  enumValues?: string[];
  loc?: SourceLocation;
}

export interface ASTTableConstraint {
  type: 'ConstraintDefinition';
  constraintType: 'PRIMARY_KEY' | 'UNIQUE' | 'FOREIGN_KEY' | 'CHECK';
  name?: string;
  columns?: string[];
  references?: {
    table: string;
    columns: string[];
    onDelete?: string;
    onUpdate?: string;
  };
  expression?: ASTExpression;
  loc?: SourceLocation;
}

export interface ASTPartitionSpec {
  type: 'RANGE' | 'LIST' | 'HASH' | 'KEY';
  columns?: string[];
  expression?: ASTExpression;
  partitions?: ASTPartitionDef[];
}

export interface ASTPartitionDef {
  name: string;
  values?: ASTExpression[];
  lessThan?: ASTExpression | 'MAXVALUE';
}

export interface ASTCreateTableStmt {
  type: 'CreateTableStatement';
  table: ASTTableRef;
  columns: ASTColumnDef[];
  constraints?: ASTTableConstraint[];
  ifNotExists?: boolean;
  engine?: string;
  charset?: string;
  collation?: string;
  comment?: string;
  partitionBy?: ASTPartitionSpec;
  as?: ASTSelectStmt;
  loc?: SourceLocation;
}

export interface ASTCreateDatabaseStmt {
  type: 'CreateDatabaseStatement';
  database: string;
  ifNotExists?: boolean;
  charset?: string;
  collation?: string;
  loc?: SourceLocation;
}

export interface ASTCreateIndexStmt {
  type: 'CreateIndexStatement';
  index: string;
  table: ASTTableRef;
  columns: Array<{ column: string; length?: number; direction?: 'ASC' | 'DESC' }>;
  unique?: boolean;
  fulltext?: boolean;
  spatial?: boolean;
  using?: 'BTREE' | 'HASH';
  ifNotExists?: boolean;
  loc?: SourceLocation;
}

export interface ASTCreateViewStmt {
  type: 'CreateViewStatement';
  view: string;
  columns?: string[];
  select: ASTSelectStmt;
  orReplace?: boolean;
  algorithm?: 'UNDEFINED' | 'MERGE' | 'TEMPTABLE';
  withCheckOption?: boolean;
  loc?: SourceLocation;
}

export interface ASTCreateTriggerStmt {
  type: 'CreateTriggerStatement';
  trigger: string;
  table: ASTTableRef;
  timing: 'BEFORE' | 'AFTER' | 'INSTEAD OF';
  event: 'INSERT' | 'UPDATE' | 'DELETE';
  forEach?: 'ROW' | 'STATEMENT';
  body: string;
  loc?: SourceLocation;
}

export interface ASTCreateProcedureStmt {
  type: 'CreateProcedureStatement';
  name: string;
  parameters: ASTProcParam[];
  body: string;
  loc?: SourceLocation;
}

export interface ASTCreateFunctionStmt {
  type: 'CreateFunctionStatement';
  name: string;
  parameters: ASTProcParam[];
  returns: string;
  body: string;
  loc?: SourceLocation;
}

export interface ASTProcParam {
  direction?: 'IN' | 'OUT' | 'INOUT';
  name: string;
  dataType: string;
}

export interface ASTDropStmt {
  type: 'DropStatement';
  objectType: 'TABLE' | 'DATABASE' | 'INDEX' | 'VIEW' | 'TRIGGER' | 'PROCEDURE' | 'FUNCTION' | 'USER' | 'ROLE';
  name: string;
  table?: string;
  ifExists?: boolean;
  cascade?: boolean;
  loc?: SourceLocation;
}

export type ASTAlterAction =
  | { action: 'ADD_COLUMN'; column: ASTColumnDef; after?: string; first?: boolean }
  | { action: 'DROP_COLUMN'; column: string }
  | { action: 'MODIFY_COLUMN'; column: ASTColumnDef; after?: string; first?: boolean }
  | { action: 'CHANGE_COLUMN'; oldName: string; newColumn: ASTColumnDef }
  | { action: 'RENAME_COLUMN'; oldName: string; newName: string }
  | { action: 'ADD_INDEX'; index: ASTCreateIndexStmt }
  | { action: 'DROP_INDEX'; index: string }
  | { action: 'ADD_CONSTRAINT'; constraint: ASTTableConstraint }
  | { action: 'DROP_CONSTRAINT'; constraint: string }
  | { action: 'RENAME_TABLE'; newName: string }
  | { action: 'ADD_PARTITION'; partition: ASTPartitionDef }
  | { action: 'DROP_PARTITION'; partition: string };

export interface ASTAlterTableStmt {
  type: 'AlterTableStatement';
  table: ASTTableRef;
  actions: ASTAlterAction[];
  loc?: SourceLocation;
}

export interface ASTTruncateStmt {
  type: 'TruncateStatement';
  table: ASTTableRef;
  loc?: SourceLocation;
}

export interface ASTUseStmt {
  type: 'UseStatement';
  database: string;
  loc?: SourceLocation;
}

export interface ASTShowStmt {
  type: 'ShowStatement';
  what: 'DATABASES' | 'TABLES' | 'COLUMNS' | 'INDEXES' | 'CREATE_TABLE' | 'PROCESSLIST' | 'VARIABLES' | 'STATUS';
  from?: string;
  like?: string;
  where?: ASTExpression;
  loc?: SourceLocation;
}

export interface ASTDescribeStmt {
  type: 'DescribeStatement';
  table: ASTTableRef;
  column?: string;
  loc?: SourceLocation;
}

export interface ASTExplainStmt {
  type: 'ExplainStatement';
  statement: ASTSelectStmt | ASTInsertStmt | ASTUpdateStmt | ASTDeleteStmt;
  analyze?: boolean;
  format?: 'TRADITIONAL' | 'JSON' | 'TREE';
  loc?: SourceLocation;
}

export interface ASTTransactionStmt {
  type: 'TransactionStatement';
  action: 'BEGIN' | 'COMMIT' | 'ROLLBACK' | 'SAVEPOINT' | 'RELEASE' | 'ROLLBACK_TO';
  savepoint?: string;
  readOnly?: boolean;
  loc?: SourceLocation;
}

export interface ASTGrantStmt {
  type: 'GrantStatement';
  privileges: string[];
  on?: { type: 'TABLE' | 'DATABASE' | 'PROCEDURE' | 'FUNCTION'; name: string };
  to: string[];
  withGrantOption?: boolean;
  loc?: SourceLocation;
}

export interface ASTRevokeStmt {
  type: 'RevokeStatement';
  privileges: string[];
  on?: { type: 'TABLE' | 'DATABASE'; name: string };
  from: string[];
  loc?: SourceLocation;
}

export interface ASTCreateUserStmt {
  type: 'CreateUserStatement';
  user: string;
  password?: string;
  ifNotExists?: boolean;
  loc?: SourceLocation;
}

export interface ASTCreateRoleStmt {
  type: 'CreateRoleStatement';
  role: string;
  ifNotExists?: boolean;
  loc?: SourceLocation;
}

export interface ASTUnionStmt {
  type: 'UnionStatement';
  left: ASTSelectStmt | ASTUnionStmt;
  right: ASTSelectStmt;
  all?: boolean;
  orderBy?: ASTOrderByItem[];
  limit?: number;
  offset?: number;
  loc?: SourceLocation;
}

export type ASTStatement =
  | ASTSelectStmt
  | ASTInsertStmt
  | ASTUpdateStmt
  | ASTDeleteStmt
  | ASTCreateTableStmt
  | ASTCreateDatabaseStmt
  | ASTCreateIndexStmt
  | ASTCreateViewStmt
  | ASTCreateTriggerStmt
  | ASTCreateProcedureStmt
  | ASTCreateFunctionStmt
  | ASTDropStmt
  | ASTAlterTableStmt
  | ASTTruncateStmt
  | ASTUseStmt
  | ASTShowStmt
  | ASTDescribeStmt
  | ASTExplainStmt
  | ASTTransactionStmt
  | ASTGrantStmt
  | ASTRevokeStmt
  | ASTCreateUserStmt
  | ASTCreateRoleStmt
  | ASTUnionStmt;

export interface ASTProgram {
  type: 'Program';
  statements: ASTStatement[];
  loc?: SourceLocation;
}


export class SQLSyntaxError extends Error {
  constructor(
    message: string,
    public position: number,
    public line: number,
    public column: number,
    public token?: Token
  ) {
    super(`SQL Syntax Error at line ${line}, column ${column}: ${message}`);
    this.name = 'SQLSyntaxError';
  }
}

export class SQLSemanticError extends Error {
  constructor(message: string) {
    super(`SQL Semantic Error: ${message}`);
    this.name = 'SQLSemanticError';
  }
}
