import { SQLParser } from './parser';
import { StorageEngine } from './storage';
import { TransactionManager } from './transaction';
import { IndexManager } from './btree';
import {
  QueryResult,
  SQLOperation,
  SelectStatement,
  InsertStatement,
  UpdateStatement,
  DeleteStatement,
  CreateTableStatement,
  DropTableStatement,
  AlterTableStatement,
  WhereCondition,
  TableSchema,
  Row,
  DataType,
  JoinClause,
  AlterOperation,
  IndexType,
  SelectColumn,
  WindowFunction,
  CaseExpression,
  SetOperation
} from './types';

export class QueryExecutor {
  private parser: SQLParser;
  private storage: StorageEngine;
  private transactionManager: TransactionManager;
  private indexManager: IndexManager;
  private currentDatabase: string = 'default';

  constructor(storage: StorageEngine) {
    this.parser = new SQLParser();
    this.storage = storage;
    this.transactionManager = new TransactionManager();
    this.indexManager = new IndexManager();
  }

  async execute(sql: string): Promise<QueryResult> {
    const startTime = Date.now();

    try {
      const statement = this.parser.parse(sql);
      let result: QueryResult;

      switch (statement.type) {
        case SQLOperation.SELECT:
          result = await this.executeSelect(statement as SelectStatement);
          break;
        case SQLOperation.INSERT:
          result = await this.executeInsert(statement as InsertStatement);
          break;
        case SQLOperation.UPDATE:
          result = await this.executeUpdate(statement as UpdateStatement);
          break;
        case SQLOperation.DELETE:
          result = await this.executeDelete(statement as DeleteStatement);
          break;
        case SQLOperation.CREATE_TABLE:
          result = await this.executeCreateTable(statement as CreateTableStatement);
          break;
        case SQLOperation.DROP_TABLE:
          result = await this.executeDropTable(statement as DropTableStatement);
          break;
        case SQLOperation.ALTER_TABLE:
          result = await this.executeAlterTable(statement as AlterTableStatement);
          break;
        case SQLOperation.CREATE_DATABASE:
          result = this.executeCreateDatabase(statement as any);
          break;
        case SQLOperation.DROP_DATABASE:
          result = this.executeDropDatabase(statement as any);
          break;
        case SQLOperation.CREATE_INDEX:
          result = this.executeCreateIndex(statement as any);
          break;
        case SQLOperation.DROP_INDEX:
          result = this.executeDropIndex(statement as any);
          break;
        case SQLOperation.USE:
          result = this.executeUse(statement as any);
          break;
        case SQLOperation.BEGIN:
          result = this.executeBegin();
          break;
        case SQLOperation.COMMIT:
          result = this.executeCommit();
          break;
        case SQLOperation.ROLLBACK:
          result = this.executeRollback(statement as any);
          break;
        case SQLOperation.SAVEPOINT:
          result = this.executeSavepoint(statement as any);
          break;
        case SQLOperation.RELEASE_SAVEPOINT:
          result = this.executeReleaseSavepoint(statement as any);
          break;
        case SQLOperation.TRUNCATE:
          result = this.executeTruncate(statement as any);
          break;
        default:
          throw new Error(`Unsupported operation: ${statement.type}`);
      }

      result.executionTime = Date.now() - startTime;
      return result;
    } catch (error: any) {
      const errorResult: QueryResult = {
        success: false,
        error: this.formatErrorMessage(error, sql),
        executionTime: Date.now() - startTime
      };
      const errorInfo = this.parseErrorLocation(error.message, sql);
      if (errorInfo.line) {
        errorResult.errorLine = errorInfo.line;
        errorResult.errorPosition = errorInfo.position;
      }
      
      return errorResult;
    }
  }
  private formatErrorMessage(error: any, sql: string): string {
    const msg = error.message || String(error);
    const errorMappings: Record<string, string> = {
      'Unknown SQL statement': 'Неизвестный SQL оператор',
      'Unexpected token': 'Неожиданный токен',
      'Expected': 'Ожидалось',
      'Table not found': 'Таблица не найдена',
      'Column not found': 'Колонка не найдена',
      'Duplicate entry': 'Дублирующееся значение',
      'Syntax error': 'Синтаксическая ошибка',
      'Database not found': 'База данных не найдена',
      'already exists': 'уже существует',
      'cannot be null': 'не может быть NULL',
      'PRIMARY KEY constraint': 'нарушение ограничения PRIMARY KEY',
      'UNIQUE constraint': 'нарушение ограничения UNIQUE',
      'FOREIGN KEY constraint': 'нарушение ограничения FOREIGN KEY'
    };
    
    let result = msg;
    for (const [en, ru] of Object.entries(errorMappings)) {
      if (msg.includes(en)) {
        result = msg.replace(en, ru);
      }
    }
    
    return result;
  }
  private parseErrorLocation(message: string, sql: string): { line?: number; position?: number } {
    const posMatch = message.match(/position\s*(\d+)/i);
    const lineMatch = message.match(/line\s*(\d+)/i);
    
    if (lineMatch) {
      return {
        line: parseInt(lineMatch[1]),
        position: posMatch ? parseInt(posMatch[1]) : undefined
      };
    }
    const tokenMatch = message.match(/(?:unexpected|unknown|invalid)\s+(?:token\s+)?['"]?(\w+)['"]?/i);
    if (tokenMatch) {
      const token = tokenMatch[1];
      const index = sql.toUpperCase().indexOf(token.toUpperCase());
      if (index >= 0) {
        const beforeError = sql.substring(0, index);
        const lines = beforeError.split('\n');
        return {
          line: lines.length,
          position: lines[lines.length - 1].length + 1
        };
      }
    }
    
    return {};
  }

  private async executeSelect(stmt: SelectStatement): Promise<QueryResult> {
    let resultRows: Row[];
    let primaryAlias: string;
    let schema: TableSchema | undefined;

    if (stmt.from.subquery) {
      const subResult = await this.executeSelect(stmt.from.subquery);
      if (!subResult.success || !subResult.rows) {
        throw new Error('Subquery in FROM failed');
      }
      resultRows = subResult.rows;
      primaryAlias = stmt.from.alias || 'subquery';
      resultRows = resultRows.map(row => {
        const prefixedRow: Row = {};
        for (const [key, value] of Object.entries(row)) {
          prefixedRow[`${primaryAlias}.${key}`] = value;
          prefixedRow[key] = value;
        }
        return prefixedRow;
      });
    } else {
      const primaryTable = stmt.from.table;
      primaryAlias = stmt.from.alias || primaryTable;
      schema = this.storage.getSchema(primaryTable);

      if (!schema) {
        throw new Error(`Table "${primaryTable}" does not exist`);
      }
      resultRows = this.storage.select(primaryTable, '*');
      resultRows = resultRows.map(row => {
        const prefixedRow: Row = {};
        for (const [key, value] of Object.entries(row)) {
          prefixedRow[`${primaryAlias}.${key}`] = value;
          prefixedRow[key] = value;
        }
        return prefixedRow;
      });
    }
    if (stmt.joins && stmt.joins.length > 0) {
      for (const join of stmt.joins) {
        resultRows = this.executeJoin(resultRows, join, primaryAlias);
      }
    }
    if (stmt.where) {
      resultRows = this.executeWhereWithIndex(resultRows, stmt.where, schema, stmt.from.table);
    }
    const hasAggregate = stmt.columns.some(c => c.aggregate);
    if (stmt.groupBy || hasAggregate) {
      resultRows = this.executeGroupBy(resultRows, stmt);
    }
    if (stmt.groupBy?.having) {
      resultRows = resultRows.filter(row => this.evaluateWhere(stmt.groupBy!.having!, row));
    }
    const windowColumns = stmt.columns.filter(c => c.windowFunction);
    if (windowColumns.length > 0) {
      resultRows = this.executeWindowFunctions(resultRows, windowColumns);
    }
    if (stmt.orderBy && stmt.orderBy.length > 0) {
      resultRows = this.sortRows(resultRows, stmt.orderBy);
    }
    if (stmt.distinct) {
      const seen = new Set<string>();
      resultRows = resultRows.filter(row => {
        const key = JSON.stringify(this.selectColumns(row, stmt.columns));
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    if (stmt.offset) {
      resultRows = resultRows.slice(stmt.offset);
    }
    if (stmt.limit) {
      resultRows = resultRows.slice(0, stmt.limit);
    }
    let finalRows = resultRows.map(row => this.selectColumns(row, stmt.columns));
    let columnNames: string[];
    if (stmt.columns.length === 1 && stmt.columns[0].expression === '*') {
      columnNames = schema ? this.getAllColumnsFromJoin(stmt, schema) : Object.keys(finalRows[0] || {});
    } else {
      columnNames = stmt.columns.map(c => c.alias || this.formatColumnName(c));
    }
    if (stmt.setOperations && stmt.setOperations.length > 0) {
      finalRows = await this.executeSetOperations(finalRows, stmt.setOperations, columnNames);
    }

    return {
      success: true,
      rows: finalRows,
      columns: columnNames,
      executionTime: 0
    };
  }

  private executeJoin(leftRows: Row[], join: JoinClause, leftAlias: string): Row[] {
    const rightTable = join.table.table;
    const rightAlias = join.table.alias || rightTable;
    
    const rightSchema = this.storage.getSchema(rightTable);
    if (!rightSchema) {
      throw new Error(`Table "${rightTable}" does not exist`);
    }

    const rightRows = this.storage.select(rightTable, '*');
    const result: Row[] = [];

    switch (join.type) {
      case 'INNER':
        for (const leftRow of leftRows) {
          for (const rightRow of rightRows) {
            const combinedRow = this.combineRows(leftRow, rightRow, rightAlias);
            if (this.evaluateJoinCondition(combinedRow, join)) {
              result.push(combinedRow);
            }
          }
        }
        break;

      case 'LEFT':
        for (const leftRow of leftRows) {
          let matched = false;
          for (const rightRow of rightRows) {
            const combinedRow = this.combineRows(leftRow, rightRow, rightAlias);
            if (this.evaluateJoinCondition(combinedRow, join)) {
              result.push(combinedRow);
              matched = true;
            }
          }
          if (!matched) {
            result.push(this.combineRows(leftRow, null, rightAlias, rightSchema.columns.map(c => c.name)));
          }
        }
        break;

      case 'RIGHT':
        for (const rightRow of rightRows) {
          let matched = false;
          for (const leftRow of leftRows) {
            const combinedRow = this.combineRows(leftRow, rightRow, rightAlias);
            if (this.evaluateJoinCondition(combinedRow, join)) {
              result.push(combinedRow);
              matched = true;
            }
          }
          if (!matched) {
            result.push(this.combineRows(null, rightRow, rightAlias, Object.keys(leftRows[0] || {})));
          }
        }
        break;

      case 'FULL':
        const matchedRight = new Set<number>();
        
        for (const leftRow of leftRows) {
          let matched = false;
          for (let i = 0; i < rightRows.length; i++) {
            const combinedRow = this.combineRows(leftRow, rightRows[i], rightAlias);
            if (this.evaluateJoinCondition(combinedRow, join)) {
              result.push(combinedRow);
              matched = true;
              matchedRight.add(i);
            }
          }
          if (!matched) {
            result.push(this.combineRows(leftRow, null, rightAlias, rightSchema.columns.map(c => c.name)));
          }
        }
        
        for (let i = 0; i < rightRows.length; i++) {
          if (!matchedRight.has(i)) {
            result.push(this.combineRows(null, rightRows[i], rightAlias, Object.keys(leftRows[0] || {})));
          }
        }
        break;

      case 'CROSS':
        for (const leftRow of leftRows) {
          for (const rightRow of rightRows) {
            result.push(this.combineRows(leftRow, rightRow, rightAlias));
          }
        }
        break;
    }

    return result;
  }

  private combineRows(leftRow: Row | null, rightRow: Row | null, rightAlias: string, nullColumns?: string[]): Row {
    const combined: Row = {};

    if (leftRow) {
      Object.assign(combined, leftRow);
    } else if (nullColumns) {
      for (const col of nullColumns) {
        combined[col] = null;
      }
    }

    if (rightRow) {
      for (const [key, value] of Object.entries(rightRow)) {
        combined[`${rightAlias}.${key}`] = value;
        if (!(key in combined)) {
          combined[key] = value;
        }
      }
    } else if (nullColumns) {
      const rightSchema = this.storage.getSchema(rightAlias);
      if (rightSchema) {
        for (const col of rightSchema.columns) {
          combined[`${rightAlias}.${col.name}`] = null;
        }
      }
    }

    return combined;
  }

  private evaluateJoinCondition(row: Row, join: JoinClause): boolean {
    if (join.on) {
      return this.evaluateWhere(join.on, row);
    }
    
    if (join.using) {
      for (const col of join.using) {
        const leftVal = row[col];
        const rightVal = row[`${join.table.alias || join.table.table}.${col}`];
        if (leftVal !== rightVal) return false;
      }
      return true;
    }
    return true;
  }

  private executeGroupBy(rows: Row[], stmt: SelectStatement): Row[] {
    const groupByColumns = stmt.groupBy?.columns || [];
    if (groupByColumns.length === 0) {
      const aggregated = this.aggregateRows(rows, stmt.columns);
      return [aggregated];
    }
    const groups = new Map<string, Row[]>();
    
    for (const row of rows) {
      const key = groupByColumns.map(col => this.getColumnValue(row, col)).join('|||');
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(row);
    }
    const result: Row[] = [];
    
    for (const [_, groupRows] of groups) {
      const aggregated = this.aggregateRows(groupRows, stmt.columns);
      for (const col of groupByColumns) {
        aggregated[col] = this.getColumnValue(groupRows[0], col);
      }
      result.push(aggregated);
    }

    return result;
  }

  private aggregateRows(rows: Row[], columns: SelectColumn[]): Row {
    const result: Row = {};

    for (const col of columns) {
      const alias = col.alias || this.formatColumnName(col);

      if (col.aggregate) {
        const values = col.distinct
          ? [...new Set(rows.map(r => this.getColumnValue(r, col.expression)))]
          : rows.map(r => this.getColumnValue(r, col.expression));

        switch (col.aggregate) {
          case 'COUNT':
            result[alias] = col.expression === '*' 
              ? rows.length 
              : values.filter(v => v !== null && v !== undefined).length;
            break;
          case 'SUM':
            result[alias] = values.reduce((sum, v) => sum + (Number(v) || 0), 0);
            break;
          case 'AVG':
            const numValues = values.filter(v => v !== null && v !== undefined);
            result[alias] = numValues.length > 0
              ? numValues.reduce((sum, v) => sum + Number(v), 0) / numValues.length
              : null;
            break;
          case 'MIN':
            result[alias] = values.length > 0 ? Math.min(...values.filter(v => v !== null).map(Number)) : null;
            break;
          case 'MAX':
            result[alias] = values.length > 0 ? Math.max(...values.filter(v => v !== null).map(Number)) : null;
            break;
          case 'GROUP_CONCAT':
            result[alias] = values.filter(v => v !== null).join(',');
            break;
        }
      } else if (col.expression !== '*') {
        result[alias] = this.getColumnValue(rows[0], col.expression);
      }
    }

    return result;
  }

  private getColumnValue(row: Row, expression: string): any {
    if (expression in row) return row[expression];
    for (const [key, value] of Object.entries(row)) {
      if (key.endsWith(`.${expression}`)) return value;
    }

    return row[expression];
  }

  private selectColumns(row: Row, columns: SelectColumn[], allRows?: Row[], rowIndex?: number): Row {
    if (columns.length === 1 && columns[0].expression === '*') {
      const result: Row = {};
      for (const [key, value] of Object.entries(row)) {
        if (!key.includes('.')) {
          result[key] = value;
        }
      }
      return result;
    }

    const result: Row = {};
    for (const col of columns) {
      const alias = col.alias || this.formatColumnName(col);
      
      if (col.aggregate) {
        result[alias] = row[alias];
      } else if (col.windowFunction) {
        result[alias] = row[alias] !== undefined ? row[alias] : null;
      } else if (col.caseExpression) {
        result[alias] = this.evaluateCaseExpression(col.caseExpression, row);
      } else {
        result[alias] = this.getColumnValue(row, col.expression);
      }
    }
    return result;
  }
  private evaluateCaseExpression(caseExpr: CaseExpression, row: Row): any {
    if (caseExpr.operand) {
      const value = this.getColumnValue(row, caseExpr.operand);
      for (const when of caseExpr.whenClauses) {
        if (value === when.condition) {
          return this.resolveValue(when.result, row);
        }
      }
    } else {
      for (const when of caseExpr.whenClauses) {
        if (this.evaluateWhere(when.condition, row)) {
          return this.resolveValue(when.result, row);
        }
      }
    }
    return caseExpr.elseResult !== undefined ? this.resolveValue(caseExpr.elseResult, row) : null;
  }
  private resolveValue(value: any, row: Row): any {
    if (typeof value === 'string' && !value.startsWith("'") && !value.startsWith('"')) {
      const colValue = this.getColumnValue(row, value);
      return colValue !== undefined ? colValue : value;
    }
    return value;
  }

  private formatColumnName(col: SelectColumn): string {
    if (col.aggregate) {
      return `${col.aggregate}(${col.expression})`;
    }
    return col.expression;
  }

  private getAllColumnsFromJoin(stmt: SelectStatement, primarySchema: TableSchema): string[] {
    const columns = primarySchema.columns.map(c => c.name);
    
    if (stmt.joins) {
      for (const join of stmt.joins) {
        const schema = this.storage.getSchema(join.table.table);
        if (schema) {
          columns.push(...schema.columns.map(c => c.name));
        }
      }
    }

    return [...new Set(columns)];
  }

  private sortRows(rows: Row[], orderBy: Array<{ column: string; direction: 'ASC' | 'DESC' }>): Row[] {
    return [...rows].sort((a, b) => {
      for (const order of orderBy) {
        const aVal = this.getColumnValue(a, order.column);
        const bVal = this.getColumnValue(b, order.column);
        
        let comparison = 0;
        if (aVal < bVal) comparison = -1;
        else if (aVal > bVal) comparison = 1;
        
        if (comparison !== 0) {
          return order.direction === 'DESC' ? -comparison : comparison;
        }
      }
      return 0;
    });
  }

  private executeWindowFunctions(rows: Row[], windowColumns: SelectColumn[]): Row[] {
    const result = rows.map(row => ({ ...row }));

    for (const col of windowColumns) {
      const wf = col.windowFunction!;
      const alias = col.alias || col.expression;
      const partitions = this.partitionRows(result, wf.partitionBy || []);

      for (const partition of partitions) {
        if (wf.orderBy && wf.orderBy.length > 0) {
          partition.rows.sort((a, b) => {
            for (const order of wf.orderBy!) {
              const aVal = this.getColumnValue(a, order.column);
              const bVal = this.getColumnValue(b, order.column);
              let cmp = 0;
              if (aVal < bVal) cmp = -1;
              else if (aVal > bVal) cmp = 1;
              if (cmp !== 0) return order.direction === 'DESC' ? -cmp : cmp;
            }
            return 0;
          });
        }
        for (let i = 0; i < partition.rows.length; i++) {
          const row = partition.rows[i];
          row[alias] = this.calculateWindowValue(wf, partition.rows, i);
        }
      }
    }

    return result;
  }

  private partitionRows(rows: Row[], partitionBy: string[]): Array<{ key: string; rows: Row[] }> {
    if (partitionBy.length === 0) {
      return [{ key: '', rows }];
    }

    const groups = new Map<string, Row[]>();
    for (const row of rows) {
      const key = partitionBy.map(col => String(this.getColumnValue(row, col))).join('|||');
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(row);
    }

    return Array.from(groups.entries()).map(([key, rows]) => ({ key, rows }));
  }

  private calculateWindowValue(wf: WindowFunction, rows: Row[], currentIndex: number): any {
    switch (wf.type) {
      case 'ROW_NUMBER':
        return currentIndex + 1;

      case 'RANK': {
        if (!wf.orderBy || wf.orderBy.length === 0) return 1;
        let rank = 1;
        const currentVal = this.getOrderByValue(rows[currentIndex], wf.orderBy);
        for (let i = 0; i < currentIndex; i++) {
          const prevVal = this.getOrderByValue(rows[i], wf.orderBy);
          if (this.compareOrderByValues(prevVal, currentVal, wf.orderBy) !== 0) {
            rank = i + 1;
          }
        }
        for (let i = 0; i <= currentIndex; i++) {
          const val = this.getOrderByValue(rows[i], wf.orderBy);
          if (this.compareOrderByValues(val, currentVal, wf.orderBy) === 0) {
            return i + 1;
          }
        }
        return rank;
      }

      case 'DENSE_RANK': {
        if (!wf.orderBy || wf.orderBy.length === 0) return 1;
        let rank = 1;
        const currentVal = this.getOrderByValue(rows[currentIndex], wf.orderBy);
        const seenValues = new Set<string>();
        for (let i = 0; i < currentIndex; i++) {
          const prevVal = this.getOrderByValue(rows[i], wf.orderBy);
          const key = JSON.stringify(prevVal);
          if (!seenValues.has(key)) {
            seenValues.add(key);
          }
        }
        const uniqueValues: any[][] = [];
        for (let i = 0; i <= currentIndex; i++) {
          const val = this.getOrderByValue(rows[i], wf.orderBy);
          if (!uniqueValues.some(v => JSON.stringify(v) === JSON.stringify(val))) {
            uniqueValues.push(val);
          }
        }
        return uniqueValues.length;
      }

      case 'NTILE': {
        const n = parseInt(wf.argument || '1');
        const bucketSize = Math.ceil(rows.length / n);
        return Math.floor(currentIndex / bucketSize) + 1;
      }

      case 'LEAD': {
        const offset = wf.offset || 1;
        const targetIndex = currentIndex + offset;
        if (targetIndex >= rows.length) {
          return wf.defaultValue !== undefined ? wf.defaultValue : null;
        }
        return this.getColumnValue(rows[targetIndex], wf.argument!);
      }

      case 'LAG': {
        const offset = wf.offset || 1;
        const targetIndex = currentIndex - offset;
        if (targetIndex < 0) {
          return wf.defaultValue !== undefined ? wf.defaultValue : null;
        }
        return this.getColumnValue(rows[targetIndex], wf.argument!);
      }

      case 'FIRST_VALUE':
        return this.getColumnValue(rows[0], wf.argument!);

      case 'LAST_VALUE':
        return this.getColumnValue(rows[rows.length - 1], wf.argument!);

      case 'SUM': {
        const values = rows.map(r => Number(this.getColumnValue(r, wf.argument!)) || 0);
        return values.reduce((sum, v) => sum + v, 0);
      }

      case 'AVG': {
        const values = rows.map(r => Number(this.getColumnValue(r, wf.argument!)) || 0);
        return values.reduce((sum, v) => sum + v, 0) / values.length;
      }

      case 'COUNT':
        return wf.argument === '*' ? rows.length : rows.filter(r => this.getColumnValue(r, wf.argument!) !== null).length;

      case 'MIN': {
        const values = rows.map(r => this.getColumnValue(r, wf.argument!)).filter(v => v !== null);
        return values.length > 0 ? Math.min(...values.map(Number)) : null;
      }

      case 'MAX': {
        const values = rows.map(r => this.getColumnValue(r, wf.argument!)).filter(v => v !== null);
        return values.length > 0 ? Math.max(...values.map(Number)) : null;
      }

      default:
        return null;
    }
  }

  private getOrderByValue(row: Row, orderBy: Array<{ column: string; direction: 'ASC' | 'DESC' }>): any[] {
    return orderBy.map(o => this.getColumnValue(row, o.column));
  }

  private compareOrderByValues(a: any[], b: any[], orderBy: Array<{ column: string; direction: 'ASC' | 'DESC' }>): number {
    for (let i = 0; i < orderBy.length; i++) {
      if (a[i] < b[i]) return orderBy[i].direction === 'DESC' ? 1 : -1;
      if (a[i] > b[i]) return orderBy[i].direction === 'DESC' ? -1 : 1;
    }
    return 0;
  }

  private async executeSetOperations(rows: Row[], operations: SetOperation[], columnNames: string[]): Promise<Row[]> {
    let result = rows;

    for (const op of operations) {
      const otherResult = await this.executeSelect(op.select);
      if (!otherResult.success || !otherResult.rows) {
        throw new Error('Set operation subquery failed');
      }

      const otherRows = otherResult.rows;

      switch (op.type) {
        case 'UNION':
          result = this.unionRows(result, otherRows, columnNames, true);
          break;

        case 'UNION ALL':
          result = this.unionRows(result, otherRows, columnNames, false);
          break;

        case 'INTERSECT':
          result = this.intersectRows(result, otherRows, columnNames);
          break;

        case 'EXCEPT':
          result = this.exceptRows(result, otherRows, columnNames);
          break;
      }
    }

    return result;
  }

  private unionRows(rows1: Row[], rows2: Row[], columns: string[], distinct: boolean): Row[] {
    const combined = [...rows1, ...rows2];
    
    if (!distinct) {
      return combined;
    }
    const seen = new Set<string>();
    return combined.filter(row => {
      const key = columns.map(c => JSON.stringify(row[c])).join('|||');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private intersectRows(rows1: Row[], rows2: Row[], columns: string[]): Row[] {
    const set2 = new Set(rows2.map(row => 
      columns.map(c => JSON.stringify(row[c])).join('|||')
    ));

    const seen = new Set<string>();
    return rows1.filter(row => {
      const key = columns.map(c => JSON.stringify(row[c])).join('|||');
      if (seen.has(key) || !set2.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private exceptRows(rows1: Row[], rows2: Row[], columns: string[]): Row[] {
    const set2 = new Set(rows2.map(row => 
      columns.map(c => JSON.stringify(row[c])).join('|||')
    ));

    const seen = new Set<string>();
    return rows1.filter(row => {
      const key = columns.map(c => JSON.stringify(row[c])).join('|||');
      if (seen.has(key) || set2.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async executeInsert(stmt: InsertStatement): Promise<QueryResult> {
    const schema = this.storage.getSchema(stmt.table);
    if (!schema) {
      throw new Error(`Table "${stmt.table}" does not exist`);
    }

    let lastInsertId = 0;
    let affectedRows = 0;

    for (const values of stmt.values) {
      const row: Row = {};
      
      if (stmt.columns.length > 0) {
        for (let i = 0; i < stmt.columns.length; i++) {
          row[stmt.columns[i]] = values[i];
        }
      } else {
        for (let i = 0; i < values.length && i < schema.columns.length; i++) {
          row[schema.columns[i].name] = values[i];
        }
      }
      this.validateRow(row, schema);
      this.validateForeignKeys(row, schema, 'INSERT');

      try {
        lastInsertId = this.storage.insert(stmt.table, row);
        this.updateIndexesOnInsert(stmt.table, row, lastInsertId);
        
        affectedRows++;
      } catch (error: any) {
        if (stmt.ignore) {
          continue;
        }
        throw error;
      }
    }

    return {
      success: true,
      affectedRows,
      insertId: lastInsertId,
      executionTime: 0
    };
  }
  private validateForeignKeys(row: Row, schema: TableSchema, operation: 'INSERT' | 'UPDATE'): void {
    for (const col of schema.columns) {
      if (!col.references) continue;
      
      const value = row[col.name];
      if (value === null || value === undefined) continue;
      
      const refTable = col.references.table;
      const refColumn = col.references.column;
      const refSchema = this.storage.getSchema(refTable);
      
      if (!refSchema) {
        throw new Error(`Referenced table "${refTable}" does not exist`);
      }
      const refRows = this.storage.select(refTable, [refColumn], 
        r => r[refColumn] === value);
      
      if (refRows.length === 0) {
        throw new Error(
          `Foreign key constraint failed: Cannot ${operation.toLowerCase()} row. ` +
          `Value '${value}' in column '${col.name}' does not exist in '${refTable}.${refColumn}'`
        );
      }
    }
  }
  private checkChildReferences(tableName: string, row: Row, oldRow: Row, schema: TableSchema): void {
    const childTables = this.findChildTables(tableName);
    
    for (const child of childTables) {
      const childSchema = this.storage.getSchema(child.tableName);
      if (!childSchema) continue;
      
      for (const fk of child.foreignKeys) {
        const oldValue = oldRow[fk.refColumn];
        const newValue = row[fk.refColumn];
        if (oldValue !== newValue && oldValue !== undefined) {
          const childRows = this.storage.select(child.tableName, '*',
            r => r[fk.column] === oldValue);
          
          if (childRows.length > 0) {
            const col = childSchema.columns.find(c => c.name === fk.column);
            const onUpdate = col?.references?.onUpdate || 'RESTRICT';
            
            switch (onUpdate) {
              case 'RESTRICT':
              case 'NO ACTION':
                throw new Error(
                  `Foreign key constraint failed: Cannot update '${tableName}.${fk.refColumn}' ` +
                  `because it is referenced by '${child.tableName}.${fk.column}'`
                );
              case 'CASCADE':
                this.storage.update(child.tableName, 
                  { [fk.column]: newValue },
                  r => r[fk.column] === oldValue);
                break;
              case 'SET NULL':
                this.storage.update(child.tableName,
                  { [fk.column]: null },
                  r => r[fk.column] === oldValue);
                break;
              case 'SET DEFAULT':
                const defaultVal = col?.defaultValue;
                this.storage.update(child.tableName,
                  { [fk.column]: defaultVal },
                  r => r[fk.column] === oldValue);
                break;
            }
          }
        }
      }
    }
  }
  private checkChildReferencesOnDelete(tableName: string, row: Row): void {
    const childTables = this.findChildTables(tableName);
    
    for (const child of childTables) {
      const childSchema = this.storage.getSchema(child.tableName);
      if (!childSchema) continue;
      
      for (const fk of child.foreignKeys) {
        const pkValue = row[fk.refColumn];
        if (pkValue === undefined || pkValue === null) continue;
        
        const childRows = this.storage.select(child.tableName, '*',
          r => r[fk.column] === pkValue);
        
        if (childRows.length > 0) {
          const col = childSchema.columns.find(c => c.name === fk.column);
          const onDelete = col?.references?.onDelete || 'RESTRICT';
          
          switch (onDelete) {
            case 'RESTRICT':
            case 'NO ACTION':
              throw new Error(
                `Foreign key constraint failed: Cannot delete from '${tableName}' ` +
                `because value '${pkValue}' is referenced by '${child.tableName}.${fk.column}'`
              );
            case 'CASCADE':
              this.storage.delete(child.tableName, r => r[fk.column] === pkValue);
              break;
            case 'SET NULL':
              this.storage.update(child.tableName,
                { [fk.column]: null },
                r => r[fk.column] === pkValue);
              break;
            case 'SET DEFAULT':
              const defaultVal = col?.defaultValue;
              this.storage.update(child.tableName,
                { [fk.column]: defaultVal },
                r => r[fk.column] === pkValue);
              break;
          }
        }
      }
    }
  }
  private findChildTables(parentTable: string): Array<{tableName: string; foreignKeys: Array<{column: string; refColumn: string}>}> {
    const result: Array<{tableName: string; foreignKeys: Array<{column: string; refColumn: string}>}> = [];
    
    const allTables = this.storage.listTables();
    for (const tableName of allTables) {
      const schema = this.storage.getSchema(tableName);
      if (!schema) continue;
      
      const foreignKeys: Array<{column: string; refColumn: string}> = [];
      
      for (const col of schema.columns) {
        if (col.references && col.references.table === parentTable) {
          foreignKeys.push({
            column: col.name,
            refColumn: col.references.column
          });
        }
      }
      
      if (foreignKeys.length > 0) {
        result.push({ tableName, foreignKeys });
      }
    }
    
    return result;
  }

  private validateRow(row: Row, schema: TableSchema): void {
    for (const col of schema.columns) {
      const value = row[col.name];
      if (!col.nullable && value === null && !col.autoIncrement) {
        if (col.defaultValue === undefined) {
          throw new Error(`Column "${col.name}" cannot be NULL`);
        }
      }
      if (col.unique && value !== null) {
        const existing = this.storage.select(schema.name, [col.name], 
          r => r[col.name] === value);
        if (existing.length > 0) {
          throw new Error(`Duplicate entry '${value}' for key '${col.name}'`);
        }
      }
      if (col.check && value !== null) {
      }
    }
  }

  private updateIndexesOnInsert(table: string, row: Row, id: number): void {
    const schema = this.storage.getSchema(table);
    if (!schema?.indexes) return;

    for (const idx of schema.indexes) {
      const key = idx.columns.map(c => row[c]).join('|||');
      this.indexManager.addToIndex(table, idx.name, key, id);
    }
  }

  private async executeUpdate(stmt: UpdateStatement): Promise<QueryResult> {
    const schema = this.storage.getSchema(stmt.table);
    if (!schema) {
      throw new Error(`Table "${stmt.table}" does not exist`);
    }
    const allRows = this.storage.select(stmt.table, '*');
    const whereFunc = stmt.where
      ? (row: Row) => this.evaluateWhere(stmt.where!, row)
      : () => true;
    
    const rowsToUpdate = allRows.filter(whereFunc);
    for (const oldRow of rowsToUpdate) {
      const newRow = { ...oldRow, ...stmt.set };
      this.validateForeignKeys(stmt.set, schema, 'UPDATE');
      this.checkChildReferences(stmt.table, newRow, oldRow, schema);
    }
    
    const actualWhereFunc = stmt.where
      ? (row: Row) => this.evaluateWhere(stmt.where!, row)
      : undefined;

    const affectedRows = this.storage.update(stmt.table, stmt.set, actualWhereFunc);

    return {
      success: true,
      affectedRows,
      executionTime: 0
    };
  }

  private async executeDelete(stmt: DeleteStatement): Promise<QueryResult> {
    const schema = this.storage.getSchema(stmt.table);
    if (!schema) {
      throw new Error(`Table "${stmt.table}" does not exist`);
    }
    const allRows = this.storage.select(stmt.table, '*');
    const whereFunc = stmt.where
      ? (row: Row) => this.evaluateWhere(stmt.where!, row)
      : () => true;
    
    const rowsToDelete = allRows.filter(whereFunc);
    for (const row of rowsToDelete) {
      this.checkChildReferencesOnDelete(stmt.table, row);
    }
    
    const actualWhereFunc = stmt.where
      ? (row: Row) => this.evaluateWhere(stmt.where!, row)
      : undefined;

    const affectedRows = this.storage.delete(stmt.table, actualWhereFunc);

    return {
      success: true,
      affectedRows,
      executionTime: 0
    };
  }

  private async executeCreateTable(stmt: CreateTableStatement): Promise<QueryResult> {
    const schema: TableSchema = {
      name: stmt.table,
      columns: stmt.columns,
      indexes: [],
      primaryKey: stmt.columns.filter(c => c.primaryKey).map(c => c.name),
      foreignKeys: stmt.columns
        .filter(c => c.references)
        .map(c => c.references!),
      relations: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    try {
      this.storage.createTable(schema);
      if (schema.primaryKey.length > 0) {
        const pkIndexName = `pk_${stmt.table}`;
        this.indexManager.createIndex(stmt.table, pkIndexName);
      }

      return { success: true, executionTime: 0 };
    } catch (error: any) {
      if (stmt.ifNotExists && error.message.includes('already exists')) {
        return { success: true, executionTime: 0 };
      }
      throw error;
    }
  }

  private async executeDropTable(stmt: DropTableStatement): Promise<QueryResult> {
    try {
      this.storage.dropTable(stmt.table);
      return { success: true, executionTime: 0 };
    } catch (error: any) {
      if (stmt.ifExists && error.message.includes('does not exist')) {
        return { success: true, executionTime: 0 };
      }
      throw error;
    }
  }

  private async executeAlterTable(stmt: AlterTableStatement): Promise<QueryResult> {
    const schema = this.storage.getSchema(stmt.table);
    if (!schema) {
      throw new Error(`Table "${stmt.table}" does not exist`);
    }

    for (const op of stmt.operations) {
      switch (op.type) {
        case 'ADD_COLUMN':
          schema.columns.push(op.column!);
          break;
        
        case 'DROP_COLUMN':
          schema.columns = schema.columns.filter(c => c.name !== op.oldName);
          break;
        
        case 'MODIFY_COLUMN':
          const modIdx = schema.columns.findIndex(c => c.name === op.column!.name);
          if (modIdx >= 0) {
            schema.columns[modIdx] = op.column!;
          }
          break;
        
        case 'RENAME_COLUMN':
          const renIdx = schema.columns.findIndex(c => c.name === op.oldName);
          if (renIdx >= 0) {
            schema.columns[renIdx] = op.column!;
          }
          break;
        
        case 'ADD_INDEX':
          if (op.index) {
            schema.indexes = schema.indexes || [];
            schema.indexes.push(op.index);
            this.indexManager.createIndex(stmt.table, op.index.name);
          }
          break;
        
        case 'DROP_INDEX':
          schema.indexes = (schema.indexes || []).filter(i => i.name !== op.oldName);
          this.indexManager.dropIndex(stmt.table, op.oldName!);
          break;
        
        case 'ADD_PRIMARY_KEY':
          schema.primaryKey = op.index?.columns || [];
          break;
        
        case 'DROP_PRIMARY_KEY':
          schema.primaryKey = [];
          break;
        
        case 'RENAME_COLUMN':
          if (op.oldName && op.newName) {
            const colIndex = schema.columns.findIndex(c => c.name === op.oldName);
            if (colIndex === -1) {
              throw new Error(`Column "${op.oldName}" does not exist`);
            }
            if (schema.columns.find(c => c.name === op.newName)) {
              throw new Error(`Column "${op.newName}" already exists`);
            }
            schema.columns[colIndex].name = op.newName;
            const rows = this.storage.select(stmt.table, '*');
            for (const row of rows) {
              if (op.oldName in row) {
                row[op.newName] = row[op.oldName];
                delete row[op.oldName];
              }
            }
            if (schema.primaryKey?.includes(op.oldName) && op.newName) {
              schema.primaryKey = schema.primaryKey.map(k => k === op.oldName ? op.newName! : k);
            }
            if (schema.indexes) {
              for (const idx of schema.indexes) {
                idx.columns = idx.columns.map(c => c === op.oldName ? op.newName! : c);
              }
            }
          }
          break;
        
        case 'RENAME_TABLE':
          if (op.newName) {
            const tableData = this.storage.select(stmt.table, '*');
            const oldSchema = this.storage.getSchema(stmt.table);
            if (oldSchema) {
              const newSchema = { ...oldSchema, name: op.newName };
              this.storage.createTable(newSchema);
              for (const row of tableData) {
                this.storage.insert(op.newName, row);
              }
              this.storage.dropTable(stmt.table);
            }
          }
          break;
      }
    }

    schema.updatedAt = new Date();
    return { success: true, executionTime: 0 };
  }

  private executeCreateDatabase(stmt: { database: string; ifNotExists?: boolean }): QueryResult {
    return { success: true, executionTime: 0 };
  }

  private executeDropDatabase(stmt: { database: string; ifExists?: boolean }): QueryResult {
    return { success: true, executionTime: 0 };
  }

  private executeUse(stmt: { database: string }): QueryResult {
    this.currentDatabase = stmt.database;
    return { success: true, executionTime: 0 };
  }

  private executeCreateIndex(stmt: { indexName: string; tableName: string; columns: string[]; unique?: boolean }): QueryResult {
    const schema = this.storage.getSchema(stmt.tableName);
    if (!schema) {
      throw new Error(`Table "${stmt.tableName}" does not exist`);
    }
    for (const col of stmt.columns) {
      if (!schema.columns.find(c => c.name === col)) {
        throw new Error(`Column "${col}" does not exist in table "${stmt.tableName}"`);
      }
    }
    if (stmt.unique) {
      const rows = this.storage.select(stmt.tableName, '*');
      const seen = new Set<string>();
      
      for (const row of rows) {
        const key = stmt.columns.map(c => row[c]).join('|||');
        if (seen.has(key)) {
          throw new Error(`Duplicate entry for UNIQUE index "${stmt.indexName}" on columns (${stmt.columns.join(', ')})`);
        }
        seen.add(key);
      }
    }
    this.indexManager.createIndex(stmt.tableName, stmt.indexName);
    this.buildIndexFromData(stmt.tableName, stmt.indexName, stmt.columns);
    schema.indexes = schema.indexes || [];
    schema.indexes.push({
      name: stmt.indexName,
      columns: stmt.columns,
      unique: stmt.unique || false,
      type: IndexType.BTREE
    });

    return { success: true, executionTime: 0 };
  }

  private executeDropIndex(stmt: { indexName: string; tableName: string }): QueryResult {
    this.indexManager.dropIndex(stmt.tableName, stmt.indexName);
    
    const schema = this.storage.getSchema(stmt.tableName);
    if (schema) {
      schema.indexes = (schema.indexes || []).filter(i => i.name !== stmt.indexName);
    }

    return { success: true, executionTime: 0 };
  }

  private currentTransactionId: string | null = null;

  private executeBegin(): QueryResult {
    const txId = this.transactionManager.begin();
    this.currentTransactionId = txId;
    return { success: true, executionTime: 0 };
  }

  private executeCommit(): QueryResult {
    if (this.currentTransactionId) {
      this.transactionManager.commit(this.currentTransactionId);
      this.currentTransactionId = null;
    }
    return { success: true, executionTime: 0 };
  }

  private executeRollback(stmt: { savepoint?: string }): QueryResult {
    if (this.currentTransactionId) {
      if (stmt.savepoint) {
        this.transactionManager.rollbackToSavepoint(this.currentTransactionId, stmt.savepoint);
      } else {
        this.transactionManager.rollback(this.currentTransactionId);
        this.currentTransactionId = null;
      }
    }
    return { success: true, executionTime: 0 };
  }

  private executeSavepoint(stmt: { name: string }): QueryResult {
    if (this.currentTransactionId) {
      this.transactionManager.savepoint(this.currentTransactionId, stmt.name);
      return { success: true, executionTime: 0 };
    }
    throw new Error('No active transaction for SAVEPOINT');
  }

  private executeReleaseSavepoint(stmt: { name: string }): QueryResult {
    if (this.currentTransactionId) {
      this.transactionManager.releaseSavepoint(this.currentTransactionId, stmt.name);
      return { success: true, executionTime: 0 };
    }
    throw new Error('No active transaction for RELEASE SAVEPOINT');
  }

  private executeTruncate(stmt: { table: string }): QueryResult {
    this.storage.delete(stmt.table, () => true);
    return { success: true, executionTime: 0 };
  }

  private evaluateWhere(condition: WhereCondition, row: Row, outerRow?: Row): boolean {
    switch (condition.type) {
      case 'AND':
        return this.evaluateWhere(condition.left as WhereCondition, row, outerRow) &&
               this.evaluateWhere(condition.right as WhereCondition, row, outerRow);
      
      case 'OR':
        return this.evaluateWhere(condition.left as WhereCondition, row, outerRow) ||
               this.evaluateWhere(condition.right as WhereCondition, row, outerRow);
      
      case 'NOT':
        return !this.evaluateWhere(condition.right as WhereCondition, row, outerRow);
      
      case 'COMPARISON':
        const leftVal = this.getColumnValue(row, condition.left as string);
        let rightVal = condition.value;
        if (condition.subquery) {
          const subResult = this.executeSubquerySync(condition.subquery, row);
          if (condition.operator === 'ANY' || condition.operator === 'ALL') {
            const subValues = subResult.map(r => Object.values(r)[0]);
            const baseOp = condition.operator;
            
            if (baseOp === 'ANY') {
              return subValues.some(sv => this.compare(leftVal, '=', sv));
            } else {
              return subValues.every(sv => this.compare(leftVal, '=', sv));
            }
          }
          if (subResult.length > 0) {
            rightVal = Object.values(subResult[0])[0];
          } else {
            rightVal = null;
          }
        }
        if (typeof rightVal === 'string' && !rightVal?.startsWith?.("'")) {
          const colVal = this.getColumnValue(row, rightVal);
          if (colVal !== undefined) {
            rightVal = colVal;
          }
        }
        
        return this.compare(leftVal, condition.operator!, rightVal);
      
      case 'IS_NULL':
        return this.getColumnValue(row, condition.left as string) === null;
      
      case 'IS_NOT_NULL':
        return this.getColumnValue(row, condition.left as string) !== null;
      
      case 'LIKE':
        const pattern = (condition.value as string)
          .replace(/%/g, '.*')
          .replace(/_/g, '.');
        const regex = new RegExp(`^${pattern}$`, 'i');
        return regex.test(String(this.getColumnValue(row, condition.left as string) || ''));
      
      case 'IN':
        return (condition.right as any[]).includes(this.getColumnValue(row, condition.left as string));
      
      case 'IN_SUBQUERY':
        if (condition.subquery) {
          const subResult = this.executeSubquerySync(condition.subquery, row);
          const subValues = subResult.map(r => Object.values(r)[0]);
          const leftValue = this.getColumnValue(row, condition.left as string);
          return subValues.includes(leftValue);
        }
        return false;
      
      case 'NOT_IN_SUBQUERY':
        if (condition.subquery) {
          const subResult = this.executeSubquerySync(condition.subquery, row);
          const subValues = subResult.map(r => Object.values(r)[0]);
          const leftValue = this.getColumnValue(row, condition.left as string);
          return !subValues.includes(leftValue);
        }
        return true;
      
      case 'EXISTS':
        if (condition.subquery) {
          const subResult = this.executeSubquerySync(condition.subquery, row);
          return subResult.length > 0;
        }
        return false;
      
      case 'NOT_EXISTS':
        if (condition.subquery) {
          const subResult = this.executeSubquerySync(condition.subquery, row);
          return subResult.length === 0;
        }
        return true;
      
      case 'BETWEEN':
        const val = this.getColumnValue(row, condition.left as string);
        const [min, max] = condition.right as any[];
        return val >= min && val <= max;
      
      case 'REGEXP':
        try {
          const regexPattern = new RegExp(condition.value as string);
          const testValue = String(this.getColumnValue(row, condition.left as string) || '');
          return regexPattern.test(testValue);
        } catch {
          return false;
        }
      
      case 'NOT_REGEXP':
        try {
          const regexPattern = new RegExp(condition.value as string);
          const testValue = String(this.getColumnValue(row, condition.left as string) || '');
          return !regexPattern.test(testValue);
        } catch {
          return false;
        }
      
      case 'CASE':
        if (condition.caseExpression) {
          const caseResult = this.evaluateCaseExpression(condition.caseExpression, row);
          return !!caseResult;
        }
        return false;
      
      default:
        return true;
    }
  }
  private executeSubquerySync(subquery: SelectStatement, outerRow?: Row): Row[] {
    const primaryTable = subquery.from.table;
    const primaryAlias = subquery.from.alias || primaryTable;
    if (subquery.from.subquery) {
      const innerResult = this.executeSubquerySync(subquery.from.subquery, outerRow);
      let resultRows = innerResult.map(row => {
        const prefixedRow: Row = {};
        for (const [key, value] of Object.entries(row)) {
          prefixedRow[`${primaryAlias}.${key}`] = value;
          prefixedRow[key] = value;
        }
        return prefixedRow;
      });
      if (subquery.where) {
        resultRows = resultRows.filter(row => this.evaluateWhereWithOuter(subquery.where!, row, outerRow));
      }
      
      return resultRows.map(row => this.selectColumns(row, subquery.columns));
    }
    
    const schema = this.storage.getSchema(primaryTable);
    if (!schema) {
      return [];
    }

    let resultRows = this.storage.select(primaryTable, '*');
    resultRows = resultRows.map(row => {
      const prefixedRow: Row = {};
      for (const [key, value] of Object.entries(row)) {
        prefixedRow[`${primaryAlias}.${key}`] = value;
        prefixedRow[key] = value;
      }
      return prefixedRow;
    });
    if (subquery.joins && subquery.joins.length > 0) {
      for (const join of subquery.joins) {
        resultRows = this.executeJoin(resultRows, join, primaryAlias);
      }
    }
    if (subquery.where) {
      resultRows = resultRows.filter(row => this.evaluateWhereWithOuter(subquery.where!, row, outerRow));
    }
    const hasAggregate = subquery.columns.some(c => c.aggregate);
    if (subquery.groupBy || hasAggregate) {
      resultRows = this.executeGroupBy(resultRows, subquery);
    }
    if (subquery.groupBy?.having) {
      resultRows = resultRows.filter(row => this.evaluateWhere(subquery.groupBy!.having!, row));
    }
    if (subquery.orderBy && subquery.orderBy.length > 0) {
      resultRows = this.sortRows(resultRows, subquery.orderBy);
    }
    if (subquery.offset) {
      resultRows = resultRows.slice(subquery.offset);
    }
    if (subquery.limit) {
      resultRows = resultRows.slice(0, subquery.limit);
    }

    return resultRows.map(row => this.selectColumns(row, subquery.columns));
  }
  private evaluateWhereWithOuter(condition: WhereCondition, row: Row, outerRow?: Row): boolean {
    const combinedRow = outerRow ? { ...outerRow, ...row } : row;
    return this.evaluateWhere(condition, combinedRow, outerRow);
  }
  private executeWhereWithIndex(rows: Row[], condition: WhereCondition, schema?: TableSchema, tableName?: string): Row[] {
    if (schema && tableName && condition.type === 'COMPARISON') {
      const column = condition.left as string;
      const colName = column.includes('.') ? column.split('.').pop()! : column;
      const index = schema.indexes?.find(idx => 
        idx.columns.length === 1 && idx.columns[0] === colName
      );
      
      if (index && condition.operator === '=') {
        const indexResult = this.indexManager.searchIndex(tableName, index.name, condition.value);
        if (indexResult.length > 0) {
          const indexedIds = new Set(indexResult);
        }
      }
      if (index && (condition.operator === '>' || condition.operator === '<' || 
                    condition.operator === '>=' || condition.operator === '<=')) {
      }
    }
    return rows.filter(row => this.evaluateWhere(condition, row));
  }
  private buildIndexFromData(tableName: string, indexName: string, columns: string[]): void {
    const rows = this.storage.select(tableName, '*');
    
    rows.forEach((row, idx) => {
      const key = columns.map(c => row[c]).join('|||');
      this.indexManager.addToIndex(tableName, indexName, key, idx);
    });
  }

  private compare(left: any, operator: string, right: any): boolean {
    if (typeof left === 'number' || typeof right === 'number') {
      left = Number(left);
      right = Number(right);
    }

    switch (operator) {
      case '=':
        return left == right;
      case '!=':
      case '<>':
        return left != right;
      case '<':
        return left < right;
      case '>':
        return left > right;
      case '<=':
        return left <= right;
      case '>=':
        return left >= right;
      default:
        return false;
    }
  }

  getTables(): string[] {
    return this.storage.listTables();
  }

  getTableSchema(tableName: string): TableSchema | undefined {
    return this.storage.getSchema(tableName);
  }

  getCurrentDatabase(): string {
    return this.currentDatabase;
  }

  getTransactionManager(): TransactionManager {
    return this.transactionManager;
  }

  getIndexManager(): IndexManager {
    return this.indexManager;
  }
}
