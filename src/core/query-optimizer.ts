import {
  ASTSelectStmt,
  ASTExpression,
  ASTBinaryExpr,
  ASTColumnRef,
  ASTLiteral,
  ASTTableRef,
  ASTSubQuery,
  ASTInExpr,
  ASTBetweenExpr,
  ASTLikeExpr,
  ASTIsNullExpr,
  ASTFunctionCall,
  ASTJoinClause,
  ASTOrderByItem
} from './ast-types';
import { IndexManager, IndexInfo, IndexStats, CompositeKey } from './btree';
import { TableSchema, IndexDefinition, IndexType } from './types';


export type ScanType = 
  | 'FULL_TABLE_SCAN'
  | 'INDEX_SCAN'
  | 'INDEX_RANGE_SCAN'
  | 'INDEX_LOOKUP'
  | 'INDEX_ONLY_SCAN'
  | 'UNIQUE_SCAN';

export type JoinMethod = 
  | 'NESTED_LOOP'
  | 'HASH_JOIN'
  | 'MERGE_JOIN'
  | 'INDEX_NESTED_LOOP';

export interface TableAccessPlan {
  table: string;
  alias?: string;
  scanType: ScanType;
  indexName?: string;
  indexColumns?: string[];
  estimatedRows: number;
  estimatedCost: number;
  conditions?: ConditionPlan[];
  usedForSort?: boolean;
}

export interface JoinPlan {
  method: JoinMethod;
  outerTable: string;
  innerTable: string;
  joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' | 'CROSS';
  joinCondition?: ASTExpression;
  indexUsed?: string;
  estimatedRows: number;
  estimatedCost: number;
}

export interface ConditionPlan {
  column: string;
  operator: string;
  value?: any;
  indexable: boolean;
  selectivity: number;
}

export interface SortPlan {
  columns: Array<{ column: string; direction: 'ASC' | 'DESC' }>;
  usingIndex: boolean;
  indexName?: string;
  estimatedCost: number;
}

export interface AggregationPlan {
  type: 'HASH' | 'SORT' | 'INDEX';
  groupByColumns: string[];
  aggregateFunctions: string[];
  estimatedCost: number;
}

export interface ExecutionPlan {
  type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  tables: TableAccessPlan[];
  joins: JoinPlan[];
  sort?: SortPlan;
  aggregation?: AggregationPlan;
  limit?: number;
  offset?: number;
  totalEstimatedRows: number;
  totalEstimatedCost: number;
  optimizerHints: string[];
  warnings: string[];
}


export interface TableStats {
  tableName: string;
  rowCount: number;
  avgRowSize: number;
  columnStats: Map<string, ColumnStats>;
}

export interface ColumnStats {
  columnName: string;
  distinctCount: number;
  nullCount: number;
  minValue?: any;
  maxValue?: any;
  avgLength?: number;
  histogram?: number[];
}


const COST = {
  SEQ_PAGE_COST: 1.0,
  RANDOM_PAGE_COST: 4.0,
  CPU_TUPLE_COST: 0.01,
  CPU_INDEX_TUPLE_COST: 0.005,
  CPU_OPERATOR_COST: 0.0025,
  HASH_QUAL_COST: 0.02,
  MERGE_QUAL_COST: 0.01,
  WORK_MEM: 4096,
  PAGE_SIZE: 8192,
  ROWS_PER_PAGE: 100
};


export class QueryOptimizer {
  private indexManager: IndexManager;
  private tableStats: Map<string, TableStats> = new Map();
  private schemas: Map<string, TableSchema> = new Map();
  private readonly DEFAULT_ROW_COUNT = 1000;

  constructor(indexManager: IndexManager) {
    this.indexManager = indexManager;
  }


  updateTableStats(tableName: string, stats: TableStats): void {
    this.tableStats.set(tableName, stats);
  }

  updateSchema(tableName: string, schema: TableSchema): void {
    this.schemas.set(tableName, schema);
  }

  getTableStats(tableName: string): TableStats | undefined {
    return this.tableStats.get(tableName);
  }
  estimateTableRows(tableName: string): number {
    const stats = this.tableStats.get(tableName);
    if (stats) return stats.rowCount;
    return 1000;
  }


  optimize(ast: ASTSelectStmt): ExecutionPlan {
    const plan: ExecutionPlan = {
      type: 'SELECT',
      tables: [],
      joins: [],
      totalEstimatedRows: 0,
      totalEstimatedCost: 0,
      optimizerHints: [],
      warnings: []
    };
    this.analyzeFromClause(ast, plan);
    if (ast.where) {
      this.analyzeWhereClause(ast.where, plan);
    }
    if (ast.joins && ast.joins.length > 0) {
      this.analyzeJoins(ast.joins, plan);
    }
    if (ast.orderBy && ast.orderBy.length > 0) {
      plan.sort = this.analyzeSorting(ast.orderBy, plan);
    }
    if (ast.groupBy && ast.groupBy.length > 0) {
      plan.aggregation = this.analyzeAggregation(ast, plan);
    } else {
      const aggregation = this.detectAggregateFunctions(ast);
      if (aggregation) {
        plan.aggregation = aggregation;
      }
    }
    if (ast.limit !== undefined) {
      plan.limit = ast.limit;
    }
    if (ast.offset !== undefined) {
      plan.offset = ast.offset;
    }
    this.calculateTotalCost(plan);
    this.applyOptimizations(plan, ast);

    return plan;
  }


  private analyzeFromClause(ast: ASTSelectStmt, plan: ExecutionPlan): void {
    if (!ast.from) return;
    if (ast.from.type === 'TableRef') {
      const tablePlan = this.createTableAccessPlan(ast.from as ASTTableRef);
      plan.tables.push(tablePlan);
    } else if (ast.from.type === 'SubQuery') {
      const subquery = ast.from as ASTSubQuery;
      const subPlan: TableAccessPlan = {
        table: subquery.alias || '(subquery)',
        alias: subquery.alias,
        scanType: 'FULL_TABLE_SCAN',
        estimatedRows: this.DEFAULT_ROW_COUNT,
        estimatedCost: this.calculateScanCost(this.DEFAULT_ROW_COUNT, 'FULL_TABLE_SCAN'),
        conditions: []
      };
      plan.tables.push(subPlan);
    }
  }

  private createTableAccessPlan(tableRef: ASTTableRef): TableAccessPlan {
    const tableName = tableRef.table;
    const estimatedRows = this.estimateTableRows(tableName);

    return {
      table: tableName,
      alias: tableRef.alias,
      scanType: 'FULL_TABLE_SCAN',
      estimatedRows,
      estimatedCost: this.calculateScanCost(estimatedRows, 'FULL_TABLE_SCAN'),
      conditions: []
    };
  }


  private analyzeWhereClause(where: ASTExpression, plan: ExecutionPlan): void {
    const conditions = this.extractConditions(where);
    const conditionsByTable = new Map<string, ConditionPlan[]>();

    for (const condition of conditions) {
      const tableName = this.findTableForColumn(condition.column, plan);
      if (tableName) {
        if (!conditionsByTable.has(tableName)) {
          conditionsByTable.set(tableName, []);
        }
        conditionsByTable.get(tableName)!.push(condition);
      }
    }
    for (const tablePlan of plan.tables) {
      const tableConditions = conditionsByTable.get(tablePlan.table) || 
                              conditionsByTable.get(tablePlan.alias || '');
      
      if (tableConditions && tableConditions.length > 0) {
        tablePlan.conditions = tableConditions;
        this.selectBestIndex(tablePlan, tableConditions);
      }
    }
  }

  private extractConditions(expr: ASTExpression): ConditionPlan[] {
    const conditions: ConditionPlan[] = [];

    if (expr.type === 'BinaryExpression') {
      const binary = expr as ASTBinaryExpr;
      
      if (binary.operator === 'AND') {
        conditions.push(...this.extractConditions(binary.left));
        conditions.push(...this.extractConditions(binary.right));
      } else if (binary.operator === 'OR') {
        const leftConditions = this.extractConditions(binary.left);
        const rightConditions = this.extractConditions(binary.right);
        for (const c of [...leftConditions, ...rightConditions]) {
          c.selectivity = Math.min(c.selectivity * 2, 1);
        }
        conditions.push(...leftConditions, ...rightConditions);
      } else {
        const condition = this.parseCondition(binary);
        if (condition) {
          conditions.push(condition);
        }
      }
    } else if (expr.type === 'BetweenExpression') {
      const between = expr as ASTBetweenExpr;
      const condition = this.parseBetweenCondition(between);
      if (condition) {
        conditions.push(condition);
      }
    } else if (expr.type === 'InExpression') {
      const inExpr = expr as ASTInExpr;
      const condition = this.parseInCondition(inExpr);
      if (condition) {
        conditions.push(condition);
      }
    } else if (expr.type === 'LikeExpression') {
      const like = expr as ASTLikeExpr;
      const condition = this.parseLikeCondition(like);
      if (condition) {
        conditions.push(condition);
      }
    } else if (expr.type === 'IsNullExpression') {
      const isNull = expr as ASTIsNullExpr;
      const condition = this.parseIsNullCondition(isNull);
      if (condition) {
        conditions.push(condition);
      }
    }

    return conditions;
  }

  private parseCondition(binary: ASTBinaryExpr): ConditionPlan | null {
    let column: string | null = null;
    let value: any = null;
    let operator = binary.operator;
    if (binary.left.type === 'ColumnRef') {
      column = (binary.left as ASTColumnRef).column;
      if (binary.right.type === 'Literal') {
        value = (binary.right as ASTLiteral).value;
      }
    } else if (binary.right.type === 'ColumnRef') {
      column = (binary.right as ASTColumnRef).column;
      if (binary.left.type === 'Literal') {
        value = (binary.left as ASTLiteral).value;
        operator = this.invertOperator(operator);
      }
    }

    if (!column) return null;
    const indexable = this.isIndexableOperator(operator);
    const selectivity = this.estimateSelectivity(operator, value);

    return {
      column,
      operator,
      value,
      indexable,
      selectivity
    };
  }

  private parseBetweenCondition(between: ASTBetweenExpr): ConditionPlan | null {
    if (between.value.type !== 'ColumnRef') return null;
    
    const column = (between.value as ASTColumnRef).column;
    let lowValue: any = null;
    let highValue: any = null;

    if (between.low.type === 'Literal') {
      lowValue = (between.low as ASTLiteral).value;
    }
    if (between.high.type === 'Literal') {
      highValue = (between.high as ASTLiteral).value;
    }

    return {
      column,
      operator: between.not ? 'NOT BETWEEN' : 'BETWEEN',
      value: { low: lowValue, high: highValue },
      indexable: !between.not,
      selectivity: between.not ? 0.7 : 0.3
    };
  }

  private parseInCondition(inExpr: ASTInExpr): ConditionPlan | null {
    if (inExpr.value.type !== 'ColumnRef') return null;
    
    const column = (inExpr.value as ASTColumnRef).column;
    if (!Array.isArray(inExpr.list)) {
      return {
        column,
        operator: inExpr.not ? 'NOT IN' : 'IN',
        value: null,
        indexable: false,
        selectivity: 0.5
      };
    }

    const values = (inExpr.list as ASTExpression[])
      .filter(e => e.type === 'Literal')
      .map(e => (e as ASTLiteral).value);

    return {
      column,
      operator: inExpr.not ? 'NOT IN' : 'IN',
      value: values,
      indexable: !inExpr.not && values.length <= 20,
      selectivity: inExpr.not ? (1 - values.length * 0.05) : Math.min(values.length * 0.05, 0.5)
    };
  }

  private parseLikeCondition(like: ASTLikeExpr): ConditionPlan | null {
    if (like.value.type !== 'ColumnRef') return null;
    
    const column = (like.value as ASTColumnRef).column;
    let pattern: string | null = null;

    if (like.pattern.type === 'Literal') {
      pattern = String((like.pattern as ASTLiteral).value);
    }
    const indexable = pattern !== null && 
                      !like.not && 
                      !pattern.startsWith('%') && 
                      !pattern.startsWith('_');

    return {
      column,
      operator: like.regexp ? 'REGEXP' : (like.not ? 'NOT LIKE' : 'LIKE'),
      value: pattern,
      indexable,
      selectivity: indexable ? 0.1 : 0.5
    };
  }

  private parseIsNullCondition(isNull: ASTIsNullExpr): ConditionPlan | null {
    if (isNull.value.type !== 'ColumnRef') return null;
    
    const column = (isNull.value as ASTColumnRef).column;

    return {
      column,
      operator: isNull.not ? 'IS NOT NULL' : 'IS NULL',
      value: null,
      indexable: true,
      selectivity: isNull.not ? 0.9 : 0.1
    };
  }


  private selectBestIndex(tablePlan: TableAccessPlan, conditions: ConditionPlan[]): void {
    const tableName = tablePlan.table;
    const availableIndexes = this.indexManager.getIndexesInfo(tableName);

    if (availableIndexes.length === 0) {
      return;
    }
    const indexableConditions = conditions
      .filter(c => c.indexable)
      .sort((a, b) => a.selectivity - b.selectivity);

    if (indexableConditions.length === 0) {
      return;
    }
    const conditionColumns = indexableConditions.map(c => c.column);
    let bestIndex: IndexInfo | null = null;
    let bestScore = -1;
    let bestScanType: ScanType = 'FULL_TABLE_SCAN';

    for (const indexInfo of availableIndexes) {
      const score = this.scoreIndex(indexInfo, conditionColumns, conditions);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = indexInfo;
        bestScanType = this.determineScanType(indexInfo, conditions);
      }
    }

    if (bestIndex && bestScore > 0) {
      tablePlan.indexName = bestIndex.name;
      tablePlan.indexColumns = bestIndex.columns;
      tablePlan.scanType = bestScanType;
      const selectivity = this.combineSelectivity(conditions);
      tablePlan.estimatedRows = Math.max(1, Math.floor(tablePlan.estimatedRows * selectivity));
      tablePlan.estimatedCost = this.calculateScanCost(tablePlan.estimatedRows, bestScanType);
    }
  }

  private scoreIndex(
    indexInfo: IndexInfo, 
    conditionColumns: string[], 
    conditions: ConditionPlan[]
  ): number {
    let score = 0;
    const indexColumns = indexInfo.columns;
    for (let i = 0; i < indexColumns.length; i++) {
      const indexCol = indexColumns[i];
      const conditionIndex = conditionColumns.indexOf(indexCol);
      
      if (conditionIndex === -1) break;
      const condition = conditions.find(c => c.column === indexCol);
      if (!condition) break;
      score += (10 - i);
      if (condition.operator === '=' || condition.operator === 'IN') {
        score += 5;
      }
      if (['<', '>', '<=', '>=', 'BETWEEN'].includes(condition.operator)) {
        score += 3;
        break;
      }
    }
    if (indexInfo.unique && score > 10) {
      score += 20;
    }
    if (indexInfo.columns.length > conditionColumns.length + 2) {
      score -= 2;
    }

    return score;
  }

  private determineScanType(indexInfo: IndexInfo, conditions: ConditionPlan[]): ScanType {
    const indexColumns = indexInfo.columns;
    const firstCondition = conditions.find(c => c.column === indexColumns[0]);

    if (!firstCondition) return 'INDEX_SCAN';
    if (indexInfo.unique && firstCondition.operator === '=' && 
        indexColumns.length === 1) {
      return 'UNIQUE_SCAN';
    }
    if (firstCondition.operator === '=' || firstCondition.operator === 'IN') {
      return 'INDEX_LOOKUP';
    }
    if (['<', '>', '<=', '>=', 'BETWEEN'].includes(firstCondition.operator)) {
      return 'INDEX_RANGE_SCAN';
    }

    return 'INDEX_SCAN';
  }


  private analyzeJoins(joins: ASTJoinClause[], plan: ExecutionPlan): void {
    for (const join of joins) {
      if (join.table.type === 'TableRef') {
        const tablePlan = this.createTableAccessPlan(join.table as ASTTableRef);
        plan.tables.push(tablePlan);
      }

      const joinPlan = this.createJoinPlan(join, plan);
      plan.joins.push(joinPlan);
      if (join.on && join.table.type === 'TableRef') {
        const tablePlan = plan.tables.find(t => 
          t.table === (join.table as ASTTableRef).table || 
          t.alias === (join.table as ASTTableRef).alias
        );
        if (tablePlan) {
          this.analyzeJoinCondition(join.on, tablePlan, joinPlan);
        }
      }
    }
  }

  private createJoinPlan(join: ASTJoinClause, plan: ExecutionPlan): JoinPlan {
    const outerTable = plan.tables[0]?.table || '';
    const innerTable = join.table.type === 'TableRef' 
      ? (join.table as ASTTableRef).table 
      : '(subquery)';
    const outerRows = this.estimateTableRows(outerTable);
    const innerRows = this.estimateTableRows(innerTable);
    const method = this.selectJoinMethod(outerRows, innerRows, join);

    return {
      method,
      outerTable,
      innerTable,
      joinType: join.joinType as any,
      joinCondition: join.on,
      estimatedRows: this.estimateJoinRows(outerRows, innerRows, join),
      estimatedCost: this.calculateJoinCost(outerRows, innerRows, method)
    };
  }

  private selectJoinMethod(outerRows: number, innerRows: number, join: ASTJoinClause): JoinMethod {
    const innerTable = join.table.type === 'TableRef' 
      ? (join.table as ASTTableRef).table 
      : '';
    const innerIndexes = innerTable ? this.indexManager.listIndexes(innerTable) : [];
    
    if (join.on?.type === 'BinaryExpression') {
      const binary = join.on as ASTBinaryExpr;
      if (binary.operator === '=' && binary.right.type === 'ColumnRef') {
        const column = (binary.right as ASTColumnRef).column;
        const hasIndex = innerIndexes.some(idx => {
          const info = this.indexManager.getIndexesInfo(innerTable)
            .find(i => i.name === idx);
          return info?.columns[0] === column;
        });
        
        if (hasIndex) {
          return 'INDEX_NESTED_LOOP';
        }
      }
    }
    if (innerRows < COST.WORK_MEM / 100) {
      return 'HASH_JOIN';
    }
    return 'NESTED_LOOP';
  }

  private analyzeJoinCondition(
    condition: ASTExpression, 
    tablePlan: TableAccessPlan, 
    joinPlan: JoinPlan
  ): void {
    if (condition.type !== 'BinaryExpression') return;
    
    const binary = condition as ASTBinaryExpr;
    if (binary.operator !== '=') return;
    let joinColumn: string | null = null;
    
    if (binary.right.type === 'ColumnRef') {
      const ref = binary.right as ASTColumnRef;
      if (!ref.table || ref.table === tablePlan.table || ref.table === tablePlan.alias) {
        joinColumn = ref.column;
      }
    }
    if (binary.left.type === 'ColumnRef') {
      const ref = binary.left as ASTColumnRef;
      if (!ref.table || ref.table === tablePlan.table || ref.table === tablePlan.alias) {
        joinColumn = ref.column;
      }
    }

    if (joinColumn) {
      const bestIndex = this.indexManager.findBestIndex(tablePlan.table, [joinColumn]);
      if (bestIndex) {
        tablePlan.indexName = bestIndex;
        tablePlan.scanType = 'INDEX_LOOKUP';
        joinPlan.indexUsed = bestIndex;
        joinPlan.method = 'INDEX_NESTED_LOOP';
      }
    }
  }


  private analyzeSorting(orderBy: ASTOrderByItem[], plan: ExecutionPlan): SortPlan {
    const sortColumns = orderBy.map(item => ({
      column: item.expression.type === 'ColumnRef' 
        ? (item.expression as ASTColumnRef).column 
        : '',
      direction: (item.direction || 'ASC') as 'ASC' | 'DESC'
    }));
    let usingIndex = false;
    let indexName: string | undefined;

    for (const tablePlan of plan.tables) {
      if (tablePlan.indexName) {
        const indexInfo = this.indexManager.getIndexesInfo(tablePlan.table)
          .find(i => i.name === tablePlan.indexName);
        
        if (indexInfo) {
          const canUseIndex = sortColumns.every((sc, i) => 
            indexInfo.columns[i] === sc.column
          );
          
          if (canUseIndex) {
            usingIndex = true;
            indexName = tablePlan.indexName;
            tablePlan.usedForSort = true;
            break;
          }
        }
      }
    }

    const estimatedRows = plan.tables.reduce((sum, t) => sum + t.estimatedRows, 0);

    return {
      columns: sortColumns,
      usingIndex,
      indexName,
      estimatedCost: usingIndex ? 0 : this.calculateSortCost(estimatedRows)
    };
  }


  private analyzeAggregation(ast: ASTSelectStmt, plan: ExecutionPlan): AggregationPlan {
    const groupByColumns = ast.groupBy!.map(item => {
      const expr = item.expression;
      if (expr.type === 'ColumnRef') {
        return (expr as ASTColumnRef).column;
      }
      return '';
    });
    const aggregateFunctions: string[] = [];
    for (const col of ast.columns) {
      if (col.expression.type === 'FunctionCall') {
        const func = col.expression as ASTFunctionCall;
        const funcName = func.name.toUpperCase();
        if (['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'GROUP_CONCAT'].includes(funcName)) {
          aggregateFunctions.push(funcName);
        }
      }
    }
    let type: 'HASH' | 'SORT' | 'INDEX' = 'HASH';
    
    for (const tablePlan of plan.tables) {
      if (tablePlan.indexName) {
        const indexInfo = this.indexManager.getIndexesInfo(tablePlan.table)
          .find(i => i.name === tablePlan.indexName);
        
        if (indexInfo) {
          const canUseIndex = groupByColumns.every((col, i) => 
            indexInfo.columns[i] === col
          );
          if (canUseIndex) {
            type = 'INDEX';
            break;
          }
        }
      }
    }

    const estimatedRows = plan.tables.reduce((sum, t) => sum + t.estimatedRows, 0);

    return {
      type,
      groupByColumns,
      aggregateFunctions,
      estimatedCost: this.calculateAggregationCost(estimatedRows, type)
    };
  }

  private detectAggregateFunctions(ast: ASTSelectStmt): AggregationPlan | null {
    const aggregateFunctions: string[] = [];
    
    for (const col of ast.columns) {
      if (col.expression.type === 'FunctionCall') {
        const func = col.expression as ASTFunctionCall;
        const funcName = func.name.toUpperCase();
        if (['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'GROUP_CONCAT'].includes(funcName)) {
          if (!aggregateFunctions.includes(funcName)) {
            aggregateFunctions.push(funcName);
          }
        }
      }
    }
    
    if (aggregateFunctions.length === 0) {
      return null;
    }
    
    return {
      type: 'HASH',
      groupByColumns: [],
      aggregateFunctions,
      estimatedCost: 10
    };
  }


  private calculateScanCost(rows: number, scanType: ScanType): number {
    const pages = Math.ceil(rows / COST.ROWS_PER_PAGE);

    switch (scanType) {
      case 'FULL_TABLE_SCAN':
        return pages * COST.SEQ_PAGE_COST + rows * COST.CPU_TUPLE_COST;
      
      case 'INDEX_SCAN':
        return pages * COST.RANDOM_PAGE_COST * 0.5 + rows * COST.CPU_INDEX_TUPLE_COST;
      
      case 'INDEX_RANGE_SCAN':
        return pages * COST.RANDOM_PAGE_COST * 0.3 + rows * COST.CPU_INDEX_TUPLE_COST;
      
      case 'INDEX_LOOKUP':
        return Math.log2(rows + 1) * COST.RANDOM_PAGE_COST + COST.CPU_INDEX_TUPLE_COST;
      
      case 'UNIQUE_SCAN':
        return Math.log2(rows + 1) * COST.RANDOM_PAGE_COST;
      
      case 'INDEX_ONLY_SCAN':
        return pages * COST.SEQ_PAGE_COST * 0.3 + rows * COST.CPU_INDEX_TUPLE_COST;
      
      default:
        return pages * COST.SEQ_PAGE_COST + rows * COST.CPU_TUPLE_COST;
    }
  }

  private calculateJoinCost(outerRows: number, innerRows: number, method: JoinMethod): number {
    switch (method) {
      case 'NESTED_LOOP':
        return outerRows * innerRows * COST.CPU_TUPLE_COST;
      
      case 'INDEX_NESTED_LOOP':
        return outerRows * Math.log2(innerRows + 1) * COST.CPU_INDEX_TUPLE_COST;
      
      case 'HASH_JOIN':
        return (outerRows + innerRows) * COST.HASH_QUAL_COST;
      
      case 'MERGE_JOIN':
        return (outerRows + innerRows) * COST.MERGE_QUAL_COST;
      
      default:
        return outerRows * innerRows * COST.CPU_TUPLE_COST;
    }
  }

  private calculateSortCost(rows: number): number {
    if (rows <= 1) return 0;
    return rows * Math.log2(rows) * COST.CPU_OPERATOR_COST;
  }

  private calculateAggregationCost(rows: number, type: 'HASH' | 'SORT' | 'INDEX'): number {
    switch (type) {
      case 'INDEX':
        return rows * COST.CPU_INDEX_TUPLE_COST;
      case 'SORT':
        return this.calculateSortCost(rows) + rows * COST.CPU_TUPLE_COST;
      case 'HASH':
        return rows * COST.HASH_QUAL_COST;
      default:
        return rows * COST.CPU_TUPLE_COST;
    }
  }

  private calculateTotalCost(plan: ExecutionPlan): void {
    let totalRows = 1;
    let totalCost = 0;
    for (const table of plan.tables) {
      totalCost += table.estimatedCost;
      totalRows = Math.max(totalRows, table.estimatedRows);
    }
    for (const join of plan.joins) {
      totalCost += join.estimatedCost;
      totalRows = join.estimatedRows;
    }
    if (plan.sort) {
      totalCost += plan.sort.estimatedCost;
    }
    if (plan.aggregation) {
      totalCost += plan.aggregation.estimatedCost;
    }
    if (plan.limit && plan.limit < totalRows) {
      const limitRatio = plan.limit / totalRows;
      totalCost *= Math.max(limitRatio, 0.1);
      totalRows = plan.limit;
    }

    plan.totalEstimatedRows = totalRows;
    plan.totalEstimatedCost = totalCost;
  }


  private applyOptimizations(plan: ExecutionPlan, ast: ASTSelectStmt): void {
    for (const table of plan.tables) {
      if (table.scanType === 'FULL_TABLE_SCAN' && table.estimatedRows > 1000) {
        plan.warnings.push(
          `Full table scan on "${table.table}" (${table.estimatedRows} rows). Consider adding an index.`
        );
      }
    }
    if (plan.tables.length > 1) {
      const sorted = [...plan.tables].sort((a, b) => a.estimatedRows - b.estimatedRows);
      if (sorted[0].table !== plan.tables[0].table) {
        plan.optimizerHints.push(
          `Consider reordering JOINs: start with "${sorted[0].table}" (fewer rows)`
        );
      }
    }
    for (const table of plan.tables) {
      if (table.conditions && table.conditions.length > 0 && !table.indexName) {
        const columns = table.conditions
          .filter(c => c.indexable)
          .map(c => c.column);
        
        if (columns.length > 0) {
          plan.optimizerHints.push(
            `Consider creating index on "${table.table}" (${columns.join(', ')})`
          );
        }
      }
    }
    if (ast.columns.length === 1 && ast.columns[0].expression.type === 'Identifier') {
      const id = ast.columns[0].expression as any;
      if (id.name === '*') {
        plan.warnings.push(
          'SELECT * may return unnecessary columns. Consider selecting specific columns.'
        );
      }
    }
    if (plan.limit && !plan.sort) {
      plan.warnings.push(
        'LIMIT without ORDER BY returns unpredictable results.'
      );
    }
  }


  private findTableForColumn(column: string, plan: ExecutionPlan): string | null {
    for (const table of plan.tables) {
      const schema = this.schemas.get(table.table);
      if (schema) {
        const hasColumn = schema.columns.some(c => 
          c.name.toLowerCase() === column.toLowerCase()
        );
        if (hasColumn) {
          return table.table;
        }
      }
    }
    return plan.tables[0]?.table || null;
  }

  private invertOperator(op: string): string {
    switch (op) {
      case '<': return '>';
      case '>': return '<';
      case '<=': return '>=';
      case '>=': return '<=';
      default: return op;
    }
  }

  private isIndexableOperator(op: string): boolean {
    return ['=', '<', '>', '<=', '>=', 'IN', 'BETWEEN', 'IS NULL', 'IS NOT NULL'].includes(op);
  }

  private estimateSelectivity(operator: string, value: any): number {
    switch (operator) {
      case '=':
        return 0.1;
      case '<':
      case '>':
        return 0.3;
      case '<=':
      case '>=':
        return 0.35;
      case '<>':
      case '!=':
        return 0.9;
      case 'IN':
        return Array.isArray(value) ? Math.min(value.length * 0.05, 0.5) : 0.5;
      case 'BETWEEN':
        return 0.25;
      case 'LIKE':
        return value && !String(value).startsWith('%') ? 0.1 : 0.5;
      case 'IS NULL':
        return 0.05;
      case 'IS NOT NULL':
        return 0.95;
      default:
        return 0.5;
    }
  }

  private combineSelectivity(conditions: ConditionPlan[]): number {
    return conditions.reduce((sel, c) => sel * c.selectivity, 1);
  }

  private estimateJoinRows(outerRows: number, innerRows: number, join: ASTJoinClause): number {
    switch (join.joinType) {
      case 'INNER':
        return Math.max(1, Math.min(outerRows, innerRows) * 0.1);
      case 'LEFT':
        return outerRows;
      case 'RIGHT':
        return innerRows;
      case 'FULL':
        return outerRows + innerRows;
      case 'CROSS':
        return outerRows * innerRows;
      default:
        return Math.min(outerRows, innerRows);
    }
  }


  formatExplain(plan: ExecutionPlan): string {
    const lines: string[] = [];
    
    lines.push('ã==================================================================¬');
    lines.push('¦                      QUERY EXECUTION PLAN                        ¦');
    lines.push('¦==================================================================¦');
    for (const table of plan.tables) {
      const scanInfo = table.indexName 
        ? `${table.scanType} using ${table.indexName} (${table.indexColumns?.join(', ')})`
        : table.scanType;
      
      lines.push(`¦ Table: ${table.table}${table.alias ? ` AS ${table.alias}` : ''}`);
      lines.push(`¦   Scan: ${scanInfo}`);
      lines.push(`¦   Est. Rows: ${table.estimatedRows}, Cost: ${table.estimatedCost.toFixed(2)}`);
      
      if (table.conditions && table.conditions.length > 0) {
        const condStr = table.conditions.map(c => 
          `${c.column} ${c.operator}${c.value !== undefined ? ` ${JSON.stringify(c.value)}` : ''}`
        ).join(', ');
        lines.push(`¦   Conditions: ${condStr}`);
      }
      lines.push('¦');
    }
    if (plan.joins.length > 0) {
      lines.push('¦==================================================================¦');
      lines.push('¦ JOINS:');
      for (const join of plan.joins) {
        lines.push(`¦   ${join.joinType} JOIN: ${join.outerTable} ? ${join.innerTable}`);
        lines.push(`¦     Method: ${join.method}${join.indexUsed ? ` (using ${join.indexUsed})` : ''}`);
        lines.push(`¦     Est. Rows: ${join.estimatedRows}, Cost: ${join.estimatedCost.toFixed(2)}`);
      }
      lines.push('¦');
    }
    if (plan.sort) {
      lines.push('¦==================================================================¦');
      lines.push('¦ SORTING:');
      const cols = plan.sort.columns.map(c => `${c.column} ${c.direction}`).join(', ');
      lines.push(`¦   Columns: ${cols}`);
      lines.push(`¦   Using Index: ${plan.sort.usingIndex ? plan.sort.indexName : 'No (filesort)'}`);
      lines.push(`¦   Cost: ${plan.sort.estimatedCost.toFixed(2)}`);
      lines.push('¦');
    }
    if (plan.aggregation) {
      lines.push('¦==================================================================¦');
      lines.push('¦ AGGREGATION:');
      lines.push(`¦   Type: ${plan.aggregation.type}`);
      lines.push(`¦   Group By: ${plan.aggregation.groupByColumns.join(', ') || '(none)'}`);
      lines.push(`¦   Functions: ${plan.aggregation.aggregateFunctions.join(', ')}`);
      lines.push('¦');
    }
    lines.push('¦==================================================================¦');
    lines.push(`¦ TOTAL: Est. Rows: ${plan.totalEstimatedRows}, Cost: ${plan.totalEstimatedCost.toFixed(2)}`);
    if (plan.limit) {
      lines.push(`¦ LIMIT: ${plan.limit}${plan.offset ? ` OFFSET ${plan.offset}` : ''}`);
    }
    if (plan.optimizerHints.length > 0) {
      lines.push('¦==================================================================¦');
      lines.push('¦ HINTS:');
      for (const hint of plan.optimizerHints) {
        lines.push(`¦ ?? ${hint}`);
      }
    }

    if (plan.warnings.length > 0) {
      lines.push('¦==================================================================¦');
      lines.push('¦ WARNINGS:');
      for (const warning of plan.warnings) {
        lines.push(`¦ ??  ${warning}`);
      }
    }

    lines.push('L==================================================================-');

    return lines.join('\n');
  }
  formatExplainBrief(plan: ExecutionPlan): object[] {
    const rows: object[] = [];

    for (let i = 0; i < plan.tables.length; i++) {
      const table = plan.tables[i];
      const join = plan.joins[i - 1];

      rows.push({
        id: i + 1,
        select_type: 'SIMPLE',
        table: table.table,
        type: this.scanTypeToMySQLType(table.scanType),
        possible_keys: table.indexName || null,
        key: table.scanType !== 'FULL_TABLE_SCAN' ? table.indexName : null,
        key_len: table.indexColumns?.length || null,
        ref: join ? 'const' : null,
        rows: table.estimatedRows,
        filtered: table.conditions ? 
          (this.combineSelectivity(table.conditions) * 100).toFixed(2) + '%' : '100%',
        Extra: this.getExtraInfo(table, plan)
      });
    }

    return rows;
  }

  private scanTypeToMySQLType(scanType: ScanType): string {
    switch (scanType) {
      case 'FULL_TABLE_SCAN': return 'ALL';
      case 'INDEX_SCAN': return 'index';
      case 'INDEX_RANGE_SCAN': return 'range';
      case 'INDEX_LOOKUP': return 'ref';
      case 'UNIQUE_SCAN': return 'eq_ref';
      case 'INDEX_ONLY_SCAN': return 'index';
      default: return 'ALL';
    }
  }

  private getExtraInfo(table: TableAccessPlan, plan: ExecutionPlan): string {
    const extra: string[] = [];

    if (table.conditions && table.conditions.length > 0) {
      extra.push('Using where');
    }

    if (table.scanType === 'INDEX_ONLY_SCAN') {
      extra.push('Using index');
    }

    if (plan.sort && !plan.sort.usingIndex) {
      extra.push('Using filesort');
    }

    if (plan.aggregation && plan.aggregation.type !== 'INDEX') {
      extra.push('Using temporary');
    }

    return extra.join('; ') || null as any;
  }
}


export { QueryOptimizer as default };
