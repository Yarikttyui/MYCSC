import * as fs from 'fs';
import * as path from 'path';
import { 
  TableSchema, 
  Row, 
  ColumnDefinition,
  IndexDefinition,
  DataType 
} from './types';

interface PageHeader {
  pageId: number;
  pageType: 'data' | 'index' | 'overflow';
  freeSpace: number;
  recordCount: number;
  nextPage: number | null;
  prevPage: number | null;
}

interface DataPage {
  header: PageHeader;
  records: Row[];
}

export class StorageEngine {
  private dataDir: string;
  private pageSize: number = 8192; // 8KB страницы
  private cache: Map<string, DataPage[]> = new Map();
  private schemas: Map<string, TableSchema> = new Map();
  private autoIncrements: Map<string, number> = new Map();

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.ensureDataDir();
    this.loadSchemas();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private getTablePath(tableName: string): string {
    return path.join(this.dataDir, `${tableName}.nvdb`);
  }

  private getSchemaPath(tableName: string): string {
    return path.join(this.dataDir, `${tableName}.schema.json`);
  }

  private loadSchemas(): void {
    const files = fs.readdirSync(this.dataDir);
    for (const file of files) {
      if (file.endsWith('.schema.json')) {
        const schemaPath = path.join(this.dataDir, file);
        const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
        this.schemas.set(schema.name, schema);
        const autoIncKey = `${schema.name}_auto`;
        if (fs.existsSync(path.join(this.dataDir, `${autoIncKey}.cnt`))) {
          const cnt = parseInt(fs.readFileSync(path.join(this.dataDir, `${autoIncKey}.cnt`), 'utf-8'));
          this.autoIncrements.set(schema.name, cnt);
        }
      }
    }
  }
  createTable(schema: TableSchema): void {
    if (this.schemas.has(schema.name)) {
      throw new Error(`Table "${schema.name}" already exists`);
    }
    const schemaPath = this.getSchemaPath(schema.name);
    fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2));
    const tablePath = this.getTablePath(schema.name);
    const initialPage: DataPage = {
      header: {
        pageId: 0,
        pageType: 'data',
        freeSpace: this.pageSize,
        recordCount: 0,
        nextPage: null,
        prevPage: null
      },
      records: []
    };
    fs.writeFileSync(tablePath, JSON.stringify([initialPage]));

    this.schemas.set(schema.name, schema);
    this.cache.set(schema.name, [initialPage]);
    const autoIncCol = schema.columns.find(c => c.autoIncrement);
    if (autoIncCol) {
      this.autoIncrements.set(schema.name, 0);
    }
  }
  dropTable(tableName: string): void {
    if (!this.schemas.has(tableName)) {
      throw new Error(`Table "${tableName}" does not exist`);
    }

    fs.unlinkSync(this.getTablePath(tableName));
    fs.unlinkSync(this.getSchemaPath(tableName));

    const autoIncPath = path.join(this.dataDir, `${tableName}_auto.cnt`);
    if (fs.existsSync(autoIncPath)) {
      fs.unlinkSync(autoIncPath);
    }

    this.schemas.delete(tableName);
    this.cache.delete(tableName);
    this.autoIncrements.delete(tableName);
  }
  getSchema(tableName: string): TableSchema | undefined {
    return this.schemas.get(tableName);
  }
  listTables(): string[] {
    return Array.from(this.schemas.keys());
  }
  private loadTable(tableName: string): DataPage[] {
    if (this.cache.has(tableName)) {
      return this.cache.get(tableName)!;
    }

    const tablePath = this.getTablePath(tableName);
    if (!fs.existsSync(tablePath)) {
      throw new Error(`Table "${tableName}" does not exist`);
    }

    const pages: DataPage[] = JSON.parse(fs.readFileSync(tablePath, 'utf-8'));
    this.cache.set(tableName, pages);
    return pages;
  }
  private saveTable(tableName: string): void {
    const pages = this.cache.get(tableName);
    if (!pages) return;

    const tablePath = this.getTablePath(tableName);
    fs.writeFileSync(tablePath, JSON.stringify(pages));
    if (this.autoIncrements.has(tableName)) {
      const autoIncPath = path.join(this.dataDir, `${tableName}_auto.cnt`);
      fs.writeFileSync(autoIncPath, this.autoIncrements.get(tableName)!.toString());
    }
  }
  insert(tableName: string, row: Row): number {
    const schema = this.schemas.get(tableName);
    if (!schema) {
      throw new Error(`Table "${tableName}" does not exist`);
    }
    const preparedRow: Row = {};

    for (const column of schema.columns) {
      let value = row[column.name];
      if (column.autoIncrement && (value === undefined || value === null)) {
        const current = this.autoIncrements.get(tableName) || 0;
        value = current + 1;
        this.autoIncrements.set(tableName, value);
      }
      if (value === undefined && column.defaultValue !== undefined) {
        value = column.defaultValue;
      }
      if (value === undefined || value === null) {
        if (!column.nullable) {
          throw new Error(`Column "${column.name}" cannot be NULL`);
        }
        value = null;
      }
      value = this.validateAndConvertType(value, column);
      preparedRow[column.name] = value;
    }
    const pages = this.loadTable(tableName);
    let lastPage = pages[pages.length - 1];
    if (lastPage.records.length >= 1000) {
      const newPage: DataPage = {
        header: {
          pageId: pages.length,
          pageType: 'data',
          freeSpace: this.pageSize,
          recordCount: 0,
          nextPage: null,
          prevPage: lastPage.header.pageId
        },
        records: []
      };
      lastPage.header.nextPage = newPage.header.pageId;
      pages.push(newPage);
      lastPage = newPage;
    }

    lastPage.records.push(preparedRow);
    lastPage.header.recordCount++;

    this.saveTable(tableName);
    const pkColumn = schema.columns.find(c => c.primaryKey || c.autoIncrement);
    return pkColumn ? preparedRow[pkColumn.name] : lastPage.records.length;
  }
  select(
    tableName: string, 
    columns: string[] | '*',
    where?: (row: Row) => boolean,
    orderBy?: { column: string; direction: 'ASC' | 'DESC' }[],
    limit?: number,
    offset?: number
  ): Row[] {
    const schema = this.schemas.get(tableName);
    if (!schema) {
      throw new Error(`Table "${tableName}" does not exist`);
    }

    const pages = this.loadTable(tableName);
    let results: Row[] = [];
    for (const page of pages) {
      for (const record of page.records) {
        if (!where || where(record)) {
          results.push(record);
        }
      }
    }
    if (orderBy && orderBy.length > 0) {
      results.sort((a, b) => {
        for (const order of orderBy) {
          const aVal = a[order.column];
          const bVal = b[order.column];
          
          let cmp = 0;
          if (aVal < bVal) cmp = -1;
          else if (aVal > bVal) cmp = 1;
          
          if (cmp !== 0) {
            return order.direction === 'DESC' ? -cmp : cmp;
          }
        }
        return 0;
      });
    }
    if (offset !== undefined) {
      results = results.slice(offset);
    }
    if (limit !== undefined) {
      results = results.slice(0, limit);
    }
    if (columns !== '*') {
      results = results.map(row => {
        const selected: Row = {};
        for (const col of columns) {
          selected[col] = row[col];
        }
        return selected;
      });
    }

    return results;
  }
  update(tableName: string, set: Row, where?: (row: Row) => boolean): number {
    const schema = this.schemas.get(tableName);
    if (!schema) {
      throw new Error(`Table "${tableName}" does not exist`);
    }
    for (const [colName, value] of Object.entries(set)) {
      const column = schema.columns.find(c => c.name === colName);
      if (!column) {
        throw new Error(`Unknown column "${colName}"`);
      }
      set[colName] = this.validateAndConvertType(value, column);
    }

    const pages = this.loadTable(tableName);
    let affectedRows = 0;

    for (const page of pages) {
      for (let i = 0; i < page.records.length; i++) {
        const record = page.records[i];
        if (!where || where(record)) {
          page.records[i] = { ...record, ...set };
          affectedRows++;
        }
      }
    }

    if (affectedRows > 0) {
      this.saveTable(tableName);
    }

    return affectedRows;
  }
  delete(tableName: string, where?: (row: Row) => boolean): number {
    const schema = this.schemas.get(tableName);
    if (!schema) {
      throw new Error(`Table "${tableName}" does not exist`);
    }

    const pages = this.loadTable(tableName);
    let affectedRows = 0;

    for (const page of pages) {
      const originalLength = page.records.length;
      page.records = page.records.filter(record => {
        if (!where || !where(record)) {
          return true;
        }
        affectedRows++;
        return false;
      });
      page.header.recordCount = page.records.length;
    }

    if (affectedRows > 0) {
      this.saveTable(tableName);
    }

    return affectedRows;
  }
  private validateAndConvertType(value: any, column: ColumnDefinition): any {
    if (value === null) return null;

    switch (column.type) {
      case DataType.INTEGER:
      case DataType.BIGINT:
        const intVal = parseInt(value);
        if (isNaN(intVal)) throw new Error(`Invalid integer value for "${column.name}"`);
        return intVal;

      case DataType.FLOAT:
      case DataType.DOUBLE:
      case DataType.DECIMAL:
        const floatVal = parseFloat(value);
        if (isNaN(floatVal)) throw new Error(`Invalid float value for "${column.name}"`);
        return floatVal;

      case DataType.BOOLEAN:
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
          return value.toLowerCase() === 'true' || value === '1';
        }
        return Boolean(value);

      case DataType.VARCHAR:
      case DataType.TEXT:
        const strVal = String(value);
        if (column.length && strVal.length > column.length) {
          throw new Error(`Value too long for column "${column.name}" (max: ${column.length})`);
        }
        return strVal;

      case DataType.DATE:
      case DataType.DATETIME:
      case DataType.TIMESTAMP:
        if (value instanceof Date) return value.toISOString();
        return new Date(value).toISOString();

      case DataType.JSON:
        if (typeof value === 'string') {
          JSON.parse(value);
          return value;
        }
        return JSON.stringify(value);

      default:
        return value;
    }
  }
  count(tableName: string, where?: (row: Row) => boolean): number {
    const pages = this.loadTable(tableName);
    let count = 0;

    for (const page of pages) {
      if (!where) {
        count += page.records.length;
      } else {
        count += page.records.filter(where).length;
      }
    }

    return count;
  }
  aggregate(tableName: string, column: string, func: 'SUM' | 'AVG' | 'MIN' | 'MAX', where?: (row: Row) => boolean): number | null {
    const pages = this.loadTable(tableName);
    let values: number[] = [];

    for (const page of pages) {
      for (const record of page.records) {
        if (!where || where(record)) {
          const val = record[column];
          if (val !== null && val !== undefined) {
            values.push(Number(val));
          }
        }
      }
    }

    if (values.length === 0) return null;

    switch (func) {
      case 'SUM':
        return values.reduce((a, b) => a + b, 0);
      case 'AVG':
        return values.reduce((a, b) => a + b, 0) / values.length;
      case 'MIN':
        return Math.min(...values);
      case 'MAX':
        return Math.max(...values);
    }
  }
}
