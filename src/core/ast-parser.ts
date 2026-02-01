import { SQLLexer } from './lexer';
import {
  Token, TokenType, SQLSyntaxError, SourceLocation,
  ASTProgram, ASTStatement, ASTExpression,
  ASTSelectStmt, ASTInsertStmt, ASTUpdateStmt, ASTDeleteStmt,
  ASTCreateTableStmt, ASTCreateDatabaseStmt, ASTCreateIndexStmt,
  ASTCreateViewStmt, ASTCreateTriggerStmt, ASTCreateProcedureStmt,
  ASTCreateFunctionStmt, ASTDropStmt, ASTAlterTableStmt,
  ASTTruncateStmt, ASTUseStmt, ASTShowStmt, ASTDescribeStmt,
  ASTExplainStmt, ASTTransactionStmt, ASTGrantStmt, ASTRevokeStmt,
  ASTCreateUserStmt, ASTCreateRoleStmt, ASTUnionStmt,
  ASTSelectItem, ASTTableRef, ASTJoinClause, ASTOrderByItem,
  ASTGroupByItem, ASTColumnDef, ASTTableConstraint, ASTAlterAction,
  ASTLiteral, ASTIdentifier, ASTColumnRef, ASTBinaryExpr, ASTUnaryExpr,
  ASTFunctionCall, ASTCaseExpr, ASTSubQuery, ASTBetweenExpr,
  ASTInExpr, ASTLikeExpr, ASTIsNullExpr, ASTExistsExpr, ASTMatchAgainst,
  ASTWindowSpec, ASTWindowFrame, ASTFrameBound, ASTProcParam, ASTPartitionSpec, ASTPartitionDef
} from './ast-types';
const PRECEDENCE: Record<string, number> = {
  'OR': 1,
  '||': 1,
  'XOR': 2,
  'AND': 3,
  '&&': 3,
  'NOT': 4,
  '=': 5, '<>': 5, '!=': 5, '<': 5, '<=': 5, '>': 5, '>=': 5,
  '<=>': 5, 'IS': 5, 'LIKE': 5, 'REGEXP': 5, 'IN': 5, 'BETWEEN': 5,
  '|': 6,
  '&': 7,
  '<<': 8, '>>': 8,
  '+': 9, '-': 9,
  '*': 10, '/': 10, '%': 10, 'DIV': 10, 'MOD': 10,
  '^': 11,
  'UNARY': 12
};

export class SQLASTParser {
  private lexer: SQLLexer;
  private tokens: Token[] = [];
  private current: number = 0;

  constructor() {
    this.lexer = new SQLLexer();
  }
  parse(sql: string): ASTProgram {
    this.tokens = this.lexer.tokenize(sql);
    this.current = 0;

    const statements: ASTStatement[] = [];

    while (!this.isAtEnd()) {
      if (this.check('SEMICOLON')) {
        this.advance();
        continue;
      }
      statements.push(this.parseStatement());
    }

    return {
      type: 'Program',
      statements
    };
  }
  parseStatement(sql?: string): ASTStatement {
    if (sql) {
      this.tokens = this.lexer.tokenize(sql);
      this.current = 0;
    }

    const token = this.peek();

    switch (token.type) {
      case 'SELECT':
        return this.parseSelectOrUnion();
      case 'INSERT':
        return this.parseInsert();
      case 'UPDATE':
        return this.parseUpdate();
      case 'DELETE':
        return this.parseDelete();
      case 'CREATE':
        return this.parseCreate();
      case 'DROP':
        return this.parseDrop();
      case 'ALTER':
        return this.parseAlter();
      case 'TRUNCATE':
        return this.parseTruncate();
      case 'USE':
        return this.parseUse();
      case 'SHOW':
        return this.parseShow();
      case 'DESCRIBE':
        return this.parseDescribe();
      case 'EXPLAIN':
        return this.parseExplain();
      case 'BEGIN':
      case 'START':
        return this.parseTransaction('BEGIN');
      case 'COMMIT':
        return this.parseTransaction('COMMIT');
      case 'ROLLBACK':
        return this.parseTransaction('ROLLBACK');
      case 'SAVEPOINT':
        return this.parseTransaction('SAVEPOINT');
      case 'RELEASE':
        return this.parseTransaction('RELEASE');
      case 'GRANT':
        return this.parseGrant();
      case 'REVOKE':
        return this.parseRevoke();
      default:
        throw this.error(`Unexpected token: ${token.value}`);
    }
  }


  private isAtEnd(): boolean {
    return this.current >= this.tokens.length || this.peek().type === 'EOF';
  }

  private peek(offset: number = 0): Token {
    const pos = this.current + offset;
    if (pos >= this.tokens.length) {
      return this.tokens[this.tokens.length - 1];
    }
    return this.tokens[pos];
  }

  private advance(): Token {
    if (!this.isAtEnd()) {
      return this.tokens[this.current++];
    }
    return this.tokens[this.current];
  }

  private check(...types: TokenType[]): boolean {
    if (this.isAtEnd()) return false;
    return types.includes(this.peek().type);
  }

  private checkKeyword(...keywords: string[]): boolean {
    if (this.isAtEnd()) return false;
    const token = this.peek();
    return keywords.some(k => 
      token.type === k as TokenType || 
      token.value.toUpperCase() === k.toUpperCase()
    );
  }

  private match(...types: TokenType[]): boolean {
    if (this.check(...types)) {
      this.advance();
      return true;
    }
    return false;
  }

  private matchKeyword(...keywords: string[]): boolean {
    if (this.checkKeyword(...keywords)) {
      this.advance();
      return true;
    }
    return false;
  }

  private expect(type: TokenType, message?: string): Token {
    if (this.check(type)) {
      return this.advance();
    }
    throw this.error(message || `Expected ${type}, got ${this.peek().type}`);
  }

  private expectKeyword(keyword: string, message?: string): Token {
    if (this.checkKeyword(keyword)) {
      return this.advance();
    }
    throw this.error(message || `Expected '${keyword}', got '${this.peek().value}'`);
  }

  private error(message: string): SQLSyntaxError {
    const token = this.peek();
    return new SQLSyntaxError(message, token.position, token.line, token.column, token);
  }

  private getLocation(): SourceLocation {
    const token = this.peek();
    return {
      start: { line: token.line, column: token.column, offset: token.position },
      end: { line: token.line, column: token.column + token.value.length, offset: token.position + token.value.length }
    };
  }


  private parseSelectOrUnion(): ASTSelectStmt | ASTUnionStmt {
    let left: ASTSelectStmt | ASTUnionStmt = this.parseSelect();

    while (this.checkKeyword('UNION', 'INTERSECT', 'EXCEPT')) {
      const op = this.advance().value.toUpperCase();
      const all = this.matchKeyword('ALL');
      const right = this.parseSelect();

      left = {
        type: 'UnionStatement',
        left,
        right,
        all
      };
    }
    if (left.type === 'UnionStatement') {
      if (this.checkKeyword('ORDER')) {
        this.advance();
        this.expectKeyword('BY');
        left.orderBy = this.parseOrderByList();
      }

      if (this.checkKeyword('LIMIT')) {
        this.advance();
        left.limit = this.parseNumber();
        if (this.matchKeyword('OFFSET')) {
          left.offset = this.parseNumber();
        }
      }
    }

    return left;
  }

  private parseSelect(): ASTSelectStmt {
    this.expectKeyword('SELECT');
    const loc = this.getLocation();
    const distinct = this.matchKeyword('DISTINCT');
    const columns = this.parseSelectColumns();
    let from: ASTTableRef | ASTSubQuery | undefined;
    let joins: ASTJoinClause[] | undefined;

    if (this.matchKeyword('FROM')) {
      const fromResult = this.parseFromClause();
      from = fromResult.from;
      joins = fromResult.joins;
    }
    let where: ASTExpression | undefined;
    if (this.matchKeyword('WHERE')) {
      where = this.parseExpression();
    }
    let groupBy: ASTGroupByItem[] | undefined;
    if (this.checkKeyword('GROUP')) {
      this.advance();
      this.expectKeyword('BY');
      groupBy = this.parseGroupByList();
    }
    let having: ASTExpression | undefined;
    if (this.matchKeyword('HAVING')) {
      having = this.parseExpression();
    }
    let orderBy: ASTOrderByItem[] | undefined;
    if (this.checkKeyword('ORDER')) {
      this.advance();
      this.expectKeyword('BY');
      orderBy = this.parseOrderByList();
    }
    let limit: number | undefined;
    let offset: number | undefined;
    if (this.matchKeyword('LIMIT')) {
      limit = this.parseNumber();
      if (this.matchKeyword('OFFSET')) {
        offset = this.parseNumber();
      } else if (this.match('COMMA')) {
        offset = limit;
        limit = this.parseNumber();
      }
    }
    const forUpdate = this.checkKeyword('FOR') && this.peek(1).value.toUpperCase() === 'UPDATE';
    if (forUpdate) {
      this.advance();
      this.advance();
    }

    return {
      type: 'SelectStatement',
      distinct,
      columns,
      from,
      joins,
      where,
      groupBy,
      having,
      orderBy,
      limit,
      offset,
      forUpdate,
      loc
    };
  }

  private parseSelectColumns(): ASTSelectItem[] {
    const columns: ASTSelectItem[] = [];

    do {
      if (this.check('STAR')) {
        this.advance();
        columns.push({ expression: { type: 'Identifier', name: '*' }, all: true });
      } else {
        const expr = this.parseExpression();
        let alias: string | undefined;

        if (this.matchKeyword('AS')) {
          alias = this.parseIdentifierName();
        } else if (this.check('IDENTIFIER') && !this.checkKeyword('FROM', 'WHERE', 'GROUP', 'ORDER', 'LIMIT', 'HAVING', 'UNION', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'CROSS', 'FULL')) {
          alias = this.parseIdentifierName();
        }

        columns.push({ expression: expr, alias });
      }
    } while (this.match('COMMA'));

    return columns;
  }

  private parseFromClause(): { from: ASTTableRef | ASTSubQuery; joins?: ASTJoinClause[] } {
    const from = this.parseTableReference();
    const joins: ASTJoinClause[] = [];

    while (this.checkKeyword('JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'NATURAL')) {
      joins.push(this.parseJoin());
    }

    return { from, joins: joins.length > 0 ? joins : undefined };
  }

  private parseTableReference(): ASTTableRef | ASTSubQuery {
    if (this.check('LPAREN')) {
      this.advance();
      const query = this.parseSelectOrUnion() as ASTSelectStmt;
      this.expect('RPAREN');

      let alias: string | undefined;
      if (this.matchKeyword('AS')) {
        alias = this.parseIdentifierName();
      } else if (this.check('IDENTIFIER')) {
        alias = this.parseIdentifierName();
      }

      return { type: 'SubQuery', query, alias };
    }
    const table = this.parseIdentifierName();
    let database: string | undefined;

    if (this.match('DOT')) {
      database = table;
      const tableName = this.parseIdentifierName();
      let alias: string | undefined;
      if (this.matchKeyword('AS')) {
        alias = this.parseIdentifierName();
      } else if (this.check('IDENTIFIER') && !this.checkKeyword('WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'ON', 'GROUP', 'ORDER', 'LIMIT', 'SET')) {
        alias = this.parseIdentifierName();
      }
      return { type: 'TableRef', database, table: tableName, alias };
    }

    let alias: string | undefined;
    if (this.matchKeyword('AS')) {
      alias = this.parseIdentifierName();
    } else if (this.check('IDENTIFIER') && !this.checkKeyword('WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'ON', 'GROUP', 'ORDER', 'LIMIT', 'SET', 'CROSS', 'FULL', 'NATURAL')) {
      alias = this.parseIdentifierName();
    }

    return { type: 'TableRef', table, alias };
  }

  private parseJoin(): ASTJoinClause {
    let joinType: ASTJoinClause['joinType'] = 'INNER';

    if (this.matchKeyword('NATURAL')) {
      joinType = 'NATURAL';
    } else if (this.matchKeyword('LEFT')) {
      joinType = 'LEFT';
      this.matchKeyword('OUTER');
    } else if (this.matchKeyword('RIGHT')) {
      joinType = 'RIGHT';
      this.matchKeyword('OUTER');
    } else if (this.matchKeyword('FULL')) {
      joinType = 'FULL';
      this.matchKeyword('OUTER');
    } else if (this.matchKeyword('CROSS')) {
      joinType = 'CROSS';
    } else if (this.matchKeyword('INNER')) {
      joinType = 'INNER';
    }

    this.expectKeyword('JOIN');
    const table = this.parseTableReference();

    let on: ASTExpression | undefined;
    let using: string[] | undefined;

    if (joinType !== 'CROSS' && joinType !== 'NATURAL') {
      if (this.matchKeyword('ON')) {
        on = this.parseExpression();
      } else if (this.matchKeyword('USING')) {
        this.expect('LPAREN');
        using = [];
        do {
          using.push(this.parseIdentifierName());
        } while (this.match('COMMA'));
        this.expect('RPAREN');
      }
    }

    return { type: 'JoinClause', joinType, table, on, using };
  }

  private parseGroupByList(): ASTGroupByItem[] {
    const items: ASTGroupByItem[] = [];
    do {
      const expr = this.parseExpression();
      const withRollup = this.matchKeyword('WITH') && this.matchKeyword('ROLLUP');
      items.push({ expression: expr, withRollup });
    } while (this.match('COMMA'));
    return items;
  }

  private parseOrderByList(): ASTOrderByItem[] {
    const items: ASTOrderByItem[] = [];
    do {
      const expr = this.parseExpression();
      let direction: 'ASC' | 'DESC' = 'ASC';
      if (this.matchKeyword('DESC')) {
        direction = 'DESC';
      } else {
        this.matchKeyword('ASC');
      }
      let nulls: 'FIRST' | 'LAST' | undefined;
      if (this.matchKeyword('NULLS')) {
        nulls = this.matchKeyword('FIRST') ? 'FIRST' : 'LAST';
      }
      items.push({ expression: expr, direction, nulls });
    } while (this.match('COMMA'));
    return items;
  }


  private parseInsert(): ASTInsertStmt {
    this.expectKeyword('INSERT');
    const ignore = this.matchKeyword('IGNORE');
    this.expectKeyword('INTO');

    const table = this.parseTableReference() as ASTTableRef;
    let columns: string[] | undefined;
    if (this.match('LPAREN')) {
      columns = [];
      do {
        columns.push(this.parseIdentifierName());
      } while (this.match('COMMA'));
      this.expect('RPAREN');
    }
    let values: ASTExpression[][] | undefined;
    let select: ASTSelectStmt | undefined;

    if (this.matchKeyword('VALUES') || this.matchKeyword('VALUE')) {
      values = [];
      do {
        this.expect('LPAREN');
        const row: ASTExpression[] = [];
        do {
          row.push(this.parseExpression());
        } while (this.match('COMMA'));
        this.expect('RPAREN');
        values.push(row);
      } while (this.match('COMMA'));
    } else if (this.checkKeyword('SELECT')) {
      select = this.parseSelect();
    } else {
      throw this.error('Expected VALUES or SELECT');
    }
    let onDuplicateKey: Array<{ column: string; value: ASTExpression }> | undefined;
    if (this.checkKeyword('ON')) {
      this.advance();
      this.expectKeyword('DUPLICATE');
      this.expectKeyword('KEY');
      this.expectKeyword('UPDATE');
      onDuplicateKey = [];
      do {
        const column = this.parseIdentifierName();
        this.expect('EQ');
        const value = this.parseExpression();
        onDuplicateKey.push({ column, value });
      } while (this.match('COMMA'));
    }

    return { type: 'InsertStatement', table, columns, values, select, onDuplicateKey, ignore };
  }


  private parseUpdate(): ASTUpdateStmt {
    this.expectKeyword('UPDATE');
    const table = this.parseTableReference() as ASTTableRef;

    this.expectKeyword('SET');
    const set: Array<{ column: string; value: ASTExpression }> = [];
    do {
      const column = this.parseIdentifierName();
      this.expect('EQ');
      const value = this.parseExpression();
      set.push({ column, value });
    } while (this.match('COMMA'));

    let where: ASTExpression | undefined;
    if (this.matchKeyword('WHERE')) {
      where = this.parseExpression();
    }

    let orderBy: ASTOrderByItem[] | undefined;
    if (this.checkKeyword('ORDER')) {
      this.advance();
      this.expectKeyword('BY');
      orderBy = this.parseOrderByList();
    }

    let limit: number | undefined;
    if (this.matchKeyword('LIMIT')) {
      limit = this.parseNumber();
    }

    return { type: 'UpdateStatement', table, set, where, orderBy, limit };
  }


  private parseDelete(): ASTDeleteStmt {
    this.expectKeyword('DELETE');
    this.expectKeyword('FROM');
    const table = this.parseTableReference() as ASTTableRef;

    let where: ASTExpression | undefined;
    if (this.matchKeyword('WHERE')) {
      where = this.parseExpression();
    }

    let orderBy: ASTOrderByItem[] | undefined;
    if (this.checkKeyword('ORDER')) {
      this.advance();
      this.expectKeyword('BY');
      orderBy = this.parseOrderByList();
    }

    let limit: number | undefined;
    if (this.matchKeyword('LIMIT')) {
      limit = this.parseNumber();
    }

    return { type: 'DeleteStatement', table, where, orderBy, limit };
  }


  private parseCreate(): ASTStatement {
    this.expectKeyword('CREATE');

    if (this.matchKeyword('DATABASE') || this.matchKeyword('SCHEMA')) {
      return this.parseCreateDatabase();
    }

    if (this.matchKeyword('TABLE')) {
      return this.parseCreateTable();
    }

    const unique = this.matchKeyword('UNIQUE');
    const fulltext = this.matchKeyword('FULLTEXT');
    const spatial = this.matchKeyword('SPATIAL');

    if (this.matchKeyword('INDEX')) {
      return this.parseCreateIndex(unique, fulltext, spatial);
    }

    if (this.matchKeyword('VIEW')) {
      return this.parseCreateView();
    }

    if (this.matchKeyword('TRIGGER')) {
      return this.parseCreateTrigger();
    }

    if (this.matchKeyword('PROCEDURE')) {
      return this.parseCreateProcedure();
    }

    if (this.matchKeyword('FUNCTION')) {
      return this.parseCreateFunction();
    }

    if (this.matchKeyword('USER')) {
      return this.parseCreateUser();
    }

    if (this.matchKeyword('ROLE')) {
      return this.parseCreateRole();
    }

    throw this.error('Expected TABLE, DATABASE, INDEX, VIEW, TRIGGER, PROCEDURE, FUNCTION, USER, or ROLE');
  }

  private parseCreateDatabase(): ASTCreateDatabaseStmt {
    const ifNotExists = this.matchKeyword('IF') && this.matchKeyword('NOT') && this.matchKeyword('EXISTS');
    const database = this.parseIdentifierName();

    let charset: string | undefined;
    let collation: string | undefined;

    while (this.checkKeyword('DEFAULT', 'CHARACTER', 'CHARSET', 'COLLATE')) {
      this.matchKeyword('DEFAULT');
      if (this.matchKeyword('CHARACTER') || this.matchKeyword('CHARSET')) {
        this.matchKeyword('SET');
        this.match('EQ');
        charset = this.parseIdentifierName();
      } else if (this.matchKeyword('COLLATE')) {
        this.match('EQ');
        collation = this.parseIdentifierName();
      }
    }

    return { type: 'CreateDatabaseStatement', database, ifNotExists, charset, collation };
  }

  private parseCreateTable(): ASTCreateTableStmt {
    const ifNotExists = this.matchKeyword('IF') && this.matchKeyword('NOT') && this.matchKeyword('EXISTS');
    const tableRef = this.parseTableReference() as ASTTableRef;
    if (this.matchKeyword('AS')) {
      const as = this.parseSelect();
      return { type: 'CreateTableStatement', table: tableRef, columns: [], ifNotExists, as };
    }
    if (this.matchKeyword('LIKE')) {
      const likeTable = this.parseIdentifierName();
      return { type: 'CreateTableStatement', table: tableRef, columns: [], ifNotExists };
    }

    this.expect('LPAREN');

    const columns: ASTColumnDef[] = [];
    const constraints: ASTTableConstraint[] = [];

    do {
      if (this.checkKeyword('PRIMARY', 'UNIQUE', 'FOREIGN', 'CHECK', 'CONSTRAINT', 'INDEX', 'KEY', 'FULLTEXT')) {
        constraints.push(this.parseTableConstraint());
      } else {
        columns.push(this.parseColumnDefinition());
      }
    } while (this.match('COMMA'));

    this.expect('RPAREN');
    let engine: string | undefined;
    let charset: string | undefined;
    let collation: string | undefined;
    let comment: string | undefined;
    let partitionBy: ASTPartitionSpec | undefined;

    while (!this.isAtEnd() && !this.check('SEMICOLON')) {
      if (this.matchKeyword('ENGINE')) {
        this.match('EQ');
        engine = this.parseIdentifierName();
      } else if (this.matchKeyword('DEFAULT') || this.matchKeyword('CHARACTER') || this.matchKeyword('CHARSET')) {
        if (this.matchKeyword('CHARSET') || (this.matchKeyword('CHARACTER') && this.matchKeyword('SET'))) {
          this.match('EQ');
          charset = this.parseIdentifierName();
        }
      } else if (this.matchKeyword('COLLATE')) {
        this.match('EQ');
        collation = this.parseIdentifierName();
      } else if (this.matchKeyword('COMMENT')) {
        this.match('EQ');
        comment = this.parseStringLiteral();
      } else if (this.matchKeyword('PARTITION')) {
        partitionBy = this.parsePartitionBy();
      } else {
        break;
      }
    }

    return { type: 'CreateTableStatement', table: tableRef, columns, constraints, ifNotExists, engine, charset, collation, comment, partitionBy };
  }

  private parseColumnDefinition(): ASTColumnDef {
    const name = this.parseIdentifierName();
    const dataType = this.parseDataType();

    const def: ASTColumnDef = { type: 'ColumnDefinition', name, dataType: dataType.type };
    if (dataType.length) def.length = dataType.length;
    if (dataType.precision) def.precision = dataType.precision;
    if (dataType.scale) def.scale = dataType.scale;
    if (dataType.enumValues) def.enumValues = dataType.enumValues;
    def.nullable = true;
    while (!this.isAtEnd() && !this.check('COMMA') && !this.check('RPAREN')) {
      if (this.matchKeyword('NOT')) {
        this.expectKeyword('NULL');
        def.nullable = false;
      } else if (this.matchKeyword('NULL')) {
        def.nullable = true;
      } else if (this.matchKeyword('PRIMARY')) {
        this.expectKeyword('KEY');
        def.primaryKey = true;
      } else if (this.matchKeyword('AUTO_INCREMENT')) {
        def.autoIncrement = true;
      } else if (this.matchKeyword('UNIQUE')) {
        this.matchKeyword('KEY');
        def.unique = true;
      } else if (this.matchKeyword('DEFAULT')) {
        def.defaultValue = this.parseExpression();
      } else if (this.matchKeyword('REFERENCES')) {
        def.references = this.parseForeignKeyReference();
      } else if (this.matchKeyword('CHECK')) {
        this.expect('LPAREN');
        def.check = this.parseExpression();
        this.expect('RPAREN');
      } else if (this.matchKeyword('COMMENT')) {
        def.comment = this.parseStringLiteral();
      } else if (this.matchKeyword('COLLATE')) {
        def.collation = this.parseIdentifierName();
      } else if (this.matchKeyword('KEY')) {
        break;
      } else {
        break;
      }
    }

    return def;
  }

  private parseDataType(): { type: string; length?: number; precision?: number; scale?: number; enumValues?: string[] } {
    const typeName = this.advance().value.toUpperCase();
    let length: number | undefined;
    let precision: number | undefined;
    let scale: number | undefined;
    let enumValues: string[] | undefined;

    if (this.match('LPAREN')) {
      if (typeName === 'ENUM' || typeName === 'SET') {
        enumValues = [];
        do {
          enumValues.push(this.parseStringLiteral());
        } while (this.match('COMMA'));
      } else {
        precision = this.parseNumber();
        if (this.match('COMMA')) {
          scale = this.parseNumber();
          length = precision;
        } else {
          length = precision;
          precision = undefined;
        }
      }
      this.expect('RPAREN');
    }
    this.matchKeyword('UNSIGNED');
    this.matchKeyword('ZEROFILL');

    return { type: typeName, length, precision, scale, enumValues };
  }

  private parseForeignKeyReference(): ASTColumnDef['references'] {
    const table = this.parseIdentifierName();
    this.expect('LPAREN');
    const column = this.parseIdentifierName();
    this.expect('RPAREN');

    type RefAction = 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
    let onDelete: RefAction | undefined;
    let onUpdate: RefAction | undefined;

    while (this.matchKeyword('ON')) {
      if (this.matchKeyword('DELETE')) {
        onDelete = this.parseReferentialAction();
      } else if (this.matchKeyword('UPDATE')) {
        onUpdate = this.parseReferentialAction();
      }
    }

    return { table, column, onDelete, onUpdate };
  }

  private parseReferentialAction(): 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION' {
    if (this.matchKeyword('CASCADE')) return 'CASCADE';
    if (this.matchKeyword('SET')) {
      this.expectKeyword('NULL');
      return 'SET NULL';
    }
    if (this.matchKeyword('RESTRICT')) return 'RESTRICT';
    if (this.matchKeyword('NO')) {
      this.expectKeyword('ACTION');
      return 'NO ACTION';
    }
    throw this.error('Expected CASCADE, SET NULL, RESTRICT, or NO ACTION');
  }

  private parseTableConstraint(): ASTTableConstraint {
    let name: string | undefined;
    if (this.matchKeyword('CONSTRAINT')) {
      if (!this.checkKeyword('PRIMARY', 'UNIQUE', 'FOREIGN', 'CHECK')) {
        name = this.parseIdentifierName();
      }
    }

    if (this.matchKeyword('PRIMARY')) {
      this.expectKeyword('KEY');
      const columns = this.parseColumnList();
      return { type: 'ConstraintDefinition', constraintType: 'PRIMARY_KEY', name, columns };
    }

    if (this.matchKeyword('UNIQUE')) {
      this.matchKeyword('KEY') || this.matchKeyword('INDEX');
      if (this.check('IDENTIFIER')) {
        name = this.parseIdentifierName();
      }
      const columns = this.parseColumnList();
      return { type: 'ConstraintDefinition', constraintType: 'UNIQUE', name, columns };
    }

    if (this.matchKeyword('FOREIGN')) {
      this.expectKeyword('KEY');
      if (this.check('IDENTIFIER') && this.peek(1).type !== 'LPAREN') {
        name = this.parseIdentifierName();
      }
      const columns = this.parseColumnList();
      this.expectKeyword('REFERENCES');
      const refTable = this.parseIdentifierName();
      const refColumns = this.parseColumnList();

      let onDelete: string | undefined;
      let onUpdate: string | undefined;
      while (this.matchKeyword('ON')) {
        if (this.matchKeyword('DELETE')) {
          onDelete = this.parseReferentialAction();
        } else if (this.matchKeyword('UPDATE')) {
          onUpdate = this.parseReferentialAction();
        }
      }

      return {
        type: 'ConstraintDefinition',
        constraintType: 'FOREIGN_KEY',
        name,
        columns,
        references: { table: refTable, columns: refColumns, onDelete, onUpdate }
      };
    }

    if (this.matchKeyword('CHECK')) {
      this.expect('LPAREN');
      const expression = this.parseExpression();
      this.expect('RPAREN');
      return { type: 'ConstraintDefinition', constraintType: 'CHECK', name, expression };
    }

    if (this.matchKeyword('INDEX') || this.matchKeyword('KEY') || this.matchKeyword('FULLTEXT')) {
      if (this.check('IDENTIFIER') && this.peek(1).type !== 'LPAREN') {
        this.parseIdentifierName();
      }
      this.parseColumnList();
      return { type: 'ConstraintDefinition', constraintType: 'UNIQUE', columns: [] };
    }

    throw this.error('Expected PRIMARY KEY, UNIQUE, FOREIGN KEY, or CHECK');
  }

  private parseColumnList(): string[] {
    this.expect('LPAREN');
    const columns: string[] = [];
    do {
      columns.push(this.parseIdentifierName());
      if (this.match('LPAREN')) {
        this.parseNumber();
        this.expect('RPAREN');
      }
      this.matchKeyword('ASC') || this.matchKeyword('DESC');
    } while (this.match('COMMA'));
    this.expect('RPAREN');
    return columns;
  }

  private parsePartitionBy(): ASTPartitionSpec {
    this.expectKeyword('BY');
    let type: ASTPartitionSpec['type'];

    if (this.matchKeyword('RANGE')) {
      type = 'RANGE';
    } else if (this.matchKeyword('LIST')) {
      type = 'LIST';
    } else if (this.matchKeyword('HASH')) {
      type = 'HASH';
    } else if (this.matchKeyword('KEY')) {
      type = 'KEY';
    } else {
      throw this.error('Expected RANGE, LIST, HASH, or KEY');
    }

    let columns: string[] | undefined;
    let expression: ASTExpression | undefined;

    if (this.matchKeyword('COLUMNS')) {
      columns = this.parseColumnList();
    } else if (this.match('LPAREN')) {
      expression = this.parseExpression();
      this.expect('RPAREN');
    }

    const partitions: ASTPartitionDef[] = [];
    if (this.match('LPAREN')) {
      do {
        partitions.push(this.parsePartitionDef());
      } while (this.match('COMMA'));
      this.expect('RPAREN');
    }

    return { type, columns, expression, partitions };
  }

  private parsePartitionDef(): ASTPartitionDef {
    this.expectKeyword('PARTITION');
    const name = this.parseIdentifierName();
    let lessThan: ASTExpression | 'MAXVALUE' | undefined;
    let values: ASTExpression[] | undefined;

    if (this.matchKeyword('VALUES')) {
      if (this.matchKeyword('LESS')) {
        this.expectKeyword('THAN');
        if (this.matchKeyword('MAXVALUE')) {
          lessThan = 'MAXVALUE';
        } else {
          this.expect('LPAREN');
          lessThan = this.parseExpression();
          this.expect('RPAREN');
        }
      } else if (this.matchKeyword('IN')) {
        this.expect('LPAREN');
        values = [];
        do {
          values.push(this.parseExpression());
        } while (this.match('COMMA'));
        this.expect('RPAREN');
      }
    }

    return { name, lessThan, values };
  }

  private parseCreateIndex(unique: boolean, fulltext: boolean, spatial: boolean): ASTCreateIndexStmt {
    const ifNotExists = this.matchKeyword('IF') && this.matchKeyword('NOT') && this.matchKeyword('EXISTS');
    const index = this.parseIdentifierName();

    this.expectKeyword('ON');
    const table = this.parseTableReference() as ASTTableRef;

    const columns: ASTCreateIndexStmt['columns'] = [];
    this.expect('LPAREN');
    do {
      const column = this.parseIdentifierName();
      let length: number | undefined;
      let direction: 'ASC' | 'DESC' | undefined;

      if (this.match('LPAREN')) {
        length = this.parseNumber();
        this.expect('RPAREN');
      }
      if (this.matchKeyword('ASC')) {
        direction = 'ASC';
      } else if (this.matchKeyword('DESC')) {
        direction = 'DESC';
      }
      columns.push({ column, length, direction });
    } while (this.match('COMMA'));
    this.expect('RPAREN');

    let using: 'BTREE' | 'HASH' | undefined;
    if (this.matchKeyword('USING')) {
      using = this.advance().value.toUpperCase() as 'BTREE' | 'HASH';
    }

    return { type: 'CreateIndexStatement', index, table, columns, unique, fulltext, spatial, using, ifNotExists };
  }

  private parseCreateView(): ASTCreateViewStmt {
    const orReplace = this.matchKeyword('OR') && this.matchKeyword('REPLACE');
    const view = this.parseIdentifierName();

    let columns: string[] | undefined;
    if (this.match('LPAREN')) {
      columns = [];
      do {
        columns.push(this.parseIdentifierName());
      } while (this.match('COMMA'));
      this.expect('RPAREN');
    }

    this.expectKeyword('AS');
    const select = this.parseSelect();

    const withCheckOption = this.matchKeyword('WITH') && this.matchKeyword('CHECK') && this.matchKeyword('OPTION');

    return { type: 'CreateViewStatement', view, columns, select, orReplace, withCheckOption };
  }

  private parseCreateTrigger(): ASTCreateTriggerStmt {
    const trigger = this.parseIdentifierName();

    let timing: ASTCreateTriggerStmt['timing'];
    if (this.matchKeyword('BEFORE')) {
      timing = 'BEFORE';
    } else if (this.matchKeyword('AFTER')) {
      timing = 'AFTER';
    } else if (this.matchKeyword('INSTEAD')) {
      this.expectKeyword('OF');
      timing = 'INSTEAD OF';
    } else {
      throw this.error('Expected BEFORE, AFTER, or INSTEAD OF');
    }

    let event: ASTCreateTriggerStmt['event'];
    if (this.matchKeyword('INSERT')) {
      event = 'INSERT';
    } else if (this.matchKeyword('UPDATE')) {
      event = 'UPDATE';
    } else if (this.matchKeyword('DELETE')) {
      event = 'DELETE';
    } else {
      throw this.error('Expected INSERT, UPDATE, or DELETE');
    }

    this.expectKeyword('ON');
    const table = this.parseTableReference() as ASTTableRef;

    let forEach: ASTCreateTriggerStmt['forEach'];
    if (this.matchKeyword('FOR')) {
      this.expectKeyword('EACH');
      forEach = this.matchKeyword('ROW') ? 'ROW' : 'STATEMENT';
    }
    const bodyStart = this.current;
    let depth = 0;
    while (!this.isAtEnd()) {
      if (this.checkKeyword('BEGIN')) {
        depth++;
      } else if (this.checkKeyword('END')) {
        if (depth === 0) break;
        depth--;
      }
      this.advance();
    }
    const body = this.tokens.slice(bodyStart, this.current).map(t => t.value).join(' ');

    return { type: 'CreateTriggerStatement', trigger, table, timing, event, forEach, body };
  }

  private parseCreateProcedure(): ASTCreateProcedureStmt {
    const name = this.parseIdentifierName();
    const parameters = this.parseProcedureParams();
    const bodyStart = this.current;
    let depth = 0;
    while (!this.isAtEnd()) {
      if (this.checkKeyword('BEGIN')) depth++;
      else if (this.checkKeyword('END')) {
        if (depth === 0) break;
        depth--;
      }
      this.advance();
    }
    const body = this.tokens.slice(bodyStart, this.current).map(t => t.value).join(' ');

    return { type: 'CreateProcedureStatement', name, parameters, body };
  }

  private parseCreateFunction(): ASTCreateFunctionStmt {
    const name = this.parseIdentifierName();
    const parameters = this.parseProcedureParams();

    this.expectKeyword('RETURNS');
    const returns = this.parseDataType().type;
    const bodyStart = this.current;
    let depth = 0;
    while (!this.isAtEnd()) {
      if (this.checkKeyword('BEGIN')) depth++;
      else if (this.checkKeyword('END')) {
        if (depth === 0) break;
        depth--;
      }
      this.advance();
    }
    const body = this.tokens.slice(bodyStart, this.current).map(t => t.value).join(' ');

    return { type: 'CreateFunctionStatement', name, parameters, returns, body };
  }

  private parseProcedureParams(): ASTProcParam[] {
    const params: ASTProcParam[] = [];
    this.expect('LPAREN');

    if (!this.check('RPAREN')) {
      do {
        let direction: ASTProcParam['direction'];
        if (this.matchKeyword('IN')) direction = 'IN';
        else if (this.matchKeyword('OUT')) direction = 'OUT';
        else if (this.matchKeyword('INOUT')) direction = 'INOUT';

        const name = this.parseIdentifierName();
        const dataType = this.parseDataType().type;
        params.push({ direction, name, dataType });
      } while (this.match('COMMA'));
    }

    this.expect('RPAREN');
    return params;
  }

  private parseCreateUser(): ASTCreateUserStmt {
    const ifNotExists = this.matchKeyword('IF') && this.matchKeyword('NOT') && this.matchKeyword('EXISTS');
    const user = this.parseIdentifierName();

    let password: string | undefined;
    if (this.matchKeyword('IDENTIFIED')) {
      this.expectKeyword('BY');
      password = this.parseStringLiteral();
    }

    return { type: 'CreateUserStatement', user, password, ifNotExists };
  }

  private parseCreateRole(): ASTCreateRoleStmt {
    const ifNotExists = this.matchKeyword('IF') && this.matchKeyword('NOT') && this.matchKeyword('EXISTS');
    const role = this.parseIdentifierName();

    return { type: 'CreateRoleStatement', role, ifNotExists };
  }


  private parseDrop(): ASTDropStmt {
    this.expectKeyword('DROP');

    let objectType: ASTDropStmt['objectType'];
    if (this.matchKeyword('TABLE')) objectType = 'TABLE';
    else if (this.matchKeyword('DATABASE') || this.matchKeyword('SCHEMA')) objectType = 'DATABASE';
    else if (this.matchKeyword('INDEX')) objectType = 'INDEX';
    else if (this.matchKeyword('VIEW')) objectType = 'VIEW';
    else if (this.matchKeyword('TRIGGER')) objectType = 'TRIGGER';
    else if (this.matchKeyword('PROCEDURE')) objectType = 'PROCEDURE';
    else if (this.matchKeyword('FUNCTION')) objectType = 'FUNCTION';
    else if (this.matchKeyword('USER')) objectType = 'USER';
    else if (this.matchKeyword('ROLE')) objectType = 'ROLE';
    else throw this.error('Expected TABLE, DATABASE, INDEX, VIEW, TRIGGER, PROCEDURE, FUNCTION, USER, or ROLE');

    const ifExists = this.matchKeyword('IF') && this.matchKeyword('EXISTS');
    const name = this.parseIdentifierName();

    let table: string | undefined;
    if (objectType === 'INDEX' && this.matchKeyword('ON')) {
      table = this.parseIdentifierName();
    }

    const cascade = this.matchKeyword('CASCADE');

    return { type: 'DropStatement', objectType, name, table, ifExists, cascade };
  }


  private parseAlter(): ASTAlterTableStmt {
    this.expectKeyword('ALTER');
    this.expectKeyword('TABLE');
    const table = this.parseTableReference() as ASTTableRef;

    const actions: ASTAlterAction[] = [];

    do {
      actions.push(this.parseAlterAction());
    } while (this.match('COMMA'));

    return { type: 'AlterTableStatement', table, actions };
  }

  private parseAlterAction(): ASTAlterAction {
    if (this.matchKeyword('ADD')) {
      if (this.matchKeyword('COLUMN')) {
        const column = this.parseColumnDefinition();
        let after: string | undefined;
        let first = false;
        if (this.matchKeyword('FIRST')) first = true;
        else if (this.matchKeyword('AFTER')) after = this.parseIdentifierName();
        return { action: 'ADD_COLUMN', column, after, first };
      }
      if (this.matchKeyword('INDEX') || this.matchKeyword('KEY')) {
        const index = this.parseCreateIndex(false, false, false);
        return { action: 'ADD_INDEX', index };
      }
      if (this.matchKeyword('UNIQUE')) {
        this.matchKeyword('INDEX') || this.matchKeyword('KEY');
        const index = this.parseCreateIndex(true, false, false);
        return { action: 'ADD_INDEX', index };
      }
      if (this.matchKeyword('FULLTEXT')) {
        this.matchKeyword('INDEX') || this.matchKeyword('KEY');
        const index = this.parseCreateIndex(false, true, false);
        return { action: 'ADD_INDEX', index };
      }
      if (this.checkKeyword('PRIMARY', 'FOREIGN', 'CONSTRAINT', 'CHECK')) {
        const constraint = this.parseTableConstraint();
        return { action: 'ADD_CONSTRAINT', constraint };
      }
      if (this.matchKeyword('PARTITION')) {
        const partition = this.parsePartitionDef();
        return { action: 'ADD_PARTITION', partition };
      }
      const column = this.parseColumnDefinition();
      return { action: 'ADD_COLUMN', column };
    }

    if (this.matchKeyword('DROP')) {
      if (this.matchKeyword('COLUMN')) {
        const column = this.parseIdentifierName();
        return { action: 'DROP_COLUMN', column };
      }
      if (this.matchKeyword('INDEX') || this.matchKeyword('KEY')) {
        const index = this.parseIdentifierName();
        return { action: 'DROP_INDEX', index };
      }
      if (this.matchKeyword('PRIMARY')) {
        this.expectKeyword('KEY');
        return { action: 'DROP_CONSTRAINT', constraint: 'PRIMARY KEY' };
      }
      if (this.matchKeyword('FOREIGN')) {
        this.expectKeyword('KEY');
        const constraint = this.parseIdentifierName();
        return { action: 'DROP_CONSTRAINT', constraint };
      }
      if (this.matchKeyword('CONSTRAINT')) {
        const constraint = this.parseIdentifierName();
        return { action: 'DROP_CONSTRAINT', constraint };
      }
      if (this.matchKeyword('PARTITION')) {
        const partition = this.parseIdentifierName();
        return { action: 'DROP_PARTITION', partition };
      }
      const column = this.parseIdentifierName();
      return { action: 'DROP_COLUMN', column };
    }

    if (this.matchKeyword('MODIFY')) {
      this.matchKeyword('COLUMN');
      const column = this.parseColumnDefinition();
      let after: string | undefined;
      let first = false;
      if (this.matchKeyword('FIRST')) first = true;
      else if (this.matchKeyword('AFTER')) after = this.parseIdentifierName();
      return { action: 'MODIFY_COLUMN', column, after, first };
    }

    if (this.matchKeyword('CHANGE')) {
      this.matchKeyword('COLUMN');
      const oldName = this.parseIdentifierName();
      const newColumn = this.parseColumnDefinition();
      return { action: 'CHANGE_COLUMN', oldName, newColumn };
    }

    if (this.matchKeyword('RENAME')) {
      if (this.matchKeyword('COLUMN')) {
        const oldName = this.parseIdentifierName();
        this.expectKeyword('TO');
        const newName = this.parseIdentifierName();
        return { action: 'RENAME_COLUMN', oldName, newName };
      }
      if (this.matchKeyword('TO') || this.matchKeyword('AS')) {
        const newName = this.parseIdentifierName();
        return { action: 'RENAME_TABLE', newName };
      }
      const newName = this.parseIdentifierName();
      return { action: 'RENAME_TABLE', newName };
    }

    throw this.error('Expected ADD, DROP, MODIFY, CHANGE, or RENAME');
  }


  private parseTruncate(): ASTTruncateStmt {
    this.expectKeyword('TRUNCATE');
    this.matchKeyword('TABLE');
    const table = this.parseTableReference() as ASTTableRef;
    return { type: 'TruncateStatement', table };
  }

  private parseUse(): ASTUseStmt {
    this.expectKeyword('USE');
    const database = this.parseIdentifierName();
    return { type: 'UseStatement', database };
  }

  private parseShow(): ASTShowStmt {
    this.expectKeyword('SHOW');

    let what: ASTShowStmt['what'];
    let from: string | undefined;
    let like: string | undefined;
    let where: ASTExpression | undefined;

    if (this.matchKeyword('DATABASES') || this.matchKeyword('SCHEMAS')) {
      what = 'DATABASES';
    } else if (this.matchKeyword('TABLES')) {
      what = 'TABLES';
      if (this.matchKeyword('FROM') || this.matchKeyword('IN')) {
        from = this.parseIdentifierName();
      }
    } else if (this.matchKeyword('COLUMNS') || this.matchKeyword('FIELDS')) {
      what = 'COLUMNS';
      if (this.matchKeyword('FROM') || this.matchKeyword('IN')) {
        from = this.parseIdentifierName();
      }
    } else if (this.matchKeyword('INDEX') || this.matchKeyword('INDEXES') || this.matchKeyword('KEYS')) {
      what = 'INDEXES';
      if (this.matchKeyword('FROM') || this.matchKeyword('IN')) {
        from = this.parseIdentifierName();
      }
    } else if (this.matchKeyword('CREATE')) {
      this.expectKeyword('TABLE');
      what = 'CREATE_TABLE';
      from = this.parseIdentifierName();
    } else if (this.matchKeyword('PROCESSLIST')) {
      what = 'PROCESSLIST';
    } else if (this.matchKeyword('VARIABLES')) {
      what = 'VARIABLES';
    } else if (this.matchKeyword('STATUS')) {
      what = 'STATUS';
    } else {
      throw this.error('Expected DATABASES, TABLES, COLUMNS, INDEXES, CREATE TABLE, PROCESSLIST, VARIABLES, or STATUS');
    }

    if (this.matchKeyword('LIKE')) {
      like = this.parseStringLiteral();
    }

    if (this.matchKeyword('WHERE')) {
      where = this.parseExpression();
    }

    return { type: 'ShowStatement', what, from, like, where };
  }

  private parseDescribe(): ASTDescribeStmt {
    this.expectKeyword('DESCRIBE') || this.expectKeyword('DESC');
    const table = this.parseTableReference() as ASTTableRef;
    let column: string | undefined;
    if (this.check('IDENTIFIER') || this.check('STRING')) {
      column = this.parseIdentifierName();
    }
    return { type: 'DescribeStatement', table, column };
  }

  private parseExplain(): ASTExplainStmt {
    this.expectKeyword('EXPLAIN');
    const analyze = this.matchKeyword('ANALYZE');

    let format: ASTExplainStmt['format'];
    if (this.matchKeyword('FORMAT')) {
      this.expect('EQ');
      format = this.advance().value.toUpperCase() as ASTExplainStmt['format'];
    }

    const statement = this.parseStatement() as ASTExplainStmt['statement'];
    return { type: 'ExplainStatement', statement, analyze, format };
  }

  private parseTransaction(action: ASTTransactionStmt['action']): ASTTransactionStmt {
    this.advance();

    if (action === 'BEGIN' || this.peek().value.toUpperCase() === 'TRANSACTION') {
      this.matchKeyword('TRANSACTION');
      this.matchKeyword('WORK');
    }

    if (action === 'SAVEPOINT') {
      const savepoint = this.parseIdentifierName();
      return { type: 'TransactionStatement', action, savepoint };
    }

    if (action === 'RELEASE') {
      this.expectKeyword('SAVEPOINT');
      const savepoint = this.parseIdentifierName();
      return { type: 'TransactionStatement', action, savepoint };
    }

    if (action === 'ROLLBACK') {
      if (this.matchKeyword('TO')) {
        this.matchKeyword('SAVEPOINT');
        const savepoint = this.parseIdentifierName();
        return { type: 'TransactionStatement', action: 'ROLLBACK_TO', savepoint };
      }
    }

    return { type: 'TransactionStatement', action };
  }

  private parseGrant(): ASTGrantStmt {
    this.expectKeyword('GRANT');
    const privileges = this.parsePrivileges();

    let on: ASTGrantStmt['on'];
    if (this.matchKeyword('ON')) {
      let type: 'TABLE' | 'DATABASE' | 'PROCEDURE' | 'FUNCTION' = 'TABLE';
      if (this.matchKeyword('DATABASE')) type = 'DATABASE';
      else if (this.matchKeyword('PROCEDURE')) type = 'PROCEDURE';
      else if (this.matchKeyword('FUNCTION')) type = 'FUNCTION';
      else this.matchKeyword('TABLE');
      const name = this.parseIdentifierName();
      on = { type, name };
    }

    this.expectKeyword('TO');
    const to: string[] = [];
    do {
      to.push(this.parseIdentifierName());
    } while (this.match('COMMA'));

    const withGrantOption = this.matchKeyword('WITH') && this.matchKeyword('GRANT') && this.matchKeyword('OPTION');

    return { type: 'GrantStatement', privileges, on, to, withGrantOption };
  }

  private parseRevoke(): ASTRevokeStmt {
    this.expectKeyword('REVOKE');
    const privileges = this.parsePrivileges();

    let on: ASTRevokeStmt['on'];
    if (this.matchKeyword('ON')) {
      let type: 'TABLE' | 'DATABASE' = 'TABLE';
      if (this.matchKeyword('DATABASE')) type = 'DATABASE';
      else this.matchKeyword('TABLE');
      const name = this.parseIdentifierName();
      on = { type, name };
    }

    this.expectKeyword('FROM');
    const from: string[] = [];
    do {
      from.push(this.parseIdentifierName());
    } while (this.match('COMMA'));

    return { type: 'RevokeStatement', privileges, on, from };
  }

  private parsePrivileges(): string[] {
    const privileges: string[] = [];
    do {
      if (this.matchKeyword('ALL')) {
        this.matchKeyword('PRIVILEGES');
        privileges.push('ALL');
      } else {
        privileges.push(this.advance().value.toUpperCase());
      }
    } while (this.match('COMMA'));
    return privileges;
  }


  private parseExpression(minPrecedence: number = 0): ASTExpression {
    let left = this.parseUnaryExpression();

    while (true) {
      const op = this.getOperator();
      if (!op) break;

      const precedence = PRECEDENCE[op] || 0;
      if (precedence < minPrecedence) break;

      this.advance();
      if (op === 'BETWEEN') {
        const low = this.parseUnaryExpression();
        this.expectKeyword('AND');
        const high = this.parseUnaryExpression();
        left = { type: 'BetweenExpression', value: left, low, high };
        continue;
      }
      if (op === 'NOT' && this.checkKeyword('BETWEEN')) {
        this.advance();
        const low = this.parseUnaryExpression();
        this.expectKeyword('AND');
        const high = this.parseUnaryExpression();
        left = { type: 'BetweenExpression', value: left, low, high, not: true };
        continue;
      }
      if (op === 'IN') {
        left = this.parseInExpression(left, false);
        continue;
      }
      if (op === 'NOT' && this.checkKeyword('IN')) {
        this.advance();
        left = this.parseInExpression(left, true);
        continue;
      }
      if (op === 'LIKE' || op === 'REGEXP') {
        const pattern = this.parseUnaryExpression();
        let escape: string | undefined;
        if (op === 'LIKE' && this.matchKeyword('ESCAPE')) {
          escape = this.parseStringLiteral();
        }
        left = { type: 'LikeExpression', value: left, pattern, escape, regexp: op === 'REGEXP' };
        continue;
      }
      if (op === 'NOT' && this.checkKeyword('LIKE')) {
        this.advance();
        const pattern = this.parseUnaryExpression();
        let escape: string | undefined;
        if (this.matchKeyword('ESCAPE')) {
          escape = this.parseStringLiteral();
        }
        left = { type: 'LikeExpression', value: left, pattern, escape, not: true };
        continue;
      }
      if (op === 'IS') {
        const not = this.matchKeyword('NOT');
        if (this.matchKeyword('NULL')) {
          left = { type: 'IsNullExpression', value: left, not };
        } else if (this.checkKeyword('TRUE', 'FALSE')) {
          const boolVal = this.advance().value.toUpperCase() === 'TRUE';
          left = { type: 'BinaryExpression', operator: not ? '!=' : '=', left, right: { type: 'Literal', value: boolVal, raw: String(boolVal), dataType: 'boolean' } };
        }
        continue;
      }

      const right = this.parseExpression(precedence + 1);
      left = { type: 'BinaryExpression', operator: op, left, right };
    }

    return left;
  }

  private getOperator(): string | null {
    const token = this.peek();
    if (token.type === 'NOT' && this.checkKeyword('BETWEEN', 'IN', 'LIKE')) {
      return 'NOT';
    }
    if (token.type === 'EQ') return '=';
    if (token.type === 'NEQ') return '<>';
    if (token.type === 'LT') return '<';
    if (token.type === 'GT') return '>';
    if (token.type === 'LTE') return '<=';
    if (token.type === 'GTE') return '>=';
    if (token.type === 'SPACESHIP') return '<=>';
    if (token.type === 'AND') return 'AND';
    if (token.type === 'OR') return 'OR';
    if (token.type === 'PLUS') return '+';
    if (token.type === 'MINUS') return '-';
    if (token.type === 'STAR') return '*';
    if (token.type === 'SLASH') return '/';
    if (token.type === 'PERCENT') return '%';
    if (token.type === 'CARET') return '^';
    if (token.type === 'BIT_AND') return '&';
    if (token.type === 'BIT_OR') return '|';
    if (token.type === 'DOUBLE_PIPE') return '||';
    if (this.checkKeyword('AND', 'OR', 'IS', 'IN', 'BETWEEN', 'LIKE', 'REGEXP')) {
      return token.value.toUpperCase();
    }

    return null;
  }

  private parseUnaryExpression(): ASTExpression {
    if (this.match('MINUS')) {
      return { type: 'UnaryExpression', operator: '-', argument: this.parseUnaryExpression(), prefix: true };
    }
    if (this.match('PLUS')) {
      return { type: 'UnaryExpression', operator: '+', argument: this.parseUnaryExpression(), prefix: true };
    }
    if (this.matchKeyword('NOT')) {
      if (this.checkKeyword('EXISTS')) {
        this.advance();
        this.expect('LPAREN');
        const query = this.parseSelectOrUnion() as ASTSelectStmt;
        this.expect('RPAREN');
        return { type: 'ExistsExpression', subquery: { type: 'SubQuery', query }, not: true };
      }
      return { type: 'UnaryExpression', operator: 'NOT', argument: this.parseUnaryExpression(), prefix: true };
    }
    if (this.match('BIT_NOT')) {
      return { type: 'UnaryExpression', operator: '~', argument: this.parseUnaryExpression(), prefix: true };
    }

    return this.parsePrimaryExpression();
  }

  private parsePrimaryExpression(): ASTExpression {
    if (this.check('LPAREN')) {
      this.advance();
      if (this.checkKeyword('SELECT')) {
        const query = this.parseSelectOrUnion() as ASTSelectStmt;
        this.expect('RPAREN');
        return { type: 'SubQuery', query };
      }
      const expr = this.parseExpression();
      this.expect('RPAREN');
      return expr;
    }
    if (this.matchKeyword('EXISTS')) {
      this.expect('LPAREN');
      const query = this.parseSelectOrUnion() as ASTSelectStmt;
      this.expect('RPAREN');
      return { type: 'ExistsExpression', subquery: { type: 'SubQuery', query } };
    }
    if (this.checkKeyword('CASE')) {
      return this.parseCaseExpression();
    }
    if (this.matchKeyword('MATCH')) {
      return this.parseMatchAgainst();
    }
    if (this.matchKeyword('NULL')) {
      return { type: 'Literal', value: null, raw: 'NULL', dataType: 'null' };
    }
    if (this.matchKeyword('TRUE')) {
      return { type: 'Literal', value: true, raw: 'TRUE', dataType: 'boolean' };
    }
    if (this.matchKeyword('FALSE')) {
      return { type: 'Literal', value: false, raw: 'FALSE', dataType: 'boolean' };
    }
    if (this.check('NUMBER')) {
      const token = this.advance();
      const value = token.value.includes('.') ? parseFloat(token.value) : parseInt(token.value);
      return { type: 'Literal', value, raw: token.value, dataType: 'number' };
    }
    if (this.check('STRING')) {
      const token = this.advance();
      return { type: 'Literal', value: token.value, raw: `'${token.value}'`, dataType: 'string' };
    }
    if (this.match('QUESTION')) {
      return { type: 'Identifier', name: '?' };
    }
    if (this.check('IDENTIFIER') || this.isKeywordIdentifier()) {
      return this.parseIdentifierOrFunction();
    }
    if (this.check('STAR')) {
      this.advance();
      return { type: 'Identifier', name: '*' };
    }

    throw this.error(`Unexpected token: ${this.peek().value}`);
  }

  private isKeywordIdentifier(): boolean {
    return this.checkKeyword('DATE', 'TIME', 'TIMESTAMP', 'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND', 
      'NOW', 'CURRENT_DATE', 'CURRENT_TIME', 'CURRENT_TIMESTAMP', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
      'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'LEAD', 'LAG', 'FIRST_VALUE', 'LAST_VALUE', 'NTH_VALUE',
      'CONCAT', 'SUBSTRING', 'UPPER', 'LOWER', 'TRIM', 'LENGTH', 'COALESCE', 'IFNULL', 'NULLIF', 'IF',
      'CAST', 'CONVERT', 'EXTRACT', 'DATE_FORMAT', 'DATE_ADD', 'DATE_SUB', 'DATEDIFF', 'TIMEDIFF',
      'ABS', 'CEIL', 'FLOOR', 'ROUND', 'TRUNCATE', 'MOD', 'POWER', 'SQRT', 'EXP', 'LOG', 'LN',
      'SIN', 'COS', 'TAN', 'ASIN', 'ACOS', 'ATAN', 'RAND', 'SIGN', 'PI',
      'LEFT', 'RIGHT', 'REPLACE', 'REVERSE', 'REPEAT', 'SPACE', 'LPAD', 'RPAD', 'LOCATE', 'INSTR',
      'JSON_EXTRACT', 'JSON_OBJECT', 'JSON_ARRAY', 'JSON_CONTAINS', 'JSON_LENGTH',
      'GROUP_CONCAT', 'BIT_AND', 'BIT_OR', 'BIT_XOR');
  }

  private parseIdentifierOrFunction(): ASTExpression {
    const name = this.parseIdentifierName();
    if (this.check('LPAREN')) {
      return this.parseFunctionCall(name);
    }
    if (this.match('DOT')) {
      const second = this.parseIdentifierName();
      if (this.match('DOT')) {
        const third = this.parseIdentifierName();
        return { type: 'ColumnRef', table: `${name}.${second}`, column: third };
      }
      return { type: 'ColumnRef', table: name, column: second };
    }
    return { type: 'ColumnRef', column: name };
  }

  private parseFunctionCall(name: string): ASTFunctionCall {
    this.expect('LPAREN');

    const args: ASTExpression[] = [];
    let distinct = false;

    if (!this.check('RPAREN')) {
      if (this.matchKeyword('DISTINCT')) {
        distinct = true;
      }
      if (this.check('STAR')) {
        this.advance();
        args.push({ type: 'Identifier', name: '*' });
      } else {
        do {
          args.push(this.parseExpression());
        } while (this.match('COMMA'));
      }
    }

    this.expect('RPAREN');
    let over: ASTWindowSpec | undefined;
    if (this.matchKeyword('OVER')) {
      over = this.parseWindowSpec();
    }

    return { type: 'FunctionCall', name: name.toUpperCase(), args, distinct, over };
  }

  private parseWindowSpec(): ASTWindowSpec {
    this.expect('LPAREN');

    let partitionBy: ASTExpression[] | undefined;
    let orderBy: ASTOrderByItem[] | undefined;
    let frame: ASTWindowFrame | undefined;

    if (this.checkKeyword('PARTITION')) {
      this.advance();
      this.expectKeyword('BY');
      partitionBy = [];
      do {
        partitionBy.push(this.parseExpression());
      } while (this.match('COMMA'));
    }

    if (this.checkKeyword('ORDER')) {
      this.advance();
      this.expectKeyword('BY');
      orderBy = this.parseOrderByList();
    }

    if (this.checkKeyword('ROWS', 'RANGE', 'GROUPS')) {
      const frameType = this.advance().value.toUpperCase() as 'ROWS' | 'RANGE' | 'GROUPS';
      
      if (this.matchKeyword('BETWEEN')) {
        const start = this.parseFrameBound();
        this.expectKeyword('AND');
        const end = this.parseFrameBound();
        frame = { type: frameType, start, end };
      } else {
        const start = this.parseFrameBound();
        frame = { type: frameType, start };
      }
    }

    this.expect('RPAREN');

    return { partitionBy, orderBy, frame };
  }

  private parseFrameBound(): ASTFrameBound {
    if (this.matchKeyword('UNBOUNDED')) {
      if (this.matchKeyword('PRECEDING')) {
        return { type: 'UNBOUNDED_PRECEDING' };
      }
      this.expectKeyword('FOLLOWING');
      return { type: 'UNBOUNDED_FOLLOWING' };
    }

    if (this.matchKeyword('CURRENT')) {
      this.expectKeyword('ROW');
      return { type: 'CURRENT_ROW' };
    }

    const value = this.parseNumber();
    if (this.matchKeyword('PRECEDING')) {
      return { type: 'PRECEDING', value };
    }
    this.expectKeyword('FOLLOWING');
    return { type: 'FOLLOWING', value };
  }

  private parseCaseExpression(): ASTCaseExpr {
    this.expectKeyword('CASE');

    let discriminant: ASTExpression | undefined;
    const cases: Array<{ when: ASTExpression; then: ASTExpression }> = [];
    if (!this.checkKeyword('WHEN')) {
      discriminant = this.parseExpression();
    }

    while (this.matchKeyword('WHEN')) {
      const when = this.parseExpression();
      this.expectKeyword('THEN');
      const then = this.parseExpression();
      cases.push({ when, then });
    }

    let elseExpr: ASTExpression | undefined;
    if (this.matchKeyword('ELSE')) {
      elseExpr = this.parseExpression();
    }

    this.expectKeyword('END');

    return { type: 'CaseExpression', discriminant, cases, else: elseExpr };
  }

  private parseMatchAgainst(): ASTMatchAgainst {
    this.expect('LPAREN');
    const columns: ASTColumnRef[] = [];
    do {
      const col = this.parseIdentifierOrFunction() as ASTColumnRef;
      columns.push(col);
    } while (this.match('COMMA'));
    this.expect('RPAREN');

    this.expectKeyword('AGAINST');
    this.expect('LPAREN');
    const against = this.parseExpression();

    let modifier: ASTMatchAgainst['modifier'];
    if (this.matchKeyword('IN')) {
      if (this.matchKeyword('NATURAL')) {
        this.expectKeyword('LANGUAGE');
        this.expectKeyword('MODE');
        modifier = 'NATURAL LANGUAGE MODE';
        if (this.matchKeyword('WITH')) {
          this.expectKeyword('QUERY');
          this.expectKeyword('EXPANSION');
          modifier = 'WITH QUERY EXPANSION';
        }
      } else if (this.matchKeyword('BOOLEAN')) {
        this.expectKeyword('MODE');
        modifier = 'BOOLEAN MODE';
      }
    }

    this.expect('RPAREN');

    return { type: 'MatchAgainst', columns, against, modifier };
  }

  private parseInExpression(value: ASTExpression, not: boolean): ASTInExpr {
    this.expect('LPAREN');
    if (this.checkKeyword('SELECT')) {
      const query = this.parseSelectOrUnion() as ASTSelectStmt;
      this.expect('RPAREN');
      return { type: 'InExpression', value, list: { type: 'SubQuery', query }, not };
    }
    const list: ASTExpression[] = [];
    do {
      list.push(this.parseExpression());
    } while (this.match('COMMA'));
    this.expect('RPAREN');

    return { type: 'InExpression', value, list, not };
  }


  private parseIdentifierName(): string {
    const token = this.advance();
    if (token.type === 'IDENTIFIER' || token.type === 'STRING') {
      return token.value;
    }
    if (KEYWORDS_AS_IDENTIFIERS.includes(token.type)) {
      return token.value;
    }
    throw this.error(`Expected identifier, got ${token.type}`);
  }

  private parseNumber(): number {
    const token = this.expect('NUMBER');
    return parseInt(token.value);
  }

  private parseStringLiteral(): string {
    const token = this.expect('STRING');
    return token.value;
  }
}
const KEYWORDS_AS_IDENTIFIERS: TokenType[] = [
  'DATE', 'TIME', 'TIMESTAMP', 'YEAR', 'INT', 'INTEGER', 'VARCHAR', 'TEXT', 'BOOLEAN',
  'KEY', 'INDEX', 'TYPE', 'STATUS', 'NAME', 'VALUE', 'DATA', 'MODE', 'ACTION',
  'CASCADE', 'RESTRICT', 'CURRENT', 'ROW', 'ROWS', 'FIRST', 'LAST', 'NEXT', 'OPEN', 'CLOSE',
  'START', 'END', 'USER', 'ROLE', 'COMMENT', 'LANGUAGE', 'PARTITION', 'PARTITIONS',
  'RANGE', 'LIST', 'HASH', 'COLUMNS', 'TABLES', 'DATABASES', 'INDEXES', 'USING',
  'NATURAL', 'MATCH', 'AGAINST', 'BOOLEAN', 'FULLTEXT', 'WINDOW', 'OVER'
];
export const parser = new SQLASTParser();
