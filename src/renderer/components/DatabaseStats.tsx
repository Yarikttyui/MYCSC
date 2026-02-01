import React, { useState, useEffect } from 'react';

interface TableStats {
  name: string;
  rowCount: number;
  columnCount: number;
  indexCount: number;
  sizeEstimate: string;
}

interface DatabaseStatsProps {
  database: string;
  tables: TableStats[];
  onClose: () => void;
  onRefresh: () => void;
}

export const DatabaseStats: React.FC<DatabaseStatsProps> = ({
  database,
  tables,
  onClose,
  onRefresh
}) => {
  const [sortBy, setSortBy] = useState<'name' | 'rowCount' | 'columnCount'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const totalRows = tables.reduce((sum, t) => sum + t.rowCount, 0);
  const totalColumns = tables.reduce((sum, t) => sum + t.columnCount, 0);
  const totalIndexes = tables.reduce((sum, t) => sum + t.indexCount, 0);

  const sortedTables = [...tables].sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'name') {
      comparison = a.name.localeCompare(b.name);
    } else if (sortBy === 'rowCount') {
      comparison = a.rowCount - b.rowCount;
    } else if (sortBy === 'columnCount') {
      comparison = a.columnCount - b.columnCount;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const handleSort = (column: 'name' | 'rowCount' | 'columnCount') => {
    if (sortBy === column) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString('ru-RU');
  };

  return (
    <div className="stats-overlay" onClick={onClose}>
      <div className="stats-modal" onClick={e => e.stopPropagation()}>
        <div className="stats-header">
          <div className="header-info">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <ellipse cx="12" cy="5" rx="9" ry="3"/>
              <path d="M21,12c0,1.66-4,3-9,3s-9-1.34-9-3"/>
              <path d="M3,5v14c0,1.66,4,3,9,3s9-1.34,9-3V5"/>
            </svg>
            <div>
              <h2>{database}</h2>
              <span className="subtitle">Статистика базы данных</span>
            </div>
          </div>
          <div className="header-actions">
            <button className="refresh-btn" onClick={onRefresh} title="Обновить">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23,4 L23,10 L17,10"/>
                <path d="M1,20 L1,14 L7,14"/>
                <path d="M3.51,9 A9,9 0,0,1,20.49,9"/>
                <path d="M20.49,15 A9,9 0,0,1,3.51,15"/>
              </svg>
            </button>
            <button className="close-btn" onClick={onClose}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="stats-summary">
          <div className="summary-card">
            <div className="card-icon tables">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <line x1="3" y1="9" x2="21" y2="9"/>
                <line x1="9" y1="21" x2="9" y2="9"/>
              </svg>
            </div>
            <div className="card-content">
              <span className="card-value">{tables.length}</span>
              <span className="card-label">Таблиц</span>
            </div>
          </div>

          <div className="summary-card">
            <div className="card-icon rows">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6"/>
                <line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/>
                <line x1="3" y1="12" x2="3.01" y2="12"/>
                <line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
            </div>
            <div className="card-content">
              <span className="card-value">{formatNumber(totalRows)}</span>
              <span className="card-label">Записей</span>
            </div>
          </div>

          <div className="summary-card">
            <div className="card-icon columns">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12,3 L12,21"/>
                <path d="M19,21 L19,16"/>
                <path d="M5,21 L5,14"/>
              </svg>
            </div>
            <div className="card-content">
              <span className="card-value">{formatNumber(totalColumns)}</span>
              <span className="card-label">Колонок</span>
            </div>
          </div>

          <div className="summary-card">
            <div className="card-icon indexes">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            <div className="card-content">
              <span className="card-value">{formatNumber(totalIndexes)}</span>
              <span className="card-label">Индексов</span>
            </div>
          </div>
        </div>

        <div className="stats-table-container">
          <table className="stats-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('name')} className="sortable">
                  Таблица
                  {sortBy === 'name' && (
                    <span className="sort-icon">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th onClick={() => handleSort('rowCount')} className="sortable">
                  Записей
                  {sortBy === 'rowCount' && (
                    <span className="sort-icon">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th onClick={() => handleSort('columnCount')} className="sortable">
                  Колонок
                  {sortBy === 'columnCount' && (
                    <span className="sort-icon">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th>Индексов</th>
                <th>Размер</th>
              </tr>
            </thead>
            <tbody>
              {sortedTables.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-row">
                    Нет таблиц в базе данных
                  </td>
                </tr>
              ) : (
                sortedTables.map(table => (
                  <tr key={table.name}>
                    <td className="table-name">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <line x1="3" y1="9" x2="21" y2="9"/>
                        <line x1="9" y1="21" x2="9" y2="9"/>
                      </svg>
                      {table.name}
                    </td>
                    <td className="number-cell">{formatNumber(table.rowCount)}</td>
                    <td className="number-cell">{formatNumber(table.columnCount)}</td>
                    <td className="number-cell">{formatNumber(table.indexCount)}</td>
                    <td className="size-cell">{table.sizeEstimate}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="stats-footer">
          <div className="footer-info">
            <span>Последнее обновление: {new Date().toLocaleString('ru-RU')}</span>
          </div>
        </div>

        <style>{`
          .stats-overlay {
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

          .stats-modal {
            width: 100%;
            max-width: 800px;
            max-height: 85vh;
            background: var(--bg-primary);
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          }

          .stats-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 20px 24px;
            border-bottom: 1px solid var(--border);
          }

          .header-info {
            display: flex;
            align-items: center;
            gap: 12px;
            color: var(--accent);
          }

          .header-info h2 {
            margin: 0;
            font-size: 18px;
            color: var(--text-primary);
          }

          .header-info .subtitle {
            font-size: 12px;
            color: var(--text-muted);
          }

          .header-actions {
            display: flex;
            gap: 8px;
          }

          .refresh-btn, .close-btn {
            background: none;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
            padding: 8px;
            border-radius: 6px;
            transition: all 0.2s;
          }

          .refresh-btn:hover, .close-btn:hover {
            background: var(--bg-tertiary);
            color: var(--text-primary);
          }

          .stats-summary {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            padding: 20px 24px;
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border);
          }

          .summary-card {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 16px;
            background: var(--bg-tertiary);
            border-radius: 8px;
          }

          .card-icon {
            width: 48px;
            height: 48px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 10px;
          }

          .card-icon.tables {
            background: rgba(137, 180, 250, 0.15);
            color: var(--ctp-blue);
          }

          .card-icon.rows {
            background: rgba(166, 227, 161, 0.15);
            color: var(--ctp-green);
          }

          .card-icon.columns {
            background: rgba(203, 166, 247, 0.15);
            color: var(--ctp-mauve);
          }

          .card-icon.indexes {
            background: rgba(250, 179, 135, 0.15);
            color: var(--ctp-peach);
          }

          .card-content {
            display: flex;
            flex-direction: column;
          }

          .card-value {
            font-size: 24px;
            font-weight: 600;
            color: var(--text-primary);
          }

          .card-label {
            font-size: 12px;
            color: var(--text-muted);
          }

          .stats-table-container {
            flex: 1;
            overflow-y: auto;
            padding: 0 24px;
          }

          .stats-table {
            width: 100%;
            border-collapse: collapse;
            margin: 16px 0;
          }

          .stats-table th {
            text-align: left;
            padding: 12px 16px;
            background: var(--bg-tertiary);
            color: var(--text-primary);
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            position: sticky;
            top: 0;
          }

          .stats-table th:first-child {
            border-radius: 6px 0 0 6px;
          }

          .stats-table th:last-child {
            border-radius: 0 6px 6px 0;
          }

          .stats-table th.sortable {
            cursor: pointer;
            user-select: none;
          }

          .stats-table th.sortable:hover {
            background: var(--ctp-surface1);
          }

          .sort-icon {
            margin-left: 6px;
            font-size: 10px;
          }

          .stats-table td {
            padding: 12px 16px;
            border-bottom: 1px solid var(--border);
            color: var(--text-secondary);
            font-size: 13px;
          }

          .stats-table tr:hover td {
            background: rgba(137, 180, 250, 0.05);
          }

          .table-name {
            display: flex;
            align-items: center;
            gap: 8px;
            color: var(--text-primary);
            font-weight: 500;
          }

          .table-name svg {
            color: var(--accent);
          }

          .number-cell {
            font-family: 'JetBrains Mono', monospace;
            text-align: right;
          }

          .size-cell {
            font-family: 'JetBrains Mono', monospace;
            text-align: right;
            color: var(--text-muted);
          }

          .empty-row {
            text-align: center;
            color: var(--text-muted);
            padding: 40px !important;
          }

          .stats-footer {
            padding: 12px 24px;
            border-top: 1px solid var(--border);
            background: var(--bg-secondary);
          }

          .footer-info {
            font-size: 11px;
            color: var(--text-muted);
          }

          @media (max-width: 768px) {
            .stats-summary {
              grid-template-columns: repeat(2, 1fr);
            }
          }
        `}</style>
      </div>
    </div>
  );
};
