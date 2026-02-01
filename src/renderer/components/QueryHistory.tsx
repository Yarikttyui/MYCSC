import React, { useState, useMemo } from 'react';

export interface HistoryEntry {
  id: string;
  query: string;
  database: string;
  executedAt: string;
  executionTime: number;
  success: boolean;
  rowsAffected?: number;
  error?: string;
}

interface QueryHistoryProps {
  history: HistoryEntry[];
  onExecuteQuery: (query: string) => void;
  onClearHistory: () => void;
  onClose: () => void;
}

export const QueryHistory: React.FC<QueryHistoryProps> = ({
  history,
  onExecuteQuery,
  onClearHistory,
  onClose
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'error'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  const filteredHistory = useMemo(() => {
    let filtered = [...history];
    if (filterStatus === 'success') {
      filtered = filtered.filter(h => h.success);
    } else if (filterStatus === 'error') {
      filtered = filtered.filter(h => !h.success);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(h => 
        h.query.toLowerCase().includes(term) ||
        h.database.toLowerCase().includes(term)
      );
    }
    filtered.sort((a, b) => {
      const dateA = new Date(a.executedAt).getTime();
      const dateB = new Date(b.executedAt).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  }, [history, searchTerm, filterStatus, sortOrder]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return `Сегодня, ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Вчера, ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return date.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const truncateQuery = (query: string, maxLength: number = 200) => {
    const normalized = query.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) return normalized;
    return normalized.substring(0, maxLength) + '...';
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const stats = useMemo(() => {
    const total = history.length;
    const successful = history.filter(h => h.success).length;
    const failed = total - successful;
    const avgTime = total > 0 
      ? Math.round(history.reduce((sum, h) => sum + h.executionTime, 0) / total)
      : 0;
    return { total, successful, failed, avgTime };
  }, [history]);

  return (
    <div className="query-history-overlay" onClick={onClose}>
      <div className="query-history-modal" onClick={e => e.stopPropagation()}>
        <div className="history-header">
          <div className="header-title">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12,6 12,12 16,14"/>
            </svg>
            <h2>История запросов</h2>
          </div>
          <button className="close-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="history-stats">
          <div className="stat-item">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Всего</span>
          </div>
          <div className="stat-item success">
            <span className="stat-value">{stats.successful}</span>
            <span className="stat-label">Успешных</span>
          </div>
          <div className="stat-item error">
            <span className="stat-value">{stats.failed}</span>
            <span className="stat-label">С ошибками</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.avgTime}мс</span>
            <span className="stat-label">Среднее время</span>
          </div>
        </div>

        <div className="history-filters">
          <div className="search-box">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Поиск по запросам..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="filter-buttons">
            <button 
              className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
              onClick={() => setFilterStatus('all')}
            >
              Все
            </button>
            <button 
              className={`filter-btn ${filterStatus === 'success' ? 'active' : ''}`}
              onClick={() => setFilterStatus('success')}
            >
              Успешные
            </button>
            <button 
              className={`filter-btn ${filterStatus === 'error' ? 'active' : ''}`}
              onClick={() => setFilterStatus('error')}
            >
              С ошибками
            </button>
          </div>

          <select 
            className="sort-select"
            value={sortOrder}
            onChange={e => setSortOrder(e.target.value as 'newest' | 'oldest')}
          >
            <option value="newest">Сначала новые</option>
            <option value="oldest">Сначала старые</option>
          </select>

          {history.length > 0 && (
            <button className="clear-btn" onClick={onClearHistory}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3,6 5,6 21,6"/>
                <path d="M19,6 L19,20 C19,21 18,22 17,22 L7,22 C6,22 5,21 5,20 L5,6"/>
                <line x1="10" y1="11" x2="10" y2="17"/>
                <line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
              Очистить
            </button>
          )}
        </div>

        <div className="history-list">
          {filteredHistory.length === 0 ? (
            <div className="history-empty">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12,6 12,12 16,14"/>
              </svg>
              <p>{history.length === 0 ? 'История пуста' : 'Ничего не найдено'}</p>
            </div>
          ) : (
            filteredHistory.map(entry => (
              <div key={entry.id} className={`history-item ${entry.success ? 'success' : 'error'}`}>
                <div className="item-status">
                  {entry.success ? (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22,11.08 L22,12 C22,17.52 17.52,22 12,22 C6.48,22 2,17.52 2,12 C2,6.48 6.48,2 12,2"/>
                      <polyline points="22,4 12,14.01 9,11.01"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="15" y1="9" x2="9" y2="15"/>
                      <line x1="9" y1="9" x2="15" y2="15"/>
                    </svg>
                  )}
                </div>

                <div className="item-content">
                  <div className="item-query">
                    <code>{truncateQuery(entry.query)}</code>
                  </div>
                  <div className="item-meta">
                    <span className="meta-database">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                        <ellipse cx="12" cy="5" rx="9" ry="3"/>
                        <path d="M21,12c0,1.66-4,3-9,3s-9-1.34-9-3"/>
                        <path d="M3,5v14c0,1.66,4,3,9,3s9-1.34,9-3V5"/>
                      </svg>
                      {entry.database}
                    </span>
                    <span className="meta-time">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12,6 12,12 16,14"/>
                      </svg>
                      {entry.executionTime}мс
                    </span>
                    <span className="meta-date">{formatDate(entry.executedAt)}</span>
                    {entry.rowsAffected !== undefined && (
                      <span className="meta-rows">{entry.rowsAffected} строк</span>
                    )}
                  </div>
                  {entry.error && (
                    <div className="item-error">{entry.error}</div>
                  )}
                </div>

                <div className="item-actions">
                  <button 
                    className="action-btn" 
                    title="Выполнить"
                    onClick={() => onExecuteQuery(entry.query)}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <polygon points="5,3 19,12 5,21"/>
                    </svg>
                  </button>
                  <button 
                    className="action-btn" 
                    title="Копировать"
                    onClick={() => copyToClipboard(entry.query)}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2"/>
                      <path d="M5,15 L3,15 C2,15 1,14 1,13 L1,3 C1,2 2,1 3,1 L13,1 C14,1 15,2 15,3 L15,5"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <style>{`
          .query-history-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 20px;
          }

          .query-history-modal {
            width: 100%;
            max-width: 900px;
            max-height: 85vh;
            background: var(--bg-primary);
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          }

          .history-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 20px 24px;
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
            font-size: 18px;
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

          .history-stats {
            display: flex;
            gap: 16px;
            padding: 16px 24px;
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border);
          }

          .stat-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 8px 16px;
            background: var(--bg-tertiary);
            border-radius: 8px;
            min-width: 80px;
          }

          .stat-value {
            font-size: 20px;
            font-weight: 600;
            color: var(--text-primary);
          }

          .stat-label {
            font-size: 11px;
            color: var(--text-muted);
            margin-top: 2px;
          }

          .stat-item.success .stat-value {
            color: var(--ctp-green);
          }

          .stat-item.error .stat-value {
            color: var(--ctp-red);
          }

          .history-filters {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 16px 24px;
            border-bottom: 1px solid var(--border);
            flex-wrap: wrap;
          }

          .search-box {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: var(--bg-tertiary);
            border-radius: 6px;
            flex: 1;
            min-width: 200px;
          }

          .search-box svg {
            color: var(--text-muted);
            flex-shrink: 0;
          }

          .search-box input {
            flex: 1;
            background: none;
            border: none;
            color: var(--text-primary);
            font-size: 13px;
            outline: none;
          }

          .search-box input::placeholder {
            color: var(--text-muted);
          }

          .filter-buttons {
            display: flex;
            gap: 4px;
          }

          .filter-btn {
            padding: 8px 12px;
            background: var(--bg-tertiary);
            border: none;
            border-radius: 6px;
            color: var(--text-secondary);
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
          }

          .filter-btn:hover {
            background: var(--ctp-surface1);
          }

          .filter-btn.active {
            background: var(--accent);
            color: var(--bg-primary);
          }

          .sort-select {
            padding: 8px 12px;
            background: var(--bg-tertiary);
            border: none;
            border-radius: 6px;
            color: var(--text-primary);
            font-size: 12px;
            cursor: pointer;
          }

          .clear-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 12px;
            background: transparent;
            border: 1px solid var(--ctp-red);
            border-radius: 6px;
            color: var(--ctp-red);
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
          }

          .clear-btn:hover {
            background: rgba(243, 139, 168, 0.1);
          }

          .history-list {
            flex: 1;
            overflow-y: auto;
            padding: 16px 24px;
          }

          .history-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 60px 20px;
            color: var(--text-muted);
          }

          .history-empty svg {
            margin-bottom: 16px;
            opacity: 0.5;
          }

          .history-item {
            display: flex;
            gap: 12px;
            padding: 16px;
            background: var(--bg-tertiary);
            border-radius: 8px;
            margin-bottom: 8px;
            border-left: 3px solid var(--ctp-surface1);
            transition: all 0.2s;
          }

          .history-item:hover {
            background: var(--ctp-surface1);
          }

          .history-item.success {
            border-left-color: var(--ctp-green);
          }

          .history-item.error {
            border-left-color: var(--ctp-red);
          }

          .item-status {
            flex-shrink: 0;
            padding-top: 2px;
          }

          .history-item.success .item-status {
            color: var(--ctp-green);
          }

          .history-item.error .item-status {
            color: var(--ctp-red);
          }

          .item-content {
            flex: 1;
            min-width: 0;
          }

          .item-query {
            margin-bottom: 8px;
          }

          .item-query code {
            font-family: 'JetBrains Mono', 'Fira Code', monospace;
            font-size: 13px;
            color: var(--text-primary);
            word-break: break-word;
          }

          .item-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            font-size: 11px;
            color: var(--text-muted);
          }

          .item-meta span {
            display: flex;
            align-items: center;
            gap: 4px;
          }

          .meta-database {
            color: var(--accent);
          }

          .item-error {
            margin-top: 8px;
            padding: 8px;
            background: rgba(243, 139, 168, 0.1);
            border-radius: 4px;
            color: var(--ctp-red);
            font-size: 12px;
          }

          .item-actions {
            display: flex;
            flex-direction: column;
            gap: 4px;
            flex-shrink: 0;
          }

          .action-btn {
            padding: 8px;
            background: var(--ctp-surface1);
            border: none;
            border-radius: 6px;
            color: var(--text-secondary);
            cursor: pointer;
            transition: all 0.2s;
          }

          .action-btn:hover {
            background: var(--ctp-surface2);
            color: var(--text-primary);
          }
        `}</style>
      </div>
    </div>
  );
};
