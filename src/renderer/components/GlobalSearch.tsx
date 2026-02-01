import React, { useState, useEffect, useCallback, useRef } from 'react';

interface SearchResult {
  table: string;
  column: string;
  value: any;
  rowIndex: number;
  matchType: 'exact' | 'partial' | 'regex';
}

interface TableData {
  name: string;
  columns: string[];
  rows: Record<string, any>[];
}

interface GlobalSearchProps {
  tables: TableData[];
  onClose: () => void;
  onNavigateToResult: (table: string, rowIndex: number) => void;
  dbAPI: any;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({
  tables,
  onClose,
  onNavigateToResult,
  dbAPI
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<'text' | 'regex'>('text');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStats, setSearchStats] = useState({ tablesSearched: 0, rowsSearched: 0, matchesFound: 0 });
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    inputRef.current?.focus();
    setSelectedTables(tables.map(t => t.name));
  }, [tables]);
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchTerm.length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch();
      }, 300);
    } else {
      setResults([]);
      setSearchStats({ tablesSearched: 0, rowsSearched: 0, matchesFound: 0 });
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, searchType, caseSensitive, selectedTables]);

  const performSearch = useCallback(async () => {
    if (searchTerm.length < 2 || selectedTables.length === 0) return;

    setIsSearching(true);
    const allResults: SearchResult[] = [];
    let tablesSearched = 0;
    let rowsSearched = 0;

    try {
      for (const tableName of selectedTables) {
        const tableData = tables.find(t => t.name === tableName);
        if (!tableData) continue;

        tablesSearched++;
        const queryResult = await dbAPI.query(`SELECT * FROM \`${tableName}\``);
        if (!queryResult.success || !queryResult.rows) continue;

        const rows = queryResult.rows;
        const columns = queryResult.columns || Object.keys(rows[0] || {});

        rows.forEach((row: Record<string, any>, rowIndex: number) => {
          rowsSearched++;
          
          columns.forEach((column: string) => {
            const value = row[column];
            if (value === null || value === undefined) return;

            const stringValue = String(value);
            let isMatch = false;
            let matchType: SearchResult['matchType'] = 'partial';

            if (searchType === 'regex') {
              try {
                const regex = new RegExp(searchTerm, caseSensitive ? '' : 'i');
                isMatch = regex.test(stringValue);
                matchType = 'regex';
              } catch {
              }
            } else {
              const searchLower = caseSensitive ? searchTerm : searchTerm.toLowerCase();
              const valueLower = caseSensitive ? stringValue : stringValue.toLowerCase();
              
              if (valueLower === searchLower) {
                isMatch = true;
                matchType = 'exact';
              } else if (valueLower.includes(searchLower)) {
                isMatch = true;
                matchType = 'partial';
              }
            }

            if (isMatch) {
              allResults.push({
                table: tableName,
                column,
                value,
                rowIndex,
                matchType
              });
            }
          });
        });
      }

      setResults(allResults.slice(0, 500));
      setSearchStats({
        tablesSearched,
        rowsSearched,
        matchesFound: allResults.length
      });
      const tablesWithResults = new Set(allResults.map(r => r.table));
      setExpandedTables(tablesWithResults);

    } catch (error) {
      console.error('Search error:', error);
    }

    setIsSearching(false);
  }, [searchTerm, searchType, caseSensitive, selectedTables, tables, dbAPI]);

  const toggleTable = (tableName: string) => {
    setSelectedTables(prev => 
      prev.includes(tableName)
        ? prev.filter(t => t !== tableName)
        : [...prev, tableName]
    );
  };

  const toggleExpandTable = (tableName: string) => {
    setExpandedTables(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tableName)) {
        newSet.delete(tableName);
      } else {
        newSet.add(tableName);
      }
      return newSet;
    });
  };

  const highlightMatch = (text: string, search: string) => {
    if (!search || searchType === 'regex') return text;
    
    const index = caseSensitive 
      ? text.indexOf(search)
      : text.toLowerCase().indexOf(search.toLowerCase());
    
    if (index === -1) return text;
    
    return (
      <>
        {text.substring(0, index)}
        <mark>{text.substring(index, index + search.length)}</mark>
        {text.substring(index + search.length)}
      </>
    );
  };

  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.table]) {
      acc[result.table] = [];
    }
    acc[result.table].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
    if (e.key === 'Enter' && results.length > 0) {
      onNavigateToResult(results[0].table, results[0].rowIndex);
    }
  };

  return (
    <div className="global-search-overlay" onClick={onClose}>
      <div className="global-search-modal" onClick={e => e.stopPropagation()}>
        <div className="search-header">
          <div className="header-title">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <h2>Глобальный поиск</h2>
          </div>
          <button className="close-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="search-input-container">
          <div className="search-input-wrapper">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Введите текст для поиска..."
              className="search-input"
            />
            {isSearching && <span className="search-spinner"></span>}
          </div>

          <div className="search-options">
            <label className="option-toggle">
              <input
                type="checkbox"
                checked={searchType === 'regex'}
                onChange={e => setSearchType(e.target.checked ? 'regex' : 'text')}
              />
              <span>Regex</span>
            </label>
            <label className="option-toggle">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={e => setCaseSensitive(e.target.checked)}
              />
              <span>Учитывать регистр</span>
            </label>
          </div>
        </div>

        <div className="search-body">
          <div className="tables-filter">
            <div className="filter-header">
              <span>Таблицы для поиска</span>
              <button 
                className="select-all-btn"
                onClick={() => {
                  if (selectedTables.length === tables.length) {
                    setSelectedTables([]);
                  } else {
                    setSelectedTables(tables.map(t => t.name));
                  }
                }}
              >
                {selectedTables.length === tables.length ? 'Снять все' : 'Выбрать все'}
              </button>
            </div>
            <div className="tables-list">
              {tables.map(table => (
                <label key={table.name} className="table-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedTables.includes(table.name)}
                    onChange={() => toggleTable(table.name)}
                  />
                  <span className="table-name">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <line x1="3" y1="9" x2="21" y2="9"/>
                      <line x1="9" y1="21" x2="9" y2="9"/>
                    </svg>
                    {table.name}
                  </span>
                  <span className="table-count">{table.rows?.length || 0} строк</span>
                </label>
              ))}
            </div>
          </div>

          <div className="search-results">
            <div className="results-header">
              <span className="results-count">
                {searchStats.matchesFound > 0 
                  ? `Найдено: ${searchStats.matchesFound} совпадений`
                  : searchTerm.length >= 2 && !isSearching 
                    ? 'Ничего не найдено'
                    : 'Введите минимум 2 символа'
                }
              </span>
              {searchStats.matchesFound > 500 && (
                <span className="results-warning">Показаны первые 500</span>
              )}
            </div>

            <div className="results-list">
              {Object.entries(groupedResults).map(([tableName, tableResults]) => (
                <div key={tableName} className="result-group">
                  <div 
                    className="group-header"
                    onClick={() => toggleExpandTable(tableName)}
                  >
                    <svg 
                      viewBox="0 0 24 24" 
                      width="16" 
                      height="16" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2"
                      style={{ transform: expandedTables.has(tableName) ? 'rotate(90deg)' : 'none' }}
                    >
                      <polyline points="9,18 15,12 9,6"/>
                    </svg>
                    <span className="group-table">{tableName}</span>
                    <span className="group-count">{tableResults.length} совпадений</span>
                  </div>

                  {expandedTables.has(tableName) && (
                    <div className="group-results">
                      {tableResults.slice(0, 50).map((result, index) => (
                        <div 
                          key={`${result.rowIndex}-${result.column}-${index}`}
                          className="result-item"
                          onClick={() => onNavigateToResult(result.table, result.rowIndex)}
                        >
                          <span className="result-column">{result.column}</span>
                          <span className="result-value">
                            {highlightMatch(String(result.value).substring(0, 100), searchTerm)}
                            {String(result.value).length > 100 && '...'}
                          </span>
                          <span className={`match-badge ${result.matchType}`}>
                            {result.matchType === 'exact' ? 'точное' : 
                             result.matchType === 'regex' ? 'regex' : 'частичное'}
                          </span>
                        </div>
                      ))}
                      {tableResults.length > 50 && (
                        <div className="more-results">
                          И ещё {tableResults.length - 50} результатов...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="search-footer">
          <div className="search-stats">
            <span>Просмотрено: {searchStats.tablesSearched} таблиц, {searchStats.rowsSearched} строк</span>
          </div>
          <div className="footer-hint">
            <kbd>Enter</kbd> перейти к первому результату
            <kbd>Esc</kbd> закрыть
          </div>
        </div>

        <style>{`
          .global-search-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: flex-start;
            justify-content: center;
            z-index: 1000;
            padding: 60px 20px 20px;
          }

          .global-search-modal {
            width: 100%;
            max-width: 900px;
            max-height: calc(100vh - 100px);
            background: var(--bg-primary);
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          }

          .search-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            border-bottom: 1px solid var(--border);
          }

          .header-title {
            display: flex;
            align-items: center;
            gap: 12px;
            color: var(--text-primary);
          }

          .header-title svg {
            color: var(--accent);
          }

          .header-title h2 {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
          }

          .close-btn {
            background: none;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
            padding: 8px;
            border-radius: 6px;
            transition: all 0.2s;
          }

          .close-btn:hover {
            background: var(--bg-tertiary);
            color: var(--text-primary);
          }

          .search-input-container {
            padding: 16px 20px;
            border-bottom: 1px solid var(--border);
          }

          .search-input-wrapper {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            background: var(--bg-tertiary);
            border-radius: 8px;
            border: 2px solid transparent;
            transition: border-color 0.2s;
          }

          .search-input-wrapper:focus-within {
            border-color: var(--accent);
          }

          .search-input-wrapper svg {
            color: var(--text-muted);
            flex-shrink: 0;
          }

          .search-input {
            flex: 1;
            background: none;
            border: none;
            color: var(--text-primary);
            font-size: 15px;
            outline: none;
          }

          .search-input::placeholder {
            color: var(--text-muted);
          }

          .search-spinner {
            width: 18px;
            height: 18px;
            border: 2px solid var(--ctp-surface1);
            border-top-color: var(--accent);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }

          .search-options {
            display: flex;
            gap: 16px;
            margin-top: 12px;
          }

          .option-toggle {
            display: flex;
            align-items: center;
            gap: 6px;
            color: var(--text-secondary);
            font-size: 13px;
            cursor: pointer;
          }

          .option-toggle input {
            accent-color: var(--accent);
          }

          .search-body {
            display: flex;
            flex: 1;
            overflow: hidden;
            min-height: 300px;
          }

          .tables-filter {
            width: 220px;
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
          }

          .filter-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            border-bottom: 1px solid var(--border);
            font-size: 12px;
            color: var(--text-muted);
          }

          .select-all-btn {
            background: none;
            border: none;
            color: var(--accent);
            font-size: 11px;
            cursor: pointer;
          }

          .select-all-btn:hover {
            text-decoration: underline;
          }

          .tables-list {
            flex: 1;
            overflow-y: auto;
            padding: 8px;
          }

          .table-checkbox {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px;
            border-radius: 6px;
            cursor: pointer;
            transition: background 0.2s;
          }

          .table-checkbox:hover {
            background: var(--bg-tertiary);
          }

          .table-checkbox input {
            accent-color: var(--accent);
          }

          .table-name {
            display: flex;
            align-items: center;
            gap: 6px;
            flex: 1;
            color: var(--text-primary);
            font-size: 13px;
          }

          .table-name svg {
            color: var(--accent);
          }

          .table-count {
            color: var(--text-muted);
            font-size: 11px;
          }

          .search-results {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }

          .results-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            border-bottom: 1px solid var(--border);
          }

          .results-count {
            font-size: 13px;
            color: var(--text-secondary);
          }

          .results-warning {
            font-size: 11px;
            color: var(--ctp-yellow);
          }

          .results-list {
            flex: 1;
            overflow-y: auto;
            padding: 8px;
          }

          .result-group {
            margin-bottom: 8px;
          }

          .group-header {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 12px;
            background: var(--bg-tertiary);
            border-radius: 6px;
            cursor: pointer;
            transition: background 0.2s;
          }

          .group-header:hover {
            background: var(--ctp-surface1);
          }

          .group-header svg {
            color: var(--text-muted);
            transition: transform 0.2s;
          }

          .group-table {
            color: var(--accent);
            font-weight: 500;
            font-size: 13px;
          }

          .group-count {
            margin-left: auto;
            color: var(--text-muted);
            font-size: 11px;
          }

          .group-results {
            margin-top: 4px;
            margin-left: 24px;
          }

          .result-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 8px 12px;
            border-radius: 6px;
            cursor: pointer;
            transition: background 0.2s;
          }

          .result-item:hover {
            background: var(--bg-tertiary);
          }

          .result-column {
            min-width: 100px;
            color: var(--ctp-green);
            font-size: 12px;
            font-family: 'JetBrains Mono', monospace;
          }

          .result-value {
            flex: 1;
            color: var(--text-primary);
            font-size: 13px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .result-value mark {
            background: color-mix(in srgb, var(--ctp-yellow) 30%, transparent);
            color: var(--ctp-yellow);
            padding: 1px 2px;
            border-radius: 2px;
          }

          .match-badge {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 4px;
          }

          .match-badge.exact {
            background: color-mix(in srgb, var(--ctp-green) 20%, transparent);
            color: var(--ctp-green);
          }

          .match-badge.partial {
            background: color-mix(in srgb, var(--ctp-blue) 20%, transparent);
            color: var(--ctp-blue);
          }

          .match-badge.regex {
            background: color-mix(in srgb, var(--ctp-mauve) 20%, transparent);
            color: var(--ctp-mauve);
          }

          .more-results {
            padding: 8px 12px;
            color: var(--text-muted);
            font-size: 12px;
            font-style: italic;
          }

          .search-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 20px;
            border-top: 1px solid var(--border);
            background: var(--bg-secondary);
          }

          .search-stats {
            font-size: 11px;
            color: var(--text-muted);
          }

          .footer-hint {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 11px;
            color: var(--text-muted);
          }

          .footer-hint kbd {
            padding: 2px 6px;
            background: var(--bg-tertiary);
            border: 1px solid var(--ctp-surface1);
            border-radius: 4px;
            font-family: inherit;
            font-size: 10px;
          }
        `}</style>
      </div>
    </div>
  );
};
