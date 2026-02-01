import React, { useState, useRef, useEffect } from 'react';
import { DataChart } from './DataChart';
import { copyResultsAs, copyToClipboard, CopyFormat } from '../utils/copyResults';

interface QueryResult {
  success: boolean;
  rows?: Record<string, any>[];
  columns?: string[];
  rowsAffected?: number;
  affectedRows?: number;
  lastInsertId?: number;
  insertId?: number;
  message?: string;
  error?: string;
  executionTime?: number;
  query?: string;
  command?: string;
}

interface ResultsPanelProps {
  results: QueryResult[];
  isLoading: boolean;
  onCopySuccess?: () => void;
}

export default function ResultsPanel({ results, isLoading, onCopySuccess }: ResultsPanelProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const copyMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (copyMenuRef.current && !copyMenuRef.current.contains(e.target as Node)) {
        setShowCopyMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopy = async (format: CopyFormat) => {
    const result = results[activeTab];
    if (result?.rows && result?.columns) {
      const text = copyResultsAs(result.rows, result.columns, format);
      const success = await copyToClipboard(text);
      if (success && onCopySuccess) {
        onCopySuccess();
      }
    }
    setShowCopyMenu(false);
  };

  if (isLoading) {
    return (
      <div className="results-panel">
        <div className="results-loading">
          <div className="spinner large"></div>
          <span>Выполнение запроса...</span>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="results-panel">
        <div className="results-empty">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect x="4" y="8" width="40" height="32" rx="2" stroke="currentColor" strokeWidth="2"/>
            <line x1="4" y1="16" x2="44" y2="16" stroke="currentColor" strokeWidth="2"/>
            <line x1="16" y1="16" x2="16" y2="40" stroke="currentColor" strokeWidth="2"/>
          </svg>
          <p>Результаты запроса появятся здесь</p>
          <small>Нажмите Ctrl+Enter для выполнения</small>
        </div>
      </div>
    );
  }

  const currentResult = results[activeTab];
  const hasData = currentResult?.rows && currentResult.rows.length > 0;

  return (
    <div className="results-panel">
      {/* Toolbar */}
      {hasData && (
        <div className="results-toolbar">
          <div className="view-toggle">
            <button 
              className={viewMode === 'table' ? 'active' : ''}
              onClick={() => setViewMode('table')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginRight: 4 }}>
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
                <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="2"/>
                <line x1="9" y1="9" x2="9" y2="21" stroke="currentColor" strokeWidth="2"/>
              </svg>
              Таблица
            </button>
            <button 
              className={viewMode === 'chart' ? 'active' : ''}
              onClick={() => setViewMode('chart')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginRight: 4 }}>
                <rect x="3" y="12" width="4" height="9" fill="currentColor"/>
                <rect x="10" y="6" width="4" height="15" fill="currentColor"/>
                <rect x="17" y="3" width="4" height="18" fill="currentColor"/>
              </svg>
              График
            </button>
          </div>
          
          <div className="spacer" />

          {/* Copy Menu */}
          <div className="copy-menu" ref={copyMenuRef}>
            <button 
              className="btn"
              onClick={() => setShowCopyMenu(!showCopyMenu)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="2"/>
              </svg>
              Копировать
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </button>
            
            {showCopyMenu && (
              <div className="copy-dropdown">
                <button className="copy-dropdown-item" onClick={() => handleCopy('json')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M8 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2h-2" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  JSON
                </button>
                <button className="copy-dropdown-item" onClick={() => handleCopy('csv')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  CSV
                </button>
                <button className="copy-dropdown-item" onClick={() => handleCopy('sql')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <ellipse cx="12" cy="6" rx="8" ry="3" stroke="currentColor" strokeWidth="2"/>
                    <path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6" stroke="currentColor" strokeWidth="2"/>
                    <path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  SQL INSERT
                </button>
                <button className="copy-dropdown-item" onClick={() => handleCopy('markdown')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M4 5h16M4 12h16M4 19h10" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  Markdown
                </button>
                <button className="copy-dropdown-item" onClick={() => handleCopy('tsv')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
                    <line x1="9" y1="3" x2="9" y2="21" stroke="currentColor" strokeWidth="2"/>
                    <line x1="15" y1="3" x2="15" y2="21" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  TSV
                </button>
                <button className="copy-dropdown-item" onClick={() => handleCopy('html')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  HTML
                </button>
                <button className="copy-dropdown-item" onClick={() => handleCopy('excel')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
                    <path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  Excel XML
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {results.length > 1 && (
        <div className="results-tabs">
          {results.map((r, index) => (
            <button
              key={index}
              className={`tab ${activeTab === index ? 'active' : ''} ${r.success ? 'success' : 'error'}`}
              onClick={() => setActiveTab(index)}
            >
              <span className="tab-icon">{r.success ? '✓' : '✗'}</span>
              Результат {index + 1}
              {r.rows && r.rows.length > 0 && <span className="tab-count">{r.rows.length}</span>}
            </button>
          ))}
        </div>
      )}

      {viewMode === 'chart' && hasData ? (
        <div style={{ padding: 16 }}>
          <DataChart 
            data={{ rows: currentResult.rows!, columns: currentResult.columns! }}
          />
        </div>
      ) : (
        <ResultView result={currentResult} index={activeTab} />
      )}
    </div>
  );
}

function ResultView({ result, index }: { result: QueryResult; index: number }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(100);
  
  if (!result.success) {
    return (
      <div className="result-error">
        <div className="error-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            <line x1="8" y1="8" x2="16" y2="16" stroke="currentColor" strokeWidth="2"/>
            <line x1="16" y1="8" x2="8" y2="16" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </div>
        <div className="error-content">
          <h4>Ошибка выполнения</h4>
          <pre>{result.error}</pre>
        </div>
      </div>
    );
  }
  if (result.rows && result.rows.length > 0) {
    const totalRows = result.rows.length;
    const totalPages = Math.ceil(totalRows / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, totalRows);
    const paginatedRows = result.rows.slice(startIndex, endIndex);
    const needsPagination = totalRows > 50;
    
    return (
      <div className="result-data">
        <div className="result-info">
          <span className="success-badge">✓ Успешно</span>
          <span>{totalRows} строк</span>
          <span>{result.executionTime}мс</span>
          {needsPagination && (
            <span className="pagination-info">
              Показано {startIndex + 1}-{endIndex} из {totalRows}
            </span>
          )}
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                {result.columns?.map((col: string, i: number) => (
                  <th key={i}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row: Record<string, any>, rowIndex: number) => (
                <tr key={startIndex + rowIndex}>
                  {result.columns?.map((col: string, colIndex: number) => (
                    <td key={colIndex}>
                      <CellValue value={row[col]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {needsPagination && (
          <div className="pagination-controls">
            <div className="pagination-left">
              <label>
                Строк на странице:
                <select 
                  value={rowsPerPage} 
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={250}>250</option>
                  <option value={500}>500</option>
                  <option value={1000}>1000</option>
                </select>
              </label>
            </div>
            <div className="pagination-center">
              <button 
                onClick={() => setCurrentPage(1)} 
                disabled={currentPage === 1}
                title="Первая страница"
              >
                ⟪
              </button>
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                disabled={currentPage === 1}
                title="Предыдущая"
              >
                ←
              </button>
              <span className="page-info">
                Страница {currentPage} из {totalPages}
              </span>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                disabled={currentPage === totalPages}
                title="Следующая"
              >
                →
              </button>
              <button 
                onClick={() => setCurrentPage(totalPages)} 
                disabled={currentPage === totalPages}
                title="Последняя страница"
              >
                ⟫
              </button>
            </div>
            <div className="pagination-right">
              <span>{totalRows.toLocaleString()} строк всего</span>
            </div>
          </div>
        )}
      </div>
    );
  }
  const queryText = result.query || result.message || '';
  const commandMatch = queryText.match(/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE)/i);
  const command = result.command || (commandMatch ? commandMatch[1].toUpperCase() : 'SQL');
  const getCommandStyle = () => {
    switch (command) {
      case 'INSERT':
        return { icon: '＋', color: 'var(--ctp-green)', label: 'Добавление данных' };
      case 'UPDATE':
        return { icon: '✎', color: 'var(--ctp-yellow)', label: 'Обновление данных' };
      case 'DELETE':
        return { icon: '✕', color: 'var(--ctp-red)', label: 'Удаление данных' };
      case 'CREATE':
        return { icon: '◉', color: 'var(--ctp-blue)', label: 'Создание объекта' };
      case 'DROP':
        return { icon: '◎', color: 'var(--ctp-red)', label: 'Удаление объекта' };
      case 'ALTER':
        return { icon: '⚙', color: 'var(--ctp-mauve)', label: 'Изменение структуры' };
      case 'TRUNCATE':
        return { icon: '⌫', color: 'var(--ctp-peach)', label: 'Очистка таблицы' };
      default:
        return { icon: '✓', color: 'var(--ctp-green)', label: 'Запрос выполнен' };
    }
  };
  
  const style = getCommandStyle();
  const affectedCount = result.affectedRows ?? result.rowsAffected ?? 0;
  return (
    <div className="result-success-detailed">
      <div className="success-header" style={{ borderLeftColor: style.color }}>
        <div className="success-icon-large" style={{ background: style.color }}>
          <span>{style.icon}</span>
        </div>
        <div className="success-info">
          <div className="success-title">{style.label}</div>
          <div className="success-command">{command}</div>
        </div>
        <div className="success-time">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          {result.executionTime}мс
        </div>
      </div>
      
      <div className="success-stats">
        <div className="stat-item">
          <div className="stat-value" style={{ color: style.color }}>{affectedCount}</div>
          <div className="stat-label">
            {command === 'INSERT' ? 'Добавлено строк' : 
             command === 'UPDATE' ? 'Обновлено строк' : 
             command === 'DELETE' ? 'Удалено строк' : 'Затронуто строк'}
          </div>
        </div>
        
        {result.insertId !== undefined && result.insertId > 0 && (
          <div className="stat-item">
            <div className="stat-value" style={{ color: 'var(--ctp-blue)' }}>{result.insertId}</div>
            <div className="stat-label">ID новой записи</div>
          </div>
        )}
        
        {result.lastInsertId !== undefined && result.lastInsertId > 0 && (
          <div className="stat-item">
            <div className="stat-value" style={{ color: 'var(--ctp-blue)' }}>{result.lastInsertId}</div>
            <div className="stat-label">ID новой записи</div>
          </div>
        )}
      </div>
      
      {queryText && (
        <div className="success-query">
          <div className="query-label">Выполненный запрос:</div>
          <pre className="query-text">{queryText.length > 200 ? queryText.substring(0, 200) + '...' : queryText}</pre>
        </div>
      )}
    </div>
  );
}

function CellValue({ value }: { value: any }) {
  if (value === null) {
    return <span className="null-value">NULL</span>;
  }

  if (typeof value === 'boolean') {
    return <span className={`bool-value ${value ? 'true' : 'false'}`}>
      {value ? 'TRUE' : 'FALSE'}
    </span>;
  }

  if (typeof value === 'object') {
    return <span className="json-value">{JSON.stringify(value)}</span>;
  }

  return <span>{String(value)}</span>;
}
