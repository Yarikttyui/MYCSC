import {
  SQLStatement,
  SQLOperation,
  SelectStatement,
  InsertStatement,
  UpdateStatement,
  DeleteStatement,
  CreateTableStatement,
  DropTableStatement,
  AlterTableStatement,
  WhereCondition,
  SelectColumn,
  ColumnDefinition,
  DataType,
  OrderByClause,
  JoinClause,
  TableReference,
  AlterOperation,
  ForeignKeyReference,
  IndexDefinition,
  IndexType,
  WindowFunction,
  CaseExpression
} from './types';

export class SQLParser {
  private sql: string = '';
  private tokens: string[] = [];
  private currentToken: number = 0;

  parse(sql: string): SQLStatement {
    this.sql = sql.trim();
    this.tokenize();
    this.currentToken = 0;

    const firstToken = this.peek()?.toUpperCase();

    switch (firstToken) {
      case 'SELECT':
        return this.parseSelect();
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
      case 'USE':
        return this.parseUse();
      case 'BEGIN':
      case 'START':
        return this.parseBegin();
      case 'COMMIT':
        return this.parseCommit();
      case 'ROLLBACK':
        return this.parseRollback();
      case 'SAVEPOINT':
        return this.parseSavepoint();
      case 'RELEASE':
        return this.parseReleaseSavepoint();
      case 'TRUNCATE':
        return this.parseTruncate();
      default:
        throw new Error(`Unknown SQL statement: ${firstToken}`);
    }
  }

  private tokenize(): void {
    this.tokens = [];
    let current = '';
    let inString = false;
    let stringChar = '';
    let inBacktick = false;

    for (let i = 0; i < this.sql.length; i++) {
      const char = this.sql[i];

      if (inString) {
        current += char;
        if (char === stringChar && this.sql[i - 1] !== '\\') {
          this.tokens.push(current);
          current = '';
          inString = false;
        }
      } else if (inBacktick) {
        if (char === '`') {
          this.tokens.push(current);
          current = '';
          inBacktick = false;
        } else {
          current += char;
        }
      } else if (char === '`') {
        if (current) {
          this.tokens.push(current);
          current = '';
        }
        inBacktick = true;
      } else if (char === '"' || char === "'") {
        if (current) {
          this.tokens.push(current);
          current = '';
        }
        inString = true;
        stringChar = char;
        current = char;
      } else if (/\s/.test(char)) {
        if (current) {
          this.tokens.push(current);
          current = '';
        }
      } else if ('(),;*=<>!.'.includes(char)) {
        if (current) {
          this.tokens.push(current);
          current = '';
        }
        if ((char === '<' || char === '>' || char === '!' || char === '=') && 
            i + 1 < this.sql.length && this.sql[i + 1] === '=') {
          this.tokens.push(char + '=');
          i++;
        } else if (char === '<' && i + 1 < this.sql.length && this.sql[i + 1] === '>') {
          this.tokens.push('<>');
          i++;
        } else {
          this.tokens.push(char);
        }
      } else {
        current += char;
      }
    }

    if (current) {
      this.tokens.push(current);
    }
  }

  private peek(offset: number = 0): string | undefined {
    return this.tokens[this.currentToken + offset];
  }

  private consume(): string {
    return this.tokens[this.currentToken++];
  }

  private expect(expected: string): void {
    const token = this.consume();
    if (token?.toUpperCase() !== expected.toUpperCase()) {
      throw new Error(`Expected "${expected}" but got "${token}"`);
    }
  }

  private isKeyword(token: string | undefined, ...keywords: string[]): boolean {
    if (!token) return false;
    return keywords.some(k => k.toUpperCase() === token.toUpperCase());
  }

  private isEnd(): boolean {
    return this.currentToken >= this.tokens.length || 
           this.peek() === ';' || 
           this.peek() === undefined;
  }

  private parseSelect(): SelectStatement {
    this.expect('SELECT');
    let distinct = false;
    if (this.isKeyword(this.peek(), 'DISTINCT')) {
      this.consume();
      distinct = true;
    }

    const columns = this.parseSelectColumns();
    
    this.expect('FROM');
    const from = this.parseTableReference();
    const joins: JoinClause[] = [];
    while (this.isKeyword(this.peek(), 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS')) {
      joins.push(this.parseJoin());
    }
    let where: WhereCondition | undefined;
    if (this.isKeyword(this.peek(), 'WHERE')) {
      this.consume();
      where = this.parseWhereCondition();
    }
    let groupBy: string[] | undefined;
    let having: WhereCondition | undefined;
    if (this.isKeyword(this.peek(), 'GROUP')) {
      this.consume();
      this.expect('BY');
      groupBy = this.parseGroupBy();
      if (this.isKeyword(this.peek(), 'HAVING')) {
        this.consume();
        having = this.parseWhereCondition();
      }
    }
    let orderBy: OrderByClause[] | undefined;
    if (this.isKeyword(this.peek(), 'ORDER')) {
      this.consume();
      this.expect('BY');
      orderBy = this.parseOrderBy();
    }
    let limit: number | undefined;
    let offset: number | undefined;
    if (this.isKeyword(this.peek(), 'LIMIT')) {
      this.consume();
      limit = parseInt(this.consume());
      
      if (this.isKeyword(this.peek(), 'OFFSET')) {
        this.consume();
        offset = parseInt(this.consume());
      } else if (this.peek() === ',') {
        this.consume();
        offset = limit;
        limit = parseInt(this.consume());
      }
    }
    const setOperations: any[] = [];
    while (this.isKeyword(this.peek(), 'UNION', 'INTERSECT', 'EXCEPT')) {
      const opType = this.consume().toUpperCase();
      let fullType = opType;
      
      if (opType === 'UNION' && this.isKeyword(this.peek(), 'ALL')) {
        this.consume();
        fullType = 'UNION ALL';
      }
      const nextSelect = this.parseSelect();
      setOperations.push({ type: fullType, select: nextSelect });
    }

    return {
      type: SQLOperation.SELECT,
      raw: this.sql,
      distinct,
      columns,
      from,
      joins: joins.length > 0 ? joins : undefined,
      where,
      groupBy: groupBy ? { columns: groupBy, having } : undefined,
      orderBy,
      limit,
      offset,
      setOperations: setOperations.length > 0 ? setOperations : undefined
    };
  }

  private parseTableReference(): TableReference {
    if (this.peek() === '(') {
      this.consume(); // (
      if (this.isKeyword(this.peek(), 'SELECT')) {
        const subquery = this.parseSelect();
        this.expect(')');
        let alias: string;
        if (this.isKeyword(this.peek(), 'AS')) {
          this.consume();
        }
        alias = this.consume();
        
        return { table: alias, alias, subquery };
      } else {
        this.currentToken--; 
      }
    }

    const table = this.consume();
    let alias: string | undefined;

    if (this.isKeyword(this.peek(), 'AS')) {
      this.consume();
      alias = this.consume();
    } else if (this.peek() && !this.isKeyword(this.peek(), 
      'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'WHERE', 'GROUP', 'ORDER', 'LIMIT', 'ON', ',', ')')) {
      alias = this.consume();
    }

    return { table, alias };
  }

  private parseJoin(): JoinClause {
    let type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' | 'CROSS' = 'INNER';

    if (this.isKeyword(this.peek(), 'LEFT')) {
      this.consume();
      type = 'LEFT';
      if (this.isKeyword(this.peek(), 'OUTER')) this.consume();
    } else if (this.isKeyword(this.peek(), 'RIGHT')) {
      this.consume();
      type = 'RIGHT';
      if (this.isKeyword(this.peek(), 'OUTER')) this.consume();
    } else if (this.isKeyword(this.peek(), 'FULL')) {
      this.consume();
      type = 'FULL';
      if (this.isKeyword(this.peek(), 'OUTER')) this.consume();
    } else if (this.isKeyword(this.peek(), 'CROSS')) {
      this.consume();
      type = 'CROSS';
    } else if (this.isKeyword(this.peek(), 'INNER')) {
      this.consume();
    }

    this.expect('JOIN');
    const table = this.parseTableReference();

    let on: WhereCondition | undefined;
    let using: string[] | undefined;

    if (this.isKeyword(this.peek(), 'ON')) {
      this.consume();
      on = this.parseJoinCondition();
    } else if (this.isKeyword(this.peek(), 'USING')) {
      this.consume();
      this.expect('(');
      using = [];
      do {
        if (this.peek() === ',') this.consume();
        using.push(this.consume());
      } while (this.peek() === ',');
      this.expect(')');
    }

    return { type, table, on, using };
  }

  private parseJoinCondition(): WhereCondition {
    const left = this.parseColumnRef();
    const operator = this.consume();
    const right = this.parseColumnRef();

    let condition: WhereCondition = {
      type: 'COMPARISON',
      left,
      operator: operator as any,
      value: right
    };
    while (this.isKeyword(this.peek(), 'AND', 'OR')) {
      const logicOp = this.consume().toUpperCase();
      const nextCondition = this.parseJoinCondition();
      condition = {
        type: logicOp as 'AND' | 'OR',
        left: condition,
        right: nextCondition
      };
    }

    return condition;
  }

  private parseColumnRef(): string {
    let ref = this.consume();
    while (this.peek() === '.') {
      this.consume();
      ref += '.' + this.consume();
    }
    return ref;
  }

  private parseSelectColumns(): SelectColumn[] {
    const columns: SelectColumn[] = [];

    do {
      if (this.peek() === ',') this.consume();

      const token = this.consume();
      
      if (token === '*') {
        columns.push({ expression: '*' });
      } else if (this.isKeyword(token, 'CASE')) {
        const caseExpr = this.parseCaseExpression();
        let alias: string | undefined;
        if (this.isKeyword(this.peek(), 'AS')) {
          this.consume();
          alias = this.consume();
        }
        columns.push({ expression: 'CASE', caseExpression: caseExpr, alias });
      } else if (this.isKeyword(token, 'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'NTILE', 'LEAD', 'LAG', 'FIRST_VALUE', 'LAST_VALUE')) {
        const windowFunc = this.parseWindowFunction(token.toUpperCase() as any);
        let alias: string | undefined;
        if (this.isKeyword(this.peek(), 'AS')) {
          this.consume();
          alias = this.consume();
        }
        columns.push({ expression: token.toUpperCase(), windowFunction: windowFunc, alias });
      } else if (this.isKeyword(token, 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'GROUP_CONCAT')) {
        this.expect('(');
        let distinct = false;
        if (this.isKeyword(this.peek(), 'DISTINCT')) {
          this.consume();
          distinct = true;
        }
        const inner = this.consume();
        this.expect(')');
        if (this.isKeyword(this.peek(), 'OVER')) {
          const windowFunc = this.parseWindowClause(token.toUpperCase() as any, inner);
          let alias: string | undefined;
          if (this.isKeyword(this.peek(), 'AS')) {
            this.consume();
            alias = this.consume();
          }
          columns.push({ expression: inner, windowFunction: windowFunc, alias });
        } else {
          let alias: string | undefined;
          if (this.isKeyword(this.peek(), 'AS')) {
            this.consume();
            alias = this.consume();
          }
          columns.push({
            expression: inner,
            aggregate: token.toUpperCase() as any,
            alias,
            distinct
          });
        }
      } else {
        let expression = token;
        if (this.peek() === '.') {
          this.consume();
          expression += '.' + this.consume();
        }
        
        let alias: string | undefined;
        if (this.isKeyword(this.peek(), 'AS')) {
          this.consume();
          alias = this.consume();
        } else if (this.peek() && !this.isKeyword(this.peek(), 'FROM', ',', 'OVER')) {
          const next = this.peek();
          if (next && /^[a-zA-Z_]/.test(next)) {
            alias = this.consume();
          }
        }
        
        columns.push({ expression, alias });
      }
    } while (this.peek() === ',');

    return columns;
  }
  private parseCaseExpression(): CaseExpression {
    let operand: string | undefined;
    if (!this.isKeyword(this.peek(), 'WHEN')) {
      operand = this.consume();
    }
    
    const whenClauses: Array<{ condition: any; result: any }> = [];
    
    while (this.isKeyword(this.peek(), 'WHEN')) {
      this.consume();
      let condition: any;
      
      if (operand) {
        condition = this.parseValue();
      } else {
        condition = this.parseWhereCondition();
      }
      
      this.expect('THEN');
      const result = this.parseValue();
      whenClauses.push({ condition, result });
    }
    
    let elseResult: any;
    if (this.isKeyword(this.peek(), 'ELSE')) {
      this.consume();
      elseResult = this.parseValue();
    }
    
    this.expect('END');
    
    return { operand, whenClauses, elseResult };
  }
  private parseWindowFunction(type: WindowFunction['type']): WindowFunction {
    this.expect('(');
    
    let argument: string | undefined;
    let offset: number | undefined;
    let defaultValue: any;
    if (type === 'LEAD' || type === 'LAG') {
      argument = this.consume();
      if (this.peek() === ',') {
        this.consume();
        offset = parseInt(this.consume());
        if (this.peek() === ',') {
          this.consume();
          defaultValue = this.parseValue();
        }
      }
    } else if (type === 'NTILE') {
      argument = this.consume();
    } else if (type === 'FIRST_VALUE' || type === 'LAST_VALUE') {
      argument = this.consume();
    }
    
    this.expect(')');
    
    return this.parseWindowClause(type, argument, offset, defaultValue);
  }
  private parseWindowClause(type: WindowFunction['type'], argument?: string, offset?: number, defaultValue?: any): WindowFunction {
    this.expect('OVER');
    this.expect('(');
    
    let partitionBy: string[] | undefined;
    let orderBy: OrderByClause[] | undefined;
    if (this.isKeyword(this.peek(), 'PARTITION')) {
      this.consume();
      this.expect('BY');
      partitionBy = [];
      do {
        if (this.peek() === ',') this.consume();
        partitionBy.push(this.parseColumnRef());
      } while (this.peek() === ',');
    }
    if (this.isKeyword(this.peek(), 'ORDER')) {
      this.consume();
      this.expect('BY');
      orderBy = this.parseOrderBy();
    }
    
    this.expect(')');
    
    return {
      type,
      partitionBy,
      orderBy,
      argument,
      offset,
      defaultValue
    };
  }

  private parseGroupBy(): string[] {
    const columns: string[] = [];
    
    do {
      if (this.peek() === ',') this.consume();
      columns.push(this.parseColumnRef());
    } while (this.peek() === ',');

    return columns;
  }

  private parseWhereCondition(): WhereCondition {
    return this.parseOrCondition();
  }

  private parseOrCondition(): WhereCondition {
    let left = this.parseAndCondition();

    while (this.isKeyword(this.peek(), 'OR')) {
      this.consume();
      const right = this.parseAndCondition();
      left = { type: 'OR', left, right };
    }

    return left;
  }

  private parseAndCondition(): WhereCondition {
    let left = this.parsePrimaryCondition();

    while (this.isKeyword(this.peek(), 'AND')) {
      this.consume();
      const right = this.parsePrimaryCondition();
      left = { type: 'AND', left, right };
    }

    return left;
  }

  private parsePrimaryCondition(): WhereCondition {
    if (this.isKeyword(this.peek(), 'NOT')) {
      this.consume();
      if (this.isKeyword(this.peek(), 'EXISTS')) {
        this.consume();
        this.expect('(');
        const subquery = this.parseSelect();
        this.expect(')');
        return { type: 'NOT_EXISTS', subquery };
      }
      return { type: 'NOT', right: this.parsePrimaryCondition() };
    }
    if (this.isKeyword(this.peek(), 'EXISTS')) {
      this.consume();
      this.expect('(');
      const subquery = this.parseSelect();
      this.expect(')');
      return { type: 'EXISTS', subquery };
    }
    if (this.peek() === '(') {
      this.consume();
      if (this.isKeyword(this.peek(), 'SELECT')) {
        const subquery = this.parseSelect();
        this.expect(')');
        return { type: 'SCALAR_SUBQUERY', subquery };
      }
      
      const condition = this.parseWhereCondition();
      this.expect(')');
      return condition;
    }

    const left = this.parseColumnRef();
    if (this.isKeyword(this.peek(), 'IS')) {
      this.consume();
      if (this.isKeyword(this.peek(), 'NOT')) {
        this.consume();
        this.expect('NULL');
        return { type: 'IS_NOT_NULL', left };
      }
      this.expect('NULL');
      return { type: 'IS_NULL', left };
    }
    if (this.isKeyword(this.peek(), 'IN')) {
      this.consume();
      this.expect('(');
      if (this.isKeyword(this.peek(), 'SELECT')) {
        const subquery = this.parseSelect();
        this.expect(')');
        return { type: 'IN_SUBQUERY', left, subquery };
      }
      const values: any[] = [];
      do {
        if (this.peek() === ',') this.consume();
        values.push(this.parseValue());
      } while (this.peek() === ',');
      this.expect(')');
      return { type: 'IN', left, right: values };
    }
    if (this.isKeyword(this.peek(), 'NOT') && this.isKeyword(this.peek(1), 'IN')) {
      this.consume();
      this.consume();
      this.expect('(');
      if (this.isKeyword(this.peek(), 'SELECT')) {
        const subquery = this.parseSelect();
        this.expect(')');
        return { type: 'NOT_IN_SUBQUERY', left, subquery };
      }
      
      const values: any[] = [];
      do {
        if (this.peek() === ',') this.consume();
        values.push(this.parseValue());
      } while (this.peek() === ',');
      this.expect(')');
      return { type: 'NOT', right: { type: 'IN', left, right: values } };
    }
    if (this.isKeyword(this.peek(), 'BETWEEN')) {
      this.consume();
      const min = this.parseValue();
      this.expect('AND');
      const max = this.parseValue();
      return { type: 'BETWEEN', left, right: [min, max] };
    }
    if (this.isKeyword(this.peek(), 'LIKE')) {
      this.consume();
      const pattern = this.parseValue();
      return { type: 'LIKE', left, value: pattern };
    }
    if (this.isKeyword(this.peek(), 'NOT') && this.isKeyword(this.peek(1), 'LIKE')) {
      this.consume();
      this.consume();
      const pattern = this.parseValue();
      return { type: 'NOT', right: { type: 'LIKE', left, value: pattern } };
    }
    if (this.isKeyword(this.peek(), 'REGEXP', 'RLIKE')) {
      this.consume();
      const pattern = this.parseValue();
      return { type: 'REGEXP', left, value: pattern };
    }
    if (this.isKeyword(this.peek(), 'NOT') && this.isKeyword(this.peek(1), 'REGEXP', 'RLIKE')) {
      this.consume();
      this.consume();
      const pattern = this.parseValue();
      return { type: 'NOT_REGEXP', left, value: pattern };
    }
    const operator = this.consume();
    if (this.isKeyword(this.peek(), 'ANY', 'ALL', 'SOME')) {
      const quantifier = this.consume().toUpperCase();
      this.expect('(');
      const subquery = this.parseSelect();
      this.expect(')');
      return {
        type: 'COMPARISON',
        left,
        operator: (quantifier === 'SOME' ? 'ANY' : quantifier) as any,
        subquery
      };
    }
    if (this.peek() === '(') {
      this.consume();
      if (this.isKeyword(this.peek(), 'SELECT')) {
        const subquery = this.parseSelect();
        this.expect(')');
        return {
          type: 'COMPARISON',
          left,
          operator: operator as any,
          subquery
        };
      }
      this.currentToken--;
    }
    
    const right = this.parseValue();

    return {
      type: 'COMPARISON',
      left,
      operator: operator as any,
      value: right
    };
  }

  private parseValue(): any {
    const token = this.consume();
    if (token.startsWith("'") || token.startsWith('"')) {
      return token.slice(1, -1);
    }
    if (!isNaN(Number(token))) {
      return token.includes('.') ? parseFloat(token) : parseInt(token);
    }
    if (token.toUpperCase() === 'NULL') {
      return null;
    }
    if (token.toUpperCase() === 'TRUE') return true;
    if (token.toUpperCase() === 'FALSE') return false;
    return token;
  }

  private parseOrderBy(): OrderByClause[] {
    const clauses: OrderByClause[] = [];

    do {
      if (this.peek() === ',') this.consume();

      const column = this.parseColumnRef();
      let direction: 'ASC' | 'DESC' = 'ASC';

      if (this.isKeyword(this.peek(), 'ASC', 'DESC')) {
        direction = this.consume().toUpperCase() as 'ASC' | 'DESC';
      }

      clauses.push({ column, direction });
    } while (this.peek() === ',');

    return clauses;
  }

  private parseInsert(): InsertStatement {
    this.expect('INSERT');
    
    let ignore = false;
    if (this.isKeyword(this.peek(), 'IGNORE')) {
      this.consume();
      ignore = true;
    }
    
    this.expect('INTO');

    const table = this.consume();
    const columns: string[] = [];
    const values: any[][] = [];
    if (this.peek() === '(') {
      this.consume();
      do {
        if (this.peek() === ',') this.consume();
        columns.push(this.consume());
      } while (this.peek() === ',');
      this.expect(')');
    }

    this.expect('VALUES');
    do {
      if (this.peek() === ',') this.consume();
      
      this.expect('(');
      const rowValues: any[] = [];
      
      do {
        if (this.peek() === ',') this.consume();
        rowValues.push(this.parseValue());
      } while (this.peek() === ',');
      
      this.expect(')');
      values.push(rowValues);
    } while (this.peek() === ',');
    let onDuplicateKey: Record<string, any> | undefined;
    if (this.isKeyword(this.peek(), 'ON')) {
      this.consume();
      this.expect('DUPLICATE');
      this.expect('KEY');
      this.expect('UPDATE');
      onDuplicateKey = this.parseSetClause();
    }

    return {
      type: SQLOperation.INSERT,
      raw: this.sql,
      table,
      columns,
      values,
      ignore,
      onDuplicateKey
    };
  }

  private parseUpdate(): UpdateStatement {
    this.expect('UPDATE');
    const table = this.consume();
    this.expect('SET');

    const set = this.parseSetClause();

    let where: WhereCondition | undefined;
    if (this.isKeyword(this.peek(), 'WHERE')) {
      this.consume();
      where = this.parseWhereCondition();
    }

    let orderBy: OrderByClause[] | undefined;
    if (this.isKeyword(this.peek(), 'ORDER')) {
      this.consume();
      this.expect('BY');
      orderBy = this.parseOrderBy();
    }

    let limit: number | undefined;
    if (this.isKeyword(this.peek(), 'LIMIT')) {
      this.consume();
      limit = parseInt(this.consume());
    }

    return {
      type: SQLOperation.UPDATE,
      raw: this.sql,
      table,
      set,
      where,
      orderBy,
      limit
    };
  }

  private parseSetClause(): Record<string, any> {
    const set: Record<string, any> = {};

    do {
      if (this.peek() === ',') this.consume();
      
      const column = this.consume();
      this.expect('=');
      const value = this.parseValue();
      set[column] = value;
    } while (this.peek() === ',');

    return set;
  }

  private parseDelete(): DeleteStatement {
    this.expect('DELETE');
    this.expect('FROM');
    const table = this.consume();

    let where: WhereCondition | undefined;
    if (this.isKeyword(this.peek(), 'WHERE')) {
      this.consume();
      where = this.parseWhereCondition();
    }

    let orderBy: OrderByClause[] | undefined;
    if (this.isKeyword(this.peek(), 'ORDER')) {
      this.consume();
      this.expect('BY');
      orderBy = this.parseOrderBy();
    }

    let limit: number | undefined;
    if (this.isKeyword(this.peek(), 'LIMIT')) {
      this.consume();
      limit = parseInt(this.consume());
    }

    return {
      type: SQLOperation.DELETE,
      raw: this.sql,
      table,
      where,
      orderBy,
      limit
    };
  }

  private parseCreate(): SQLStatement {
    this.expect('CREATE');
    const next = this.peek()?.toUpperCase();

    if (next === 'TABLE') {
      return this.parseCreateTable();
    } else if (next === 'INDEX' || next === 'UNIQUE') {
      return this.parseCreateIndex();
    } else if (next === 'DATABASE') {
      return this.parseCreateDatabase();
    }

    throw new Error(`Unknown CREATE statement: CREATE ${next}`);
  }

  private parseCreateTable(): CreateTableStatement {
    this.expect('TABLE');

    let ifNotExists = false;
    if (this.isKeyword(this.peek(), 'IF')) {
      this.consume();
      this.expect('NOT');
      this.expect('EXISTS');
      ifNotExists = true;
    }

    const table = this.consume();
    this.expect('(');

    const columns: ColumnDefinition[] = [];

    do {
      if (this.peek() === ',') this.consume();
      
      const firstWord = this.peek()?.toUpperCase();
      if (firstWord === 'PRIMARY') {
        this.consume();
        this.expect('KEY');
        this.expect('(');
        while (this.peek() !== ')') {
          if (this.peek() === ',') this.consume();
          const pkCol = this.consume();
          const col = columns.find(c => c.name === pkCol);
          if (col) col.primaryKey = true;
        }
        this.consume(); // )
        continue;
      }
      if (firstWord === 'FOREIGN') {
        this.consume();
        this.expect('KEY');
        this.expect('(');
        const fkCol = this.consume();
        this.expect(')');
        this.expect('REFERENCES');
        const refTable = this.consume();
        this.expect('(');
        const refCol = this.consume();
        this.expect(')');
        
        let onDelete: any = 'RESTRICT';
        let onUpdate: any = 'RESTRICT';
        
        while (this.isKeyword(this.peek(), 'ON')) {
          this.consume();
          if (this.isKeyword(this.peek(), 'DELETE')) {
            this.consume();
            onDelete = this.parseReferentialAction();
          } else if (this.isKeyword(this.peek(), 'UPDATE')) {
            this.consume();
            onUpdate = this.parseReferentialAction();
          }
        }
        
        const col = columns.find(c => c.name === fkCol);
        if (col) {
          col.references = { table: refTable, column: refCol, onDelete, onUpdate };
        }
        continue;
      }
      if (firstWord === 'UNIQUE' || firstWord === 'INDEX' || firstWord === 'KEY') {
        while (this.peek() !== ',' && this.peek() !== ')') {
          this.consume();
        }
        continue;
      }
      const colName = this.consume();
      const colType = this.parseDataType();
      const colDef = this.parseColumnConstraints(colName, colType);
      columns.push(colDef);
    } while (this.peek() === ',');

    this.expect(')');
    let engine: string | undefined;
    let charset: string | undefined;
    
    while (!this.isEnd()) {
      if (this.isKeyword(this.peek(), 'ENGINE')) {
        this.consume();
        if (this.peek() === '=') this.consume();
        engine = this.consume();
      } else if (this.isKeyword(this.peek(), 'DEFAULT', 'CHARSET', 'CHARACTER')) {
        if (this.isKeyword(this.peek(), 'DEFAULT')) this.consume();
        if (this.isKeyword(this.peek(), 'CHARACTER')) {
          this.consume();
          this.expect('SET');
        } else if (this.isKeyword(this.peek(), 'CHARSET')) {
          this.consume();
        }
        if (this.peek() === '=') this.consume();
        charset = this.consume();
      } else {
        break;
      }
    }

    return {
      type: SQLOperation.CREATE_TABLE,
      raw: this.sql,
      table,
      columns,
      ifNotExists,
      engine,
      charset
    };
  }

  private parseReferentialAction(): string {
    if (this.isKeyword(this.peek(), 'CASCADE')) {
      this.consume();
      return 'CASCADE';
    } else if (this.isKeyword(this.peek(), 'SET')) {
      this.consume();
      if (this.isKeyword(this.peek(), 'NULL')) {
        this.consume();
        return 'SET NULL';
      } else if (this.isKeyword(this.peek(), 'DEFAULT')) {
        this.consume();
        return 'SET DEFAULT';
      }
    } else if (this.isKeyword(this.peek(), 'RESTRICT')) {
      this.consume();
      return 'RESTRICT';
    } else if (this.isKeyword(this.peek(), 'NO')) {
      this.consume();
      this.expect('ACTION');
      return 'NO ACTION';
    }
    return 'RESTRICT';
  }

  private parseDataType(): { type: DataType; length?: number; precision?: number; scale?: number; enumValues?: string[] } {
    const typeStr = this.consume().toUpperCase();
    let length: number | undefined;
    let precision: number | undefined;
    let scale: number | undefined;
    let enumValues: string[] | undefined;

    if (this.peek() === '(') {
      this.consume();
      
      if (typeStr === 'ENUM' || typeStr === 'SET') {
        enumValues = [];
        do {
          if (this.peek() === ',') this.consume();
          const val = this.consume();
          enumValues.push(val.startsWith("'") ? val.slice(1, -1) : val);
        } while (this.peek() === ',');
      } else {
        precision = parseInt(this.consume());
        if (this.peek() === ',') {
          this.consume();
          scale = parseInt(this.consume());
          length = precision;
        } else {
          length = precision;
          precision = undefined;
        }
      }
      this.expect(')');
    }

    const typeMap: Record<string, DataType> = {
      'INT': DataType.INTEGER,
      'INTEGER': DataType.INTEGER,
      'TINYINT': DataType.TINYINT,
      'SMALLINT': DataType.SMALLINT,
      'BIGINT': DataType.BIGINT,
      'FLOAT': DataType.FLOAT,
      'DOUBLE': DataType.DOUBLE,
      'DECIMAL': DataType.DECIMAL,
      'NUMERIC': DataType.DECIMAL,
      'VARCHAR': DataType.VARCHAR,
      'CHAR': DataType.CHAR,
      'TEXT': DataType.TEXT,
      'MEDIUMTEXT': DataType.MEDIUMTEXT,
      'LONGTEXT': DataType.LONGTEXT,
      'BOOLEAN': DataType.BOOLEAN,
      'BOOL': DataType.BOOLEAN,
      'DATE': DataType.DATE,
      'TIME': DataType.TIME,
      'DATETIME': DataType.DATETIME,
      'TIMESTAMP': DataType.TIMESTAMP,
      'YEAR': DataType.YEAR,
      'BLOB': DataType.BLOB,
      'MEDIUMBLOB': DataType.MEDIUMBLOB,
      'LONGBLOB': DataType.LONGBLOB,
      'BINARY': DataType.BINARY,
      'VARBINARY': DataType.VARBINARY,
      'JSON': DataType.JSON,
      'UUID': DataType.UUID,
      'ENUM': DataType.ENUM,
      'SET': DataType.SET
    };

    return {
      type: typeMap[typeStr] || DataType.VARCHAR,
      length,
      precision,
      scale,
      enumValues
    };
  }

  private parseColumnConstraints(name: string, dataType: any): ColumnDefinition {
    const column: ColumnDefinition = {
      name,
      type: dataType.type,
      length: dataType.length,
      precision: dataType.precision,
      scale: dataType.scale,
      enumValues: dataType.enumValues,
      nullable: true,
      primaryKey: false,
      unique: false,
      autoIncrement: false
    };

    while (this.peek() && this.peek() !== ',' && this.peek() !== ')') {
      const constraint = this.peek()?.toUpperCase();

      switch (constraint) {
        case 'PRIMARY':
          this.consume();
          this.expect('KEY');
          column.primaryKey = true;
          column.nullable = false;
          break;
        case 'NOT':
          this.consume();
          this.expect('NULL');
          column.nullable = false;
          break;
        case 'NULL':
          this.consume();
          column.nullable = true;
          break;
        case 'UNIQUE':
          this.consume();
          column.unique = true;
          break;
        case 'AUTO_INCREMENT':
        case 'AUTOINCREMENT':
          this.consume();
          column.autoIncrement = true;
          break;
        case 'DEFAULT':
          this.consume();
          column.defaultValue = this.parseValue();
          break;
        case 'REFERENCES':
          this.consume();
          const refTable = this.consume();
          this.expect('(');
          const refCol = this.consume();
          this.expect(')');
          column.references = {
            table: refTable,
            column: refCol,
            onDelete: 'RESTRICT',
            onUpdate: 'RESTRICT'
          };
          break;
        case 'COMMENT':
          this.consume();
          column.comment = this.parseValue();
          break;
        case 'UNSIGNED':
        case 'ZEROFILL':
          this.consume();
          break;
        default:
          return column;
      }
    }

    return column;
  }

  private parseCreateIndex(): SQLStatement {
    let unique = false;
    if (this.isKeyword(this.peek(), 'UNIQUE')) {
      this.consume();
      unique = true;
    }
    
    this.expect('INDEX');
    const indexName = this.consume();
    this.expect('ON');
    const tableName = this.consume();
    
    this.expect('(');
    const columns: string[] = [];
    do {
      if (this.peek() === ',') this.consume();
      columns.push(this.consume());
    } while (this.peek() === ',');
    this.expect(')');

    return {
      type: SQLOperation.CREATE_INDEX,
      raw: this.sql,
      indexName,
      tableName,
      columns,
      unique
    } as any;
  }

  private parseCreateDatabase(): SQLStatement {
    this.expect('DATABASE');
    
    let ifNotExists = false;
    if (this.isKeyword(this.peek(), 'IF')) {
      this.consume();
      this.expect('NOT');
      this.expect('EXISTS');
      ifNotExists = true;
    }

    const database = this.consume();

    return {
      type: SQLOperation.CREATE_DATABASE,
      raw: this.sql,
      database,
      ifNotExists
    } as any;
  }

  private parseDrop(): SQLStatement {
    this.expect('DROP');
    const next = this.peek()?.toUpperCase();

    if (next === 'TABLE') {
      return this.parseDropTable();
    } else if (next === 'INDEX') {
      return this.parseDropIndex();
    } else if (next === 'DATABASE') {
      return this.parseDropDatabase();
    }

    throw new Error(`Unknown DROP statement: DROP ${next}`);
  }

  private parseDropTable(): DropTableStatement {
    this.expect('TABLE');

    let ifExists = false;
    if (this.isKeyword(this.peek(), 'IF')) {
      this.consume();
      this.expect('EXISTS');
      ifExists = true;
    }

    const table = this.consume();

    return {
      type: SQLOperation.DROP_TABLE,
      raw: this.sql,
      table,
      ifExists
    };
  }

  private parseDropIndex(): SQLStatement {
    this.expect('INDEX');
    const indexName = this.consume();
    this.expect('ON');
    const tableName = this.consume();

    return {
      type: SQLOperation.DROP_INDEX,
      raw: this.sql,
      indexName,
      tableName
    } as any;
  }

  private parseDropDatabase(): SQLStatement {
    this.expect('DATABASE');
    
    let ifExists = false;
    if (this.isKeyword(this.peek(), 'IF')) {
      this.consume();
      this.expect('EXISTS');
      ifExists = true;
    }

    const database = this.consume();

    return {
      type: SQLOperation.DROP_DATABASE,
      raw: this.sql,
      database,
      ifExists
    } as any;
  }

  private parseAlter(): AlterTableStatement {
    this.expect('ALTER');
    this.expect('TABLE');
    const table = this.consume();
    
    const operations: AlterOperation[] = [];

    do {
      if (this.peek() === ',') this.consume();
      
      const action = this.consume().toUpperCase();

      if (action === 'ADD') {
        if (this.isKeyword(this.peek(), 'COLUMN')) {
          this.consume();
        }
        
        if (this.isKeyword(this.peek(), 'INDEX', 'KEY')) {
          this.consume();
          const indexName = this.consume();
          this.expect('(');
          const cols: string[] = [];
          do {
            if (this.peek() === ',') this.consume();
            cols.push(this.consume());
          } while (this.peek() === ',');
          this.expect(')');
          operations.push({ 
            type: 'ADD_INDEX', 
            index: { name: indexName, columns: cols, unique: false, type: IndexType.BTREE } 
          });
        } else if (this.isKeyword(this.peek(), 'PRIMARY')) {
          this.consume();
          this.expect('KEY');
          this.expect('(');
          const cols: string[] = [];
          do {
            if (this.peek() === ',') this.consume();
            cols.push(this.consume());
          } while (this.peek() === ',');
          this.expect(')');
          operations.push({ type: 'ADD_PRIMARY_KEY', index: { name: 'PRIMARY', columns: cols, unique: true, type: IndexType.BTREE } });
        } else if (this.isKeyword(this.peek(), 'FOREIGN')) {
          this.consume();
          this.expect('KEY');
          this.expect('(');
          const fkCol = this.consume();
          this.expect(')');
          this.expect('REFERENCES');
          const refTable = this.consume();
          this.expect('(');
          const refCol = this.consume();
          this.expect(')');
          operations.push({ 
            type: 'ADD_FOREIGN_KEY', 
            foreignKey: { table: refTable, column: refCol, onDelete: 'RESTRICT', onUpdate: 'RESTRICT' },
            oldName: fkCol
          });
        } else {
          const colName = this.consume();
          const colType = this.parseDataType();
          const colDef = this.parseColumnConstraints(colName, colType);
          operations.push({ type: 'ADD_COLUMN', column: colDef });
        }
      } else if (action === 'DROP') {
        if (this.isKeyword(this.peek(), 'COLUMN')) {
          this.consume();
          operations.push({ type: 'DROP_COLUMN', oldName: this.consume() });
        } else if (this.isKeyword(this.peek(), 'INDEX', 'KEY')) {
          this.consume();
          operations.push({ type: 'DROP_INDEX', oldName: this.consume() });
        } else if (this.isKeyword(this.peek(), 'PRIMARY')) {
          this.consume();
          this.expect('KEY');
          operations.push({ type: 'DROP_PRIMARY_KEY' });
        } else if (this.isKeyword(this.peek(), 'FOREIGN')) {
          this.consume();
          this.expect('KEY');
          operations.push({ type: 'DROP_FOREIGN_KEY', oldName: this.consume() });
        } else {
          operations.push({ type: 'DROP_COLUMN', oldName: this.consume() });
        }
      } else if (action === 'MODIFY') {
        if (this.isKeyword(this.peek(), 'COLUMN')) this.consume();
        const colName = this.consume();
        const colType = this.parseDataType();
        const colDef = this.parseColumnConstraints(colName, colType);
        operations.push({ type: 'MODIFY_COLUMN', column: colDef });
      } else if (action === 'CHANGE') {
        if (this.isKeyword(this.peek(), 'COLUMN')) this.consume();
        const oldName = this.consume();
        const newName = this.consume();
        const colType = this.parseDataType();
        const colDef = this.parseColumnConstraints(newName, colType);
        operations.push({ type: 'RENAME_COLUMN', oldName, newName, column: colDef });
      } else if (action === 'RENAME') {
        if (this.isKeyword(this.peek(), 'TO')) this.consume();
        operations.push({ type: 'RENAME_TABLE', newName: this.consume() });
      }
    } while (this.peek() === ',');

    return {
      type: SQLOperation.ALTER_TABLE,
      raw: this.sql,
      table,
      operations
    };
  }

  private parseUse(): SQLStatement {
    this.expect('USE');
    const database = this.consume();
    return { type: SQLOperation.USE, raw: this.sql, database } as any;
  }

  private parseBegin(): SQLStatement {
    this.consume();
    if (this.isKeyword(this.peek(), 'TRANSACTION')) this.consume();
    return { type: SQLOperation.BEGIN, raw: this.sql } as any;
  }

  private parseCommit(): SQLStatement {
    this.expect('COMMIT');
    return { type: SQLOperation.COMMIT, raw: this.sql } as any;
  }

  private parseRollback(): SQLStatement {
    this.expect('ROLLBACK');
    let savepoint: string | undefined;
    if (this.isKeyword(this.peek(), 'TO')) {
      this.consume();
      if (this.isKeyword(this.peek(), 'SAVEPOINT')) this.consume();
      savepoint = this.consume();
    }
    return { type: SQLOperation.ROLLBACK, raw: this.sql, savepoint } as any;
  }

  private parseSavepoint(): SQLStatement {
    this.expect('SAVEPOINT');
    const name = this.consume();
    return { type: SQLOperation.SAVEPOINT, raw: this.sql, name } as any;
  }

  private parseReleaseSavepoint(): SQLStatement {
    this.expect('RELEASE');
    if (this.isKeyword(this.peek(), 'SAVEPOINT')) this.consume();
    const name = this.consume();
    return { type: SQLOperation.RELEASE_SAVEPOINT, raw: this.sql, name } as any;
  }

  private parseTruncate(): SQLStatement {
    this.expect('TRUNCATE');
    if (this.isKeyword(this.peek(), 'TABLE')) this.consume();
    const table = this.consume();
    return { type: SQLOperation.TRUNCATE, raw: this.sql, table } as any;
  }
}

export const sqlParser = new SQLParser();
