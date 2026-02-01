import React, { useState, useCallback, useRef, useEffect } from 'react';
import { DatabaseList } from './DatabaseList';
import { TableManager } from './TableManager';
import { ExportImportModal } from './ExportImportModal';
import { Connection } from './WelcomeScreen';
import { QueryHistory, HistoryEntry } from './QueryHistory';
import { SettingsModal, AppSettings, defaultSettings } from './SettingsModal';
import { KeyboardShortcuts, useKeyboardShortcuts } from './KeyboardShortcuts';
import { DatabaseStats } from './DatabaseStats';
import { SQLEditor } from './SQLEditor';
import { CollaborativeEditor } from './CollaborativeEditor';
import { GlobalSearch } from './GlobalSearch';
import { RelationsModal } from './RelationsModal';
import { ERDiagram } from './ERDiagram';
import { Documentation } from './Documentation';
import { ObjectEditorModal } from './ObjectEditorModal';
import { AdminPanel } from './AdminPanel';
import { BackupRestore } from './BackupRestore';
import { useToast } from './Toast';
import { useLocale } from './Locale';
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

interface Database {
  name: string;
  size: string;
  tables: number;
  createdAt: string;
}

interface QueryResult {
  success: boolean;
  rows?: Record<string, any>[];
  columns?: string[];
  rowsAffected?: number;
  message?: string;
  error?: string;
  executionTime?: number;
  errorLine?: number;
  errorPosition?: number;
  query?: string;
}
interface QueryLogEntry {
  id: number;
  time: string;
  query: string;
  message: string;
  duration: number;
  fetchTime: number;
  success: boolean;
  error?: string;
  errorLine?: number;
  errorPosition?: number;
}

interface MainWorkspaceProps {
  connection: Connection;
  onDisconnect: () => void;
  dbAPI: any;
  sessionId?: string;
  apiUrl?: string;
  username?: string;
}

export const MainWorkspace: React.FC<MainWorkspaceProps> = ({
  connection,
  onDisconnect,
  dbAPI,
  sessionId = '',
  apiUrl = '',
  username = ''
}) => {
  const toast = useToast();
  const { t, language, setLanguage } = useLocale();
  const [databases, setDatabases] = useState<Database[]>([]);
  const [currentDatabase, setCurrentDatabase] = useState(connection.database || 'default');
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [views, setViews] = useState<ViewInfo[]>([]);
  const [procedures, setProcedures] = useState<ProcedureInfo[]>([]);
  const [functions, setFunctions] = useState<FunctionInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [results, setResults] = useState<QueryResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'query' | 'structure' | 'data'>('query');
  const [leftPanelWidth, setLeftPanelWidth] = useState(280);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(250);
  const [showOutput, setShowOutput] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showRelations, setShowRelations] = useState(false);
  const [showERDiagram, setShowERDiagram] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [leftPanelTab, setLeftPanelTab] = useState<'schemas' | 'admin'>('schemas');
  const [objectEditorModal, setObjectEditorModal] = useState<{
    isOpen: boolean;
    type: 'view' | 'procedure' | 'function';
  }>({ isOpen: false, type: 'view' });
  
  const [relations, setRelations] = useState<Array<{
    id: string;
    name: string;
    type: 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_MANY';
    sourceTable: string;
    sourceColumn: string;
    targetTable: string;
    targetColumn: string;
    onDelete: 'CASCADE' | 'SET_NULL' | 'SET_DEFAULT' | 'RESTRICT' | 'NO_ACTION';
    onUpdate: 'CASCADE' | 'SET_NULL' | 'SET_DEFAULT' | 'RESTRICT' | 'NO_ACTION';
  }>>([]);
  const [queryHistory, setQueryHistory] = useState<HistoryEntry[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [queryLog, setQueryLog] = useState<QueryLogEntry[]>([]);
  const [logCounter, setLogCounter] = useState(1);
  interface QueryTab {
    id: string;
    name: string;
    sql: string;
  }
  const [queryTabs, setQueryTabs] = useState<QueryTab[]>([
    { id: '1', name: 'Query 1', sql: `-- Добро пожаловать в MYCSC!
-- Подключение: ${connection.name}
-- Хост: ${connection.host}:${connection.port}

-- Создайте таблицу:
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE,
  age INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Показать все таблицы:
SHOW TABLES;

-- Выбрать данные:
SELECT * FROM users;
` }
  ]);
  const [activeTabId, setActiveTabId] = useState('1');
  const [tabCounter, setTabCounter] = useState(2);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const sql = queryTabs.find(t => t.id === activeTabId)?.sql || '';
  const setSql = (newSql: string) => {
    setQueryTabs(tabs => tabs.map(t => 
      t.id === activeTabId ? { ...t, sql: newSql } : t
    ));
  };
  const connectionStorageKey = `mycsc_queries_${connection.id}`;
  const handleManualSave = useCallback(() => {
    setIsSaving(true);
    const savedQueries = JSON.parse(localStorage.getItem(connectionStorageKey) || '{}');
    queryTabs.forEach(tab => {
      savedQueries[tab.id] = {
        sql: tab.sql,
        savedAt: new Date().toISOString(),
        database: currentDatabase
      };
    });
    localStorage.setItem(connectionStorageKey, JSON.stringify(savedQueries));
    const now = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    setLastSavedAt(now);
    setTimeout(() => setIsSaving(false), 500);
    toast.success('Сохранено', `Скрипты сохранены в ${now}`);
  }, [connectionStorageKey, queryTabs, currentDatabase, toast]);
  const handleAutoSave = useCallback((sqlContent: string) => {
    const savedQueries = JSON.parse(localStorage.getItem(connectionStorageKey) || '{}');
    savedQueries[activeTabId] = {
      sql: sqlContent,
      savedAt: new Date().toISOString(),
      database: currentDatabase
    };
    localStorage.setItem(connectionStorageKey, JSON.stringify(savedQueries));
    setLastSavedAt(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }));
  }, [activeTabId, currentDatabase, connectionStorageKey]);
  useEffect(() => {
    const savedQueries = JSON.parse(localStorage.getItem(connectionStorageKey) || '{}');
    if (Object.keys(savedQueries).length > 0) {
      const restoredTabs = queryTabs.map(tab => {
        if (savedQueries[tab.id]) {
          return { ...tab, sql: savedQueries[tab.id].sql };
        }
        return tab;
      });
      if (JSON.stringify(restoredTabs) !== JSON.stringify(queryTabs)) {
        setQueryTabs(restoredTabs);
      }
    } else {
      setQueryTabs([{
        id: '1',
        name: 'Query 1',
        sql: `-- Добро пожаловать в MYCSC!\n-- Подключение: ${connection.name}\n-- Хост: ${connection.host}:${connection.port}\n\n-- Создайте таблицу:\nCREATE TABLE IF NOT EXISTS users (\n  id INTEGER PRIMARY KEY AUTO_INCREMENT,\n  name VARCHAR(100) NOT NULL,\n  email VARCHAR(255) UNIQUE,\n  age INTEGER,\n  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n);\n\n-- Показать все таблицы:\nSHOW TABLES;\n`
      }]);
      setActiveTabId('1');
    }
  }, [connectionStorageKey]);
  const addNewTab = () => {
    const newTab: QueryTab = {
      id: String(tabCounter),
      name: `Query ${tabCounter}`,
      sql: '-- Новый запрос\n\n'
    };
    setQueryTabs([...queryTabs, newTab]);
    setActiveTabId(newTab.id);
    setTabCounter(tabCounter + 1);
  };

  const closeTab = (id: string) => {
    if (queryTabs.length <= 1) return;
    
    const newTabs = queryTabs.filter(t => t.id !== id);
    setQueryTabs(newTabs);
    
    if (activeTabId === id) {
      setActiveTabId(newTabs[newTabs.length - 1].id);
    }
  };

  const editorRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const savedSettings = localStorage.getItem('mycsc_settings');
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch {}
    }
    const savedHistory = localStorage.getItem('mycsc_query_history');
    if (savedHistory) {
      try {
        setQueryHistory(JSON.parse(savedHistory));
      } catch {}
    }
    const savedRelations = localStorage.getItem('mycsc_relations');
    if (savedRelations) {
      try {
        setRelations(JSON.parse(savedRelations));
      } catch {}
    }
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);
  useEffect(() => {
    localStorage.setItem('mycsc_query_history', JSON.stringify(queryHistory));
  }, [queryHistory]);
  useEffect(() => {
    localStorage.setItem('mycsc_relations', JSON.stringify(relations));
  }, [relations]);
  useEffect(() => {
    loadData();
  }, [currentDatabase]);

  const loadData = async () => {
    try {
      const tableNames = await dbAPI.getTables();
      const tablesData: TableInfo[] = await Promise.all(
        tableNames.map(async (name: string) => {
          const schema = await dbAPI.getTableSchema(name);
          const countResult = await dbAPI.query(`SELECT COUNT(*) as count FROM \`${name}\``);
          return {
            name,
            columns: schema?.columns || [],
            rowCount: countResult.rows?.[0]?.count || 0,
            indexes: schema?.indexes?.map((i: any) => i.name) || []
          };
        })
      );

      const databasesList = dbAPI.getDatabases();
      const dbs: Database[] = databasesList.map((db: any) => ({
        name: db.name,
        size: db.size,
        tables: db.tables,
        createdAt: new Date().toISOString()
      }));
      const viewsList = dbAPI.getViews?.() || [];
      const proceduresList = dbAPI.getProcedures?.() || [];
      const functionsList = dbAPI.getFunctions?.() || [];

      setDatabases(dbs);
      setTables(tablesData);
      setViews(viewsList);
      setProcedures(proceduresList);
      setFunctions(functionsList);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };
  const executeQuery = useCallback(async () => {
    if (!sql.trim()) {
      toast.warning('Пустой запрос', 'Введите SQL запрос для выполнения');
      return;
    }

    setIsLoading(true);
    const startTime = Date.now();
    const executeTime = new Date().toLocaleTimeString('ru-RU', { hour12: false });
    
    try {
      const queryResults = await dbAPI.queryMultiple(sql);
      const resultsArray = Array.isArray(queryResults) ? queryResults : [queryResults];
      const endTime = Date.now();
      const duration = endTime - startTime;
      const resultsWithQuery = resultsArray.map((r: any, idx: number) => {
        const queries = sql.split(';').map(q => q.trim()).filter(q => q.length > 0);
        const query = queries[idx] || sql;
        const commandMatch = query.match(/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE|SHOW|DESCRIBE)/i);
        return {
          ...r,
          query: query,
          command: commandMatch ? commandMatch[1].toUpperCase() : undefined
        };
      });
      
      setResults(resultsWithQuery);
      const totalRows = resultsArray.reduce((sum: number, r: any) => sum + (r.rowsAffected || r.rows?.length || 0), 0);
      const newLogEntry: QueryLogEntry = {
        id: logCounter,
        time: executeTime,
        query: sql.length > 100 ? sql.substring(0, 100) + '...' : sql.replace(/\n/g, ' ').trim(),
        message: `${totalRows} row(s) returned`,
        duration: duration / 1000,
        fetchTime: duration / 1000,
        success: true
      };
      setQueryLog(prev => [newLogEntry, ...prev].slice(0, 100));
      setLogCounter(prev => prev + 1);
      const historyEntry: HistoryEntry = {
        id: Date.now().toString(),
        query: sql,
        database: currentDatabase,
        executedAt: new Date().toISOString(),
        executionTime: duration,
        success: resultsArray.every(r => r.success),
        rowsAffected: totalRows
      };
      setQueryHistory(prev => [historyEntry, ...prev].slice(0, settings.maxHistoryItems));
      toast.success('Запрос выполнен', `${totalRows} строк • ${duration}мс`);
      
      await loadData();
    } catch (error: any) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      let errorLine: number | undefined;
      let errorPosition: number | undefined;
      let errorMessage = error.message || 'Неизвестная ошибка';
      const lineMatch = errorMessage.match(/line\s+(\d+)/i);
      const posMatch = errorMessage.match(/position\s+(\d+)|at\s+position\s+(\d+)|column\s+(\d+)/i);
      const nearMatch = errorMessage.match(/near\s+['"]([^'"]+)['"]/i);
      
      if (lineMatch) {
        errorLine = parseInt(lineMatch[1]);
      }
      if (posMatch) {
        errorPosition = parseInt(posMatch[1] || posMatch[2] || posMatch[3]);
      }
      if (nearMatch && !errorLine) {
        const nearText = nearMatch[1];
        const lines = sql.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(nearText)) {
            errorLine = i + 1;
            errorPosition = lines[i].indexOf(nearText) + 1;
            break;
          }
        }
      }
      const newLogEntry: QueryLogEntry = {
        id: logCounter,
        time: executeTime,
        query: sql.length > 100 ? sql.substring(0, 100) + '...' : sql.replace(/\n/g, ' ').trim(),
        message: `Error: ${errorMessage}`,
        duration: duration / 1000,
        fetchTime: 0,
        success: false,
        error: errorMessage,
        errorLine,
        errorPosition
      };
      setQueryLog(prev => [newLogEntry, ...prev].slice(0, 100));
      setLogCounter(prev => prev + 1);
      
      const historyEntry: HistoryEntry = {
        id: Date.now().toString(),
        query: sql,
        database: currentDatabase,
        executedAt: new Date().toISOString(),
        executionTime: duration,
        success: false,
        error: errorMessage
      };
      setQueryHistory(prev => [historyEntry, ...prev].slice(0, settings.maxHistoryItems));
      
      setResults([{
        success: false,
        error: errorMessage,
        errorLine,
        errorPosition,
        query: sql,
        executionTime: duration
      }]);
      const lineInfo = errorLine ? ` (строка ${errorLine})` : '';
      toast.error('Ошибка SQL' + lineInfo, errorMessage);
    }
    setIsLoading(false);
  }, [sql, dbAPI, currentDatabase, settings.maxHistoryItems, toast, logCounter]);
  const shortcutHandlers = {
    'F5': executeQuery,
    'Ctrl+Enter': executeQuery,
    'Ctrl+S': handleManualSave,
    'Ctrl+Shift+H': () => setShowHistory(true),
    'Ctrl+Shift+F': () => setShowSearch(true),
    'Ctrl+Shift+E': () => setShowExportModal(true),
    'Ctrl+Shift+B': () => setShowBackup(true),
    'Ctrl+Shift+R': () => setShowRelations(true),
    'Ctrl+Shift+D': () => setShowERDiagram(true),
    'Ctrl+Shift+S': () => setShowStats(true),
    'Ctrl+,': () => setShowSettings(true),
    'F1': () => setShowShortcuts(true),
    'F11': () => document.documentElement.requestFullscreen?.(),
    'Ctrl+T': addNewTab,
    'Ctrl+W': () => closeTab(activeTabId),
    'Escape': () => {
      setShowHistory(false);
      setShowSettings(false);
      setShowShortcuts(false);
      setShowStats(false);
      setShowSearch(false);
      setShowBackup(false);
      setShowRelations(false);
      setShowERDiagram(false);
    }
  };
  useKeyboardShortcuts(shortcutHandlers);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        executeQuery();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [executeQuery]);
  const selectDatabase = async (name: string) => {
    await dbAPI.query(`USE \`${name}\``);
    setCurrentDatabase(name);
  };

  const createDatabase = async (name: string) => {
    await dbAPI.query(`CREATE DATABASE \`${name}\``);
    await loadData();
  };

  const dropDatabase = async (name: string) => {
    await dbAPI.query(`DROP DATABASE \`${name}\``);
    await loadData();
  };
  const createTable = async (name: string, columns: Column[]) => {
    const columnsDef = columns.map(col => {
      let def = `\`${col.name}\` ${col.type}`;
      if (col.primaryKey) def += ' PRIMARY KEY';
      if (col.autoIncrement) def += ' AUTO_INCREMENT';
      if (!col.nullable) def += ' NOT NULL';
      if (col.unique && !col.primaryKey) def += ' UNIQUE';
      return def;
    }).join(',\n  ');

    await dbAPI.query(`CREATE TABLE \`${name}\` (\n  ${columnsDef}\n)`);
    await loadData();
  };

  const dropTable = async (name: string) => {
    await dbAPI.query(`DROP TABLE \`${name}\``);
    if (selectedTable === name) setSelectedTable(null);
    await loadData();
  };

  const selectTable = (name: string) => {
    setSelectedTable(name);
    setSql(`SELECT * FROM \`${name}\` LIMIT 100;`);
  };
  const handleCreateObject = async (
    name: string, 
    definition: string, 
    params?: string[], 
    returnType?: string
  ) => {
    let sql = '';
    const type = objectEditorModal.type;
    
    if (type === 'view') {
      sql = `CREATE VIEW \`${name}\` AS ${definition}`;
    } else if (type === 'procedure') {
      const paramsStr = params?.join(', ') || '';
      sql = `CREATE PROCEDURE \`${name}\`(${paramsStr}) BEGIN ${definition} END`;
    } else if (type === 'function') {
      const paramsStr = params?.join(', ') || '';
      sql = `CREATE FUNCTION \`${name}\`(${paramsStr}) RETURNS ${returnType} DETERMINISTIC BEGIN ${definition} END`;
    }
    
    try {
      await dbAPI.query(sql);
      await loadData();
    } catch (error) {
      console.error('Failed to create object:', error);
    }
  };

  const openObjectEditor = (type: 'view' | 'procedure' | 'function') => {
    setObjectEditorModal({ isOpen: true, type });
  };
  const handleLeftResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftPanelWidth;

    const onMouseMove = (e: MouseEvent) => {
      const newWidth = Math.min(Math.max(startWidth + e.clientX - startX, 200), 500);
      setLeftPanelWidth(newWidth);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleBottomResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = bottomPanelHeight;

    const onMouseMove = (e: MouseEvent) => {
      const newHeight = Math.min(Math.max(startHeight - (e.clientY - startY), 100), 500);
      setBottomPanelHeight(newHeight);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div className="main-workspace">
      {/* Top Toolbar */}
      <header className="workspace-header">
        <div className="header-left">
          <button className="back-btn" onClick={onDisconnect} title="Назад к подключениям">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
          </button>
          <div className="connection-info">
            <div className="connection-badge" style={{ backgroundColor: connection.color }}>
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path fill="white" d="M12 3C7.58 3 4 4.79 4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7c0-2.21-3.58-4-8-4z"/>
              </svg>
            </div>
            <span className="connection-name">{connection.name}</span>
            <span className="connection-host">{connection.host}:{connection.port}</span>
          </div>
        </div>

        <div className="header-center">
          <div className="toolbar-group">
            <button 
              className={`toolbar-btn execute-btn ${isLoading ? 'loading' : ''}`}
              onClick={executeQuery}
              disabled={isLoading}
              title={`${t('editor.execute')} (Ctrl+Enter)`}
            >
              {isLoading ? (
                <span className="spinner"></span>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path fill="currentColor" d="M8 5v14l11-7z"/>
                </svg>
              )}
              <span>{isLoading ? t('editor.executing') : t('editor.execute')}</span>
            </button>
            <button 
              className="toolbar-btn stop-btn" 
              onClick={() => {
                setIsLoading(false);
                toast.warning('Остановлено', 'Выполнение запроса прервано');
              }}
              disabled={!isLoading}
              title="Остановить выполнение"
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M6 6h12v12H6z"/>
              </svg>
            </button>
          </div>

          <div className="toolbar-divider"></div>

          <div className="toolbar-group">
            <button className="toolbar-btn" onClick={addNewTab} title={t('editor.newTab')}>
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
            </button>
            <button 
              className={`toolbar-btn ${isSaving ? 'saving' : ''}`} 
              onClick={handleManualSave} 
              title={`${t('common.save')} (Ctrl+S)${lastSavedAt ? ` • Сохранено в ${lastSavedAt}` : ''}`}
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
              </svg>
              {isSaving && <span style={{marginLeft: 4, fontSize: 10}}>...</span>}
            </button>
            <button className="toolbar-btn" onClick={() => {
              const blob = new Blob([sql], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `query_${Date.now()}.sql`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success('Сохранено', 'Файл экспортирован');
            }} title="Экспорт в файл .sql">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
              </svg>
            </button>
          </div>

          <div className="toolbar-divider"></div>

          <div className="toolbar-group">
            <button className="toolbar-btn" onClick={() => setShowExportModal(true)} title={`${t('common.export')}/${t('common.import')}`}>
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
              </svg>
            </button>
            <button className="toolbar-btn" onClick={() => setShowBackup(true)} title="Резервные копии">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M19.35 10.04C18.67 6.59 15.64 4 12 4c-1.48 0-2.85.43-4.01 1.17-.25.16-.5.34-.74.53C5.84 6.92 5 8.85 5 11c0 .34.03.67.08 1h-.01C3.38 12 2 13.38 2 15.07c0 1.65 1.38 3 3.07 3H19c2.21 0 4-1.79 4-4 0-2.05-1.53-3.76-3.56-3.97l-.09-.06z"/>
              </svg>
            </button>
            <button className="toolbar-btn" onClick={() => setShowHistory(true)} title={`${t('editor.history')} (Ctrl+Shift+H)`}>
              <svg viewBox="0 0 24 24" width="18" height="18">
                <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2"/>
                <polyline points="12,7 12,12 16,14" fill="none" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </button>
            <button className="toolbar-btn" onClick={() => setShowStats(true)} title={t('stats.title')}>
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
              </svg>
            </button>
            <button className="toolbar-btn" onClick={() => setShowSearch(true)} title="Глобальный поиск (Ctrl+Shift+F)">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" strokeWidth="2"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </button>
            <button className="toolbar-btn" onClick={() => setShowRelations(true)} title="Связи таблиц">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <rect x="2" y="4" width="6" height="6" rx="1" fill="currentColor"/>
                <rect x="16" y="4" width="6" height="6" rx="1" fill="currentColor"/>
                <rect x="16" y="14" width="6" height="6" rx="1" fill="currentColor"/>
                <path d="M8 7h4M12 7v10M12 17h4" fill="none" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </button>
            <button className="toolbar-btn er-diagram-btn" onClick={() => setShowERDiagram(true)} title="ER Диаграмма">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <rect x="2" y="2" width="8" height="6" rx="1" fill="var(--ctp-blue)"/>
                <rect x="14" y="2" width="8" height="6" rx="1" fill="var(--ctp-peach)"/>
                <rect x="2" y="16" width="8" height="6" rx="1" fill="var(--ctp-green)"/>
                <rect x="14" y="16" width="8" height="6" rx="1" fill="var(--ctp-mauve)"/>
                <path d="M10 5h4M18 8v3h-6v3M6 8v8" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              </svg>
            </button>
          </div>

          <div className="toolbar-divider"></div>

          <div className="toolbar-group">
            <button className="toolbar-btn" onClick={() => setShowSettings(true)} title="Настройки (Ctrl+,)">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
              </svg>
            </button>
            <button className="toolbar-btn" onClick={() => setShowShortcuts(true)} title="Горячие клавиши (F1)">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/>
                <line x1="6" y1="8" x2="6" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="10" y1="8" x2="10" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="14" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="18" y1="8" x2="18" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="6" y1="12" x2="18" y2="12" stroke="currentColor" strokeWidth="2"/>
                <line x1="8" y1="16" x2="16" y2="16" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="header-right">
          <div className="help-buttons">
            <button className="help-btn" onClick={() => setShowDocs(true)} title="Документация">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
              </svg>
              Документация
            </button>
          </div>
          
          <div className="db-selector">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M12 3C7.58 3 4 4.79 4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7c0-2.21-3.58-4-8-4z"/>
            </svg>
            <select 
              value={currentDatabase} 
              onChange={(e) => selectDatabase(e.target.value)}
            >
              {databases.map(db => (
                <option key={db.name} value={db.name}>{db.name}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="workspace-content">
        {/* Left Panel - Navigator */}
        <aside className="left-panel" style={{ width: leftPanelWidth }}>
          <div className="panel-tabs">
            <button 
              className={`panel-tab ${leftPanelTab === 'schemas' ? 'active' : ''}`}
              onClick={() => setLeftPanelTab('schemas')}
            >
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M12 3C7.58 3 4 4.79 4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7c0-2.21-3.58-4-8-4z"/>
              </svg>
              Схемы
            </button>
            <button 
              className={`panel-tab ${leftPanelTab === 'admin' ? 'active' : ''}`}
              onClick={() => setLeftPanelTab('admin')}
            >
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
              </svg>
              Админ
            </button>
          </div>

          <div className="panel-content">
            {leftPanelTab === 'schemas' ? (
              <>
                <DatabaseList
                  databases={databases}
                  currentDatabase={currentDatabase}
                  tables={tables}
                  views={views}
                  procedures={procedures}
                  functions={functions}
                  selectedTable={selectedTable}
                  onSelectDatabase={selectDatabase}
                  onSelectTable={selectTable}
                  onSelectView={(viewName) => {
                    const view = views.find(v => v.name === viewName);
                    if (view) {
                      setSql(`-- View: ${viewName}\n${view.definition}`);
                    }
                  }}
                  onSelectProcedure={(procName) => {
                    const proc = procedures.find(p => p.name === procName);
                    if (proc) {
                      setSql(`-- Procedure: ${procName}(${proc.parameters.join(', ')})\n${proc.definition}`);
                    }
                  }}
                  onSelectFunction={(funcName) => {
                    const func = functions.find(f => f.name === funcName);
                    if (func) {
                      setSql(`-- Function: ${funcName}(${func.parameters.join(', ')}) RETURNS ${func.returnType}\n${func.definition}`);
                    }
                  }}
                  onCreateView={() => openObjectEditor('view')}
                  onCreateProcedure={() => openObjectEditor('procedure')}
                  onCreateFunction={() => openObjectEditor('function')}
                  onCreateDatabase={createDatabase}
                  onDropDatabase={dropDatabase}
                />
                
                <div className="tables-section">
                  <TableManager
                    tables={tables}
                    selectedTable={selectedTable}
                    onSelectTable={selectTable}
                    onCreateTable={createTable}
                    onDropTable={dropTable}
                    onAlterTable={() => {}}
                  />
                </div>
              </>
            ) : (
              <AdminPanel
                connection={connection}
                currentDatabase={currentDatabase}
                dbAPI={dbAPI}
                onShowStats={() => setShowStats(true)}
                onShowExport={() => setShowExportModal(true)}
              />
            )}
          </div>
        </aside>

        {/* Resize Handle */}
        <div className="resize-handle vertical" onMouseDown={handleLeftResize}></div>

        {/* Main Area */}
        <main className="main-area">
          {/* Query Tabs */}
          <div className="query-tabs">
            {queryTabs.map(tab => (
              <div 
                key={tab.id}
                className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
                onClick={() => setActiveTabId(tab.id)}
              >
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 9h-2v2H9v-2H7v-2h2V7h2v2h2v2z"/>
                </svg>
                {tab.name}
                {queryTabs.length > 1 && (
                  <button 
                    className="tab-close"
                    onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                  >×</button>
                )}
              </div>
            ))}
            <button className="new-tab-btn" onClick={addNewTab} title="Новая вкладка">
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
            </button>
          </div>

          {/* Editor Area */}
          <div className="editor-area">
            {connection.id.startsWith('shared_') ? (
              <CollaborativeEditor
                value={sql}
                onChange={setSql}
                onExecute={executeQuery}
                placeholder="Введите SQL запрос..."
                databaseId={connection.id.replace('shared_', '')}
                username={username || connection.username}
                serverUrl={apiUrl}
                isSharedDatabase={true}
              />
            ) : (
              <SQLEditor
                value={sql}
                onChange={setSql}
                onExecute={executeQuery}
                placeholder="Введите SQL запрос..."
                autoSave={settings.autoSave}
                autoSaveInterval={30000}
                onAutoSave={handleAutoSave}
              />
            )}
          </div>

          {/* Resize Handle */}
          {showOutput && (
            <div className="resize-handle horizontal" onMouseDown={handleBottomResize}></div>
          )}

          {/* Output Panel */}
          {showOutput && (
            <div className="output-panel" style={{ height: bottomPanelHeight }}>
              <div className="output-tabs">
                <button className={`output-tab ${activeTab === 'query' ? 'active' : ''}`} onClick={() => setActiveTab('query')}>
                  <svg viewBox="0 0 24 24" width="14" height="14">
                    <path fill="currentColor" d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
                  </svg>
                  Результат
                  {results.length > 0 && <span className="tab-badge">{results.length}</span>}
                </button>
                <button className={`output-tab ${activeTab === 'structure' ? 'active' : ''}`} onClick={() => setActiveTab('structure')}>
                  <svg viewBox="0 0 24 24" width="14" height="14">
                    <path fill="currentColor" d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
                  </svg>
                  Журнал
                  {queryLog.length > 0 && <span className="tab-badge">{queryLog.length}</span>}
                </button>
                <button className="output-toggle" onClick={() => setShowOutput(false)} title="Скрыть панель">
                  <svg viewBox="0 0 24 24" width="16" height="16">
                    <path fill="currentColor" d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
                  </svg>
                </button>
              </div>

              <div className="output-content">
                {activeTab === 'query' ? (
                  results.length === 0 ? (
                    <div className="output-empty">
                      <svg viewBox="0 0 24 24" width="48" height="48">
                        <path fill="currentColor" opacity="0.3" d="M3 3h18v18H3V3zm2 4v12h14V7H5z"/>
                      </svg>
                      <p>Результаты запроса появятся здесь</p>
                      <small>Нажмите Ctrl+Enter для выполнения</small>
                    </div>
                  ) : (
                    <ResultsTable 
                      results={results} 
                      onCopySuccess={() => toast.success('Скопировано', 'Данные скопированы в буфер обмена')}
                    />
                  )
                ) : (
                  <QueryLogTable 
                    log={queryLog} 
                    onClearLog={() => setQueryLog([])}
                    onExecuteQuery={(query) => setSql(query)}
                  />
                )}
              </div>
            </div>
          )}

          {/* Show Output Button */}
          {!showOutput && (
            <button className="show-output-btn" onClick={() => setShowOutput(true)}>
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/>
              </svg>
              Показать результаты
            </button>
          )}
        </main>
      </div>

      {/* Status Bar */}
      <footer className="status-bar">
        <div className="status-left">
          <span className="status-item">
            <span className="status-dot connected"></span>
            Подключено к {connection.host}
          </span>
          <span className="status-item">База: {currentDatabase}</span>
        </div>
        <div className="status-right">
          <span className="status-item">Строк: {sql.split('\n').length}</span>
          <span className="status-item">Символов: {sql.length}</span>
          {results.length > 0 && results[results.length - 1].executionTime !== undefined && (
            <span className="status-item">Время: {results[results.length - 1].executionTime}мс</span>
          )}
        </div>
      </footer>

      {/* Export Modal */}
      {showExportModal && (
        <ExportImportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          tables={tables.map(t => t.name)}
          currentTable={selectedTable}
          onExport={async (options) => {
            const { format, tables: selectedTables, includeSchema, includeData, prettyPrint } = options;
            const lines: string[] = [];
            const date = new Date().toISOString();
            if (format === 'sql') {
              lines.push(`-- ========================================`);
              lines.push(`-- MYCSC Database Export`);
              lines.push(`-- Database: ${currentDatabase}`);
              lines.push(`-- Date: ${date}`);
              lines.push(`-- ========================================`);
              lines.push('');
            }

            for (const tableName of selectedTables) {
              const tableInfo = tables.find(t => t.name === tableName);
              const schema = await dbAPI.getTableSchema(tableName);
              const dataResult = includeData ? await dbAPI.query(`SELECT * FROM \`${tableName}\``) : null;
              const rows = dataResult?.rows || [];

              if (format === 'sql') {
                if (includeSchema && schema) {
                  lines.push(`-- Table: ${tableName}`);
                  lines.push(`DROP TABLE IF EXISTS \`${tableName}\`;`);
                  const colDefs = schema.columns.map((col: any) => {
                    let def = `  \`${col.name}\` ${col.type}`;
                    if (col.length) def += `(${col.length})`;
                    if (!col.nullable) def += ' NOT NULL';
                    if (col.autoIncrement) def += ' AUTO_INCREMENT';
                    if (col.primaryKey) def += ' PRIMARY KEY';
                    if (col.defaultValue !== undefined) def += ` DEFAULT ${JSON.stringify(col.defaultValue)}`;
                    return def;
                  });
                  lines.push(`CREATE TABLE \`${tableName}\` (`);
                  lines.push(colDefs.join(',\n'));
                  lines.push(`);`);
                  lines.push('');
                }
                if (includeData && rows.length > 0) {
                  lines.push(`-- Data for ${tableName}`);
                  const columns = Object.keys(rows[0]);
                  for (const row of rows) {
                    const values = columns.map(c => {
                      const v = row[c];
                      if (v === null || v === undefined) return 'NULL';
                      if (typeof v === 'number') return String(v);
                      if (typeof v === 'boolean') return v ? '1' : '0';
                      return `'${String(v).replace(/'/g, "''")}'`;
                    });
                    lines.push(`INSERT INTO \`${tableName}\` (\`${columns.join('`, `')}\`) VALUES (${values.join(', ')});`);
                  }
                  lines.push('');
                }
              } else if (format === 'json') {
                const tableData: any = { tableName };
                if (includeSchema && schema) tableData.schema = schema;
                if (includeData) tableData.data = rows;
                lines.push(prettyPrint ? JSON.stringify(tableData, null, 2) : JSON.stringify(tableData));
              } else if (format === 'csv') {
                if (rows.length > 0) {
                  const columns = Object.keys(rows[0]);
                  lines.push(`# Table: ${tableName}`);
                  lines.push(columns.join(','));
                  for (const row of rows) {
                    const values = columns.map(c => {
                      const v = row[c];
                      if (v === null || v === undefined) return '';
                      const str = String(v);
                      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                        return `"${str.replace(/"/g, '""')}"`;
                      }
                      return str;
                    });
                    lines.push(values.join(','));
                  }
                  lines.push('');
                }
              } else if (format === 'xml') {
                lines.push(`<table name="${tableName}">`);
                if (includeSchema && schema) {
                  lines.push('  <schema>');
                  for (const col of schema.columns) {
                    lines.push(`    <column name="${col.name}" type="${col.type}"${col.primaryKey ? ' primaryKey="true"' : ''}/>`);
                  }
                  lines.push('  </schema>');
                }
                if (includeData) {
                  lines.push('  <data>');
                  for (const row of rows) {
                    lines.push('    <row>');
                    for (const [key, val] of Object.entries(row)) {
                      const escaped = String(val ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                      lines.push(`      <${key}>${escaped}</${key}>`);
                    }
                    lines.push('    </row>');
                  }
                  lines.push('  </data>');
                }
                lines.push('</table>');
              }
            }
            if (format === 'json' && selectedTables.length > 1) {
              return `[${lines.join(',\n')}]`;
            }
            if (format === 'xml') {
              return `<?xml version="1.0" encoding="UTF-8"?>\n<database name="${currentDatabase}">\n${lines.join('\n')}\n</database>`;
            }
            
            return lines.join('\n');
          }}
          onImport={async (format, data, tableName) => {
            if (format === 'sql') {
              await dbAPI.queryMultiple(data);
            } else if (format === 'json') {
              const parsed = JSON.parse(data);
              const tableData = Array.isArray(parsed) ? parsed : [parsed];
              for (const table of tableData) {
                const rows = table.data || table;
                if (Array.isArray(rows) && rows.length > 0) {
                  const targetTable = table.tableName || tableName;
                  for (const row of rows) {
                    const columns = Object.keys(row);
                    const values = columns.map(c => {
                      const v = row[c];
                      if (v === null) return 'NULL';
                      if (typeof v === 'number') return String(v);
                      return `'${String(v).replace(/'/g, "''")}'`;
                    });
                    await dbAPI.query(`INSERT INTO \`${targetTable}\` (\`${columns.join('`, `')}\`) VALUES (${values.join(', ')})`);
                  }
                }
              }
            } else if (format === 'csv') {
              const lines = data.split('\n').filter(l => l.trim() && !l.startsWith('#'));
              if (lines.length < 2) return;
              const headers = lines[0].split(',').map(h => h.trim());
              for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim());
                const sqlValues = values.map(v => {
                  if (!v || v === 'NULL') return 'NULL';
                  if (/^\d+(\.\d+)?$/.test(v)) return v;
                  return `'${v.replace(/'/g, "''")}'`;
                });
                await dbAPI.query(`INSERT INTO \`${tableName}\` (\`${headers.join('`, `')}\`) VALUES (${sqlValues.join(', ')})`);
              }
            }
            await loadData();
          }}
        />
      )}

      {/* Query History Modal */}
      {showHistory && (
        <QueryHistory
          history={queryHistory}
          onExecuteQuery={(query) => {
            setSql(query);
            setShowHistory(false);
          }}
          onClearHistory={() => setQueryHistory([])}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={(newSettings) => {
            setSettings(newSettings);
            localStorage.setItem('mycsc_settings', JSON.stringify(newSettings));
            if (newSettings.language !== language) {
              setLanguage(newSettings.language);
            }
          }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <KeyboardShortcuts onClose={() => setShowShortcuts(false)} />
      )}

      {/* Database Stats Modal */}
      {showStats && (
        <DatabaseStats
          database={currentDatabase}
          tables={tables.map(t => ({
            name: t.name,
            rowCount: t.rowCount,
            columnCount: t.columns.length,
            indexCount: t.indexes.length,
            sizeEstimate: `${Math.round(t.rowCount * t.columns.length * 50 / 1024)} KB`
          }))}
          onClose={() => setShowStats(false)}
          onRefresh={loadData}
        />
      )}

      {/* Global Search Modal */}
      {showSearch && (
        <GlobalSearch
          tables={tables.map(t => ({
            name: t.name,
            columns: t.columns.map(c => c.name),
            rows: []
          }))}
          onClose={() => setShowSearch(false)}
          onNavigateToResult={(table, rowIndex) => {
            setSelectedTable(table);
            setSql(`SELECT * FROM \`${table}\` LIMIT 100 OFFSET ${Math.max(0, rowIndex - 50)};`);
            setShowSearch(false);
            executeQuery();
          }}
          dbAPI={dbAPI}
        />
      )}

      {/* Relations Modal */}
      {showRelations && (
        <RelationsModal
          isOpen={showRelations}
          onClose={() => setShowRelations(false)}
          tables={tables.map(t => ({
            name: t.name,
            columns: t.columns.map(c => ({
              name: c.name,
              type: c.type,
              primaryKey: c.primaryKey
            }))
          }))}
          relations={relations}
          onCreateRelation={(relation) => {
            const newRelation = {
              ...relation,
              id: `rel_${Date.now()}`
            };
            setRelations([...relations, newRelation]);
            const sql = `ALTER TABLE \`${relation.sourceTable}\` ADD CONSTRAINT \`${relation.name}\` FOREIGN KEY (\`${relation.sourceColumn}\`) REFERENCES \`${relation.targetTable}\`(\`${relation.targetColumn}\`) ON DELETE ${relation.onDelete} ON UPDATE ${relation.onUpdate};`;
            dbAPI.query(sql).then(() => loadData());
          }}
          onDeleteRelation={(id) => {
            const relation = relations.find(r => r.id === id);
            if (relation) {
              setRelations(relations.filter(r => r.id !== id));
              dbAPI.query(`ALTER TABLE \`${relation.sourceTable}\` DROP FOREIGN KEY \`${relation.name}\`;`);
            }
          }}
        />
      )}

      {/* ER Diagram */}
      {showERDiagram && (
        <ERDiagram
          isOpen={showERDiagram}
          onClose={() => setShowERDiagram(false)}
          tables={tables.map(t => ({
            name: t.name,
            columns: t.columns.map(c => ({
              name: c.name,
              type: c.type,
              primaryKey: c.primaryKey,
              nullable: c.nullable,
              unique: c.unique
            }))
          }))}
          relations={relations.map(r => ({
            id: r.id,
            sourceTable: r.sourceTable,
            sourceColumn: r.sourceColumn,
            targetTable: r.targetTable,
            targetColumn: r.targetColumn,
            type: r.type === 'ONE_TO_ONE' ? '1:1' : r.type === 'ONE_TO_MANY' ? '1:N' : 'N:M'
          }))}
          onCreateRelation={(rel) => {
            const newRelation = {
              id: `rel_${Date.now()}`,
              name: `fk_${rel.sourceTable}_${rel.targetTable}`,
              type: rel.type === '1:1' ? 'ONE_TO_ONE' as const : rel.type === '1:N' ? 'ONE_TO_MANY' as const : 'MANY_TO_MANY' as const,
              sourceTable: rel.sourceTable,
              sourceColumn: rel.sourceColumn,
              targetTable: rel.targetTable,
              targetColumn: rel.targetColumn,
              onDelete: 'CASCADE' as const,
              onUpdate: 'CASCADE' as const
            };
            setRelations([...relations, newRelation]);
          }}
          onDeleteRelation={(id) => {
            setRelations(relations.filter(r => r.id !== id));
          }}
          dbAPI={dbAPI}
        />
      )}

      {/* Documentation */}
      {showDocs && (
        <Documentation onClose={() => setShowDocs(false)} />
      )}

      {/* Backup/Restore */}
      <BackupRestore
        isOpen={showBackup}
        onClose={() => setShowBackup(false)}
        currentDatabase={currentDatabase}
        onRestore={() => {
          setShowBackup(false);
          loadData();
          toast.success('Восстановлено', 'Данные восстановлены из резервной копии');
        }}
      />

      {/* Object Editor Modal */}
      <ObjectEditorModal
        isOpen={objectEditorModal.isOpen}
        type={objectEditorModal.type}
        onClose={() => setObjectEditorModal({ ...objectEditorModal, isOpen: false })}
        onSave={handleCreateObject}
      />

      <style>{`
        .main-workspace {
          display: flex;
          flex-direction: column;
          height: 100vh;
          width: 100vw;
          background: var(--bg-primary);
          color: var(--text-primary);
          overflow: hidden;
        }

        /* Header */
        .workspace-header {
          display: flex;
          align-items: center;
          padding: 8px 16px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border);
          gap: 16px;
          min-height: 56px;
          flex-shrink: 0;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .back-btn {
          padding: 8px;
          background: transparent;
          border: none;
          border-radius: 6px;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s;
        }

        .back-btn:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .connection-info {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .connection-badge {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .connection-name {
          font-weight: 600;
          color: var(--text-primary);
        }

        .connection-host {
          font-size: 12px;
          color: var(--text-muted);
        }

        .header-center {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .toolbar-group {
          display: flex;
          gap: 4px;
        }

        .toolbar-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: transparent;
          border: none;
          border-radius: 6px;
          color: var(--text-secondary);
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .toolbar-btn:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .toolbar-btn.execute-btn {
          background: var(--ctp-green);
          color: var(--bg-primary);
        }

        .toolbar-btn.execute-btn:hover {
          background: var(--ctp-teal);
        }

        .toolbar-btn.stop-btn {
          color: var(--ctp-red);
        }

        .toolbar-btn.stop-btn:hover {
          background: color-mix(in srgb, var(--ctp-red) 20%, transparent);
        }

        .toolbar-btn.stop-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .toolbar-btn.loading {
          opacity: 0.7;
          pointer-events: none;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid currentColor;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .toolbar-divider {
          width: 1px;
          height: 24px;
          background: var(--border);
          margin: 0 8px;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .help-buttons {
          display: flex;
          gap: 4px;
        }

        .help-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: transparent;
          border: 1px solid var(--ctp-surface1);
          border-radius: 6px;
          color: var(--text-secondary);
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
        }

        .help-btn:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
          border-color: var(--accent);
        }

        .help-btn svg {
          color: var(--accent);
        }

        .db-selector {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: var(--bg-tertiary);
          border-radius: 6px;
        }

        .db-selector svg {
          color: var(--accent);
        }

        .db-selector select {
          background: transparent;
          border: none;
          color: var(--text-primary);
          font-size: 13px;
          cursor: pointer;
          outline: none;
        }

        .db-selector select option {
          background: var(--bg-tertiary);
        }

        /* Content */
        .workspace-content {
          flex: 1;
          display: flex;
          overflow: hidden;
          min-height: 0;
        }

        /* Left Panel */
        .left-panel {
          display: flex;
          flex-direction: column;
          background: var(--bg-secondary);
          border-right: 1px solid var(--border);
          overflow: hidden;
          flex-shrink: 0;
          min-width: 200px;
        }

        .panel-tabs {
          display: flex;
          background: var(--bg-primary);
          border-bottom: 1px solid var(--border);
        }

        .panel-tab {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .panel-tab:hover {
          color: var(--text-secondary);
        }

        .panel-tab.active {
          background: var(--bg-secondary);
          color: var(--text-primary);
        }

        .panel-content {
          flex: 1;
          overflow-y: auto;
        }

        .tables-section {
          border-top: 1px solid var(--border);
        }

        /* Resize Handle */
        .resize-handle {
          background: var(--border);
          transition: background 0.2s;
        }

        .resize-handle:hover {
          background: var(--accent);
        }

        .resize-handle.vertical {
          width: 4px;
          cursor: col-resize;
        }

        .resize-handle.horizontal {
          height: 4px;
          cursor: row-resize;
        }

        /* Main Area */
        .main-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        /* Query Tabs */
        .query-tabs {
          display: flex;
          align-items: center;
          padding: 0 8px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border);
        }

        .tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 16px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 13px;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
        }

        .tab.active {
          color: var(--text-primary);
          background: var(--bg-primary);
          border-bottom-color: var(--accent);
        }

        .tab-close {
          padding: 0 4px;
          background: transparent;
          border: none;
          color: inherit;
          font-size: 16px;
          cursor: pointer;
          opacity: 0;
        }

        .tab:hover .tab-close {
          opacity: 1;
        }

        .new-tab-btn {
          padding: 8px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          border-radius: 4px;
        }

        .new-tab-btn:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        /* Editor */
        .editor-area {
          flex: 1;
          display: flex;
          overflow: hidden;
          min-height: 100px;
        }

        .editor-wrapper {
          height: 100%;
          display: flex;
        }

        .line-numbers {
          padding: 12px 8px;
          background: var(--bg-secondary);
          text-align: right;
          user-select: none;
          border-right: 1px solid var(--border);
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 13px;
          line-height: 1.6;
          color: var(--ctp-surface1);
          min-width: 40px;
        }

        .line-numbers span {
          display: block;
        }

        .sql-editor {
          flex: 1;
          padding: 12px;
          background: var(--bg-primary);
          border: none;
          outline: none;
          color: var(--text-primary);
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 13px;
          line-height: 1.6;
          resize: none;
        }

        .sql-editor::placeholder {
          color: var(--ctp-surface1);
        }

        /* Output Panel */
        .output-panel {
          display: flex;
          flex-direction: column;
          background: var(--bg-secondary);
          border-top: 1px solid var(--border);
        }

        .output-tabs {
          display: flex;
          align-items: center;
          padding: 0 8px;
          border-bottom: 1px solid var(--border);
        }

        .output-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 12px;
          cursor: pointer;
        }

        .output-tab.active {
          color: var(--text-primary);
        }

        .tab-badge {
          padding: 2px 6px;
          background: var(--accent);
          color: var(--bg-primary);
          border-radius: 10px;
          font-size: 10px;
          font-weight: 600;
        }

        .output-toggle {
          margin-left: auto;
          padding: 6px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          border-radius: 4px;
        }

        .output-toggle:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .output-content {
          flex: 1;
          overflow: auto;
        }

        .output-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--ctp-surface1);
        }

        .output-empty p {
          margin: 16px 0 4px;
          color: var(--text-muted);
        }

        .output-empty small {
          color: var(--ctp-surface1);
          font-size: 12px;
        }

        .show-output-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px;
          background: var(--bg-tertiary);
          border: none;
          color: var(--text-secondary);
          font-size: 12px;
          cursor: pointer;
        }

        .show-output-btn:hover {
          background: var(--ctp-surface1);
        }

        /* Status Bar */
        .status-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 4px 16px;
          background: var(--bg-secondary);
          border-top: 1px solid var(--border);
          font-size: 12px;
          color: var(--text-muted);
        }

        .status-left, .status-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .status-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--text-muted);
        }

        .status-dot.connected {
          background: var(--ctp-green);
        }

        /* Admin Panel - MySQL Workbench Style */
        .admin-panel {
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          overflow-y: auto;
        }

        .admin-section {
          margin-bottom: 4px;
        }

        .admin-section-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 6px 8px;
          margin: 0;
          background: var(--bg-tertiary);
          border-radius: 4px;
        }

        .admin-section-title .instance-icon {
          margin-left: auto;
          color: var(--accent);
        }

        .admin-list {
          display: flex;
          flex-direction: column;
          gap: 1px;
          margin-top: 2px;
        }

        .admin-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          font-size: 13px;
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.15s;
          border-radius: 4px;
        }

        .admin-item:hover {
          background: var(--bg-tertiary);
        }

        .admin-item svg {
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .admin-item:hover svg {
          color: var(--accent);
        }

        .admin-info-section {
          margin-top: auto;
          padding-top: 12px;
          border-top: 1px solid var(--border);
        }

        .admin-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 6px 8px;
          font-size: 12px;
          border-radius: 4px;
        }

        .info-row:hover {
          background: var(--bg-tertiary);
        }

        .info-row .label {
          color: var(--text-muted);
        }

        .info-row .value {
          color: var(--text-primary);
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
        }
      `}</style>
    </div>
  );
};
const QueryLogTable: React.FC<{ 
  log: QueryLogEntry[], 
  onClearLog: () => void,
  onExecuteQuery: (query: string) => void 
}> = ({ log, onClearLog, onExecuteQuery }) => {
  return (
    <div className="query-log-wrapper">
      <div className="query-log-toolbar">
        <span className="log-count">{log.length} запросов</span>
        <button className="clear-log-btn" onClick={onClearLog} title="Очистить журнал">
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path fill="currentColor" d="M19 4h-3.5l-1-1h-5l-1 1H5v2h14V4zM6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12z"/>
          </svg>
          Очистить
        </button>
      </div>
      
      <div className="query-log-table-scroll">
        <table className="query-log-table">
          <thead>
            <tr>
              <th style={{ width: 30 }}>#</th>
              <th style={{ width: 80 }}>Time</th>
              <th>Action</th>
              <th style={{ width: 200 }}>Message</th>
              <th style={{ width: 120 }}>Duration / Fetch</th>
            </tr>
          </thead>
          <tbody>
            {log.length === 0 ? (
              <tr>
                <td colSpan={5} className="log-empty">
                  Журнал запросов пуст
                </td>
              </tr>
            ) : (
              log.map(entry => (
                <tr 
                  key={entry.id} 
                  className={entry.success ? 'log-success' : 'log-error'}
                  onClick={() => onExecuteQuery(entry.query)}
                  title="Нажмите чтобы вставить запрос"
                >
                  <td className="log-id">
                    <span className={`log-status ${entry.success ? 'success' : 'error'}`}>
                      {entry.success ? '●' : '●'}
                    </span>
                    {entry.id}
                  </td>
                  <td className="log-time">{entry.time}</td>
                  <td className="log-query">
                    <code>{entry.query}</code>
                  </td>
                  <td className={`log-message ${entry.success ? '' : 'error-message'}`}>
                    {entry.message}
                    {entry.errorLine && (
                      <span className="error-location"> (line {entry.errorLine})</span>
                    )}
                  </td>
                  <td className="log-duration">
                    {entry.duration.toFixed(3)} sec / {entry.fetchTime.toFixed(3)} sec
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        .query-log-wrapper {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .query-log-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 12px;
          background: var(--bg-tertiary);
          border-bottom: 1px solid var(--border);
        }

        .log-count {
          font-size: 12px;
          color: var(--text-muted);
        }

        .clear-log-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 4px;
          color: var(--text-secondary);
          font-size: 11px;
          cursor: pointer;
        }

        .clear-log-btn:hover {
          background: var(--bg-secondary);
          color: var(--ctp-red);
          border-color: var(--ctp-red);
        }

        .query-log-table-scroll {
          flex: 1;
          overflow: auto;
        }

        .query-log-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }

        .query-log-table th {
          position: sticky;
          top: 0;
          background: var(--bg-secondary);
          padding: 8px 12px;
          text-align: left;
          font-weight: 600;
          color: var(--text-secondary);
          border-bottom: 1px solid var(--border);
          white-space: nowrap;
        }

        .query-log-table td {
          padding: 6px 12px;
          border-bottom: 1px solid var(--border);
          vertical-align: middle;
        }

        .query-log-table tr {
          cursor: pointer;
          transition: background 0.15s;
        }

        .query-log-table tr:hover {
          background: var(--bg-tertiary);
        }

        .query-log-table tr.log-error {
          background: color-mix(in srgb, var(--ctp-red) 5%, transparent);
        }

        .query-log-table tr.log-error:hover {
          background: color-mix(in srgb, var(--ctp-red) 10%, transparent);
        }

        .log-id {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--text-muted);
        }

        .log-status {
          font-size: 8px;
        }

        .log-status.success {
          color: var(--ctp-green);
        }

        .log-status.error {
          color: var(--ctp-red);
        }

        .log-time {
          color: var(--text-muted);
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
        }

        .log-query {
          max-width: 400px;
        }

        .log-query code {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--ctp-blue);
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
        }

        .log-message {
          color: var(--ctp-green);
          font-size: 11px;
        }

        .log-message.error-message {
          color: var(--ctp-red);
        }

        .error-location {
          color: var(--ctp-yellow);
          font-weight: 500;
        }

        .log-duration {
          color: var(--text-muted);
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          white-space: nowrap;
        }

        .log-empty {
          text-align: center;
          padding: 40px !important;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
};
const ResultsTable: React.FC<{ results: QueryResult[], onCopySuccess?: () => void }> = ({ results, onCopySuccess }) => {
  const [activeResult, setActiveResult] = useState(0);
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const copyMenuRef = useRef<HTMLDivElement>(null);
  const result = results[activeResult];
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (copyMenuRef.current && !copyMenuRef.current.contains(e.target as Node)) {
        setShowCopyMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopy = async (format: 'json' | 'csv' | 'sql' | 'markdown' | 'tsv' | 'html') => {
    if (result?.rows && result?.columns) {
      const { copyResultsAs, copyToClipboard } = await import('../utils/copyResults');
      const text = copyResultsAs(result.rows, result.columns, format);
      const success = await copyToClipboard(text);
      if (success && onCopySuccess) {
        onCopySuccess();
      }
    }
    setShowCopyMenu(false);
  };

  if (!result) return null;

  if (!result.success) {
    const queryLines = (result as any).query?.split('\n') || [];
    const errorLine = (result as any).errorLine;
    const errorPosition = (result as any).errorPosition;
    
    return (
      <div className="result-error-wrapper">
        <div className="result-error">
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path fill="var(--ctp-red)" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <div className="error-content">
            <h4>Ошибка выполнения SQL</h4>
            <div className="error-message">{result.error}</div>
            {errorLine && (
              <div className="error-location">
                <span className="error-badge">Строка {errorLine}</span>
                {errorPosition && <span className="error-badge">Позиция {errorPosition}</span>}
              </div>
            )}
          </div>
        </div>
        
        {queryLines.length > 0 && (
          <div className="error-query-preview">
            <div className="error-query-header">SQL запрос с ошибкой:</div>
            <pre className="error-query-code">
              {queryLines.map((line: string, idx: number) => {
                const lineNum = idx + 1;
                const isErrorLine = errorLine === lineNum;
                return (
                  <div key={idx} className={`code-line ${isErrorLine ? 'error-line' : ''}`}>
                    <span className="line-number">{lineNum}</span>
                    <span className="line-content">{line || ' '}</span>
                    {isErrorLine && <span className="error-indicator">← ошибка здесь</span>}
                  </div>
                );
              })}
            </pre>
          </div>
        )}
        
        <style>{`
          .result-error-wrapper {
            padding: 12px;
            height: 100%;
            overflow: auto;
          }
          
          .result-error {
            display: flex;
            align-items: flex-start;
            gap: 16px;
            padding: 16px;
            background: color-mix(in srgb, var(--ctp-red) 10%, transparent);
            border-left: 3px solid var(--ctp-red);
            border-radius: 0 8px 8px 0;
            margin-bottom: 12px;
          }
          
          .error-content h4 {
            color: var(--ctp-red);
            margin-bottom: 8px;
            font-size: 14px;
          }
          
          .error-message {
            color: var(--text-primary);
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            margin-bottom: 8px;
            word-break: break-word;
          }
          
          .error-location {
            display: flex;
            gap: 8px;
          }
          
          .error-badge {
            display: inline-block;
            padding: 2px 8px;
            background: var(--ctp-red);
            color: white;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
          }
          
          .error-query-preview {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 8px;
            overflow: hidden;
          }
          
          .error-query-header {
            padding: 8px 12px;
            background: var(--bg-tertiary);
            color: var(--text-secondary);
            font-size: 12px;
            font-weight: 600;
            border-bottom: 1px solid var(--border);
          }
          
          .error-query-code {
            margin: 0;
            padding: 8px 0;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            max-height: 200px;
            overflow: auto;
          }
          
          .code-line {
            display: flex;
            align-items: center;
            padding: 2px 12px;
            line-height: 20px;
          }
          
          .code-line.error-line {
            background: color-mix(in srgb, var(--ctp-red) 20%, transparent);
          }
          
          .line-number {
            width: 30px;
            color: var(--text-muted);
            text-align: right;
            margin-right: 12px;
            user-select: none;
          }
          
          .line-content {
            flex: 1;
            color: var(--text-primary);
            white-space: pre;
          }
          
          .error-line .line-number {
            color: var(--ctp-red);
            font-weight: 600;
          }
          
          .error-indicator {
            color: var(--ctp-red);
            font-size: 11px;
            font-weight: 600;
            margin-left: 12px;
            animation: blink 1s infinite;
          }
          
          @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0.5; }
          }
        `}</style>
      </div>
    );
  }

  if (result.rows && result.rows.length > 0) {
    const columns = result.columns || Object.keys(result.rows[0]);
    const DataChartComponent = React.lazy(() => import('./DataChart').then(m => ({ default: m.DataChart })));
    
    return (
      <div className="results-wrapper">
        {/* Results Toolbar */}
        <div className="results-toolbar-inner">
          <div className="view-toggle">
            <button 
              className={viewMode === 'table' ? 'active' : ''}
              onClick={() => setViewMode('table')}
            >
              📋 Таблица
            </button>
            <button 
              className={viewMode === 'chart' ? 'active' : ''}
              onClick={() => setViewMode('chart')}
            >
              📊 График
            </button>
          </div>

          <div style={{ flex: 1 }} />

          {/* Copy Menu */}
          <div className="copy-menu" ref={copyMenuRef} style={{ position: 'relative' }}>
            <button 
              className="copy-btn"
              onClick={() => setShowCopyMenu(!showCopyMenu)}
            >
              📋 Копировать ▾
            </button>
            
            {showCopyMenu && (
              <div className="copy-dropdown" style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 4,
                minWidth: 140,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                zIndex: 100,
                overflow: 'hidden'
              }}>
                <button onClick={() => handleCopy('json')} style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: 'var(--text-primary)', textAlign: 'left', cursor: 'pointer' }}>JSON</button>
                <button onClick={() => handleCopy('csv')} style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: 'var(--text-primary)', textAlign: 'left', cursor: 'pointer' }}>CSV</button>
                <button onClick={() => handleCopy('sql')} style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: 'var(--text-primary)', textAlign: 'left', cursor: 'pointer' }}>SQL INSERT</button>
                <button onClick={() => handleCopy('markdown')} style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: 'var(--text-primary)', textAlign: 'left', cursor: 'pointer' }}>Markdown</button>
                <button onClick={() => handleCopy('tsv')} style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: 'var(--text-primary)', textAlign: 'left', cursor: 'pointer' }}>TSV</button>
                <button onClick={() => handleCopy('html')} style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: 'var(--text-primary)', textAlign: 'left', cursor: 'pointer' }}>HTML</button>
              </div>
            )}
          </div>
        </div>
        
        {results.length > 1 && (
          <div className="results-tabs">
            {results.map((_, i) => (
              <button
                key={i}
                className={`result-tab ${activeResult === i ? 'active' : ''}`}
                onClick={() => setActiveResult(i)}
              >
                Результат {i + 1}
              </button>
            ))}
          </div>
        )}
        <div className="result-info">
          <span className="success-badge">✓ Успешно</span>
          <span>{result.rows.length} строк</span>
          <span>{result.executionTime}мс</span>
        </div>
        
        {viewMode === 'chart' ? (
          <div style={{ padding: 16 }}>
            <React.Suspense fallback={<div style={{ padding: 20, textAlign: 'center' }}>Загрузка графика...</div>}>
              <DataChartComponent data={{ rows: result.rows, columns }} />
            </React.Suspense>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  {columns.map(col => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                <tr key={i}>
                  {columns.map(col => (
                    <td key={col}>{row[col] !== null ? String(row[col]) : <span className="null-value">NULL</span>}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
        <style>{`
          .results-wrapper {
            display: flex;
            flex-direction: column;
            height: 100%;
          }
          .results-toolbar-inner {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: var(--bg-tertiary);
            border-bottom: 1px solid var(--border);
          }
          .view-toggle {
            display: flex;
            gap: 4px;
            background: var(--bg-primary);
            padding: 2px;
            border-radius: 4px;
          }
          .view-toggle button {
            padding: 4px 10px;
            background: transparent;
            border: none;
            border-radius: 3px;
            color: var(--text-secondary);
            font-size: 11px;
            cursor: pointer;
          }
          .view-toggle button.active {
            background: var(--bg-secondary);
            color: var(--text-primary);
          }
          .copy-btn {
            padding: 4px 10px;
            background: var(--bg-primary);
            border: 1px solid var(--border);
            border-radius: 4px;
            color: var(--text-secondary);
            font-size: 11px;
            cursor: pointer;
          }
          .copy-btn:hover {
            background: var(--bg-secondary);
            color: var(--text-primary);
          }
          .results-tabs {
            display: flex;
            padding: 8px;
            gap: 4px;
            border-bottom: 1px solid var(--border);
          }
          .result-tab {
            padding: 6px 12px;
            background: transparent;
            border: none;
            color: var(--text-muted);
            font-size: 12px;
            cursor: pointer;
            border-radius: 4px;
          }
          .result-tab.active {
            background: var(--bg-tertiary);
            color: var(--text-primary);
          }
          .result-info {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 8px 12px;
            font-size: 12px;
            color: var(--text-muted);
            border-bottom: 1px solid var(--border);
          }
          .success-badge {
            color: var(--ctp-green);
          }
          .table-scroll {
            flex: 1;
            overflow: auto;
          }
          .data-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
          }
          .data-table th {
            position: sticky;
            top: 0;
            background: var(--bg-tertiary);
            padding: 8px 12px;
            text-align: left;
            font-weight: 500;
            color: var(--text-secondary);
            border-bottom: 1px solid var(--ctp-surface1);
          }
          .data-table td {
            padding: 8px 12px;
            border-bottom: 1px solid var(--border);
            color: var(--text-primary);
            max-width: 300px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .data-table tr:hover td {
            background: color-mix(in srgb, var(--ctp-blue) 5%, transparent);
          }
          .null-value {
            color: var(--text-muted);
            font-style: italic;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="result-message">
      <svg viewBox="0 0 24 24" width="24" height="24">
        <path fill="var(--ctp-green)" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
      </svg>
      <span>Запрос выполнен успешно. {result.rowsAffected !== undefined && `Затронуто строк: ${result.rowsAffected}`}</span>
      <style>{`
        .result-message {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 20px;
          color: var(--ctp-green);
        }
      `}</style>
    </div>
  );
};
