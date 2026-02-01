export type CopyFormat = 'json' | 'csv' | 'sql' | 'markdown' | 'tsv' | 'html' | 'excel';

interface CopyOptions {
  tableName?: string;
  includeHeaders?: boolean;
}

export function copyResultsAs(
  rows: Record<string, any>[],
  columns: string[],
  format: CopyFormat,
  options: CopyOptions = {}
): string {
  const { tableName = 'table_name', includeHeaders = true } = options;

  switch (format) {
    case 'json':
      return toJSON(rows);
    case 'csv':
      return toCSV(rows, columns, includeHeaders);
    case 'sql':
      return toSQL(rows, columns, tableName);
    case 'markdown':
      return toMarkdown(rows, columns);
    case 'tsv':
      return toTSV(rows, columns, includeHeaders);
    case 'html':
      return toHTML(rows, columns);
    case 'excel':
      return toExcelXML(rows, columns);
    default:
      return JSON.stringify(rows, null, 2);
  }
}
function toJSON(rows: Record<string, any>[]): string {
  return JSON.stringify(rows, null, 2);
}
function toCSV(rows: Record<string, any>[], columns: string[], includeHeaders: boolean): string {
  const lines: string[] = [];

  if (includeHeaders) {
    lines.push(columns.map(escapeCSV).join(','));
  }

  rows.forEach(row => {
    const values = columns.map(col => escapeCSV(formatValue(row[col])));
    lines.push(values.join(','));
  });

  return lines.join('\n');
}
function toTSV(rows: Record<string, any>[], columns: string[], includeHeaders: boolean): string {
  const lines: string[] = [];

  if (includeHeaders) {
    lines.push(columns.join('\t'));
  }

  rows.forEach(row => {
    const values = columns.map(col => formatValue(row[col]).replace(/\t/g, ' '));
    lines.push(values.join('\t'));
  });

  return lines.join('\n');
}
function toSQL(rows: Record<string, any>[], columns: string[], tableName: string): string {
  const lines: string[] = [];

  rows.forEach(row => {
    const values = columns.map(col => formatSQLValue(row[col]));
    lines.push(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});`);
  });

  return lines.join('\n');
}
function toMarkdown(rows: Record<string, any>[], columns: string[]): string {
  const lines: string[] = [];
  lines.push('| ' + columns.join(' | ') + ' |');
  lines.push('| ' + columns.map(() => '---').join(' | ') + ' |');
  rows.forEach(row => {
    const values = columns.map(col => formatValue(row[col]).replace(/\|/g, '\\|'));
    lines.push('| ' + values.join(' | ') + ' |');
  });

  return lines.join('\n');
}
function toHTML(rows: Record<string, any>[], columns: string[]): string {
  const lines: string[] = [];

  lines.push('<table>');
  lines.push('  <thead>');
  lines.push('    <tr>');
  columns.forEach(col => {
    lines.push(`      <th>${escapeHTML(col)}</th>`);
  });
  lines.push('    </tr>');
  lines.push('  </thead>');
  lines.push('  <tbody>');

  rows.forEach(row => {
    lines.push('    <tr>');
    columns.forEach(col => {
      lines.push(`      <td>${escapeHTML(formatValue(row[col]))}</td>`);
    });
    lines.push('    </tr>');
  });

  lines.push('  </tbody>');
  lines.push('</table>');

  return lines.join('\n');
}
function toExcelXML(rows: Record<string, any>[], columns: string[]): string {
  const lines: string[] = [];
  
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<?mso-application progid="Excel.Sheet"?>');
  lines.push('<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"');
  lines.push(' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">');
  lines.push('  <Styles>');
  lines.push('    <Style ss:ID="Header">');
  lines.push('      <Font ss:Bold="1"/>');
  lines.push('      <Interior ss:Color="#E0E0E0" ss:Pattern="Solid"/>');
  lines.push('    </Style>');
  lines.push('  </Styles>');
  lines.push('  <Worksheet ss:Name="Data">');
  lines.push('    <Table>');
  lines.push('      <Row>');
  columns.forEach(col => {
    lines.push(`        <Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXML(col)}</Data></Cell>`);
  });
  lines.push('      </Row>');
  rows.forEach(row => {
    lines.push('      <Row>');
    columns.forEach(col => {
      const value = row[col];
      const type = typeof value === 'number' ? 'Number' : 'String';
      const displayValue = value === null || value === undefined ? '' : 
        typeof value === 'object' ? JSON.stringify(value) : String(value);
      lines.push(`        <Cell><Data ss:Type="${type}">${escapeXML(displayValue)}</Data></Cell>`);
    });
    lines.push('      </Row>');
  });
  
  lines.push('    </Table>');
  lines.push('  </Worksheet>');
  lines.push('</Workbook>');
  
  return lines.join('\n');
}
function escapeXML(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
function formatValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}
function formatSQLValue(value: any): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  if (typeof value === 'object') {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
function escapeHTML(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      document.body.removeChild(textarea);
      return false;
    }
  }
}
