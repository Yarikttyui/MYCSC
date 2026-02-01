import React from 'react';

interface SidebarProps {
  currentDatabase: string;
  tables: string[];
  selectedTable: string | null;
  onSelectTable: (table: string) => void;
  onDescribeTable: (table: string) => void;
  onRefresh: () => void;
}

export default function Sidebar({
  currentDatabase,
  tables,
  selectedTable,
  onSelectTable,
  onDescribeTable,
  onRefresh
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2"/>
            <ellipse cx="16" cy="12" rx="8" ry="4" stroke="currentColor" strokeWidth="2"/>
            <path d="M8 12v8c0 2.2 3.6 4 8 4s8-1.8 8-4v-8" stroke="currentColor" strokeWidth="2"/>
            <path d="M8 16c0 2.2 3.6 4 8 4s8-1.8 8-4" stroke="currentColor" strokeWidth="2"/>
          </svg>
          <span>MYCSC</span>
        </div>
      </div>

      <div className="database-info">
        <span className="label">База данных</span>
        <span className="database-name">{currentDatabase}</span>
      </div>

      <div className="sidebar-section">
        <div className="section-header">
          <span>Таблицы</span>
          <button className="icon-btn" onClick={onRefresh} title="Обновить">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M13.65 2.35A7 7 0 1 0 15 8h-2a5 5 0 1 1-1-3l-2.5 2.5H15V2l-1.35.35z" fill="currentColor"/>
            </svg>
          </button>
        </div>

        <div className="tables-list">
          {tables.length === 0 ? (
            <div className="empty-state">
              <p>Нет таблиц</p>
              <small>Создайте таблицу с помощью CREATE TABLE</small>
            </div>
          ) : (
            tables.map(table => (
              <div 
                key={table}
                className={`table-item ${selectedTable === table ? 'selected' : ''}`}
              >
                <div className="table-name" onClick={() => onSelectTable(table)}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect x="1" y="2" width="14" height="12" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                    <line x1="1" y1="6" x2="15" y2="6" stroke="currentColor" strokeWidth="1.5"/>
                    <line x1="5" y1="6" x2="5" y2="14" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                  <span>{table}</span>
                </div>
                <button 
                  className="icon-btn small" 
                  onClick={() => onDescribeTable(table)}
                  title="Показать структуру"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/>
                    <line x1="7" y1="6" x2="7" y2="10" stroke="currentColor" strokeWidth="1.5"/>
                    <circle cx="7" cy="4" r="0.5" fill="currentColor"/>
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="shortcuts">
          <span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> - Выполнить</span>
        </div>
      </div>
    </aside>
  );
}
