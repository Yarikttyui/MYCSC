import React, { useState, useEffect, useRef } from 'react';

interface Database {
  name: string;
  size: string;
  tables: number;
  createdAt: string;
}

interface TableInfo {
  name: string;
  rowCount?: number;
  size?: string;
}

interface ViewInfo {
  name: string;
  definition: string;
  createdAt: string;
}

interface ProcedureInfo {
  name: string;
  definition: string;
  parameters: string[];
  createdAt: string;
}

interface FunctionInfo {
  name: string;
  definition: string;
  parameters: string[];
  returnType: string;
  createdAt: string;
}

interface DatabaseListProps {
  databases: Database[];
  currentDatabase: string;
  tables?: TableInfo[];
  views?: ViewInfo[];
  procedures?: ProcedureInfo[];
  functions?: FunctionInfo[];
  selectedTable?: string | null;
  onSelectDatabase: (name: string) => void;
  onSelectTable?: (table: string) => void;
  onSelectView?: (view: string) => void;
  onSelectProcedure?: (proc: string) => void;
  onSelectFunction?: (func: string) => void;
  onCreateView?: () => void;
  onCreateProcedure?: () => void;
  onCreateFunction?: () => void;
  onCreateDatabase: (name: string) => void;
  onDropDatabase: (name: string) => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  database: Database | null;
}

interface ModalState {
  type: 'create' | 'alter' | 'drop' | 'inspector' | null;
  database?: Database;
}

export const DatabaseList: React.FC<DatabaseListProps> = ({
  databases,
  currentDatabase,
  tables = [],
  views = [],
  procedures = [],
  functions = [],
  selectedTable = null,
  onSelectDatabase,
  onSelectTable,
  onSelectView,
  onSelectProcedure,
  onSelectFunction,
  onCreateView,
  onCreateProcedure,
  onCreateFunction,
  onCreateDatabase,
  onDropDatabase
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, database: null });
  const [modal, setModal] = useState<ModalState>({ type: null });
  const [newDbName, setNewDbName] = useState('');
  const [newDbCharset, setNewDbCharset] = useState('utf8mb4');
  const [newDbCollation, setNewDbCollation] = useState('utf8mb4_general_ci');
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [expandedDbs, setExpandedDbs] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Record<string, Set<string>>>({});

  const toggleDbExpand = (dbName: string) => {
    setExpandedDbs(prev => {
      const next = new Set(prev);
      if (next.has(dbName)) {
        next.delete(dbName);
      } else {
        next.add(dbName);
      }
      return next;
    });
  };

  const toggleSectionExpand = (dbName: string, section: string) => {
    setExpandedSections(prev => {
      const dbSections = prev[dbName] || new Set();
      const next = new Set(dbSections);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return { ...prev, [dbName]: next };
    });
  };

  const handleDbClick = (db: Database) => {
    if (db.name === currentDatabase) {
      toggleDbExpand(db.name);
    }
  };

  const handleDbDoubleClick = (db: Database) => {
    onSelectDatabase(db.name);
    setExpandedDbs(prev => new Set(prev).add(db.name));
  };

  const filteredDatabases = databases.filter(db =>
    db.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(prev => ({ ...prev, visible: false }));
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, db: Database) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      database: db
    });
  };

  const handleMenuAction = (action: string) => {
    const db = contextMenu.database;
    setContextMenu(prev => ({ ...prev, visible: false }));
    
    if (!db) return;

    switch (action) {
      case 'select':
        onSelectDatabase(db.name);
        break;
      case 'inspector':
        setModal({ type: 'inspector', database: db });
        break;
      case 'copy-name':
        navigator.clipboard.writeText(db.name);
        break;
      case 'copy-create':
        navigator.clipboard.writeText(`CREATE DATABASE \`${db.name}\` CHARACTER SET ${newDbCharset} COLLATE ${newDbCollation};`);
        break;
      case 'send-to-editor':
        navigator.clipboard.writeText(`USE \`${db.name}\`;`);
        break;
      case 'create':
        setModal({ type: 'create' });
        setNewDbName('');
        break;
      case 'alter':
        setModal({ type: 'alter', database: db });
        setNewDbName(db.name);
        break;
      case 'drop':
        setModal({ type: 'drop', database: db });
        break;
      case 'refresh':
        break;
    }
  };

  const handleCreateDatabase = () => {
    if (newDbName.trim()) {
      onCreateDatabase(newDbName.trim());
      setModal({ type: null });
      setNewDbName('');
    }
  };

  const handleDropDatabase = () => {
    if (modal.database) {
      onDropDatabase(modal.database.name);
      setModal({ type: null });
    }
  };

  return (
    <div className="database-list">
      {/* Header */}
      <div className="db-list-header">
        <h3>СХЕМЫ</h3>
        <div className="header-actions">
          <button 
            className="header-btn"
            onClick={() => { setModal({ type: 'create' }); setNewDbName(''); }}
            title="Создать схему"
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
          </button>
          <button 
            className="header-btn"
            title="Обновить"
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="db-search">
        <svg viewBox="0 0 24 24" className="search-icon">
          <path fill="currentColor" d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
        <input
          type="text"
          placeholder="Фильтр объектов"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Database Tree */}
      <div className="db-tree">
        {filteredDatabases.map(db => {
          const isExpanded = expandedDbs.has(db.name);
          const isActive = db.name === currentDatabase;
          const dbSections = expandedSections[db.name] || new Set();
          
          return (
            <div key={db.name} className="db-tree-node">
              <div 
                className={`db-tree-item ${isActive ? 'active' : ''}`}
                onClick={() => handleDbClick(db)}
                onContextMenu={(e) => handleContextMenu(e, db)}
                onDoubleClick={() => handleDbDoubleClick(db)}
              >
                <div 
                  className={`tree-expand ${isExpanded ? 'expanded' : ''}`}
                  onClick={(e) => { e.stopPropagation(); toggleDbExpand(db.name); }}
                >
                  <svg viewBox="0 0 24 24" width="12" height="12">
                    <path fill="currentColor" d="M10 17l5-5-5-5v10z"/>
                  </svg>
                </div>
                <div className="db-icon">
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path fill="currentColor" d="M12 3C7.58 3 4 4.79 4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7c0-2.21-3.58-4-8-4zm0 2c3.87 0 6 1.5 6 2s-2.13 2-6 2-6-1.5-6-2 2.13-2 6-2zm6 12c0 .5-2.13 2-6 2s-6-1.5-6-2v-2.23c1.61.78 3.72 1.23 6 1.23s4.39-.45 6-1.23V17zm0-5c0 .5-2.13 2-6 2s-6-1.5-6-2V9.77c1.61.78 3.72 1.23 6 1.23s4.39-.45 6-1.23V12z"/>
                  </svg>
                </div>
                <span className="db-name">{db.name}</span>
              </div>
              
              {/* Expanded DB contents */}
              {isExpanded && (
                <div className="db-tree-children">
                  {/* Tables */}
                  <div className="db-section">
                    <div 
                      className={`db-section-header ${dbSections.has('tables') ? 'expanded' : ''}`}
                      onClick={() => toggleSectionExpand(db.name, 'tables')}
                    >
                      <div className="tree-expand">
                        <svg viewBox="0 0 24 24" width="10" height="10">
                          <path fill="currentColor" d="M10 17l5-5-5-5v10z"/>
                        </svg>
                      </div>
                      <svg viewBox="0 0 24 24" width="16" height="16" className="section-icon">
                        <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/>
                        <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="2"/>
                        <line x1="9" y1="9" x2="9" y2="21" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                      <span>Tables</span>
                      <span className="section-count">{isActive ? tables.length : 0}</span>
                    </div>
                    {dbSections.has('tables') && (
                      <div className="db-section-items">
                        {isActive && tables.length > 0 ? (
                          tables.map(table => (
                            <div 
                              key={table.name}
                              className={`section-item ${selectedTable === table.name ? 'active' : ''}`}
                              onClick={() => onSelectTable?.(table.name)}
                            >
                              <svg viewBox="0 0 24 24" width="14" height="14">
                                <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                                <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="1.5"/>
                                <line x1="9" y1="9" x2="9" y2="21" stroke="currentColor" strokeWidth="1.5"/>
                              </svg>
                              <span>{table.name}</span>
                            </div>
                          ))
                        ) : (
                          <div className="db-section-items empty">
                            <span className="empty-text">{isActive ? 'Нет таблиц' : 'Выберите БД'}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Views */}
                  <div className="db-section">
                    <div 
                      className={`db-section-header ${dbSections.has('views') ? 'expanded' : ''}`}
                      onClick={() => toggleSectionExpand(db.name, 'views')}
                    >
                      <div className="tree-expand">
                        <svg viewBox="0 0 24 24" width="10" height="10">
                          <path fill="currentColor" d="M10 17l5-5-5-5v10z"/>
                        </svg>
                      </div>
                      <svg viewBox="0 0 24 24" width="16" height="16" className="section-icon">
                        <path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                      </svg>
                      <span>Views</span>
                      <span className="section-count">{isActive ? views.length : 0}</span>
                      {isActive && (
                        <button 
                          className="section-add-btn"
                          onClick={(e) => { e.stopPropagation(); onCreateView?.(); }}
                          title="Создать View"
                        >
                          <svg viewBox="0 0 24 24" width="12" height="12">
                            <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                          </svg>
                        </button>
                      )}
                    </div>
                    {dbSections.has('views') && (
                      <div className="db-section-items">
                        {isActive && views.length > 0 ? (
                          views.map(view => (
                            <div 
                              key={view.name}
                              className="section-item"
                              onClick={() => onSelectView?.(view.name)}
                              title={view.definition}
                            >
                              <svg viewBox="0 0 24 24" width="14" height="14">
                                <path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                              </svg>
                              <span>{view.name}</span>
                            </div>
                          ))
                        ) : isActive ? (
                          <div 
                            className="section-item add-new"
                            onClick={() => onCreateView?.()}
                          >
                            <svg viewBox="0 0 24 24" width="14" height="14">
                              <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                            </svg>
                            <span>Создать View...</span>
                          </div>
                        ) : (
                          <div className="db-section-items empty">
                            <span className="empty-text">Выберите БД</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Stored Procedures */}
                  <div className="db-section">
                    <div 
                      className={`db-section-header ${dbSections.has('procedures') ? 'expanded' : ''}`}
                      onClick={() => toggleSectionExpand(db.name, 'procedures')}
                    >
                      <div className="tree-expand">
                        <svg viewBox="0 0 24 24" width="10" height="10">
                          <path fill="currentColor" d="M10 17l5-5-5-5v10z"/>
                        </svg>
                      </div>
                      <svg viewBox="0 0 24 24" width="16" height="16" className="section-icon">
                        <path fill="currentColor" d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0L19.2 12l-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
                      </svg>
                      <span>Stored Procedures</span>
                      <span className="section-count">{isActive ? procedures.length : 0}</span>
                      {isActive && (
                        <button 
                          className="section-add-btn"
                          onClick={(e) => { e.stopPropagation(); onCreateProcedure?.(); }}
                          title="Создать Procedure"
                        >
                          <svg viewBox="0 0 24 24" width="12" height="12">
                            <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                          </svg>
                        </button>
                      )}
                    </div>
                    {dbSections.has('procedures') && (
                      <div className="db-section-items">
                        {isActive && procedures.length > 0 ? (
                          procedures.map(proc => (
                            <div 
                              key={proc.name}
                              className="section-item"
                              onClick={() => onSelectProcedure?.(proc.name)}
                              title={`(${proc.parameters.join(', ')})`}
                            >
                              <svg viewBox="0 0 24 24" width="14" height="14">
                                <path fill="currentColor" d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0L19.2 12l-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
                              </svg>
                              <span>{proc.name}</span>
                            </div>
                          ))
                        ) : isActive ? (
                          <div 
                            className="section-item add-new"
                            onClick={() => onCreateProcedure?.()}
                          >
                            <svg viewBox="0 0 24 24" width="14" height="14">
                              <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                            </svg>
                            <span>Создать Procedure...</span>
                          </div>
                        ) : (
                          <div className="db-section-items empty">
                            <span className="empty-text">Выберите БД</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Functions */}
                  <div className="db-section">
                    <div 
                      className={`db-section-header ${dbSections.has('functions') ? 'expanded' : ''}`}
                      onClick={() => toggleSectionExpand(db.name, 'functions')}
                    >
                      <div className="tree-expand">
                        <svg viewBox="0 0 24 24" width="10" height="10">
                          <path fill="currentColor" d="M10 17l5-5-5-5v10z"/>
                        </svg>
                      </div>
                      <svg viewBox="0 0 24 24" width="16" height="16" className="section-icon">
                        <text x="4" y="17" fontSize="14" fontWeight="bold" fill="currentColor">ƒ</text>
                      </svg>
                      <span>Functions</span>
                      <span className="section-count">{isActive ? functions.length : 0}</span>
                      {isActive && (
                        <button 
                          className="section-add-btn"
                          onClick={(e) => { e.stopPropagation(); onCreateFunction?.(); }}
                          title="Создать Function"
                        >
                          <svg viewBox="0 0 24 24" width="12" height="12">
                            <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                          </svg>
                        </button>
                      )}
                    </div>
                    {dbSections.has('functions') && (
                      <div className="db-section-items">
                        {isActive && functions.length > 0 ? (
                          functions.map(func => (
                            <div 
                              key={func.name}
                              className="section-item"
                              onClick={() => onSelectFunction?.(func.name)}
                              title={`(${func.parameters.join(', ')}) RETURNS ${func.returnType}`}
                            >
                              <svg viewBox="0 0 24 24" width="14" height="14">
                                <text x="2" y="13" fontSize="12" fontWeight="bold" fill="currentColor">ƒ</text>
                              </svg>
                              <span>{func.name}</span>
                            </div>
                          ))
                        ) : isActive ? (
                          <div 
                            className="section-item add-new"
                            onClick={() => onCreateFunction?.()}
                          >
                            <svg viewBox="0 0 24 24" width="14" height="14">
                              <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                            </svg>
                            <span>Создать Function...</span>
                          </div>
                        ) : (
                          <div className="db-section-items empty">
                            <span className="empty-text">Выберите БД</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredDatabases.length === 0 && (
          <div className="db-empty">
            <p>Нет баз данных</p>
            <button onClick={() => { setModal({ type: 'create' }); setNewDbName(''); }}>
              Создать схему
            </button>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div 
          ref={contextMenuRef}
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <div className="context-menu-item" onClick={() => handleMenuAction('select')}>
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            Сделать схемой по умолчанию
          </div>
          <div className="context-menu-item" onClick={() => handleMenuAction('inspector')}>
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
            </svg>
            Инспектор схемы
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
          <div className="context-menu-item" onClick={() => handleMenuAction('send-to-editor')}>
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
            Отправить в SQL редактор
          </div>
          <div className="context-menu-divider"></div>
          <div className="context-menu-item" onClick={() => handleMenuAction('create')}>
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            Создать схему...
          </div>
          <div className="context-menu-item" onClick={() => handleMenuAction('alter')}>
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
            Изменить схему...
          </div>
          <div className="context-menu-item danger" onClick={() => handleMenuAction('drop')}>
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
            Удалить схему...
          </div>
          <div className="context-menu-divider"></div>
          <div className="context-menu-item" onClick={() => handleMenuAction('refresh')}>
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
            Обновить всё
          </div>
        </div>
      )}

      {/* Create/Alter Schema Modal */}
      {(modal.type === 'create' || modal.type === 'alter') && (
        <div className="modal-overlay" onClick={() => setModal({ type: null })}>
          <div className="modal-content schema-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon">
                <svg viewBox="0 0 24 24" width="40" height="40">
                  <path fill="var(--ctp-yellow)" d="M12 3C7.58 3 4 4.79 4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7c0-2.21-3.58-4-8-4z"/>
                </svg>
              </div>
              <div className="modal-header-text">
                <h3>{modal.type === 'create' ? 'Создание схемы' : 'Изменение схемы'}</h3>
                <p>Настройте свойства схемы</p>
              </div>
              <button className="modal-close" onClick={() => setModal({ type: null })}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>Имя:</label>
                <input
                  type="text"
                  value={newDbName}
                  onChange={(e) => setNewDbName(e.target.value)}
                  placeholder="new_schema"
                  autoFocus
                />
                <span className="form-hint">
                  Укажите имя схемы. Можно использовать латинские буквы, цифры и символ подчёркивания.
                </span>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Кодировка/Сравнение:</label>
                  <select value={newDbCharset} onChange={(e) => setNewDbCharset(e.target.value)}>
                    <option value="utf8mb4">utf8mb4</option>
                    <option value="utf8">utf8</option>
                    <option value="latin1">latin1</option>
                    <option value="ascii">ascii</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>&nbsp;</label>
                  <select value={newDbCollation} onChange={(e) => setNewDbCollation(e.target.value)}>
                    <option value="utf8mb4_general_ci">utf8mb4_general_ci</option>
                    <option value="utf8mb4_unicode_ci">utf8mb4_unicode_ci</option>
                    <option value="utf8_general_ci">utf8_general_ci</option>
                  </select>
                </div>
              </div>

              <div className="sql-preview">
                <label>SQL запрос:</label>
                <pre>
                  {modal.type === 'create' 
                    ? `CREATE SCHEMA \`${newDbName || 'new_schema'}\` DEFAULT CHARACTER SET ${newDbCharset} COLLATE ${newDbCollation};`
                    : `ALTER SCHEMA \`${newDbName}\` DEFAULT CHARACTER SET ${newDbCharset} COLLATE ${newDbCollation};`
                  }
                </pre>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal({ type: null })}>
                Отмена
              </button>
              <button className="btn-primary" onClick={handleCreateDatabase} disabled={!newDbName.trim()}>
                Применить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drop Schema Modal */}
      {modal.type === 'drop' && modal.database && (
        <div className="modal-overlay" onClick={() => setModal({ type: null })}>
          <div className="modal-content drop-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header danger">
              <svg viewBox="0 0 24 24" width="48" height="48">
                <path fill="var(--ctp-red)" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              <div>
                <h3>Удаление схемы</h3>
                <p>Это действие нельзя отменить!</p>
              </div>
              <button className="modal-close" onClick={() => setModal({ type: null })}>×</button>
            </div>
            
            <div className="modal-body">
              <p className="drop-warning">
                Вы собираетесь удалить схему <strong>`{modal.database.name}`</strong>.
              </p>
              <p>Будет безвозвратно удалено:</p>
              <ul>
                <li>Все таблицы в схеме ({modal.database.tables} таблиц)</li>
                <li>Все данные в этих таблицах</li>
                <li>Все представления, процедуры и функции</li>
              </ul>

              <div className="sql-preview danger">
                <pre>DROP SCHEMA `{modal.database.name}`;</pre>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal({ type: null })}>
                Отмена
              </button>
              <button className="btn-danger" onClick={handleDropDatabase}>
                Удалить схему
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schema Inspector Modal */}
      {modal.type === 'inspector' && modal.database && (
        <div className="modal-overlay" onClick={() => setModal({ type: null })}>
          <div className="modal-content inspector-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <svg viewBox="0 0 24 24" width="32" height="32">
                <path fill="var(--ctp-blue)" d="M12 3C7.58 3 4 4.79 4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7c0-2.21-3.58-4-8-4z"/>
              </svg>
              <div>
                <h3>Инспектор схемы: {modal.database.name}</h3>
              </div>
              <button className="modal-close" onClick={() => setModal({ type: null })}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="inspector-tabs">
                <button className="inspector-tab active">Информация</button>
                <button className="inspector-tab">Таблицы</button>
                <button className="inspector-tab">Индексы</button>
              </div>

              <div className="inspector-content">
                <table className="inspector-table">
                  <tbody>
                    <tr>
                      <td className="label">Имя схемы:</td>
                      <td>{modal.database.name}</td>
                    </tr>
                    <tr>
                      <td className="label">Таблиц:</td>
                      <td>{modal.database.tables}</td>
                    </tr>
                    <tr>
                      <td className="label">Размер:</td>
                      <td>{modal.database.size}</td>
                    </tr>
                    <tr>
                      <td className="label">Создана:</td>
                      <td>{new Date(modal.database.createdAt).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="label">Кодировка:</td>
                      <td>utf8mb4</td>
                    </tr>
                    <tr>
                      <td className="label">Сравнение:</td>
                      <td>utf8mb4_general_ci</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal({ type: null })}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .database-list {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--bg-secondary);
        }

        .db-list-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
        }

        .db-list-header h3 {
          margin: 0;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          letter-spacing: 1px;
        }

        .header-actions {
          display: flex;
          gap: 4px;
        }

        .header-btn {
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
        }

        .header-btn:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .db-search {
          position: relative;
          padding: 8px 12px;
        }

        .db-search .search-icon {
          position: absolute;
          left: 20px;
          top: 50%;
          transform: translateY(-50%);
          width: 14px;
          height: 14px;
          color: var(--text-muted);
        }

        .db-search input {
          width: 100%;
          padding: 6px 8px 6px 30px;
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 4px;
          color: var(--text-primary);
          font-size: 12px;
        }

        .db-search input:focus {
          outline: none;
          border-color: var(--accent);
        }

        .db-tree {
          flex: 1;
          overflow-y: auto;
          padding: 4px 0;
        }
        
        .db-tree-node {
          user-select: none;
        }

        .db-tree-item {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          cursor: pointer;
          user-select: none;
        }

        .db-tree-item:hover {
          background: rgba(137, 180, 250, 0.1);
        }

        .db-tree-item.active {
          background: rgba(137, 180, 250, 0.15);
        }

        .db-tree-item.active .db-name {
          color: var(--accent);
          font-weight: 500;
        }

        .tree-expand {
          width: 16px;
          height: 16px;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.15s ease;
        }
        
        .tree-expand.expanded {
          transform: rotate(90deg);
        }
        
        .tree-expand svg {
          display: block;
        }

        .db-icon {
          color: var(--accent);
          display: flex;
          align-items: center;
        }

        .db-name {
          color: var(--text-primary);
          font-size: 13px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        /* Tree children - expanded content */
        .db-tree-children {
          padding-left: 16px;
        }
        
        .db-section {
          margin: 2px 0;
        }
        
        .db-section-header {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px 4px 16px;
          cursor: pointer;
          color: var(--text-secondary);
          font-size: 12px;
        }
        
        .db-section-header:hover {
          background: rgba(137, 180, 250, 0.08);
        }
        
        .db-section-header .tree-expand {
          width: 12px;
          height: 12px;
        }
        
        .db-section-header.expanded .tree-expand {
          transform: rotate(90deg);
        }
        
        .section-icon {
          color: var(--text-muted);
          flex-shrink: 0;
        }
        
        .section-count {
          margin-left: auto;
          color: var(--text-muted);
          font-size: 11px;
          background: var(--bg-tertiary);
          padding: 1px 6px;
          border-radius: 10px;
        }
        
        .section-add-btn {
          margin-left: 4px;
          padding: 2px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          border-radius: 4px;
          opacity: 0;
          transition: all 0.15s;
        }
        
        .db-section-header:hover .section-add-btn {
          opacity: 1;
        }
        
        .section-add-btn:hover {
          background: var(--ctp-surface1);
          color: var(--success);
        }
        
        .db-section-items {
          padding-left: 34px;
        }
        
        .db-section-items.empty {
          padding: 6px 12px 6px 50px;
        }
        
        .empty-text {
          color: var(--text-muted);
          font-size: 11px;
          font-style: italic;
        }
        
        .section-item {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 3px 12px;
          cursor: pointer;
          font-size: 12px;
          color: var(--text-primary);
        }
        
        .section-item:hover {
          background: rgba(137, 180, 250, 0.08);
        }
        
        .section-item.active {
          background: rgba(137, 180, 250, 0.15);
          color: var(--accent);
        }
        
        .section-item.active svg {
          color: var(--accent);
        }
        
        .section-item.add-new {
          color: var(--text-muted);
          font-style: italic;
        }
        
        .section-item.add-new:hover {
          color: var(--success);
        }
        
        .section-item.add-new svg {
          color: var(--success);
        }
        
        .section-item.placeholder {
          cursor: default;
        }
        
        .section-item.placeholder:hover {
          background: transparent;
        }
        
        .placeholder-text {
          color: var(--text-muted);
          font-size: 11px;
          font-style: italic;
        }

        .db-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px 16px;
          color: var(--text-muted);
          text-align: center;
        }

        .db-empty p {
          margin: 0 0 12px 0;
          font-size: 13px;
        }

        .db-empty button {
          padding: 8px 16px;
          background: var(--ctp-surface1);
          border: none;
          border-radius: 6px;
          color: var(--text-primary);
          font-size: 12px;
          cursor: pointer;
        }

        .db-empty button:hover {
          background: var(--ctp-surface2);
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
          color: var(--error);
        }

        .context-menu-item svg {
          color: var(--text-muted);
        }

        .context-menu-item.danger svg {
          color: var(--error);
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

        /* Modals */
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

        .modal-content {
          background: var(--bg-primary);
          border-radius: 12px;
          width: 90%;
          max-width: 500px;
          overflow: hidden;
          box-shadow: 0 16px 64px rgba(0, 0, 0, 0.5);
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
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 24px;
          background: var(--bg-secondary);
          border-top: 1px solid var(--border);
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group label {
          display: block;
          margin-bottom: 6px;
          color: var(--text-primary);
          font-size: 13px;
        }

        .form-group input,
        .form-group select {
          width: 100%;
          padding: 10px 12px;
          background: var(--bg-tertiary);
          border: 1px solid var(--ctp-surface1);
          border-radius: 6px;
          color: var(--text-primary);
          font-size: 14px;
        }

        .form-group input:focus,
        .form-group select:focus {
          outline: none;
          border-color: var(--accent);
        }

        .form-hint {
          display: block;
          margin-top: 6px;
          color: var(--text-muted);
          font-size: 11px;
          line-height: 1.4;
        }

        .form-row {
          display: flex;
          gap: 12px;
        }

        .form-row .form-group {
          flex: 1;
        }

        .sql-preview {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 12px;
          margin-top: 16px;
        }

        .sql-preview label {
          display: block;
          margin-bottom: 8px;
          color: var(--text-muted);
          font-size: 11px;
          text-transform: uppercase;
        }

        .sql-preview pre {
          margin: 0;
          color: var(--accent);
          font-family: 'Fira Code', monospace;
          font-size: 12px;
          white-space: pre-wrap;
          word-break: break-all;
        }

        .sql-preview.danger pre {
          color: var(--error);
        }

        .drop-warning {
          color: var(--text-primary);
          font-size: 14px;
          margin-bottom: 12px;
        }

        .drop-warning strong {
          color: var(--error);
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

        .btn-primary {
          padding: 10px 20px;
          background: var(--accent);
          border: none;
          border-radius: 6px;
          color: var(--ctp-crust);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }

        .btn-primary:hover {
          background: var(--accent-hover);
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
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
          background: var(--error);
          border: none;
          border-radius: 6px;
          color: var(--ctp-crust);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }

        .btn-danger:hover {
          background: var(--ctp-maroon);
        }

        /* Inspector Modal */
        .inspector-modal {
          max-width: 600px;
        }

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
      `}</style>
    </div>
  );
};
