import React, { useState, useEffect } from 'react';

interface ServerStatus {
  version: string;
  uptime: number;
  connections: number;
  threads: number;
  queries: number;
  slowQueries: number;
  bytesReceived: number;
  bytesSent: number;
  bufferPoolSize: number;
  tableCache: number;
}

interface ClientConnection {
  id: number;
  user: string;
  host: string;
  database: string;
  command: string;
  time: number;
  state: string;
  info: string;
}

interface UserPrivilege {
  user: string;
  host: string;
  privileges: string[];
  databases: string[];
}

interface SystemVariable {
  name: string;
  value: string;
  type: 'global' | 'session';
}

interface ServerLog {
  timestamp: string;
  level: 'info' | 'warning' | 'error';
  message: string;
}

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  status: 'good' | 'warning' | 'critical';
}

interface AdminPanelProps {
  connection: {
    host: string;
    port: number;
    username: string;
    database?: string;
  };
  currentDatabase: string;
  dbAPI: any;
  onShowStats: () => void;
  onShowExport: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  connection,
  currentDatabase,
  dbAPI,
  onShowStats,
  onShowExport
}) => {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [clientConnections, setClientConnections] = useState<ClientConnection[]>([]);
  const [users, setUsers] = useState<UserPrivilege[]>([]);
  const [variables, setVariables] = useState<SystemVariable[]>([]);
  const [serverLogs, setServerLogs] = useState<ServerLog[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [variableFilter, setVariableFilter] = useState('');
  const [variableType, setVariableType] = useState<'global' | 'session' | 'all'>('all');
  const loadServerStatus = async () => {
    setIsLoading(true);
    try {
      const statusResult = await dbAPI.query('SHOW GLOBAL STATUS');
      
      if (statusResult.success && statusResult.rows && statusResult.rows.length > 0) {
        const variablesResult = await dbAPI.query('SHOW GLOBAL VARIABLES');
        
        const statusMap: Record<string, string> = {};
        statusResult.rows.forEach((row: any) => {
          statusMap[row.Variable_name || row.variable_name] = row.Value || row.value;
        });

        const varsMap: Record<string, string> = {};
        if (variablesResult.success && variablesResult.rows) {
          variablesResult.rows.forEach((row: any) => {
            varsMap[row.Variable_name || row.variable_name] = row.Value || row.value;
          });
        }

        setServerStatus({
          version: varsMap['version'] || 'Unknown',
          uptime: parseInt(statusMap['Uptime'] || '0'),
          connections: parseInt(statusMap['Connections'] || '0'),
          threads: parseInt(statusMap['Threads_connected'] || '0'),
          queries: parseInt(statusMap['Queries'] || '0'),
          slowQueries: parseInt(statusMap['Slow_queries'] || '0'),
          bytesReceived: parseInt(statusMap['Bytes_received'] || '0'),
          bytesSent: parseInt(statusMap['Bytes_sent'] || '0'),
          bufferPoolSize: parseInt(varsMap['innodb_buffer_pool_size'] || '0'),
          tableCache: parseInt(varsMap['table_open_cache'] || '0'),
        });
      } else {
        const tables = await dbAPI.getTables();
        const startTime = parseInt(localStorage.getItem('mycsc_start_time') || Date.now().toString());
        if (!localStorage.getItem('mycsc_start_time')) {
          localStorage.setItem('mycsc_start_time', Date.now().toString());
        }
        const uptime = Math.floor((Date.now() - startTime) / 1000);
        const queryCount = parseInt(localStorage.getItem('mycsc_query_count') || '0');
        
        setServerStatus({
          version: 'MYCSC Local DB 1.0',
          uptime: uptime,
          connections: 1,
          threads: 1,
          queries: queryCount,
          slowQueries: 0,
          bytesReceived: 0,
          bytesSent: 0,
          bufferPoolSize: 16 * 1024 * 1024, // 16MB
          tableCache: tables.length,
        });
      }
    } catch (error) {
      console.error('Error loading server status:', error);
      setServerStatus({
        version: 'MYCSC Local DB 1.0',
        uptime: 0,
        connections: 1,
        threads: 1,
        queries: 0,
        slowQueries: 0,
        bytesReceived: 0,
        bytesSent: 0,
        bufferPoolSize: 16 * 1024 * 1024,
        tableCache: 0,
      });
    }
    setIsLoading(false);
  };
  const loadClientConnections = async () => {
    setIsLoading(true);
    try {
      const result = await dbAPI.query('SHOW FULL PROCESSLIST');
      if (result.success && result.rows && result.rows.length > 0) {
        setClientConnections(result.rows.map((row: any) => ({
          id: row.Id || row.id,
          user: row.User || row.user,
          host: row.Host || row.host,
          database: row.db || row.database || '-',
          command: row.Command || row.command,
          time: row.Time || row.time || 0,
          state: row.State || row.state || '',
          info: row.Info || row.info || ''
        })));
      } else {
        setClientConnections([{
          id: 1,
          user: connection.username,
          host: 'localhost',
          database: currentDatabase,
          command: 'Query',
          time: 0,
          state: 'Active',
          info: 'Локальное подключение'
        }]);
      }
    } catch (error) {
      console.error('Error loading connections:', error);
      setClientConnections([{
        id: 1,
        user: connection.username,
        host: 'localhost',
        database: currentDatabase,
        command: 'Query',
        time: 0,
        state: 'Active',
        info: 'Локальное подключение'
      }]);
    }
    setIsLoading(false);
  };
  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const result = await dbAPI.query('SELECT User, Host FROM mysql.user ORDER BY User');
      if (result.success && result.rows && result.rows.length > 0) {
        setUsers(result.rows.map((row: any) => ({
          user: row.User || row.user,
          host: row.Host || row.host,
          privileges: [],
          databases: []
        })));
      } else {
        const savedUsers = JSON.parse(localStorage.getItem('mycsc_users') || '{}');
        const userList = Object.keys(savedUsers).map(username => ({
          user: username,
          host: 'localhost',
          privileges: ['ALL PRIVILEGES'],
          databases: ['*']
        }));
        
        if (userList.length === 0) {
          userList.push({
            user: connection.username,
            host: 'localhost',
            privileges: ['ALL PRIVILEGES'],
            databases: ['*']
          });
        }
        
        setUsers(userList);
      }
    } catch (error) {
      console.error('Error loading users:', error);
      setUsers([{
        user: connection.username,
        host: connection.host,
        privileges: ['ALL PRIVILEGES'],
        databases: ['*']
      }]);
    }
    setIsLoading(false);
  };
  const loadVariables = async () => {
    setIsLoading(true);
    try {
      const globalResult = await dbAPI.query('SHOW GLOBAL VARIABLES');
      
      if (globalResult.success && globalResult.rows && globalResult.rows.length > 0) {
        const sessionResult = await dbAPI.query('SHOW SESSION VARIABLES');
        
        const vars: SystemVariable[] = [];
        
        globalResult.rows.forEach((row: any) => {
          vars.push({
            name: row.Variable_name || row.variable_name,
            value: row.Value || row.value,
            type: 'global'
          });
        });
        
        if (sessionResult.success && sessionResult.rows) {
          sessionResult.rows.forEach((row: any) => {
            const existing = vars.find(v => v.name === (row.Variable_name || row.variable_name));
            if (!existing) {
              vars.push({
                name: row.Variable_name || row.variable_name,
                value: row.Value || row.value,
                type: 'session'
              });
            }
          });
        }
        
        setVariables(vars.sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        const localVars: SystemVariable[] = [
          { name: 'database_engine', value: 'MYCSC Local', type: 'global' },
          { name: 'storage_type', value: 'localStorage', type: 'global' },
          { name: 'max_connections', value: '1', type: 'global' },
          { name: 'current_database', value: currentDatabase, type: 'session' },
          { name: 'user', value: connection.username, type: 'session' },
          { name: 'host', value: connection.host, type: 'session' },
          { name: 'port', value: String(connection.port), type: 'session' },
          { name: 'auto_commit', value: 'ON', type: 'session' },
          { name: 'character_set', value: 'UTF-8', type: 'global' },
          { name: 'collation', value: 'unicode_ci', type: 'global' },
        ];
        setVariables(localVars);
      }
    } catch (error) {
      console.error('Error loading variables:', error);
      setVariables([
        { name: 'database_engine', value: 'MYCSC Local', type: 'global' },
        { name: 'current_database', value: currentDatabase, type: 'session' },
      ]);
    }
    setIsLoading(false);
  };
  const loadServerLogs = async () => {
    setIsLoading(true);
    try {
      const result = await dbAPI.query("SHOW GLOBAL STATUS LIKE '%error%'");
      const logs: ServerLog[] = [];
      
      if (result.success && result.rows && result.rows.length > 0) {
        result.rows.forEach((row: any) => {
          logs.push({
            timestamp: new Date().toISOString(),
            level: 'info',
            message: `${row.Variable_name}: ${row.Value}`
          });
        });
      }
      const savedLogs = JSON.parse(localStorage.getItem('mycsc_logs') || '[]');
      savedLogs.forEach((log: any) => {
        logs.push(log);
      });
      logs.unshift({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Сервер работает нормально'
      });
      
      logs.unshift({
        timestamp: new Date(Date.now() - 60000).toISOString(),
        level: 'info',
        message: `Подключен к базе данных: ${currentDatabase}`
      });
      
      setServerLogs(logs);
    } catch (error) {
      console.error('Error loading logs:', error);
      setServerLogs([{
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Сервер работает нормально'
      }]);
    }
    setIsLoading(false);
  };
  const loadPerformanceMetrics = async () => {
    setIsLoading(true);
    try {
      const statusResult = await dbAPI.query('SHOW GLOBAL STATUS');
      const metrics: PerformanceMetric[] = [];
      
      if (statusResult.success && statusResult.rows && statusResult.rows.length > 0) {
        const statusMap: Record<string, number> = {};
        statusResult.rows.forEach((row: any) => {
          statusMap[row.Variable_name || row.variable_name] = parseInt(row.Value || row.value) || 0;
        });
        
        metrics.push({
          name: 'Запросов в секунду',
          value: Math.round(statusMap['Queries'] / Math.max(statusMap['Uptime'], 1)),
          unit: 'q/s',
          status: 'good'
        });
        
        metrics.push({
          name: 'Активных подключений',
          value: statusMap['Threads_connected'] || 0,
          unit: '',
          status: statusMap['Threads_connected'] > 100 ? 'warning' : 'good'
        });
        
        metrics.push({
          name: 'Медленных запросов',
          value: statusMap['Slow_queries'] || 0,
          unit: '',
          status: statusMap['Slow_queries'] > 10 ? 'warning' : 'good'
        });
        
        const cacheHitRate = statusMap['Qcache_hits'] 
          ? Math.round((statusMap['Qcache_hits'] / (statusMap['Qcache_hits'] + statusMap['Qcache_inserts'] + 1)) * 100)
          : 0;
        metrics.push({
          name: 'Попадания в кэш',
          value: cacheHitRate,
          unit: '%',
          status: cacheHitRate > 80 ? 'good' : cacheHitRate > 50 ? 'warning' : 'critical'
        });
        
        metrics.push({
          name: 'Открытых таблиц',
          value: statusMap['Open_tables'] || 0,
          unit: '',
          status: 'good'
        });
        
        metrics.push({
          name: 'Время работы',
          value: Math.round((statusMap['Uptime'] || 0) / 3600),
          unit: 'ч',
          status: 'good'
        });
      } else {
        const tables = await dbAPI.getTables();
        const queryCount = parseInt(localStorage.getItem('mycsc_query_count') || '0');
        const startTime = parseInt(localStorage.getItem('mycsc_start_time') || Date.now().toString());
        const uptime = Math.floor((Date.now() - startTime) / 1000);
        
        metrics.push({
          name: 'Всего запросов',
          value: queryCount,
          unit: '',
          status: 'good'
        });
        
        metrics.push({
          name: 'Активных подключений',
          value: 1,
          unit: '',
          status: 'good'
        });
        
        metrics.push({
          name: 'Таблиц в БД',
          value: tables.length,
          unit: '',
          status: 'good'
        });
        
        metrics.push({
          name: 'Использование памяти',
          value: Math.round(JSON.stringify(localStorage).length / 1024),
          unit: 'KB',
          status: 'good'
        });
        
        metrics.push({
          name: 'Баз данных',
          value: dbAPI.getDatabases().length,
          unit: '',
          status: 'good'
        });
        
        metrics.push({
          name: 'Время работы',
          value: Math.round(uptime / 60),
          unit: 'мин',
          status: 'good'
        });
      }
      
      setPerformanceMetrics(metrics);
    } catch (error) {
      console.error('Error loading performance metrics:', error);
      setPerformanceMetrics([{
        name: 'Статус',
        value: 1,
        unit: '',
        status: 'good'
      }]);
    }
    setIsLoading(false);
  };
  const killConnection = async (id: number) => {
    try {
      await dbAPI.query(`KILL ${id}`);
      loadClientConnections();
    } catch (error) {
      console.error('Error killing connection:', error);
      alert('Невозможно завершить подключение в локальном режиме');
    }
  };
  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}д ${hours}ч ${minutes}м`;
    if (hours > 0) return `${hours}ч ${minutes}м`;
    return `${minutes}м`;
  };
  const formatBytes = (bytes: number): string => {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${bytes} B`;
  };
  const handleSectionClick = (section: string) => {
    if (activeSection === section) {
      setActiveSection(null);
    } else {
      setActiveSection(section);
      
      switch (section) {
        case 'status':
          loadServerStatus();
          break;
        case 'connections':
          loadClientConnections();
          break;
        case 'users':
          loadUsers();
          break;
        case 'variables':
          loadVariables();
          break;
        case 'logs':
          loadServerLogs();
          break;
        case 'dashboard':
        case 'performance':
          loadPerformanceMetrics();
          break;
      }
    }
  };
  const filteredVariables = variables.filter(v => {
    const matchesFilter = v.name.toLowerCase().includes(variableFilter.toLowerCase());
    const matchesType = variableType === 'all' || v.type === variableType;
    return matchesFilter && matchesType;
  });

  return (
    <div className="admin-panel">
      {/* УПРАВЛЕНИЕ */}
      <div className="admin-section">
        <h4 className="admin-section-title">УПРАВЛЕНИЕ</h4>
        <div className="admin-list">
          <div 
            className={`admin-item ${activeSection === 'status' ? 'active' : ''}`}
            onClick={() => handleSectionClick('status')}
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 6v6l4 2" fill="none" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <span>Статус сервера</span>
          </div>
          <div 
            className={`admin-item ${activeSection === 'connections' ? 'active' : ''}`}
            onClick={() => handleSectionClick('connections')}
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
            </svg>
            <span>Подключения клиентов</span>
          </div>
          <div 
            className={`admin-item ${activeSection === 'users' ? 'active' : ''}`}
            onClick={() => handleSectionClick('users')}
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
            <span>Пользователи и права</span>
          </div>
          <div 
            className={`admin-item ${activeSection === 'variables' ? 'active' : ''}`}
            onClick={() => handleSectionClick('variables')}
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
            </svg>
            <span>Статус и переменные</span>
          </div>
          <div className="admin-item" onClick={onShowExport}>
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
            </svg>
            <span>Экспорт данных</span>
          </div>
          <div className="admin-item" onClick={onShowExport}>
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>
            </svg>
            <span>Импорт данных</span>
          </div>
        </div>
      </div>

      {/* ИНСТАНС */}
      <div className="admin-section">
        <h4 className="admin-section-title">
          ЭКЗЕМПЛЯР
          <svg viewBox="0 0 24 24" width="14" height="14" className="instance-icon">
            <path fill="var(--ctp-green)" d="M12 3C7.58 3 4 4.79 4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7c0-2.21-3.58-4-8-4z"/>
          </svg>
        </h4>
        <div className="admin-list">
          <div 
            className={`admin-item ${activeSection === 'startup' ? 'active' : ''}`}
            onClick={() => handleSectionClick('startup')}
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/>
              <rect x="8" y="8" width="8" height="8" fill="currentColor"/>
            </svg>
            <span>Запуск / Остановка</span>
          </div>
          <div 
            className={`admin-item ${activeSection === 'logs' ? 'active' : ''}`}
            onClick={() => handleSectionClick('logs')}
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            <span>Логи сервера</span>
          </div>
          <div className="admin-item">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
            <span>Файл настроек</span>
          </div>
        </div>
      </div>

      {/* ПРОИЗВОДИТЕЛЬНОСТЬ */}
      <div className="admin-section">
        <h4 className="admin-section-title">ПРОИЗВОДИТЕЛЬНОСТЬ</h4>
        <div className="admin-list">
          <div 
            className={`admin-item ${activeSection === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleSectionClick('dashboard')}
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 6v6l3 3" fill="none" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <span>Панель мониторинга</span>
          </div>
          <div 
            className={`admin-item ${activeSection === 'performance' ? 'active' : ''}`}
            onClick={() => handleSectionClick('performance')}
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
            </svg>
            <span>Отчёты производительности</span>
          </div>
          <div className="admin-item" onClick={onShowStats}>
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
            </svg>
            <span>Настройка Performance Schema</span>
          </div>
        </div>
      </div>

      {/* Информация о подключении */}
      <div className="admin-section admin-info-section">
        <div className="admin-info">
          <div className="info-row">
            <span className="label">Хост:</span>
            <span className="value">{connection.host}:{connection.port}</span>
          </div>
          <div className="info-row">
            <span className="label">Пользователь:</span>
            <span className="value">{connection.username}</span>
          </div>
          <div className="info-row">
            <span className="label">База данных:</span>
            <span className="value">{currentDatabase}</span>
          </div>
        </div>
      </div>

      {/* Детальные панели */}
      {activeSection && (
        <div className="admin-detail-panel">
          <div className="detail-header">
            <h3>
              {activeSection === 'status' && 'Статус сервера'}
              {activeSection === 'connections' && 'Подключения клиентов'}
              {activeSection === 'users' && 'Пользователи и права'}
              {activeSection === 'variables' && 'Системные переменные'}
              {activeSection === 'logs' && 'Логи сервера'}
              {activeSection === 'dashboard' && 'Панель мониторинга'}
              {activeSection === 'performance' && 'Метрики производительности'}
              {activeSection === 'startup' && 'Управление сервером'}
            </h3>
            <button className="close-detail" onClick={() => setActiveSection(null)}>×</button>
          </div>
          
          <div className="detail-content">
            {isLoading && (
              <div className="loading-indicator">
                <div className="spinner"></div>
                <span>Загрузка...</span>
              </div>
            )}

            {/* Статус сервера */}
            {activeSection === 'status' && serverStatus && !isLoading && (
              <div className="status-grid">
                <div className="status-card">
                  <div className="status-icon version">
                    <svg viewBox="0 0 24 24" width="24" height="24">
                      <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  </div>
                  <div className="status-info">
                    <span className="status-label">Версия</span>
                    <span className="status-value">{serverStatus.version}</span>
                  </div>
                </div>
                
                <div className="status-card">
                  <div className="status-icon uptime">
                    <svg viewBox="0 0 24 24" width="24" height="24">
                      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
                      <path d="M12 6v6l4 2" fill="none" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                  </div>
                  <div className="status-info">
                    <span className="status-label">Время работы</span>
                    <span className="status-value">{formatUptime(serverStatus.uptime)}</span>
                  </div>
                </div>
                
                <div className="status-card">
                  <div className="status-icon connections">
                    <svg viewBox="0 0 24 24" width="24" height="24">
                      <path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                    </svg>
                  </div>
                  <div className="status-info">
                    <span className="status-label">Всего подключений</span>
                    <span className="status-value">{serverStatus.connections.toLocaleString()}</span>
                  </div>
                </div>
                
                <div className="status-card">
                  <div className="status-icon threads">
                    <svg viewBox="0 0 24 24" width="24" height="24">
                      <path fill="currentColor" d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z"/>
                    </svg>
                  </div>
                  <div className="status-info">
                    <span className="status-label">Активных потоков</span>
                    <span className="status-value">{serverStatus.threads}</span>
                  </div>
                </div>
                
                <div className="status-card">
                  <div className="status-icon queries">
                    <svg viewBox="0 0 24 24" width="24" height="24">
                      <path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
                    </svg>
                  </div>
                  <div className="status-info">
                    <span className="status-label">Всего запросов</span>
                    <span className="status-value">{serverStatus.queries.toLocaleString()}</span>
                  </div>
                </div>
                
                <div className="status-card">
                  <div className="status-icon slow">
                    <svg viewBox="0 0 24 24" width="24" height="24">
                      <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                  </div>
                  <div className="status-info">
                    <span className="status-label">Медленных запросов</span>
                    <span className="status-value">{serverStatus.slowQueries}</span>
                  </div>
                </div>
                
                <div className="status-card wide">
                  <div className="status-icon traffic">
                    <svg viewBox="0 0 24 24" width="24" height="24">
                      <path fill="currentColor" d="M7 16h10v-2H7v2zm0 4h10v-2H7v2zM7 8h10V6H7v2zm-4 8h2v-2H3v2zm0 4h2v-2H3v2zM3 8h2V6H3v2zm0 4h2v-2H3v2zm4 0h10v-2H7v2zm14-4V6h-2v2h2zm0 4h-2v2h2v-2zm0 6v-2h-2v2h2zm0 4v-2h-2v2h2z"/>
                    </svg>
                  </div>
                  <div className="status-info">
                    <span className="status-label">Трафик</span>
                    <span className="status-value">
                      ↓ {formatBytes(serverStatus.bytesReceived)} / ↑ {formatBytes(serverStatus.bytesSent)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Подключения клиентов */}
            {activeSection === 'connections' && !isLoading && (
              <div className="connections-list">
                <div className="connections-header">
                  <span>Всего активных подключений: {clientConnections.length}</span>
                  <button className="refresh-btn" onClick={loadClientConnections}>
                    <svg viewBox="0 0 24 24" width="14" height="14">
                      <path fill="currentColor" d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                    </svg>
                    Обновить
                  </button>
                </div>
                <table className="connections-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Пользователь</th>
                      <th>Хост</th>
                      <th>База данных</th>
                      <th>Команда</th>
                      <th>Время</th>
                      <th>Состояние</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientConnections.map(conn => (
                      <tr key={conn.id}>
                        <td>{conn.id}</td>
                        <td>{conn.user}</td>
                        <td>{conn.host}</td>
                        <td>{conn.database}</td>
                        <td>{conn.command}</td>
                        <td>{conn.time}с</td>
                        <td>{conn.state || '-'}</td>
                        <td>
                          <button 
                            className="kill-btn"
                            onClick={() => killConnection(conn.id)}
                            title="Завершить подключение"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Пользователи */}
            {activeSection === 'users' && !isLoading && (
              <div className="users-list">
                <div className="users-header">
                  <span>Всего пользователей: {users.length}</span>
                </div>
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>Пользователь</th>
                      <th>Хост</th>
                      <th>Права</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user, i) => (
                      <tr key={i}>
                        <td>
                          <div className="user-cell">
                            <svg viewBox="0 0 24 24" width="16" height="16">
                              <path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                            </svg>
                            {user.user}
                          </div>
                        </td>
                        <td>{user.host}</td>
                        <td>
                          <button className="view-privileges-btn">
                            Просмотреть права
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Системные переменные */}
            {activeSection === 'variables' && !isLoading && (
              <div className="variables-panel">
                <div className="variables-filters">
                  <input 
                    type="text"
                    placeholder="Поиск переменных..."
                    value={variableFilter}
                    onChange={(e) => setVariableFilter(e.target.value)}
                    className="variable-search"
                  />
                  <select 
                    value={variableType} 
                    onChange={(e) => setVariableType(e.target.value as any)}
                    className="variable-type-select"
                  >
                    <option value="all">Все</option>
                    <option value="global">Глобальные</option>
                    <option value="session">Сессии</option>
                  </select>
                </div>
                <div className="variables-count">
                  Найдено: {filteredVariables.length} из {variables.length}
                </div>
                <div className="variables-list">
                  {filteredVariables.slice(0, 100).map((v, i) => (
                    <div key={i} className="variable-item">
                      <span className="variable-name">{v.name}</span>
                      <span className="variable-value">{v.value}</span>
                      <span className={`variable-type ${v.type}`}>{v.type}</span>
                    </div>
                  ))}
                  {filteredVariables.length > 100 && (
                    <div className="variables-more">
                      ... и ещё {filteredVariables.length - 100} переменных
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Логи сервера */}
            {activeSection === 'logs' && !isLoading && (
              <div className="logs-panel">
                <div className="logs-header">
                  <span>Последние записи логов</span>
                  <button className="refresh-btn" onClick={loadServerLogs}>
                    <svg viewBox="0 0 24 24" width="14" height="14">
                      <path fill="currentColor" d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                    </svg>
                    Обновить
                  </button>
                </div>
                <div className="logs-list">
                  {serverLogs.map((log, i) => (
                    <div key={i} className={`log-entry ${log.level}`}>
                      <span className="log-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      <span className={`log-level ${log.level}`}>{log.level.toUpperCase()}</span>
                      <span className="log-message">{log.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Панель мониторинга / Метрики */}
            {(activeSection === 'dashboard' || activeSection === 'performance') && !isLoading && (
              <div className="performance-panel">
                <div className="metrics-grid">
                  {performanceMetrics.map((metric, i) => (
                    <div key={i} className={`metric-card ${metric.status}`}>
                      <div className="metric-value">
                        {metric.value}
                        <span className="metric-unit">{metric.unit}</span>
                      </div>
                      <div className="metric-name">{metric.name}</div>
                      <div className={`metric-status ${metric.status}`}>
                        {metric.status === 'good' && '✓ Норма'}
                        {metric.status === 'warning' && '⚠ Внимание'}
                        {metric.status === 'critical' && '✕ Критично'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Управление сервером */}
            {activeSection === 'startup' && !isLoading && (
              <div className="startup-panel">
                <div className="startup-status">
                  <div className="status-indicator online">
                    <div className="status-dot"></div>
                    <span>Сервер работает</span>
                  </div>
                </div>
                <div className="startup-actions">
                  <button className="startup-btn restart" disabled>
                    <svg viewBox="0 0 24 24" width="20" height="20">
                      <path fill="currentColor" d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                    </svg>
                    Перезапустить сервер
                  </button>
                  <button className="startup-btn stop" disabled>
                    <svg viewBox="0 0 24 24" width="20" height="20">
                      <rect x="6" y="6" width="12" height="12" fill="currentColor"/>
                    </svg>
                    Остановить сервер
                  </button>
                </div>
                <p className="startup-note">
                  Примечание: Управление сервером доступно только при локальном подключении с правами администратора.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .admin-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow-y: auto;
        }

        .admin-section {
          padding: 8px 12px;
        }

        .admin-section-title {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0 0 8px 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .instance-icon {
          opacity: 0.7;
        }

        .admin-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .admin-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          color: var(--text-secondary);
          transition: all 0.15s ease;
        }

        .admin-item:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .admin-item.active {
          background: var(--accent);
          color: var(--ctp-base);
        }

        .admin-item svg {
          flex-shrink: 0;
          opacity: 0.7;
        }

        .admin-item:hover svg,
        .admin-item.active svg {
          opacity: 1;
        }

        .admin-info-section {
          margin-top: auto;
          border-top: 1px solid var(--border);
          padding-top: 12px;
        }

        .admin-info {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
        }

        .info-row .label {
          color: var(--text-muted);
        }

        .info-row .value {
          color: var(--text-primary);
          font-family: 'JetBrains Mono', monospace;
        }

        /* Detail Panel */
        .admin-detail-panel {
          position: fixed;
          left: 280px;
          top: 40px;
          bottom: 0;
          width: 500px;
          background: var(--bg-primary);
          border-left: 1px solid var(--border);
          box-shadow: 5px 0 20px rgba(0,0,0,0.3);
          z-index: 100;
          display: flex;
          flex-direction: column;
          animation: slideIn 0.2s ease;
        }

        @keyframes slideIn {
          from { transform: translateX(-20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        .detail-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
          background: var(--bg-secondary);
        }

        .detail-header h3 {
          margin: 0;
          font-size: 16px;
          color: var(--text-primary);
        }

        .close-detail {
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 24px;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
          line-height: 1;
        }

        .close-detail:hover {
          background: var(--error);
          color: white;
        }

        .detail-content {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }

        .loading-indicator {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 40px;
          color: var(--text-muted);
        }

        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid var(--border);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Status Grid */
        .status-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .status-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .status-card.wide {
          grid-column: span 2;
        }

        .status-icon {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .status-icon.version { background: color-mix(in srgb, var(--ctp-green) 20%, transparent); color: var(--ctp-green); }
        .status-icon.uptime { background: color-mix(in srgb, var(--ctp-blue) 20%, transparent); color: var(--ctp-blue); }
        .status-icon.connections { background: color-mix(in srgb, var(--ctp-mauve) 20%, transparent); color: var(--ctp-mauve); }
        .status-icon.threads { background: color-mix(in srgb, var(--ctp-yellow) 20%, transparent); color: var(--ctp-yellow); }
        .status-icon.queries { background: color-mix(in srgb, var(--ctp-peach) 20%, transparent); color: var(--ctp-peach); }
        .status-icon.slow { background: color-mix(in srgb, var(--ctp-red) 20%, transparent); color: var(--ctp-red); }
        .status-icon.traffic { background: color-mix(in srgb, var(--ctp-teal) 20%, transparent); color: var(--ctp-teal); }

        .status-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .status-label {
          font-size: 12px;
          color: var(--text-muted);
        }

        .status-value {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
          font-family: 'JetBrains Mono', monospace;
        }

        /* Connections Table */
        .connections-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .connections-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: var(--text-secondary);
          font-size: 13px;
        }

        .refresh-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border);
          border-radius: 6px;
          color: var(--text-primary);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .refresh-btn:hover {
          background: var(--accent);
          color: var(--ctp-base);
          border-color: var(--accent);
        }

        .connections-table,
        .users-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }

        .connections-table th,
        .connections-table td,
        .users-table th,
        .users-table td {
          padding: 10px 8px;
          text-align: left;
          border-bottom: 1px solid var(--border);
        }

        .connections-table th,
        .users-table th {
          background: var(--bg-secondary);
          color: var(--text-muted);
          font-weight: 600;
          text-transform: uppercase;
          font-size: 10px;
          letter-spacing: 0.5px;
        }

        .connections-table td,
        .users-table td {
          color: var(--text-primary);
        }

        .kill-btn {
          background: var(--error);
          color: white;
          border: none;
          width: 24px;
          height: 24px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
        }

        .kill-btn:hover {
          opacity: 0.8;
        }

        .user-cell {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .view-privileges-btn {
          padding: 4px 10px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border);
          border-radius: 4px;
          color: var(--accent);
          font-size: 11px;
          cursor: pointer;
        }

        .view-privileges-btn:hover {
          background: var(--accent);
          color: var(--ctp-base);
        }

        /* Variables Panel */
        .variables-panel {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .variables-filters {
          display: flex;
          gap: 10px;
        }

        .variable-search {
          flex: 1;
          padding: 8px 12px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 6px;
          color: var(--text-primary);
          font-size: 13px;
        }

        .variable-search:focus {
          outline: none;
          border-color: var(--accent);
        }

        .variable-type-select {
          padding: 8px 12px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 6px;
          color: var(--text-primary);
          font-size: 13px;
          cursor: pointer;
        }

        .variables-count {
          font-size: 12px;
          color: var(--text-muted);
        }

        .variables-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
          max-height: 400px;
          overflow-y: auto;
        }

        .variable-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          background: var(--bg-secondary);
          border-radius: 6px;
          font-size: 12px;
        }

        .variable-name {
          flex: 1;
          color: var(--text-primary);
          font-family: 'JetBrains Mono', monospace;
        }

        .variable-value {
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--ctp-green);
          font-family: 'JetBrains Mono', monospace;
        }

        .variable-type {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 10px;
          text-transform: uppercase;
        }

        .variable-type.global {
          background: color-mix(in srgb, var(--ctp-blue) 20%, transparent);
          color: var(--ctp-blue);
        }

        .variable-type.session {
          background: color-mix(in srgb, var(--ctp-peach) 20%, transparent);
          color: var(--ctp-peach);
        }

        .variables-more {
          text-align: center;
          padding: 12px;
          color: var(--text-muted);
          font-size: 12px;
        }

        /* Logs Panel */
        .logs-panel {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .logs-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: var(--text-secondary);
          font-size: 13px;
        }

        .logs-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          max-height: 400px;
          overflow-y: auto;
        }

        .log-entry {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 10px 12px;
          background: var(--bg-secondary);
          border-radius: 6px;
          font-size: 12px;
          border-left: 3px solid transparent;
        }

        .log-entry.info { border-left-color: var(--ctp-blue); }
        .log-entry.warning { border-left-color: var(--ctp-yellow); }
        .log-entry.error { border-left-color: var(--ctp-red); }

        .log-time {
          color: var(--text-muted);
          font-family: 'JetBrains Mono', monospace;
          flex-shrink: 0;
        }

        .log-level {
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: 600;
          flex-shrink: 0;
        }

        .log-level.info { background: color-mix(in srgb, var(--ctp-blue) 20%, transparent); color: var(--ctp-blue); }
        .log-level.warning { background: color-mix(in srgb, var(--ctp-yellow) 20%, transparent); color: var(--ctp-yellow); }
        .log-level.error { background: color-mix(in srgb, var(--ctp-red) 20%, transparent); color: var(--ctp-red); }

        .log-message {
          color: var(--text-primary);
          flex: 1;
          word-break: break-word;
        }

        /* Performance Panel */
        .performance-panel {
          padding: 0;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .metric-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 20px;
          text-align: center;
        }

        .metric-card.good { border-color: var(--ctp-green); }
        .metric-card.warning { border-color: var(--ctp-yellow); }
        .metric-card.critical { border-color: var(--ctp-red); }

        .metric-value {
          font-size: 32px;
          font-weight: 700;
          color: var(--text-primary);
          font-family: 'JetBrains Mono', monospace;
        }

        .metric-unit {
          font-size: 14px;
          color: var(--text-muted);
          margin-left: 4px;
        }

        .metric-name {
          font-size: 13px;
          color: var(--text-secondary);
          margin-top: 4px;
        }

        .metric-status {
          font-size: 11px;
          margin-top: 8px;
          padding: 4px 10px;
          border-radius: 20px;
          display: inline-block;
        }

        .metric-status.good {
          background: color-mix(in srgb, var(--ctp-green) 20%, transparent);
          color: var(--ctp-green);
        }

        .metric-status.warning {
          background: color-mix(in srgb, var(--ctp-yellow) 20%, transparent);
          color: var(--ctp-yellow);
        }

        .metric-status.critical {
          background: color-mix(in srgb, var(--ctp-red) 20%, transparent);
          color: var(--ctp-red);
        }

        /* Startup Panel */
        .startup-panel {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
          padding: 20px;
        }

        .startup-status {
          text-align: center;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 18px;
          font-weight: 600;
        }

        .status-indicator.online {
          color: var(--ctp-green);
        }

        .status-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--ctp-green);
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .startup-actions {
          display: flex;
          gap: 12px;
        }

        .startup-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }

        .startup-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .startup-btn.restart {
          background: var(--ctp-blue);
          color: var(--ctp-base);
        }

        .startup-btn.stop {
          background: var(--ctp-red);
          color: var(--ctp-base);
        }

        .startup-note {
          font-size: 12px;
          color: var(--text-muted);
          text-align: center;
          max-width: 300px;
        }
      `}</style>
    </div>
  );
};
