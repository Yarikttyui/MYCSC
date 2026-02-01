const newlineKeywords = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ORDER BY', 'GROUP BY',
  'HAVING', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN',
  'FULL JOIN', 'CROSS JOIN', 'ON', 'UNION', 'UNION ALL', 'EXCEPT', 'INTERSECT',
  'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM',
  'CREATE TABLE', 'CREATE INDEX', 'CREATE VIEW', 'CREATE PROCEDURE', 'CREATE FUNCTION',
  'ALTER TABLE', 'DROP TABLE', 'DROP INDEX', 'DROP VIEW',
  'LIMIT', 'OFFSET', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'IF', 'BEGIN', 'DECLARE', 'RETURN'
];
const allKeywords = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN',
  'IS', 'NULL', 'TRUE', 'FALSE', 'AS', 'ON', 'USING',
  'ORDER', 'BY', 'ASC', 'DESC', 'GROUP', 'HAVING',
  'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'CROSS', 'NATURAL',
  'UNION', 'ALL', 'EXCEPT', 'INTERSECT',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
  'CREATE', 'TABLE', 'INDEX', 'VIEW', 'PROCEDURE', 'FUNCTION', 'TRIGGER',
  'ALTER', 'ADD', 'DROP', 'MODIFY', 'COLUMN', 'CONSTRAINT',
  'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'UNIQUE', 'CHECK', 'DEFAULT',
  'AUTO_INCREMENT', 'NOT', 'NULL', 'UNIQUE',
  'IF', 'EXISTS', 'THEN', 'ELSE', 'END', 'CASE', 'WHEN',
  'BEGIN', 'COMMIT', 'ROLLBACK', 'TRANSACTION',
  'LIMIT', 'OFFSET', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
  'CAST', 'CONVERT', 'COALESCE', 'NULLIF',
  'VARCHAR', 'CHAR', 'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT',
  'DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE', 'REAL',
  'DATE', 'TIME', 'DATETIME', 'TIMESTAMP', 'YEAR',
  'TEXT', 'BLOB', 'BOOLEAN', 'BOOL', 'JSON',
  'CURRENT_TIMESTAMP', 'CURRENT_DATE', 'CURRENT_TIME',
  'CASCADE', 'RESTRICT', 'NO', 'ACTION', 'SET',
  'SHOW', 'TABLES', 'DATABASES', 'COLUMNS', 'DESCRIBE', 'EXPLAIN',
  'TRUNCATE', 'REPLACE', 'IGNORE', 'DUPLICATE', 'RETURNING',
  'WITH', 'RECURSIVE', 'OVER', 'PARTITION', 'ROW', 'ROWS',
  'PRECEDING', 'FOLLOWING', 'UNBOUNDED', 'CURRENT',
  'DECLARE', 'RETURN', 'RETURNS', 'DETERMINISTIC', 'READS', 'SQL', 'DATA',
  'MODIFIES', 'CONTAINS', 'LANGUAGE', 'COMMENT'
];

interface FormatOptions {
  indentSize?: number;
  uppercase?: boolean;
  linesBetweenQueries?: number;
}

export function formatSQL(sql: string, options: FormatOptions = {}): string {
  const {
    indentSize = 2,
    uppercase = true,
    linesBetweenQueries = 2
  } = options;

  const indent = ' '.repeat(indentSize);
  let formatted = sql.trim();
  const strings: string[] = [];
  const comments: string[] = [];
  formatted = formatted.replace(/'([^'\\]|\\.)*'/g, (match) => {
    strings.push(match);
    return `__STRING_${strings.length - 1}__`;
  });
  formatted = formatted.replace(/"([^"\\]|\\.)*"/g, (match) => {
    strings.push(match);
    return `__STRING_${strings.length - 1}__`;
  });
  formatted = formatted.replace(/\/\*[\s\S]*?\*\//g, (match) => {
    comments.push(match);
    return `__COMMENT_${comments.length - 1}__`;
  });
  formatted = formatted.replace(/--.*$/gm, (match) => {
    comments.push(match);
    return `__COMMENT_${comments.length - 1}__`;
  });
  formatted = formatted.replace(/\s+/g, ' ');
  if (uppercase) {
    allKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      formatted = formatted.replace(regex, keyword);
    });
  }
  newlineKeywords.forEach(keyword => {
    const regex = new RegExp(`\\s+${keyword.replace(/ /g, '\\s+')}\\b`, 'gi');
    formatted = formatted.replace(regex, `\n${keyword}`);
  });
  formatted = formatted.replace(/\(\s*/g, '(\n' + indent);
  formatted = formatted.replace(/\s*\)/g, '\n)');
  formatted = formatted.replace(/,\s*(?![^(]*\))/g, ',\n' + indent);
  formatted = formatted.replace(/;\s*/g, ';\n'.repeat(linesBetweenQueries));
  formatted = formatted.replace(/\n{3,}/g, '\n\n');
  formatted = formatted.replace(/^\s+/gm, (match) => {
    const depth = (match.match(/\n/g) || []).length;
    return '\n' + indent.repeat(Math.min(depth, 3));
  });
  const lines = formatted.split('\n');
  let indentLevel = 0;
  const indentedLines = lines.map(line => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return '';
    if (trimmedLine.startsWith(')') || trimmedLine.startsWith('END')) {
      indentLevel = Math.max(0, indentLevel - 1);
    }

    const indentedLine = indent.repeat(indentLevel) + trimmedLine;
    if (trimmedLine.endsWith('(') || 
        trimmedLine.startsWith('CASE') ||
        trimmedLine.startsWith('BEGIN')) {
      indentLevel++;
    }

    return indentedLine;
  });

  formatted = indentedLines.join('\n').trim();
  strings.forEach((str, i) => {
    formatted = formatted.replace(`__STRING_${i}__`, str);
  });
  comments.forEach((comment, i) => {
    formatted = formatted.replace(`__COMMENT_${i}__`, comment);
  });

  return formatted;
}
export function prettifySQL(sql: string): string {
  let result = sql.trim();
  allKeywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    result = result.replace(regex, keyword);
  });

  return result;
}
export function minifySQL(sql: string): string {
  return sql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
