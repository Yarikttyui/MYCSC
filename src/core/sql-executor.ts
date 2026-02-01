import { SQLASTParser } from './ast-parser';
import {
  ASTStatement, ASTSelectStmt, ASTInsertStmt, ASTUpdateStmt, ASTDeleteStmt,
  ASTExpression, ASTBinaryExpr, ASTUnaryExpr, ASTLiteral, ASTColumnRef,
  ASTFunctionCall, ASTCaseExpr, ASTBetweenExpr, ASTInExpr, ASTLikeExpr,
  ASTIsNullExpr, ASTIdentifier, ASTSubQuery, ASTExistsExpr, ASTUnionStmt,
  ASTTableRef, ASTJoinClause, ASTOrderByItem, ASTSelectItem
} from './ast-types';

export interface ExecutorContext {
  tables: Map<string, any>;
  currentRow?: Record<string, any>;
  allRows?: Record<string, any>[];
  rowIndex?: number;
  tableAliases?: Map<string, string>;
  groupRows?: Record<string, any>[];
  windowPartition?: Record<string, any>[];
}

export class SQLExecutor {
  private parser: SQLASTParser;

  constructor() {
    this.parser = new SQLASTParser();
  }
  parse(sql: string): ASTStatement {
    const program = this.parser.parse(sql);
    return program.statements[0];
  }
  evaluateExpression(expr: ASTExpression, ctx: ExecutorContext): any {
    switch (expr.type) {
      case 'Literal':
        return (expr as ASTLiteral).value;

      case 'Identifier':
        return this.resolveIdentifier((expr as ASTIdentifier).name, ctx);

      case 'ColumnRef':
        return this.resolveColumnRef(expr as ASTColumnRef, ctx);

      case 'BinaryExpression':
        return this.evaluateBinaryExpr(expr as ASTBinaryExpr, ctx);

      case 'UnaryExpression':
        return this.evaluateUnaryExpr(expr as ASTUnaryExpr, ctx);

      case 'FunctionCall':
        return this.evaluateFunction(expr as ASTFunctionCall, ctx);

      case 'CaseExpression':
        return this.evaluateCaseExpr(expr as ASTCaseExpr, ctx);

      case 'BetweenExpression':
        return this.evaluateBetween(expr as ASTBetweenExpr, ctx);

      case 'InExpression':
        return this.evaluateIn(expr as ASTInExpr, ctx);

      case 'LikeExpression':
        return this.evaluateLike(expr as ASTLikeExpr, ctx);

      case 'IsNullExpression':
        return this.evaluateIsNull(expr as ASTIsNullExpr, ctx);

      case 'SubQuery':
        return this.evaluateSubQuery(expr as ASTSubQuery, ctx);

      case 'ExistsExpression':
        return this.evaluateExists(expr as ASTExistsExpr, ctx);

      default:
        throw new Error(`Unknown expression type: ${(expr as any).type}`);
    }
  }

  private resolveIdentifier(name: string, ctx: ExecutorContext): any {
    if (name === '*') return '*';
    if (name === '?') return undefined;

    if (ctx.currentRow) {
      if (name in ctx.currentRow) {
        return ctx.currentRow[name];
      }
      const lowerName = name.toLowerCase();
      for (const key of Object.keys(ctx.currentRow)) {
        if (key.toLowerCase() === lowerName) {
          return ctx.currentRow[key];
        }
      }
    }

    return undefined;
  }

  private resolveColumnRef(ref: ASTColumnRef, ctx: ExecutorContext): any {
    const { table, column } = ref;

    if (!ctx.currentRow) return undefined;
    if (table && ctx.tableAliases) {
      const realTable = ctx.tableAliases.get(table) || table;
      const qualifiedKey = `${realTable}.${column}`;
      if (qualifiedKey in ctx.currentRow) {
        return ctx.currentRow[qualifiedKey];
      }
    }
    if (column in ctx.currentRow) {
      return ctx.currentRow[column];
    }
    const lowerCol = column.toLowerCase();
    for (const key of Object.keys(ctx.currentRow)) {
      const parts = key.split('.');
      const colPart = parts[parts.length - 1].toLowerCase();
      if (colPart === lowerCol) {
        return ctx.currentRow[key];
      }
    }

    return undefined;
  }

  private evaluateBinaryExpr(expr: ASTBinaryExpr, ctx: ExecutorContext): any {
    const left = this.evaluateExpression(expr.left, ctx);
    const right = this.evaluateExpression(expr.right, ctx);

    switch (expr.operator.toUpperCase()) {
      case '=':
        return this.compareValues(left, right) === 0;
      case '<>':
      case '!=':
        return this.compareValues(left, right) !== 0;
      case '<':
        return this.compareValues(left, right) < 0;
      case '>':
        return this.compareValues(left, right) > 0;
      case '<=':
        return this.compareValues(left, right) <= 0;
      case '>=':
        return this.compareValues(left, right) >= 0;
      case '<=>':
        if (left === null && right === null) return true;
        if (left === null || right === null) return false;
        return this.compareValues(left, right) === 0;
      case 'AND':
      case '&&':
        return this.toBoolean(left) && this.toBoolean(right);
      case 'OR':
      case '||':
        return this.toBoolean(left) || this.toBoolean(right);
      case 'XOR':
        return this.toBoolean(left) !== this.toBoolean(right);
      case '+':
        return Number(left) + Number(right);
      case '-':
        return Number(left) - Number(right);
      case '*':
        return Number(left) * Number(right);
      case '/':
        return right !== 0 ? Number(left) / Number(right) : null;
      case '%':
      case 'MOD':
        return right !== 0 ? Number(left) % Number(right) : null;
      case 'DIV':
        return right !== 0 ? Math.floor(Number(left) / Number(right)) : null;
      case '^':
        return Math.pow(Number(left), Number(right));
      case '&':
        return (Number(left) | 0) & (Number(right) | 0);
      case '|':
        return (Number(left) | 0) | (Number(right) | 0);
      case '<<':
        return (Number(left) | 0) << (Number(right) | 0);
      case '>>':
        return (Number(left) | 0) >> (Number(right) | 0);

      default:
        throw new Error(`Unknown operator: ${expr.operator}`);
    }
  }

  private evaluateUnaryExpr(expr: ASTUnaryExpr, ctx: ExecutorContext): any {
    const arg = this.evaluateExpression(expr.argument, ctx);

    switch (expr.operator) {
      case '-':
        return -Number(arg);
      case '+':
        return +Number(arg);
      case 'NOT':
      case '!':
        return !this.toBoolean(arg);
      case '~':
        return ~(Number(arg) | 0);
      default:
        throw new Error(`Unknown unary operator: ${expr.operator}`);
    }
  }

  private evaluateFunction(expr: ASTFunctionCall, ctx: ExecutorContext): any {
    const funcName = expr.name.toUpperCase();
    const args = expr.args;
    if (ctx.groupRows && this.isAggregateFunction(funcName)) {
      return this.evaluateAggregateFunction(funcName, args, ctx);
    }
    if (expr.over && ctx.windowPartition) {
      return this.evaluateWindowFunction(funcName, args, expr.over, ctx);
    }
    const evalArgs = args.map(a => this.evaluateExpression(a, ctx));

    switch (funcName) {
      case 'CONCAT':
        return evalArgs.map(a => a ?? '').join('');
      case 'CONCAT_WS':
        const sep = evalArgs[0];
        return evalArgs.slice(1).filter(a => a !== null).join(sep);
      case 'UPPER':
      case 'UCASE':
        return String(evalArgs[0]).toUpperCase();
      case 'LOWER':
      case 'LCASE':
        return String(evalArgs[0]).toLowerCase();
      case 'LENGTH':
      case 'CHAR_LENGTH':
      case 'CHARACTER_LENGTH':
        return String(evalArgs[0] ?? '').length;
      case 'SUBSTRING':
      case 'SUBSTR':
      case 'MID': {
        const str = String(evalArgs[0]);
        const startIdx = Number(evalArgs[1]) - 1;
        const len = evalArgs[2] !== undefined ? Number(evalArgs[2]) : undefined;
        return len !== undefined ? str.substring(startIdx, startIdx + len) : str.substring(startIdx);
      }
      case 'LEFT':
        return String(evalArgs[0]).substring(0, Number(evalArgs[1]));
      case 'RIGHT':
        const s = String(evalArgs[0]);
        return s.substring(s.length - Number(evalArgs[1]));
      case 'TRIM':
        return String(evalArgs[0]).trim();
      case 'LTRIM':
        return String(evalArgs[0]).trimStart();
      case 'RTRIM':
        return String(evalArgs[0]).trimEnd();
      case 'REPLACE':
        return String(evalArgs[0]).replace(new RegExp(String(evalArgs[1]), 'g'), String(evalArgs[2]));
      case 'REVERSE':
        return String(evalArgs[0]).split('').reverse().join('');
      case 'REPEAT':
        return String(evalArgs[0]).repeat(Number(evalArgs[1]));
      case 'SPACE':
        return ' '.repeat(Number(evalArgs[0]));
      case 'LPAD':
        const s1 = String(evalArgs[0]);
        const l1 = Number(evalArgs[1]);
        const p1 = String(evalArgs[2] ?? ' ');
        return s1.length >= l1 ? s1 : p1.repeat(Math.ceil((l1 - s1.length) / p1.length)).substring(0, l1 - s1.length) + s1;
      case 'RPAD':
        const s2 = String(evalArgs[0]);
        const l2 = Number(evalArgs[1]);
        const p2 = String(evalArgs[2] ?? ' ');
        return s2.length >= l2 ? s2 : s2 + p2.repeat(Math.ceil((l2 - s2.length) / p2.length)).substring(0, l2 - s2.length);
      case 'LOCATE':
      case 'INSTR':
      case 'POSITION':
        return String(evalArgs[1]).indexOf(String(evalArgs[0])) + 1;
      case 'ASCII':
        return String(evalArgs[0]).charCodeAt(0);
      case 'CHAR':
        return String.fromCharCode(...evalArgs.map(Number));
      case 'ABS':
        return Math.abs(Number(evalArgs[0]));
      case 'CEIL':
      case 'CEILING':
        return Math.ceil(Number(evalArgs[0]));
      case 'FLOOR':
        return Math.floor(Number(evalArgs[0]));
      case 'ROUND':
        const decimals = evalArgs[1] !== undefined ? Number(evalArgs[1]) : 0;
        const factor = Math.pow(10, decimals);
        return Math.round(Number(evalArgs[0]) * factor) / factor;
      case 'TRUNCATE':
        const trDec = evalArgs[1] !== undefined ? Number(evalArgs[1]) : 0;
        const trFactor = Math.pow(10, trDec);
        return Math.trunc(Number(evalArgs[0]) * trFactor) / trFactor;
      case 'SQRT':
        return Math.sqrt(Number(evalArgs[0]));
      case 'POWER':
      case 'POW':
        return Math.pow(Number(evalArgs[0]), Number(evalArgs[1]));
      case 'EXP':
        return Math.exp(Number(evalArgs[0]));
      case 'LOG':
        return evalArgs.length > 1 
          ? Math.log(Number(evalArgs[1])) / Math.log(Number(evalArgs[0]))
          : Math.log(Number(evalArgs[0]));
      case 'LN':
        return Math.log(Number(evalArgs[0]));
      case 'LOG10':
        return Math.log10(Number(evalArgs[0]));
      case 'LOG2':
        return Math.log2(Number(evalArgs[0]));
      case 'MOD':
        return Number(evalArgs[0]) % Number(evalArgs[1]);
      case 'RAND':
        return Math.random();
      case 'SIGN':
        return Math.sign(Number(evalArgs[0]));
      case 'PI':
        return Math.PI;
      case 'SIN':
        return Math.sin(Number(evalArgs[0]));
      case 'COS':
        return Math.cos(Number(evalArgs[0]));
      case 'TAN':
        return Math.tan(Number(evalArgs[0]));
      case 'ASIN':
        return Math.asin(Number(evalArgs[0]));
      case 'ACOS':
        return Math.acos(Number(evalArgs[0]));
      case 'ATAN':
        return evalArgs.length > 1 
          ? Math.atan2(Number(evalArgs[0]), Number(evalArgs[1]))
          : Math.atan(Number(evalArgs[0]));
      case 'DEGREES':
        return Number(evalArgs[0]) * (180 / Math.PI);
      case 'RADIANS':
        return Number(evalArgs[0]) * (Math.PI / 180);
      case 'GREATEST':
        return Math.max(...evalArgs.map(Number));
      case 'LEAST':
        return Math.min(...evalArgs.map(Number));
      case 'NOW':
      case 'CURRENT_TIMESTAMP':
        return new Date().toISOString().replace('T', ' ').substring(0, 19);
      case 'CURDATE':
      case 'CURRENT_DATE':
        return new Date().toISOString().substring(0, 10);
      case 'CURTIME':
      case 'CURRENT_TIME':
        return new Date().toTimeString().substring(0, 8);
      case 'DATE':
        return new Date(evalArgs[0]).toISOString().substring(0, 10);
      case 'TIME':
        return new Date(evalArgs[0]).toTimeString().substring(0, 8);
      case 'YEAR':
        return new Date(evalArgs[0]).getFullYear();
      case 'MONTH':
        return new Date(evalArgs[0]).getMonth() + 1;
      case 'DAY':
      case 'DAYOFMONTH':
        return new Date(evalArgs[0]).getDate();
      case 'HOUR':
        return new Date(evalArgs[0]).getHours();
      case 'MINUTE':
        return new Date(evalArgs[0]).getMinutes();
      case 'SECOND':
        return new Date(evalArgs[0]).getSeconds();
      case 'DAYOFWEEK':
        return new Date(evalArgs[0]).getDay() + 1;
      case 'DAYOFYEAR': {
        const d = new Date(evalArgs[0]);
        const yearStart = new Date(d.getFullYear(), 0, 0);
        const diff = d.getTime() - yearStart.getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24));
      }
      case 'WEEKOFYEAR':
      case 'WEEK': {
        const dt = new Date(evalArgs[0]);
        const yearStart = new Date(dt.getFullYear(), 0, 1);
        const days = Math.floor((dt.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000));
        return Math.ceil((days + yearStart.getDay() + 1) / 7);
      }
      case 'DATE_FORMAT':
        return this.formatDate(evalArgs[0], evalArgs[1]);
      case 'DATE_ADD':
      case 'ADDDATE':
        return this.dateAdd(evalArgs[0], evalArgs[1], evalArgs[2] || 'DAY');
      case 'DATE_SUB':
      case 'SUBDATE':
        return this.dateSub(evalArgs[0], evalArgs[1], evalArgs[2] || 'DAY');
      case 'DATEDIFF': {
        const d1 = new Date(evalArgs[0]);
        const d2 = new Date(evalArgs[1]);
        return Math.floor((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
      }
      case 'TIMESTAMPDIFF':
        return this.timestampDiff(evalArgs[0], evalArgs[1], evalArgs[2]);
      case 'UNIX_TIMESTAMP':
        return evalArgs.length > 0 
          ? Math.floor(new Date(evalArgs[0]).getTime() / 1000)
          : Math.floor(Date.now() / 1000);
      case 'FROM_UNIXTIME': {
        const ts = Number(evalArgs[0]) * 1000;
        const dtFormat = evalArgs[1];
        const fmtResult = new Date(ts).toISOString().replace('T', ' ').substring(0, 19);
        return dtFormat ? this.formatDate(fmtResult, dtFormat) : fmtResult;
      }
      case 'IF':
        return this.toBoolean(evalArgs[0]) ? evalArgs[1] : evalArgs[2];
      case 'IFNULL':
        return evalArgs[0] ?? evalArgs[1];
      case 'NULLIF':
        return evalArgs[0] === evalArgs[1] ? null : evalArgs[0];
      case 'COALESCE':
        return evalArgs.find(a => a !== null && a !== undefined) ?? null;
      case 'NVL':
        return evalArgs[0] ?? evalArgs[1];
      case 'CAST':
        return evalArgs[0];
      case 'CONVERT':
        return evalArgs[0];
      case 'JSON_EXTRACT':
        try {
          const obj = typeof evalArgs[0] === 'string' ? JSON.parse(evalArgs[0]) : evalArgs[0];
          const path = String(evalArgs[1]).replace(/^\$\.?/, '');
          return path.split('.').reduce((o, k) => o?.[k], obj);
        } catch {
          return null;
        }
      case 'JSON_OBJECT':
        const jsonObj: Record<string, any> = {};
        for (let i = 0; i < evalArgs.length; i += 2) {
          jsonObj[String(evalArgs[i])] = evalArgs[i + 1];
        }
        return JSON.stringify(jsonObj);
      case 'JSON_ARRAY':
        return JSON.stringify(evalArgs);
      case 'JSON_LENGTH':
        try {
          const arr = typeof evalArgs[0] === 'string' ? JSON.parse(evalArgs[0]) : evalArgs[0];
          return Array.isArray(arr) ? arr.length : Object.keys(arr).length;
        } catch {
          return 0;
        }
      case 'COUNT':
      case 'SUM':
      case 'AVG':
      case 'MIN':
      case 'MAX':
      case 'GROUP_CONCAT':
        if (evalArgs[0] === '*') return 1;
        return evalArgs[0];

      default:
        console.warn(`Unknown function: ${funcName}`);
        return null;
    }
  }

  private isAggregateFunction(name: string): boolean {
    return ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'GROUP_CONCAT', 'BIT_AND', 'BIT_OR', 'BIT_XOR', 
            'STD', 'STDDEV', 'STDDEV_POP', 'STDDEV_SAMP', 'VAR_POP', 'VAR_SAMP', 'VARIANCE'].includes(name);
  }

  private evaluateAggregateFunction(funcName: string, args: ASTExpression[], ctx: ExecutorContext): any {
    const rows = ctx.groupRows!;
    
    if (funcName === 'COUNT') {
      const arg = args[0];
      if (arg.type === 'Identifier' && (arg as ASTIdentifier).name === '*') {
        return rows.length;
      }
      const values = rows.map(r => {
        const tmpCtx = { ...ctx, currentRow: r };
        return this.evaluateExpression(arg, tmpCtx);
      }).filter(v => v !== null && v !== undefined);
      return values.length;
    }

    const values = rows.map(r => {
      const tmpCtx = { ...ctx, currentRow: r };
      return this.evaluateExpression(args[0], tmpCtx);
    }).filter(v => v !== null && v !== undefined);

    switch (funcName) {
      case 'SUM':
        return values.reduce((sum, v) => sum + Number(v), 0);
      case 'AVG':
        return values.length > 0 ? values.reduce((sum, v) => sum + Number(v), 0) / values.length : null;
      case 'MIN':
        return values.length > 0 ? Math.min(...values.map(Number)) : null;
      case 'MAX':
        return values.length > 0 ? Math.max(...values.map(Number)) : null;
      case 'GROUP_CONCAT':
        return values.join(',');
      case 'STD':
      case 'STDDEV':
      case 'STDDEV_POP':
        const avg = values.reduce((s, v) => s + Number(v), 0) / values.length;
        const variance = values.reduce((s, v) => s + Math.pow(Number(v) - avg, 2), 0) / values.length;
        return Math.sqrt(variance);
      default:
        return null;
    }
  }

  private evaluateWindowFunction(funcName: string, args: ASTExpression[], over: any, ctx: ExecutorContext): any {
    const partition = ctx.windowPartition!;
    const currentIndex = ctx.rowIndex!;

    switch (funcName) {
      case 'ROW_NUMBER':
        return currentIndex + 1;
      case 'RANK':
        return currentIndex + 1;
      case 'DENSE_RANK':
        return currentIndex + 1;
      case 'LEAD':
        const leadOffset = args[1] ? Number(this.evaluateExpression(args[1], ctx)) : 1;
        const leadDefault = args[2] ? this.evaluateExpression(args[2], ctx) : null;
        const leadRow = partition[currentIndex + leadOffset];
        if (!leadRow) return leadDefault;
        const leadCtx = { ...ctx, currentRow: leadRow };
        return this.evaluateExpression(args[0], leadCtx);
      case 'LAG':
        const lagOffset = args[1] ? Number(this.evaluateExpression(args[1], ctx)) : 1;
        const lagDefault = args[2] ? this.evaluateExpression(args[2], ctx) : null;
        const lagRow = partition[currentIndex - lagOffset];
        if (!lagRow) return lagDefault;
        const lagCtx = { ...ctx, currentRow: lagRow };
        return this.evaluateExpression(args[0], lagCtx);
      case 'FIRST_VALUE':
        const firstRow = partition[0];
        const firstCtx = { ...ctx, currentRow: firstRow };
        return this.evaluateExpression(args[0], firstCtx);
      case 'LAST_VALUE':
        const lastRow = partition[partition.length - 1];
        const lastCtx = { ...ctx, currentRow: lastRow };
        return this.evaluateExpression(args[0], lastCtx);
      case 'NTH_VALUE':
        const n = Number(this.evaluateExpression(args[1], ctx));
        const nthRow = partition[n - 1];
        if (!nthRow) return null;
        const nthCtx = { ...ctx, currentRow: nthRow };
        return this.evaluateExpression(args[0], nthCtx);
      case 'NTILE':
        const buckets = Number(this.evaluateExpression(args[0], ctx));
        return Math.floor(currentIndex * buckets / partition.length) + 1;
      default:
        return null;
    }
  }

  private evaluateCaseExpr(expr: ASTCaseExpr, ctx: ExecutorContext): any {
    if (expr.discriminant) {
      const testValue = this.evaluateExpression(expr.discriminant, ctx);
      for (const { when, then } of expr.cases) {
        const whenValue = this.evaluateExpression(when, ctx);
        if (this.compareValues(testValue, whenValue) === 0) {
          return this.evaluateExpression(then, ctx);
        }
      }
    } else {
      for (const { when, then } of expr.cases) {
        if (this.toBoolean(this.evaluateExpression(when, ctx))) {
          return this.evaluateExpression(then, ctx);
        }
      }
    }
    if (expr.else) {
      return this.evaluateExpression(expr.else, ctx);
    }

    return null;
  }

  private evaluateBetween(expr: ASTBetweenExpr, ctx: ExecutorContext): boolean {
    const value = this.evaluateExpression(expr.value, ctx);
    const low = this.evaluateExpression(expr.low, ctx);
    const high = this.evaluateExpression(expr.high, ctx);

    const result = this.compareValues(value, low) >= 0 && this.compareValues(value, high) <= 0;
    return expr.not ? !result : result;
  }

  private evaluateIn(expr: ASTInExpr, ctx: ExecutorContext): boolean {
    const value = this.evaluateExpression(expr.value, ctx);
    if ('query' in (expr.list as any)) {
      const subResult = this.evaluateSubQuery(expr.list as ASTSubQuery, ctx);
      const result = Array.isArray(subResult) 
        ? subResult.some(r => this.compareValues(value, Object.values(r)[0]) === 0)
        : false;
      return expr.not ? !result : result;
    }
    const list = expr.list as ASTExpression[];
    const result = list.some(item => {
      const itemValue = this.evaluateExpression(item, ctx);
      return this.compareValues(value, itemValue) === 0;
    });

    return expr.not ? !result : result;
  }

  private evaluateLike(expr: ASTLikeExpr, ctx: ExecutorContext): boolean {
    const value = String(this.evaluateExpression(expr.value, ctx) ?? '');
    const pattern = String(this.evaluateExpression(expr.pattern, ctx) ?? '');

    let result: boolean;

    if (expr.regexp) {
      try {
        result = new RegExp(pattern, 'i').test(value);
      } catch {
        result = false;
      }
    } else {
      const escape = expr.escape || '\\';
      let regexPattern = '';
      for (let i = 0; i < pattern.length; i++) {
        const char = pattern[i];
        if (char === escape && i + 1 < pattern.length) {
          regexPattern += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        } else if (char === '%') {
          regexPattern += '.*';
        } else if (char === '_') {
          regexPattern += '.';
        } else {
          regexPattern += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
      }
      result = new RegExp(`^${regexPattern}$`, 'i').test(value);
    }

    return expr.not ? !result : result;
  }

  private evaluateIsNull(expr: ASTIsNullExpr, ctx: ExecutorContext): boolean {
    const value = this.evaluateExpression(expr.value, ctx);
    const isNull = value === null || value === undefined;
    return expr.not ? !isNull : isNull;
  }

  private evaluateSubQuery(expr: ASTSubQuery, ctx: ExecutorContext): any {
    console.warn('Subquery evaluation not fully implemented');
    return [];
  }

  private evaluateExists(expr: ASTExistsExpr, ctx: ExecutorContext): boolean {
    const result = this.evaluateSubQuery(expr.subquery, ctx);
    const exists = Array.isArray(result) && result.length > 0;
    return expr.not ? !exists : exists;
  }
  private compareValues(a: any, b: any): number {
    if (a === null || a === undefined) {
      if (b === null || b === undefined) return 0;
      return -1;
    }
    if (b === null || b === undefined) return 1;

    if (typeof a === 'number' && typeof b === 'number') {
      return a - b;
    }

    const strA = String(a);
    const strB = String(b);
    return strA.localeCompare(strB);
  }

  private toBoolean(value: any): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true' || lower === '1') return true;
      if (lower === 'false' || lower === '0') return false;
      return value.length > 0;
    }
    return Boolean(value);
  }

  private formatDate(date: any, format: string): string {
    const d = new Date(date);
    const pad = (n: number) => n.toString().padStart(2, '0');

    return format
      .replace('%Y', d.getFullYear().toString())
      .replace('%y', d.getFullYear().toString().slice(-2))
      .replace('%m', pad(d.getMonth() + 1))
      .replace('%d', pad(d.getDate()))
      .replace('%H', pad(d.getHours()))
      .replace('%i', pad(d.getMinutes()))
      .replace('%s', pad(d.getSeconds()))
      .replace('%W', ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()])
      .replace('%w', d.getDay().toString())
      .replace('%M', ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][d.getMonth()])
      .replace('%b', ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()])
      .replace('%j', this.dayOfYear(d).toString());
  }

  private dayOfYear(d: Date): number {
    const start = new Date(d.getFullYear(), 0, 0);
    const diff = d.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  private dateAdd(date: any, interval: number, unit: string): string {
    const d = new Date(date);
    const unitUpper = String(unit).toUpperCase();

    switch (unitUpper) {
      case 'SECOND':
        d.setSeconds(d.getSeconds() + interval);
        break;
      case 'MINUTE':
        d.setMinutes(d.getMinutes() + interval);
        break;
      case 'HOUR':
        d.setHours(d.getHours() + interval);
        break;
      case 'DAY':
        d.setDate(d.getDate() + interval);
        break;
      case 'WEEK':
        d.setDate(d.getDate() + interval * 7);
        break;
      case 'MONTH':
        d.setMonth(d.getMonth() + interval);
        break;
      case 'YEAR':
        d.setFullYear(d.getFullYear() + interval);
        break;
    }

    return d.toISOString().replace('T', ' ').substring(0, 19);
  }

  private dateSub(date: any, interval: number, unit: string): string {
    return this.dateAdd(date, -interval, unit);
  }

  private timestampDiff(unit: any, date1: any, date2: any): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffMs = d2.getTime() - d1.getTime();
    const unitUpper = String(unit).toUpperCase();

    switch (unitUpper) {
      case 'SECOND':
        return Math.floor(diffMs / 1000);
      case 'MINUTE':
        return Math.floor(diffMs / (1000 * 60));
      case 'HOUR':
        return Math.floor(diffMs / (1000 * 60 * 60));
      case 'DAY':
        return Math.floor(diffMs / (1000 * 60 * 60 * 24));
      case 'WEEK':
        return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
      case 'MONTH':
        return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
      case 'YEAR':
        return d2.getFullYear() - d1.getFullYear();
      default:
        return Math.floor(diffMs / 1000);
    }
  }
}
export const sqlExecutor = new SQLExecutor();
