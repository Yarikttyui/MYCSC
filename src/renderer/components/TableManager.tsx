import React, { useState, useRef, useEffect } from 'react';

interface Column {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  autoIncrement: boolean;
  defaultValue?: any;
  unique: boolean;
}

interface TableInfo {
  name: string;
  columns: Column[];
  rowCount: number;
  indexes: string[];
}

interface TableManagerProps {
  tables: TableInfo[];
  onSelectTable: (name: string) => void;
  onCreateTable: (name: string, columns: Column[]) => void;
  onDropTable: (name: string) => void;
  onAlterTable: (name: string, operation: any) => void;
  selectedTable: string | null;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  table: TableInfo | null;
}

const DATA_TYPES = [
  'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT',
  'FLOAT', 'DOUBLE', 'DECIMAL',
  'VARCHAR', 'CHAR', 'TEXT', 'MEDIUMTEXT', 'LONGTEXT',
  'DATE', 'TIME', 'DATETIME', 'TIMESTAMP',
  'BOOLEAN', 'JSON', 'BLOB', 'UUID', 'ENUM'
];

export const TableManager: React.FC<TableManagerProps> = ({
  tables,
  onSelectTable,
  onCreateTable,
  onDropTable,
  onAlterTable,
  selectedTable
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newColumns, setNewColumns] = useState<Column[]>([
    { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true, autoIncrement: true, unique: false }
  ]);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [editingColumn, setEditingColumn] = useState<{ table: string; column: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, table: null });
  const [showInspector, setShowInspector] = useState<TableInfo | null>(null);
  const [showDropConfirm, setShowDropConfirm] = useState<TableInfo | null>(null);
  const [activeTab, setActiveTab] = useState<'tables' | 'indexes'>('tables');
  const contextMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(prev => ({ ...prev, visible: false }));
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, table: TableInfo) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      table
    });
  };

  const handleMenuAction = (action: string) => {
    const table = contextMenu.table;
    setContextMenu(prev => ({ ...prev, visible: false }));
    
    if (!table) return;

    switch (action) {
      case 'select-all':
        navigator.clipboard.writeText(`SELECT * FROM \`${table.name}\`;`);
        break;
      case 'select-1000':
        navigator.clipboard.writeText(`SELECT * FROM \`${table.name}\` LIMIT 1000;`);
        break;
      case 'inspector':
        setShowInspector(table);
        break;
      case 'copy-name':
        navigator.clipboard.writeText(table.name);
        break;
      case 'copy-create':
        const cols = table.columns.map(c => {
          let def = `\`${c.name}\` ${c.type}`;
          if (c.primaryKey) def += ' PRIMARY KEY';
          if (c.autoIncrement) def += ' AUTO_INCREMENT';
          if (!c.nullable) def += ' NOT NULL';
          if (c.unique && !c.primaryKey) def += ' UNIQUE';
          return def;
        }).join(',\n  ');
        navigator.clipboard.writeText(`CREATE TABLE \`${table.name}\` (\n  ${cols}\n);`);
        break;
      case 'truncate':
        if (confirm(`Очистить все данные из таблицы "${table.name}"?`)) {
        }
        break;
      case 'drop':
        setShowDropConfirm(table);
        break;
      case 'alter':
        break;
    }
  };

  const addColumn = () => {
    setNewColumns([
      ...newColumns,
      { name: '', type: 'VARCHAR', nullable: true, primaryKey: false, autoIncrement: false, unique: false }
    ]);
  };

  const removeColumn = (index: number) => {
    setNewColumns(newColumns.filter((_, i) => i !== index));
  };

  const updateColumn = (index: number, field: keyof Column, value: any) => {
    const updated = [...newColumns];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'primaryKey' && value) {
      updated[index].nullable = false;
    }
    
    setNewColumns(updated);
  };

  const handleCreate = () => {
    if (newTableName.trim() && newColumns.length > 0 && newColumns.every(c => c.name.trim())) {
      onCreateTable(newTableName.trim(), newColumns);
      setNewTableName('');
      setNewColumns([
        { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true, autoIncrement: true, unique: false }
      ]);
      setIsCreating(false);
    }
  };

  return (
    <div className="table-manager">
      <div className="tm-tabs">
        <button 
          className={`tm-tab ${activeTab === 'tables' ? 'active' : ''}`}
          onClick={() => setActiveTab('tables')}
        >
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path fill="currentColor" d="M3 3h18v18H3V3zm2 4v12h14V7H5zm2 2h10v2H7V9zm0 4h10v2H7v-2z"/>
          </svg>
          Таблицы
        </button>
        <button 
          className={`tm-tab ${activeTab === 'indexes' ? 'active' : ''}`}
          onClick={() => setActiveTab('indexes')}
        >
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path fill="currentColor" d="M3 5h18v2H3V5zm0 6h18v2H3v-2zm0 6h18v2H3v-2z"/>
          </svg>
          Индексы
        </button>
      </div>

      <div className="tm-header">
        <h3>{activeTab === 'tables' ? 'Таблицы' : 'Индексы'}</h3>
        {activeTab === 'tables' && (
          <button className="add-table-btn" onClick={() => setIsCreating(true)}>
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
          </button>
        )}
      </div>

      {activeTab === 'tables' ? (
        <>

      {isCreating && (
        <div className="create-table-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h4>Создание таблицы</h4>
              <button className="close-btn" onClick={() => setIsCreating(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Имя таблицы</label>
                <input
                  type="text"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  placeholder="users, products, orders..."
                />
              </div>

              <div className="columns-section">
                <div className="columns-header">
                  <h5>Колонки</h5>
                  <button className="add-col-btn" onClick={addColumn}>+ Добавить колонку</button>
                </div>

                <div className="columns-list">
                  {newColumns.map((col, index) => (
                    <div key={index} className="column-row">
                      <input
                        type="text"
                        className="col-name"
                        placeholder="Имя колонки"
                        value={col.name}
                        onChange={(e) => updateColumn(index, 'name', e.target.value)}
                      />
                      
                      <select 
                        className="col-type"
                        value={col.type}
                        onChange={(e) => updateColumn(index, 'type', e.target.value)}
                      >
                        {DATA_TYPES.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>

                      <div className="col-options">
                        <label className="checkbox-label" title="Primary Key">
                          <input
                            type="checkbox"
                            checked={col.primaryKey}
                            onChange={(e) => updateColumn(index, 'primaryKey', e.target.checked)}
                          />
                          <span>PK</span>
                        </label>
                        
                        <label className="checkbox-label" title="Auto Increment">
                          <input
                            type="checkbox"
                            checked={col.autoIncrement}
                            onChange={(e) => updateColumn(index, 'autoIncrement', e.target.checked)}
                          />
                          <span>AI</span>
                        </label>
                        
                        <label className="checkbox-label" title="Not NULL">
                          <input
                            type="checkbox"
                            checked={!col.nullable}
                            onChange={(e) => updateColumn(index, 'nullable', !e.target.checked)}
                          />
                          <span>NN</span>
                        </label>
                        
                        <label className="checkbox-label" title="Unique">
                          <input
                            type="checkbox"
                            checked={col.unique}
                            onChange={(e) => updateColumn(index, 'unique', e.target.checked)}
                          />
                          <span>UQ</span>
                        </label>
                      </div>

                      <button 
                        className="remove-col-btn"
                        onClick={() => removeColumn(index)}
                        disabled={newColumns.length === 1}
                      >
                        <svg viewBox="0 0 24 24" width="18" height="18">
                          <path fill="currentColor" d="M19 13H5v-2h14v2z"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setIsCreating(false)}>
                Отмена
              </button>
              <button className="create-btn" onClick={handleCreate}>
                Создать таблицу
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="tables-list">
        {tables.map(table => (
          <div 
            key={table.name}
            className={`table-item ${selectedTable === table.name ? 'selected' : ''}`}
            onContextMenu={(e) => handleContextMenu(e, table)}
          >
            <div 
              className="table-header"
              onClick={() => {
                onSelectTable(table.name);
                setExpandedTable(expandedTable === table.name ? null : table.name);
              }}
            >
              <svg 
                viewBox="0 0 24 24" 
                className={`expand-icon ${expandedTable === table.name ? 'expanded' : ''}`}
                width="16" 
                height="16"
              >
                <path fill="currentColor" d="M10 17l5-5-5-5v10z"/>
              </svg>
              <svg viewBox="0 0 24 24" className="table-icon" width="18" height="18">
                <path fill="currentColor" d="M3 3h18v18H3V3zm2 4v12h14V7H5zm2 2h10v2H7V9zm0 4h10v2H7v-2z"/>
              </svg>
              <span className="table-name">{table.name}</span>
              <span className="table-rows">{table.rowCount} строк</span>
              <button 
                className="delete-table-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDropConfirm(table);
                }}
              >
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
              </button>
            </div>

            {expandedTable === table.name && (
              <div className="table-columns">
                {table.columns.map(col => (
                  <div key={col.name} className="column-info">
                    <span className={`col-name ${col.primaryKey ? 'pk' : ''}`}>
                      {col.primaryKey && <span className="pk-icon">🔑</span>}
                      {col.name}
                    </span>
                    <span className="col-type">{col.type}</span>
                    <div className="col-constraints">
                      {col.primaryKey && <span className="badge pk">PK</span>}
                      {col.autoIncrement && <span className="badge ai">AI</span>}
                      {!col.nullable && <span className="badge nn">NN</span>}
                      {col.unique && <span className="badge uq">UQ</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {tables.length === 0 && (
          <div className="no-tables">
            <svg viewBox="0 0 24 24" width="40" height="40">
              <path fill="currentColor" opacity="0.3" d="M3 3h18v18H3V3zm2 4v12h14V7H5z"/>
            </svg>
            <p>Нет таблиц</p>
            <button onClick={() => setIsCreating(true)}>Создать первую таблицу</button>
          </div>
        )}
      </div>
      </>
      ) : (
        <div className="indexes-list">
          {tables.length === 0 ? (
            <div className="no-indexes">
              <svg viewBox="0 0 24 24" width="40" height="40">
                <path fill="currentColor" opacity="0.3" d="M3 5h18v2H3V5zm0 6h18v2H3v-2zm0 6h18v2H3v-2z"/>
              </svg>
              <p>Нет индексов</p>
              <small>Создайте таблицы для просмотра индексов</small>
            </div>
          ) : (
            tables.map(table => {
              const allIndexes = [
                ...table.columns.filter(c => c.primaryKey).map(c => ({
                  name: `PRIMARY`,
                  table: table.name,
                  column: c.name,
                  type: 'PRIMARY' as const,
                  unique: true
                })),
                ...table.columns.filter(c => c.unique && !c.primaryKey).map(c => ({
                  name: `idx_${table.name}_${c.name}`,
                  table: table.name,
                  column: c.name,
                  type: 'UNIQUE' as const,
                  unique: true
                })),
                ...table.indexes.map(idx => ({
                  name: idx,
                  table: table.name,
                  column: '-',
                  type: 'INDEX' as const,
                  unique: false
                }))
              ];

              if (allIndexes.length === 0) return null;

              return (
                <div key={table.name} className="index-group">
                  <div className="index-group-header">
                    <svg viewBox="0 0 24 24" width="14" height="14">
                      <path fill="currentColor" d="M3 3h18v18H3V3zm2 4v12h14V7H5z"/>
                    </svg>
                    <span>{table.name}</span>
                    <span className="index-count">{allIndexes.length} индексов</span>
                  </div>
                  <div className="index-items">
                    {allIndexes.map((idx, i) => (
                      <div key={i} className="index-item">
                        <svg viewBox="0 0 24 24" width="14" height="14">
                          <path fill="currentColor" d="M3 5h18v2H3V5zm0 6h18v2H3v-2zm0 6h18v2H3v-2z"/>
                        </svg>
                        <span className="index-name">{idx.name}</span>
                        <span className={`index-type ${idx.type.toLowerCase()}`}>{idx.type}</span>
                        <span className="index-column">{idx.column}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu.visible && (
        <div 
          ref={contextMenuRef}
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <div className="context-menu-item" onClick={() => handleMenuAction('select-all')}>
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
            </svg>
            Выбрать все строки
          </div>
          <div className="context-menu-item" onClick={() => handleMenuAction('select-1000')}>
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
            </svg>
            Выбрать первые 1000 строк
          </div>
          <div className="context-menu-divider"></div>
          <div className="context-menu-item" onClick={() => handleMenuAction('inspector')}>
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
            </svg>
            Инспектор таблицы
          </div>
          <div className="context-menu-divider"></div>
          <div className="context-menu-item has-submenu">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
            Копировать в буфер
            <svg className="submenu-arrow" viewBox="0 0 24 24" width="12" height="12">
              <path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
            </svg>
            <div className="context-submenu">
              <div className="context-menu-item" onClick={() => handleMenuAction('copy-name')}>
                Имя
              </div>
              <div className="context-menu-item" onClick={() => handleMenuAction('copy-create')}>
                CREATE запрос
              </div>
            </div>
          </div>
          <div className="context-menu-divider"></div>
          <div className="context-menu-item" onClick={() => handleMenuAction('alter')}>
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
            Изменить таблицу...
          </div>
          <div className="context-menu-item" onClick={() => handleMenuAction('truncate')}>
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M9 3v1H4v2h1v13a2 2 0 002 2h10a2 2 0 002-2V6h1V4h-5V3H9zM7 19V6h10v13H7z"/>
            </svg>
            Очистить таблицу
          </div>
          <div className="context-menu-item danger" onClick={() => handleMenuAction('drop')}>
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
            Удалить таблицу...
          </div>
        </div>
      )}

      {/* Table Inspector Modal */}
      {showInspector && (
        <div className="modal-overlay" onClick={() => setShowInspector(null)}>
          <div className="inspector-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <svg viewBox="0 0 24 24" width="28" height="28">
                <path fill="var(--ctp-green)" d="M3 3h18v18H3V3zm2 4v12h14V7H5zm2 2h10v2H7V9zm0 4h10v2H7v-2z"/>
              </svg>
              <div>
                <h3>Инспектор таблицы: {showInspector.name}</h3>
              </div>
              <button className="modal-close" onClick={() => setShowInspector(null)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="inspector-tabs">
                <button className="inspector-tab active">Информация</button>
                <button className="inspector-tab">Колонки</button>
                <button className="inspector-tab">Индексы</button>
                <button className="inspector-tab">DDL</button>
              </div>

              <div className="inspector-content">
                <table className="inspector-table">
                  <tbody>
                    <tr>
                      <td className="label">Имя таблицы:</td>
                      <td>{showInspector.name}</td>
                    </tr>
                    <tr>
                      <td className="label">Кол-во строк:</td>
                      <td>{showInspector.rowCount}</td>
                    </tr>
                    <tr>
                      <td className="label">Колонок:</td>
                      <td>{showInspector.columns.length}</td>
                    </tr>
                    <tr>
                      <td className="label">Индексов:</td>
                      <td>{showInspector.indexes.length}</td>
                    </tr>
                    <tr>
                      <td className="label">Движок:</td>
                      <td>MYCSC Storage</td>
                    </tr>
                  </tbody>
                </table>

                <h4 style={{ marginTop: 20, marginBottom: 10, color: 'var(--text-primary)' }}>Колонки</h4>
                <table className="columns-table">
                  <thead>
                    <tr>
                      <th>Имя</th>
                      <th>Тип</th>
                      <th>Null</th>
                      <th>Ключ</th>
                      <th>Дополнительно</th>
                    </tr>
                  </thead>
                  <tbody>
                    {showInspector.columns.map(col => (
                      <tr key={col.name}>
                        <td>{col.name}</td>
                        <td>{col.type}</td>
                        <td>{col.nullable ? 'YES' : 'NO'}</td>
                        <td>{col.primaryKey ? 'PRI' : col.unique ? 'UNI' : ''}</td>
                        <td>{col.autoIncrement ? 'auto_increment' : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowInspector(null)}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drop Confirm Modal */}
      {showDropConfirm && (
        <div className="modal-overlay" onClick={() => setShowDropConfirm(null)}>
          <div className="drop-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header danger">
              <svg viewBox="0 0 24 24" width="40" height="40">
                <path fill="var(--ctp-red)" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              <div>
                <h3>Удаление таблицы</h3>
                <p>Это действие нельзя отменить!</p>
              </div>
              <button className="modal-close" onClick={() => setShowDropConfirm(null)}>×</button>
            </div>
            
            <div className="modal-body">
              <p>Вы собираетесь удалить таблицу <strong style={{ color: 'var(--ctp-red)' }}>`{showDropConfirm.name}`</strong>.</p>
              <p>Будет безвозвратно удалено:</p>
              <ul>
                <li>Все данные ({showDropConfirm.rowCount} строк)</li>
                <li>Все колонки ({showDropConfirm.columns.length} колонок)</li>
                <li>Все индексы ({showDropConfirm.indexes.length} индексов)</li>
              </ul>

              <div className="sql-preview danger">
                <pre>DROP TABLE `{showDropConfirm.name}`;</pre>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDropConfirm(null)}>
                Отмена
              </button>
              <button className="btn-danger" onClick={() => {
                onDropTable(showDropConfirm.name);
                setShowDropConfirm(null);
              }}>
                Удалить таблицу
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .table-manager {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .tm-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
        }

        .tm-header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .add-table-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: var(--ctp-surface1);
          border: none;
          border-radius: 6px;
          color: var(--ctp-green);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .add-table-btn:hover {
          background: var(--ctp-surface2);
        }

        /* Modal Styles */
        .create-table-modal {
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
        }

        .modal-content {
          width: 90%;
          max-width: 700px;
          max-height: 80vh;
          background: var(--bg-tertiary);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--ctp-surface1);
        }

        .modal-header h4 {
          margin: 0;
          color: var(--text-primary);
          font-size: 16px;
        }

        .close-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 24px;
          cursor: pointer;
        }

        .modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          color: var(--text-secondary);
          font-size: 13px;
        }

        .form-group input {
          width: 100%;
          padding: 10px 12px;
          background: var(--bg-primary);
          border: 1px solid var(--ctp-surface1);
          border-radius: 6px;
          color: var(--text-primary);
          font-size: 14px;
        }

        .form-group input:focus {
          outline: none;
          border-color: var(--accent);
        }

        .columns-section {
          background: var(--bg-primary);
          border-radius: 8px;
          padding: 16px;
        }

        .columns-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .columns-header h5 {
          margin: 0;
          color: var(--text-primary);
          font-size: 14px;
        }

        .add-col-btn {
          padding: 6px 12px;
          background: var(--ctp-surface1);
          border: none;
          border-radius: 4px;
          color: var(--accent);
          font-size: 12px;
          cursor: pointer;
        }

        .columns-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .column-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          background: var(--bg-tertiary);
          border-radius: 6px;
        }

        .col-name {
          flex: 1;
          padding: 8px 10px;
          background: var(--ctp-surface1);
          border: 1px solid var(--ctp-surface2);
          border-radius: 4px;
          color: var(--text-primary);
          font-size: 13px;
        }

        .col-type {
          width: 130px;
          padding: 8px 10px;
          background: var(--ctp-surface1);
          border: 1px solid var(--ctp-surface2);
          border-radius: 4px;
          color: var(--text-primary);
          font-size: 13px;
        }

        .col-options {
          display: flex;
          gap: 8px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 8px;
          background: var(--ctp-surface1);
          border-radius: 4px;
          color: var(--text-secondary);
          font-size: 11px;
          cursor: pointer;
        }

        .checkbox-label input {
          width: 14px;
          height: 14px;
          cursor: pointer;
        }

        .checkbox-label:has(input:checked) {
          background: var(--accent);
          color: var(--bg-primary);
        }

        .remove-col-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: transparent;
          border: none;
          border-radius: 4px;
          color: var(--ctp-red);
          cursor: pointer;
        }

        .remove-col-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .modal-footer {
          display: flex;
          gap: 12px;
          padding: 16px 20px;
          border-top: 1px solid var(--ctp-surface1);
        }

        .cancel-btn {
          flex: 1;
          padding: 12px;
          background: var(--ctp-surface1);
          border: none;
          border-radius: 6px;
          color: var(--text-primary);
          font-size: 14px;
          cursor: pointer;
        }

        .create-btn {
          flex: 1;
          padding: 12px;
          background: linear-gradient(135deg, var(--ctp-blue), var(--ctp-mauve));
          border: none;
          border-radius: 6px;
          color: var(--bg-primary);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        /* Tables List */
        .tables-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }

        .table-item {
          margin-bottom: 4px;
          background: var(--bg-tertiary);
          border-radius: 6px;
          overflow: hidden;
        }

        .table-item.selected {
          border: 1px solid var(--accent);
        }

        .table-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .table-header:hover {
          background: var(--ctp-surface1);
        }

        .expand-icon {
          color: var(--text-muted);
          transition: transform 0.2s ease;
        }

        .expand-icon.expanded {
          transform: rotate(90deg);
        }

        .table-icon {
          color: var(--accent);
        }

        .table-name {
          flex: 1;
          color: var(--text-primary);
          font-size: 13px;
          font-weight: 500;
        }

        .table-rows {
          color: var(--text-muted);
          font-size: 12px;
        }

        .delete-table-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          background: transparent;
          border: none;
          border-radius: 4px;
          color: var(--text-muted);
          cursor: pointer;
          opacity: 0;
          transition: all 0.2s ease;
        }

        .table-header:hover .delete-table-btn {
          opacity: 1;
        }

        .delete-table-btn:hover {
          color: var(--ctp-red);
          background: rgba(243, 139, 168, 0.1);
        }

        .table-columns {
          padding: 0 12px 12px 36px;
        }

        .column-info {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 0;
          border-bottom: 1px solid var(--ctp-surface1);
        }

        .column-info:last-child {
          border-bottom: none;
        }

        .column-info .col-name {
          flex: 1;
          color: var(--text-primary);
          font-size: 13px;
          background: none;
          border: none;
          padding: 0;
        }

        .column-info .col-name.pk {
          color: var(--ctp-yellow);
        }

        .pk-icon {
          margin-right: 4px;
        }

        .column-info .col-type {
          width: auto;
          padding: 2px 8px;
          background: var(--ctp-surface1);
          border: none;
          border-radius: 4px;
          color: var(--accent);
          font-size: 11px;
          font-family: monospace;
        }

        .col-constraints {
          display: flex;
          gap: 4px;
        }

        .badge {
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: 600;
        }

        .badge.pk { background: var(--ctp-yellow); color: var(--bg-primary); }
        .badge.ai { background: var(--ctp-green); color: var(--bg-primary); }
        .badge.nn { background: var(--ctp-red); color: var(--bg-primary); }
        .badge.uq { background: var(--ctp-blue); color: var(--bg-primary); }

        .no-tables {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          color: var(--text-muted);
          text-align: center;
        }

        .no-tables p {
          margin: 12px 0;
        }

        .no-tables button {
          padding: 10px 20px;
          background: var(--ctp-surface1);
          border: none;
          border-radius: 6px;
          color: var(--accent);
          cursor: pointer;
        }

        /* Context Menu */
        .context-menu {
          position: fixed;
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 6px 0;
          min-width: 200px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
          z-index: 1000;
        }

        .context-menu-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 16px;
          color: var(--text-primary);
          font-size: 13px;
          cursor: pointer;
          position: relative;
        }

        .context-menu-item:hover {
          background: var(--bg-tertiary);
        }

        .context-menu-item.danger {
          color: var(--ctp-red);
        }

        .context-menu-item svg {
          color: var(--text-muted);
        }

        .context-menu-item.danger svg {
          color: var(--ctp-red);
        }

        .context-menu-divider {
          height: 1px;
          background: var(--border);
          margin: 6px 0;
        }

        .context-menu-item.has-submenu {
          padding-right: 32px;
        }

        .submenu-arrow {
          position: absolute;
          right: 12px;
        }

        .context-submenu {
          display: none;
          position: absolute;
          left: 100%;
          top: 0;
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 6px 0;
          min-width: 150px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        }

        .context-menu-item.has-submenu:hover .context-submenu {
          display: block;
        }

        /* Modal Overlay */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1001;
        }

        .inspector-modal,
        .drop-modal {
          background: var(--bg-primary);
          border-radius: 12px;
          width: 90%;
          max-width: 600px;
          max-height: 80vh;
          overflow: hidden;
          box-shadow: 0 16px 64px rgba(0, 0, 0, 0.5);
        }

        .drop-modal {
          max-width: 450px;
        }

        .modal-header {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px 24px;
          background: linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary));
          border-bottom: 1px solid var(--border);
        }

        .modal-header.danger {
          background: linear-gradient(135deg, rgba(243, 139, 168, 0.2), var(--bg-secondary));
        }

        .modal-header h3 {
          margin: 0;
          color: var(--text-primary);
          font-size: 16px;
        }

        .modal-header p {
          margin: 4px 0 0 0;
          color: var(--text-muted);
          font-size: 12px;
        }

        .modal-close {
          margin-left: auto;
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }

        .modal-close:hover {
          color: var(--text-primary);
        }

        .modal-body {
          padding: 24px;
          overflow-y: auto;
          max-height: 50vh;
        }

        .modal-body p {
          color: var(--text-primary);
          margin: 0 0 12px 0;
        }

        .modal-body ul {
          margin: 12px 0;
          padding-left: 20px;
          color: var(--text-secondary);
          font-size: 13px;
        }

        .modal-body li {
          margin-bottom: 6px;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 24px;
          background: var(--bg-secondary);
          border-top: 1px solid var(--border);
        }

        .btn-secondary {
          padding: 10px 20px;
          background: var(--ctp-surface1);
          border: none;
          border-radius: 6px;
          color: var(--text-primary);
          font-size: 13px;
          cursor: pointer;
        }

        .btn-secondary:hover {
          background: var(--ctp-surface2);
        }

        .btn-danger {
          padding: 10px 20px;
          background: var(--ctp-red);
          border: none;
          border-radius: 6px;
          color: var(--bg-primary);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }

        .btn-danger:hover {
          background: var(--ctp-maroon);
        }

        .sql-preview {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 12px;
          margin-top: 16px;
        }

        .sql-preview.danger pre {
          color: var(--ctp-red);
        }

        .sql-preview pre {
          margin: 0;
          color: var(--accent);
          font-family: 'Fira Code', monospace;
          font-size: 12px;
        }

        /* Inspector */
        .inspector-tabs {
          display: flex;
          gap: 4px;
          margin-bottom: 16px;
          border-bottom: 1px solid var(--border);
          padding-bottom: 8px;
        }

        .inspector-tab {
          padding: 8px 16px;
          background: transparent;
          border: none;
          border-radius: 4px;
          color: var(--text-muted);
          font-size: 13px;
          cursor: pointer;
        }

        .inspector-tab:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .inspector-tab.active {
          background: var(--bg-tertiary);
          color: var(--accent);
        }

        .inspector-table {
          width: 100%;
          border-collapse: collapse;
        }

        .inspector-table td {
          padding: 10px 12px;
          border-bottom: 1px solid var(--border);
          font-size: 13px;
        }

        .inspector-table .label {
          color: var(--text-muted);
          width: 40%;
        }

        .inspector-table td:last-child {
          color: var(--text-primary);
        }

        .columns-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }

        .columns-table th {
          text-align: left;
          padding: 8px;
          background: var(--bg-tertiary);
          color: var(--text-muted);
          font-weight: 500;
        }

        .columns-table td {
          padding: 8px;
          border-bottom: 1px solid var(--border);
          color: var(--text-primary);
        }

        /* Table Manager Tabs */
        .tm-tabs {
          display: flex;
          gap: 2px;
          padding: 8px 12px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border);
        }

        .tm-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: transparent;
          border: none;
          border-radius: 6px;
          color: var(--text-muted);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tm-tab:hover {
          background: var(--bg-tertiary);
          color: var(--text-secondary);
        }

        .tm-tab.active {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        /* Indexes List */
        .indexes-list {
          padding: 8px;
          overflow-y: auto;
        }

        .no-indexes {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          text-align: center;
        }

        .no-indexes p {
          margin: 12px 0 4px;
          color: var(--text-muted);
        }

        .no-indexes small {
          color: var(--ctp-surface1);
          font-size: 12px;
        }

        .index-group {
          margin-bottom: 12px;
        }

        .index-group-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: var(--bg-tertiary);
          border-radius: 6px 6px 0 0;
          font-size: 12px;
          color: var(--text-secondary);
        }

        .index-group-header span:first-of-type {
          color: var(--text-primary);
          font-weight: 500;
        }

        .index-count {
          margin-left: auto;
          color: var(--text-muted);
          font-size: 11px;
        }

        .index-items {
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-top: none;
          border-radius: 0 0 6px 6px;
        }

        .index-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-bottom: 1px solid var(--border);
          font-size: 12px;
        }

        .index-item:last-child {
          border-bottom: none;
        }

        .index-item svg {
          color: var(--text-muted);
        }

        .index-name {
          color: var(--text-primary);
          font-family: 'JetBrains Mono', monospace;
        }

        .index-type {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .index-type.primary {
          background: rgba(249, 226, 175, 0.2);
          color: var(--ctp-yellow);
        }

        .index-type.unique {
          background: rgba(137, 180, 250, 0.2);
          color: var(--ctp-blue);
        }

        .index-type.index {
          background: rgba(166, 173, 200, 0.2);
          color: var(--text-secondary);
        }

        .index-column {
          margin-left: auto;
          color: var(--text-muted);
          font-family: 'JetBrains Mono', monospace;
        }
      `}</style>
    </div>
  );
};
