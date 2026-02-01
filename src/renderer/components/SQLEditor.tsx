import React, { useRef, useCallback, useEffect, useState } from 'react';

interface SQLEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  placeholder?: string;
  autoSave?: boolean;
  autoSaveInterval?: number;
  onAutoSave?: (sql: string) => void;
}
const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 
  'DELETE', 'CREATE', 'TABLE', 'DATABASE', 'DROP', 'ALTER', 'ADD', 'COLUMN',
  'INDEX', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'NOT', 'NULL', 'DEFAULT',
  'AUTO_INCREMENT', 'UNIQUE', 'CHECK', 'CONSTRAINT', 'IF', 'EXISTS', 'CASCADE',
  'ON', 'AND', 'OR', 'IN', 'BETWEEN', 'LIKE', 'IS', 'AS', 'JOIN', 'LEFT', 'RIGHT',
  'INNER', 'OUTER', 'CROSS', 'FULL', 'UNION', 'ALL', 'DISTINCT', 'ORDER', 'BY',
  'ASC', 'DESC', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'CASE', 'WHEN', 'THEN',
  'ELSE', 'END', 'BEGIN', 'COMMIT', 'ROLLBACK', 'TRANSACTION', 'GRANT', 'REVOKE',
  'USE', 'SHOW', 'DESCRIBE', 'EXPLAIN', 'TRUNCATE', 'RENAME', 'TO', 'VIEW',
  'PROCEDURE', 'FUNCTION', 'TRIGGER', 'DECLARE', 'CURSOR', 'FETCH', 'RETURN',
  'RETURNS', 'DETERMINISTIC', 'CALL', 'EXECUTE', 'PREPARE', 'DEALLOCATE'
];
const SQL_TYPES = [
  'INT', 'INTEGER', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT', 'DECIMAL',
  'NUMERIC', 'FLOAT', 'DOUBLE', 'REAL', 'BIT', 'BOOLEAN', 'BOOL', 'DATE',
  'DATETIME', 'TIMESTAMP', 'TIME', 'YEAR', 'CHAR', 'VARCHAR', 'BINARY',
  'VARBINARY', 'TINYBLOB', 'BLOB', 'MEDIUMBLOB', 'LONGBLOB', 'TINYTEXT',
  'TEXT', 'MEDIUMTEXT', 'LONGTEXT', 'ENUM', 'SET', 'JSON', 'GEOMETRY',
  'POINT', 'LINESTRING', 'POLYGON', 'MULTIPOINT', 'MULTILINESTRING',
  'MULTIPOLYGON', 'GEOMETRYCOLLECTION'
];
const SQL_FUNCTIONS = [
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'CONCAT', 'SUBSTRING', 'SUBSTR',
  'LENGTH', 'UPPER', 'LOWER', 'TRIM', 'LTRIM', 'RTRIM', 'REPLACE', 'COALESCE',
  'IFNULL', 'NULLIF', 'CAST', 'CONVERT', 'NOW', 'CURDATE', 'CURTIME',
  'DATE_FORMAT', 'DATEDIFF', 'DATE_ADD', 'DATE_SUB', 'YEAR', 'MONTH', 'DAY',
  'HOUR', 'MINUTE', 'SECOND', 'ABS', 'CEIL', 'FLOOR', 'ROUND', 'MOD', 'POWER',
  'SQRT', 'RAND', 'IF', 'CASE', 'WHEN', 'GREATEST', 'LEAST', 'GROUP_CONCAT'
];

export const SQLEditor: React.FC<SQLEditorProps> = ({
  value,
  onChange,
  onExecute,
  placeholder = 'Введите SQL запрос...',
  autoSave = false,
  autoSaveInterval = 30000,
  onAutoSave
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [cursorInfo, setCursorInfo] = useState({ line: 1, col: 1 });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const lastSavedRef = useRef<string>(value);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!autoSave || !onAutoSave) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    if (value !== lastSavedRef.current && value.trim()) {
      setSaveStatus('idle');
      
      saveTimeoutRef.current = setTimeout(() => {
        setSaveStatus('saving');
        onAutoSave(value);
        lastSavedRef.current = value;
        
        setTimeout(() => {
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2000);
        }, 300);
      }, autoSaveInterval);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [value, autoSave, autoSaveInterval, onAutoSave]);
  const highlightSQL = useCallback((code: string): string => {
    if (!code) return '';
    
    const result: string[] = [];
    let i = 0;
    
    while (i < code.length) {
      if (code[i] === '-' && code[i + 1] === '-') {
        let end = i + 2;
        while (end < code.length && code[end] !== '\n') end++;
        const comment = code.slice(i, end);
        result.push(`<span class="sql-comment">${escapeHtml(comment)}</span>`);
        i = end;
        continue;
      }
      if (code[i] === '/' && code[i + 1] === '*') {
        let end = i + 2;
        while (end < code.length - 1 && !(code[end] === '*' && code[end + 1] === '/')) end++;
        end += 2;
        const comment = code.slice(i, end);
        result.push(`<span class="sql-comment">${escapeHtml(comment)}</span>`);
        i = end;
        continue;
      }
      if (code[i] === "'") {
        let end = i + 1;
        while (end < code.length && code[end] !== "'") {
          if (code[end] === '\\') end++;
          end++;
        }
        end++;
        const str = code.slice(i, end);
        result.push(`<span class="sql-string">${escapeHtml(str)}</span>`);
        i = end;
        continue;
      }
      if (code[i] === '"') {
        let end = i + 1;
        while (end < code.length && code[end] !== '"') {
          if (code[end] === '\\') end++;
          end++;
        }
        end++;
        const str = code.slice(i, end);
        result.push(`<span class="sql-string">${escapeHtml(str)}</span>`);
        i = end;
        continue;
      }
      if (/[a-zA-Z_]/.test(code[i])) {
        let end = i;
        while (end < code.length && /[a-zA-Z0-9_]/.test(code[end])) end++;
        const word = code.slice(i, end);
        const upperWord = word.toUpperCase();
        
        if (SQL_KEYWORDS.includes(upperWord)) {
          result.push(`<span class="sql-keyword">${escapeHtml(word)}</span>`);
        } else if (SQL_TYPES.includes(upperWord)) {
          result.push(`<span class="sql-type">${escapeHtml(word)}</span>`);
        } else if (SQL_FUNCTIONS.includes(upperWord) && code[end] === '(') {
          result.push(`<span class="sql-function">${escapeHtml(word)}</span>`);
        } else {
          result.push(escapeHtml(word));
        }
        i = end;
        continue;
      }
      if (/[0-9]/.test(code[i])) {
        let end = i;
        while (end < code.length && /[0-9.]/.test(code[end])) end++;
        const num = code.slice(i, end);
        result.push(`<span class="sql-number">${num}</span>`);
        i = end;
        continue;
      }
      if (/[=<>!+\-*/%]/.test(code[i])) {
        let end = i;
        while (end < code.length && /[=<>!]/.test(code[end])) end++;
        if (end === i) end++;
        const op = code.slice(i, end);
        result.push(`<span class="sql-operator">${escapeHtml(op)}</span>`);
        i = end;
        continue;
      }
      result.push(escapeHtml(code[i]));
      i++;
    }
    
    return result.join('');
  }, []);
  
  const escapeHtml = (text: string): string => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  };
  const handleScroll = useCallback(() => {
    if (textareaRef.current) {
      if (lineNumbersRef.current) {
        lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
      }
      if (highlightRef.current) {
        highlightRef.current.scrollTop = textareaRef.current.scrollTop;
        highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
      }
    }
  }, []);
  const updateCursor = useCallback(() => {
    if (!textareaRef.current) return;
    const pos = textareaRef.current.selectionStart;
    const text = value.substring(0, pos);
    const lines = text.split('\n');
    setCursorInfo({
      line: lines.length,
      col: lines[lines.length - 1].length + 1
    });
  }, [value]);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      onExecute();
      return;
    }
    if (e.key === 'F5') {
      e.preventDefault();
      onExecute();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textareaRef.current?.selectionStart || 0;
      const end = textareaRef.current?.selectionEnd || 0;
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newValue);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + 2;
          textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  };
  const lineCount = Math.max(value.split('\n').length, 20);

  return (
    <div className="sql-editor">
      <div className="editor-body">
        <div ref={lineNumbersRef} className="line-numbers">
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i + 1} className="line-num">{i + 1}</div>
          ))}
        </div>
        <div className="editor-container">
          <pre 
            ref={highlightRef}
            className="editor-highlight"
            dangerouslySetInnerHTML={{ __html: highlightSQL(value) + '\n' }}
          />
          <textarea
            ref={textareaRef}
            className="editor-textarea"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            onKeyUp={updateCursor}
            onClick={updateCursor}
            placeholder={placeholder}
            spellCheck={false}
          />
        </div>
      </div>
      <div className="editor-footer">
        <div className="footer-left">
          <span>Строка {cursorInfo.line}, Столбец {cursorInfo.col}</span>
          {autoSave && (
            <span className={`save-indicator ${saveStatus}`}>
              {saveStatus === 'saving' && '💾 Сохранение...'}
              {saveStatus === 'saved' && '✓ Сохранено'}
            </span>
          )}
        </div>
        <div className="footer-right">
          <span className="hint">Ctrl+Enter — выполнить</span>
        </div>
      </div>

      <style>{`
        .sql-editor {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
          background: var(--bg-primary);
          border-radius: 6px;
          overflow: hidden;
        }

        .editor-body {
          display: flex;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }

        .line-numbers {
          width: 50px;
          background: var(--bg-secondary);
          border-right: 1px solid var(--border);
          padding: 8px 0;
          overflow: hidden;
          flex-shrink: 0;
        }

        .line-num {
          height: 24px;
          line-height: 24px;
          text-align: right;
          padding-right: 12px;
          color: var(--text-muted);
          font-family: 'Consolas', 'Monaco', monospace;
          font-size: 13px;
          user-select: none;
        }

        .editor-container {
          flex: 1;
          position: relative;
          overflow: hidden;
        }

        .editor-highlight {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          margin: 0;
          padding: 8px 12px;
          font-family: 'Consolas', 'Monaco', monospace;
          font-size: 13px;
          line-height: 24px;
          white-space: pre-wrap;
          word-wrap: break-word;
          color: var(--text-primary);
          pointer-events: none;
          overflow: auto;
        }

        .editor-textarea {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          padding: 8px 12px;
          background: transparent;
          color: transparent;
          caret-color: var(--ctp-pink);
          border: none;
          outline: none;
          resize: none;
          font-family: 'Consolas', 'Monaco', monospace;
          font-size: 13px;
          line-height: 24px;
          overflow: auto;
        }

        .editor-textarea::placeholder {
          color: var(--text-muted);
        }

        .editor-textarea::selection {
          background: color-mix(in srgb, var(--ctp-blue) 30%, transparent);
        }

        /* Подсветка синтаксиса */
        .sql-keyword {
          color: var(--ctp-blue);
          font-weight: 600;
        }

        .sql-type {
          color: var(--ctp-yellow);
        }

        .sql-function {
          color: var(--ctp-mauve);
        }

        .sql-string {
          color: var(--ctp-green);
        }

        .sql-number {
          color: var(--ctp-peach);
        }

        .sql-comment {
          color: var(--ctp-overlay2);
          font-style: italic;
        }

        .sql-operator {
          color: var(--ctp-red);
        }

        .editor-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 12px;
          background: var(--bg-secondary);
          border-top: 1px solid var(--border);
          font-size: 11px;
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .footer-left, .footer-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .save-indicator {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 10px;
        }

        .save-indicator.saving {
          color: var(--ctp-yellow);
        }

        .save-indicator.saved {
          color: var(--ctp-green);
        }

        .format-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border);
          border-radius: 4px;
          color: var(--text-secondary);
          font-size: 11px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .format-btn:hover {
          background: var(--ctp-blue);
          color: white;
          border-color: var(--ctp-blue);
        }

        .hint {
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
};
