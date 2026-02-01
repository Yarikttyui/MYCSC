import React, { useState, useEffect, useRef, useCallback } from 'react';
const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN',
  'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET', 'JOIN', 'LEFT JOIN',
  'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN', 'ON', 'AS', 'DISTINCT', 'ALL',
  'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'CREATE TABLE',
  'ALTER TABLE', 'DROP TABLE', 'CREATE DATABASE', 'DROP DATABASE', 'USE',
  'INDEX', 'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'AUTO_INCREMENT',
  'NOT NULL', 'DEFAULT', 'UNIQUE', 'CHECK', 'CONSTRAINT', 'CASCADE',
  'TRUNCATE', 'SHOW TABLES', 'SHOW DATABASES', 'DESCRIBE', 'EXPLAIN',
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'IFNULL', 'NULLIF',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'CAST', 'CONVERT', 'CONCAT',
  'SUBSTRING', 'UPPER', 'LOWER', 'TRIM', 'LENGTH', 'REPLACE', 'NOW',
  'CURDATE', 'CURTIME', 'DATE', 'TIME', 'YEAR', 'MONTH', 'DAY',
  'ASC', 'DESC', 'NULL', 'TRUE', 'FALSE', 'IS NULL', 'IS NOT NULL',
  'EXISTS', 'UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT'
];
const SQL_TYPES = [
  'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'FLOAT', 'DOUBLE',
  'DECIMAL', 'NUMERIC', 'VARCHAR', 'CHAR', 'TEXT', 'LONGTEXT', 'MEDIUMTEXT',
  'BOOLEAN', 'BOOL', 'DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'YEAR',
  'BLOB', 'LONGBLOB', 'MEDIUMBLOB', 'JSON', 'ENUM', 'SET'
];

interface TableInfo {
  name: string;
  columns: { name: string; type: string }[];
}

interface Suggestion {
  text: string;
  type: 'keyword' | 'table' | 'column' | 'function' | 'type';
  detail?: string;
}

interface SQLAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  tables: TableInfo[];
  placeholder?: string;
  fontSize?: number;
  fontFamily?: string;
  showLineNumbers?: boolean;
}

export const SQLAutocomplete: React.FC<SQLAutocompleteProps> = ({
  value,
  onChange,
  onExecute,
  tables,
  placeholder = 'Введите SQL запрос...',
  fontSize = 14,
  fontFamily = 'JetBrains Mono',
  showLineNumbers = true
}) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [suggestionPosition, setSuggestionPosition] = useState({ top: 0, left: 0 });
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const getCurrentWord = useCallback(() => {
    if (!textareaRef.current) return { word: '', start: 0, end: 0 };
    
    const pos = textareaRef.current.selectionStart;
    const text = value.substring(0, pos);
    const match = text.match(/[\w.`]+$/);
    if (!match) return { word: '', start: pos, end: pos };
    
    return {
      word: match[0],
      start: pos - match[0].length,
      end: pos
    };
  }, [value]);
  const getContext = useCallback(() => {
    if (!textareaRef.current) return '';
    
    const pos = textareaRef.current.selectionStart;
    const textBefore = value.substring(0, pos).toUpperCase();
    if (/FROM\s+[\w,\s]*$/i.test(textBefore)) return 'table';
    if (/JOIN\s+$/i.test(textBefore)) return 'table';
    if (/INTO\s+$/i.test(textBefore)) return 'table';
    if (/UPDATE\s+$/i.test(textBefore)) return 'table';
    if (/TABLE\s+$/i.test(textBefore)) return 'table';
    if (/SELECT\s+[\w\s,.*]*$/i.test(textBefore) && !/FROM/i.test(textBefore)) return 'column';
    if (/WHERE\s+[\w\s,.*=<>!'AND''OR']*$/i.test(textBefore)) return 'column';
    if (/SET\s+[\w\s,=]*$/i.test(textBefore)) return 'column';
    if (/ORDER BY\s+[\w\s,]*$/i.test(textBefore)) return 'column';
    if (/GROUP BY\s+[\w\s,]*$/i.test(textBefore)) return 'column';
    if (/\(\s*$/i.test(textBefore)) return 'type';
    
    return 'keyword';
  }, [value]);
  const generateSuggestions = useCallback(() => {
    const { word } = getCurrentWord();
    const context = getContext();
    const searchTerm = word.toUpperCase().replace(/`/g, '');
    
    if (word.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    let results: Suggestion[] = [];
    if (context === 'keyword' || context === 'column') {
      const keywords = SQL_KEYWORDS
        .filter(k => k.toUpperCase().startsWith(searchTerm))
        .slice(0, 10)
        .map(k => ({ text: k, type: 'keyword' as const, detail: 'ключевое слово' }));
      results = [...results, ...keywords];
    }
    if (context === 'table' || context === 'keyword') {
      const tableNames = tables
        .filter(t => t.name.toUpperCase().startsWith(searchTerm))
        .slice(0, 10)
        .map(t => ({ 
          text: t.name, 
          type: 'table' as const, 
          detail: `таблица (${t.columns.length} колонок)` 
        }));
      results = [...results, ...tableNames];
    }
    if (context === 'column' || context === 'keyword') {
      const fromMatch = value.toUpperCase().match(/FROM\s+`?(\w+)`?/i);
      const targetTable = fromMatch ? tables.find(t => t.name.toUpperCase() === fromMatch[1].toUpperCase()) : null;

      if (targetTable) {
        const columns = targetTable.columns
          .filter(c => c.name.toUpperCase().startsWith(searchTerm))
          .slice(0, 10)
          .map(c => ({ 
            text: c.name, 
            type: 'column' as const, 
            detail: `${c.type} (${targetTable.name})` 
          }));
        results = [...results, ...columns];
      } else {
        tables.forEach(t => {
          const columns = t.columns
            .filter(c => c.name.toUpperCase().startsWith(searchTerm))
            .slice(0, 5)
            .map(c => ({ 
              text: c.name, 
              type: 'column' as const, 
              detail: `${c.type} (${t.name})` 
            }));
          results = [...results, ...columns];
        });
      }
    }
    if (context === 'type') {
      const types = SQL_TYPES
        .filter(t => t.toUpperCase().startsWith(searchTerm))
        .slice(0, 10)
        .map(t => ({ text: t, type: 'type' as const, detail: 'тип данных' }));
      results = [...results, ...types];
    }
    const unique = results.filter((item, index, self) => 
      index === self.findIndex(t => t.text.toUpperCase() === item.text.toUpperCase())
    ).slice(0, 15);

    setSuggestions(unique);
    setShowSuggestions(unique.length > 0);
    setSelectedIndex(0);
  }, [getCurrentWord, getContext, tables, value]);
  const updateCursorPosition = useCallback(() => {
    if (!textareaRef.current) return;
    
    const pos = textareaRef.current.selectionStart;
    const textBefore = value.substring(0, pos);
    const lines = textBefore.split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;
    
    setCursorPosition({ line, column });
    if (mirrorRef.current && textareaRef.current) {
      const mirror = mirrorRef.current;
      mirror.textContent = textBefore;
      
      const rect = textareaRef.current.getBoundingClientRect();
      const lineHeight = fontSize * 1.5;
      const charWidth = fontSize * 0.6;
      
      const top = (line - 1) * lineHeight + lineHeight + 4;
      const left = Math.min((column - 1) * charWidth, rect.width - 300);
      
      setSuggestionPosition({ top, left: Math.max(0, left) });
    }
  }, [value, fontSize]);
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };
  const handleSelect = () => {
    updateCursorPosition();
    generateSuggestions();
  };
  const applySuggestion = useCallback((suggestion: Suggestion) => {
    const { word, start, end } = getCurrentWord();
    const newValue = value.substring(0, start) + suggestion.text + value.substring(end);
    onChange(newValue);
    setShowSuggestions(false);
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = start + suggestion.text.length;
        textareaRef.current.selectionStart = newPos;
        textareaRef.current.selectionEnd = newPos;
        textareaRef.current.focus();
      }
    }, 0);
  }, [getCurrentWord, value, onChange]);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Tab':
        case 'Enter':
          if (suggestions[selectedIndex]) {
            e.preventDefault();
            applySuggestion(suggestions[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setShowSuggestions(false);
          break;
      }
    } else {
      if ((e.ctrlKey && e.key === 'Enter') || e.key === 'F5') {
        e.preventDefault();
        onExecute();
      }
      if (e.ctrlKey && e.key === ' ') {
        e.preventDefault();
        generateSuggestions();
      }
    }
    if (e.key === 'Tab' && !showSuggestions) {
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
  useEffect(() => {
    if (suggestionsRef.current && showSuggestions) {
      const selected = suggestionsRef.current.children[selectedIndex] as HTMLElement;
      if (selected) {
        selected.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, showSuggestions]);
  const highlightSQL = (code: string) => {
    let highlighted = code
      .replace(/('.*?')/g, '<span class="sql-string">$1</span>')
      .replace(/\b(\d+)\b/g, '<span class="sql-number">$1</span>')
      .replace(/(--.*$)/gm, '<span class="sql-comment">$1</span>')
      .replace(
        /\b(SELECT|FROM|WHERE|AND|OR|NOT|IN|LIKE|BETWEEN|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AS|DISTINCT|ALL|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|ALTER|DROP|TABLE|DATABASE|USE|INDEX|PRIMARY|KEY|FOREIGN|REFERENCES|AUTO_INCREMENT|NULL|DEFAULT|UNIQUE|CHECK|CONSTRAINT|CASCADE|TRUNCATE|SHOW|TABLES|DATABASES|DESCRIBE|EXPLAIN|COUNT|SUM|AVG|MIN|MAX|COALESCE|IFNULL|CASE|WHEN|THEN|ELSE|END|CAST|ASC|DESC|TRUE|FALSE|EXISTS|UNION|INTERSECT|EXCEPT|IF)\b/gi,
        '<span class="sql-keyword">$1</span>'
      )
      .replace(
        /\b(CONCAT|SUBSTRING|UPPER|LOWER|TRIM|LENGTH|REPLACE|NOW|CURDATE|CURTIME|DATE|TIME|YEAR|MONTH|DAY)\b/gi,
        '<span class="sql-function">$1</span>'
      );
    
    return highlighted;
  };
  const lineNumbers = value.split('\n').map((_, i) => i + 1);
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (highlightRef.current) {
      highlightRef.current.scrollTop = e.currentTarget.scrollTop;
      highlightRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const getTypeIcon = (type: Suggestion['type']) => {
    switch (type) {
      case 'keyword': return '🔑';
      case 'table': return '📋';
      case 'column': return '📊';
      case 'function': return 'ƒ';
      case 'type': return '📦';
      default: return '•';
    }
  };

  return (
    <div className="sql-editor-container">
      <div className="sql-editor-main">
        {showLineNumbers && (
          <div className="line-numbers" style={{ fontSize, fontFamily }}>
            {lineNumbers.map(num => (
              <div key={num} className="line-number">{num}</div>
            ))}
          </div>
        )}
        
        <div className="editor-wrapper">
        <div 
          ref={highlightRef}
          className="syntax-highlight"
          style={{ fontSize, fontFamily }}
          dangerouslySetInnerHTML={{ __html: highlightSQL(value) || `<span class="placeholder">${placeholder}</span>` }}
        />
        <textarea
          ref={textareaRef}
          className="sql-textarea"
          value={value}
          onChange={handleChange}
          onSelect={handleSelect}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder=""
          spellCheck={false}
          style={{ fontSize, fontFamily }}
        />
        <div ref={mirrorRef} className="cursor-mirror" style={{ fontSize, fontFamily }} />
        
        {showSuggestions && suggestions.length > 0 && (
          <div 
            ref={suggestionsRef}
            className="suggestions-popup"
            style={{ top: suggestionPosition.top, left: suggestionPosition.left }}
          >
            {suggestions.map((suggestion, index) => (
              <div
                key={`${suggestion.text}-${index}`}
                className={`suggestion-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => applySuggestion(suggestion)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span className={`suggestion-icon ${suggestion.type}`}>
                  {getTypeIcon(suggestion.type)}
                </span>
                <span className="suggestion-text">{suggestion.text}</span>
                {suggestion.detail && (
                  <span className="suggestion-detail">{suggestion.detail}</span>
                )}
              </div>
            ))}
          </div>
        )}
        </div>
      </div>

      <div className="editor-status">
        <span>Строка {cursorPosition.line}, Столбец {cursorPosition.column}</span>
        <span className="hint">Ctrl+Space - подсказки • Ctrl+Enter - выполнить</span>
      </div>

      <style>{`
        .sql-editor-container {
          display: flex;
          flex-direction: column;
          flex: 1;
          background: var(--ctp-crust);
          border-radius: 8px;
          overflow: hidden;
          position: relative;
          min-height: 200px;
        }

        .sql-editor-main {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .line-numbers {
          padding: 12px 8px;
          background: var(--bg-secondary);
          color: var(--text-muted);
          text-align: right;
          user-select: none;
          border-right: 1px solid var(--border);
          min-width: 40px;
        }

        .line-number {
          line-height: 1.5;
        }

        .editor-wrapper {
          flex: 1;
          position: relative;
          overflow: hidden;
          min-height: 150px;
        }

        .syntax-highlight {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          padding: 12px;
          color: var(--text-primary);
          white-space: pre-wrap;
          word-wrap: break-word;
          line-height: 1.5;
          pointer-events: none;
          overflow: hidden;
          z-index: 1;
        }

        .sql-textarea {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          padding: 12px;
          background: transparent;
          border: none;
          color: transparent;
          caret-color: var(--accent);
          resize: none;
          outline: none;
          line-height: 1.5;
          overflow: auto;
          z-index: 2;
          white-space: pre-wrap;
          word-wrap: break-word;
        }

        .sql-textarea::placeholder {
          color: var(--text-muted);
        }

        .cursor-mirror {
          position: absolute;
          visibility: hidden;
          white-space: pre-wrap;
          word-wrap: break-word;
          padding: 12px;
          line-height: 1.5;
        }

        .suggestions-popup {
          position: absolute;
          background: var(--border);
          border: 1px solid var(--ctp-surface1);
          border-radius: 8px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          max-height: 250px;
          overflow-y: auto;
          z-index: 100;
          min-width: 280px;
        }

        .suggestion-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          cursor: pointer;
          transition: background 0.1s;
        }

        .suggestion-item:hover,
        .suggestion-item.selected {
          background: var(--ctp-surface1);
        }

        .suggestion-icon {
          width: 20px;
          text-align: center;
          font-size: 12px;
        }

        .suggestion-icon.keyword { color: var(--ctp-mauve); }
        .suggestion-icon.table { color: var(--ctp-blue); }
        .suggestion-icon.column { color: var(--ctp-green); }
        .suggestion-icon.function { color: var(--ctp-peach); }
        .suggestion-icon.type { color: var(--ctp-yellow); }

        .suggestion-text {
          color: var(--text-primary);
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
        }

        .suggestion-detail {
          margin-left: auto;
          color: var(--text-muted);
          font-size: 11px;
        }

        .editor-status {
          display: flex;
          justify-content: space-between;
          padding: 6px 12px;
          background: var(--bg-secondary);
          border-top: 1px solid var(--border);
          font-size: 11px;
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .hint {
          opacity: 0.7;
        }

        /* Syntax highlighting colors */
        .sql-keyword { color: var(--ctp-mauve); font-weight: 500; }
        .sql-function { color: var(--ctp-teal); }
        .sql-string { color: var(--ctp-green); }
        .sql-number { color: var(--ctp-peach); }
        .sql-comment { color: var(--text-muted); font-style: italic; }
        .placeholder { color: var(--text-muted); }
      `}</style>
    </div>
  );
};
