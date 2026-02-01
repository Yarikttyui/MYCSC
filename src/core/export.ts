import { 
  TableSchema, 
  Row, 
  ExportOptions, 
  ImportOptions, 
  ExportResult, 
  ImportResult,
  DataType,
  ColumnDefinition
} from './types';

export class ExportImportManager {
  
  
  exportToSQL(
    tables: Map<string, { schema: TableSchema; data: Row[] }>,
    options: ExportOptions
  ): string {
    const lines: string[] = [];
    const timestamp = new Date().toISOString();
    
    lines.push(`-- MYCSC SQL Export`);
    lines.push(`-- Generated: ${timestamp}`);
    lines.push(`-- Options: schema=${options.includeSchema}, data=${options.includeData}`);
    lines.push('');
    lines.push('SET FOREIGN_KEY_CHECKS = 0;');
    lines.push('');

    for (const [tableName, { schema, data }] of tables) {
      if (options.tables && !options.tables.includes(tableName)) continue;
      lines.push(`DROP TABLE IF EXISTS \`${tableName}\`;`);
      lines.push('');
      if (options.includeSchema) {
        lines.push(this.generateCreateTable(schema));
        lines.push('');
      }
      if (options.includeData && data.length > 0) {
        lines.push(this.generateInserts(tableName, schema.columns, data));
        lines.push('');
      }
      if (options.includeIndexes && schema.indexes.length > 0) {
        for (const index of schema.indexes) {
          if (!index.unique) {
            lines.push(`CREATE INDEX \`${index.name}\` ON \`${tableName}\` (${index.columns.map(c => `\`${c}\``).join(', ')});`);
          }
        }
        lines.push('');
      }
    }
    if (options.includeForeignKeys) {
      for (const [tableName, { schema }] of tables) {
        if (options.tables && !options.tables.includes(tableName)) continue;
        
        for (const col of schema.columns) {
          if (col.references) {
            lines.push(`ALTER TABLE \`${tableName}\` ADD CONSTRAINT \`fk_${tableName}_${col.name}\` `);
            lines.push(`  FOREIGN KEY (\`${col.name}\`) REFERENCES \`${col.references.table}\`(\`${col.references.column}\`)`);
            lines.push(`  ON DELETE ${col.references.onDelete} ON UPDATE ${col.references.onUpdate};`);
          }
        }
      }
      lines.push('');
    }

    lines.push('SET FOREIGN_KEY_CHECKS = 1;');
    lines.push('');
    lines.push(`-- Export complete`);

    return lines.join('\n');
  }

  private generateCreateTable(schema: TableSchema): string {
    const lines: string[] = [];
    lines.push(`CREATE TABLE \`${schema.name}\` (`);

    const columnDefs: string[] = [];
    const primaryKeys: string[] = [];

    for (const col of schema.columns) {
      let def = `  \`${col.name}\` ${this.getTypeString(col)}`;
      
      if (!col.nullable) def += ' NOT NULL';
      if (col.autoIncrement) def += ' AUTO_INCREMENT';
      if (col.defaultValue !== undefined) {
        def += ` DEFAULT ${this.formatValue(col.defaultValue, col.type)}`;
      }
      if (col.unique && !col.primaryKey) def += ' UNIQUE';
      if (col.comment) def += ` COMMENT '${col.comment.replace(/'/g, "''")}'`;
      
      if (col.primaryKey) primaryKeys.push(col.name);
      
      columnDefs.push(def);
    }

    if (primaryKeys.length > 0) {
      columnDefs.push(`  PRIMARY KEY (${primaryKeys.map(k => `\`${k}\``).join(', ')})`);
    }
    for (const index of schema.indexes) {
      if (index.unique) {
        columnDefs.push(`  UNIQUE KEY \`${index.name}\` (${index.columns.map(c => `\`${c}\``).join(', ')})`);
      }
    }

    lines.push(columnDefs.join(',\n'));
    
    let tableOptions = ')';
    if (schema.engine) tableOptions += ` ENGINE=${schema.engine}`;
    if (schema.charset) tableOptions += ` DEFAULT CHARSET=${schema.charset}`;
    if (schema.comment) tableOptions += ` COMMENT='${schema.comment.replace(/'/g, "''")}'`;
    tableOptions += ';';
    
    lines.push(tableOptions);

    return lines.join('\n');
  }

  private getTypeString(col: ColumnDefinition): string {
    switch (col.type) {
      case DataType.VARCHAR:
      case DataType.CHAR:
        return `${col.type}(${col.length || 255})`;
      case DataType.DECIMAL:
        return `DECIMAL(${col.precision || 10},${col.scale || 2})`;
      case DataType.ENUM:
        return `ENUM(${col.enumValues?.map(v => `'${v}'`).join(', ') || ''})`;
      default:
        return col.type;
    }
  }

  private generateInserts(tableName: string, columns: ColumnDefinition[], data: Row[]): string {
    if (data.length === 0) return '';

    const colNames = columns.map(c => `\`${c.name}\``).join(', ');
    const lines: string[] = [];
    const batchSize = 1000;
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const values = batch.map(row => {
        const rowValues = columns.map(col => this.formatValue(row[col.name], col.type));
        return `(${rowValues.join(', ')})`;
      });
      
      lines.push(`INSERT INTO \`${tableName}\` (${colNames}) VALUES`);
      lines.push(values.join(',\n') + ';');
    }

    return lines.join('\n');
  }

  private formatValue(value: any, type: DataType): string {
    if (value === null || value === undefined) return 'NULL';
    
    switch (type) {
      case DataType.INTEGER:
      case DataType.BIGINT:
      case DataType.TINYINT:
      case DataType.SMALLINT:
      case DataType.FLOAT:
      case DataType.DOUBLE:
      case DataType.DECIMAL:
        return String(value);
      
      case DataType.BOOLEAN:
        return value ? '1' : '0';
      
      case DataType.JSON:
        const jsonStr = typeof value === 'string' ? value : JSON.stringify(value);
        return `'${jsonStr.replace(/'/g, "''")}'`;
      
      default:
        return `'${String(value).replace(/'/g, "''")}'`;
    }
  }
  exportToJSON(
    tables: Map<string, { schema: TableSchema; data: Row[] }>,
    options: ExportOptions
  ): string {
    const result: any = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      tables: {}
    };

    for (const [tableName, { schema, data }] of tables) {
      if (options.tables && !options.tables.includes(tableName)) continue;

      result.tables[tableName] = {};
      
      if (options.includeSchema) {
        result.tables[tableName].schema = {
          columns: schema.columns,
          indexes: options.includeIndexes ? schema.indexes : [],
          primaryKey: schema.primaryKey,
          foreignKeys: options.includeForeignKeys ? schema.foreignKeys : []
        };
      }
      
      if (options.includeData) {
        result.tables[tableName].data = data;
      }
    }

    return JSON.stringify(result, null, 2);
  }
  exportToCSV(tableName: string, columns: ColumnDefinition[], data: Row[]): string {
    const lines: string[] = [];
    lines.push(columns.map(c => `"${c.name}"`).join(','));
    for (const row of data) {
      const values = columns.map(col => {
        const value = row[col.name];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string') {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value);
      });
      lines.push(values.join(','));
    }

    return lines.join('\n');
  }
  exportToXML(
    tables: Map<string, { schema: TableSchema; data: Row[] }>,
    options: ExportOptions
  ): string {
    const lines: string[] = [];
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push('<database>');
    lines.push(`  <exportedAt>${new Date().toISOString()}</exportedAt>`);
    lines.push('  <tables>');

    for (const [tableName, { schema, data }] of tables) {
      if (options.tables && !options.tables.includes(tableName)) continue;

      lines.push(`    <table name="${tableName}">`);
      
      if (options.includeSchema) {
        lines.push('      <schema>');
        for (const col of schema.columns) {
          lines.push(`        <column name="${col.name}" type="${col.type}" nullable="${col.nullable}" />`);
        }
        lines.push('      </schema>');
      }
      
      if (options.includeData) {
        lines.push('      <rows>');
        for (const row of data) {
          lines.push('        <row>');
          for (const col of schema.columns) {
            const value = row[col.name];
            const escapedValue = value === null ? '' : this.escapeXML(String(value));
            lines.push(`          <${col.name}>${escapedValue}</${col.name}>`);
          }
          lines.push('        </row>');
        }
        lines.push('      </rows>');
      }
      
      lines.push('    </table>');
    }

    lines.push('  </tables>');
    lines.push('</database>');

    return lines.join('\n');
  }

  private escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  parseJSONImport(jsonData: string): Map<string, { schema?: TableSchema; data: Row[] }> {
    const parsed = JSON.parse(jsonData);
    const result = new Map<string, { schema?: TableSchema; data: Row[] }>();

    if (parsed.tables) {
      for (const [tableName, tableData] of Object.entries(parsed.tables) as any) {
        result.set(tableName, {
          schema: tableData.schema ? this.parseSchemaFromJSON(tableData.schema) : undefined,
          data: tableData.data || []
        });
      }
    }

    return result;
  }

  private parseSchemaFromJSON(schemaData: any): TableSchema {
    return {
      name: schemaData.name || '',
      columns: schemaData.columns || [],
      indexes: schemaData.indexes || [],
      primaryKey: schemaData.primaryKey || [],
      foreignKeys: schemaData.foreignKeys || [],
      relations: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
  parseCSVImport(csvData: string, hasHeader: boolean = true): { columns: string[]; data: Row[] } {
    const lines = csvData.split('\n').filter(line => line.trim());
    const result: Row[] = [];
    let columns: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      
      if (i === 0 && hasHeader) {
        columns = values;
        continue;
      }

      if (columns.length === 0) {
        columns = values.map((_, idx) => `column_${idx + 1}`);
      }

      const row: Row = {};
      for (let j = 0; j < columns.length; j++) {
        row[columns[j]] = values[j] || null;
      }
      result.push(row);
    }

    return { columns, data: result };
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
    }

    result.push(current.trim());
    return result;
  }
  validateImportData(
    schema: TableSchema, 
    data: Row[]
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 1;

      for (const col of schema.columns) {
        const value = row[col.name];
        if (!col.nullable && (value === null || value === undefined)) {
          if (!col.autoIncrement && col.defaultValue === undefined) {
            errors.push(`Row ${rowNum}: Column "${col.name}" cannot be NULL`);
          }
        }
        if (value !== null && value !== undefined) {
          const typeError = this.validateType(value, col);
          if (typeError) {
            errors.push(`Row ${rowNum}: Column "${col.name}" - ${typeError}`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private validateType(value: any, col: ColumnDefinition): string | null {
    switch (col.type) {
      case DataType.INTEGER:
      case DataType.BIGINT:
      case DataType.TINYINT:
      case DataType.SMALLINT:
        if (isNaN(parseInt(value))) {
          return `Invalid integer value: ${value}`;
        }
        break;
      
      case DataType.FLOAT:
      case DataType.DOUBLE:
      case DataType.DECIMAL:
        if (isNaN(parseFloat(value))) {
          return `Invalid number value: ${value}`;
        }
        break;
      
      case DataType.VARCHAR:
      case DataType.CHAR:
        if (col.length && String(value).length > col.length) {
          return `Value too long (max ${col.length}): ${value}`;
        }
        break;
      
      case DataType.DATE:
      case DataType.DATETIME:
      case DataType.TIMESTAMP:
        if (isNaN(Date.parse(value))) {
          return `Invalid date value: ${value}`;
        }
        break;
      
      case DataType.JSON:
        if (typeof value === 'string') {
          try {
            JSON.parse(value);
          } catch {
            return `Invalid JSON value: ${value}`;
          }
        }
        break;
    }

    return null;
  }
}

export const exportImportManager = new ExportImportManager();
