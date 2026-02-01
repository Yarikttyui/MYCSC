import React, { useState, useEffect } from 'react';
import { Documentation } from './Documentation';
import { StorageStatus } from './StorageStatus';
import Notifications from './Notifications';
import SharedDatabases from './SharedDatabases';

export interface Connection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  database: string;
  color: string;
  createdAt: string;
  lastUsed?: string;
}

interface WelcomeScreenProps {
  username: string;
  connections: Connection[];
  onConnect: (connection: Connection) => void;
  onCreateConnection: (connection: Omit<Connection, 'id' | 'createdAt'>) => void;
  onEditConnection: (connection: Connection) => void;
  onDeleteConnection: (id: string) => void;
  onLogout: () => void;
  sessionId?: string;
  apiUrl?: string;
}

const CONNECTION_COLORS = [
  '#89b4fa', '#a6e3a1', '#f9e2af', '#f38ba8', '#cba6f7',
  '#94e2d5', '#fab387', '#74c7ec', '#f5c2e7', '#b4befe'
];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  username,
  connections,
  onConnect,
  onCreateConnection,
  onEditConnection,
  onDeleteConnection,
  onLogout,
  sessionId = '',
  apiUrl = ''
}) => {
  const [showNewConnection, setShowNewConnection] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; connection: Connection } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeNavTab, setActiveNavTab] = useState<'home' | 'shared' | 'docs'>('home');
  const [formData, setFormData] = useState({
    name: '',
    host: 'localhost',
    port: 3306,
    username: 'root',
    password: '',
    database: '',
    color: CONNECTION_COLORS[Math.floor(Math.random() * CONNECTION_COLORS.length)]
  });
  const [sslSettings, setSslSettings] = useState({
    useSSL: false,
    sslCA: '',
    sslCert: '',
    sslKey: '',
    verifyServerCert: true
  });
  const [advancedSettings, setAdvancedSettings] = useState({
    connectionTimeout: 10,
    readTimeout: 30,
    writeTimeout: 30,
    maxPacketSize: 64,
    autoReconnect: true,
    compress: false,
    multipleStatements: true
  });
  const [activeFormTab, setActiveFormTab] = useState<'params' | 'ssl' | 'advanced'>('params');
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const filteredConnections = connections.filter(conn =>
    conn.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conn.host.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleContextMenu = (e: React.MouseEvent, connection: Connection) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, connection });
  };

  const openEditModal = (connection: Connection) => {
    setEditingConnection(connection);
    setFormData({
      name: connection.name,
      host: connection.host,
      port: connection.port,
      username: connection.username,
      password: '',
      database: connection.database,
      color: connection.color
    });
    setActiveFormTab('params');
    setTestResult(null);
    setContextMenu(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingConnection) {
      onEditConnection({
        ...editingConnection,
        ...formData
      });
      setEditingConnection(null);
    } else {
      onCreateConnection(formData);
      setShowNewConnection(false);
    }
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: '',
      database: '',
      color: CONNECTION_COLORS[Math.floor(Math.random() * CONNECTION_COLORS.length)]
    });
    setSslSettings({
      useSSL: false,
      sslCA: '',
      sslCert: '',
      sslKey: '',
      verifyServerCert: true
    });
    setAdvancedSettings({
      connectionTimeout: 10,
      readTimeout: 30,
      writeTimeout: 30,
      maxPacketSize: 64,
      autoReconnect: true,
      compress: false,
      multipleStatements: true
    });
    setActiveFormTab('params');
    setTestResult(null);
  };

  const closeModal = () => {
    setShowNewConnection(false);
    setEditingConnection(null);
    resetForm();
  };
  const testConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    if (!formData.host || !formData.port || !formData.username) {
      setTestResult({
        success: false,
        message: 'Заполните обязательные поля: хост, порт и пользователь'
      });
      setTestingConnection(false);
      return;
    }

    const port = typeof formData.port === 'string' ? parseInt(formData.port, 10) : formData.port;
    if (isNaN(port) || port < 1 || port > 65535) {
      setTestResult({
        success: false,
        message: 'Порт должен быть числом от 1 до 65535'
      });
      setTestingConnection(false);
      return;
    }

    try {
      const novaDB = (window as any).novaDB;
      
      if (novaDB && novaDB.testConnection) {
        const result = await novaDB.testConnection({
          host: formData.host,
          port: port,
          timeout: 5000
        });
        
        setTestResult({
          success: result.success,
          message: result.message
        });
      } else {
        setTestResult({
          success: true,
          message: `Проверка соединения с ${formData.host}:${formData.port} недоступна в браузере. Запустите в Electron для реальной проверки.`
        });
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        message: `Ошибка проверки соединения: ${error.message || 'Неизвестная ошибка'}`
      });
    }
    
    setTestingConnection(false);
  };

  return (
    <div className="welcome-screen">
      {/* Header */}
      <header className="welcome-header">
        <div className="header-left">
          <div className="logo">
            <svg viewBox="0 0 40 40" width="40" height="40">
              <defs>
                <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#89b4fa" />
                  <stop offset="100%" stopColor="#cba6f7" />
                </linearGradient>
              </defs>
              <circle cx="20" cy="20" r="18" fill="none" stroke="url(#logoGrad)" strokeWidth="2"/>
              <ellipse cx="20" cy="14" rx="10" ry="5" fill="none" stroke="url(#logoGrad)" strokeWidth="1.5"/>
              <path d="M10 14v12c0 2.8 4.5 5 10 5s10-2.2 10-5V14" fill="none" stroke="url(#logoGrad)" strokeWidth="1.5"/>
              <ellipse cx="20" cy="20" rx="10" ry="5" fill="none" stroke="url(#logoGrad)" strokeWidth="1.5" opacity="0.5"/>
            </svg>
            <span>MYCSC</span>
          </div>
        </div>
        <div className="header-center">
          <nav className="header-nav">
            <button 
              className={`nav-link ${activeNavTab === 'home' ? 'active' : ''}`}
              onClick={() => setActiveNavTab('home')}
            >
              Главная
            </button>
            <button 
              className={`nav-link ${activeNavTab === 'shared' ? 'active' : ''}`}
              onClick={() => setActiveNavTab('shared')}
            >
              Совместные БД
            </button>
            <button 
              className={`nav-link ${activeNavTab === 'docs' ? 'active' : ''}`}
              onClick={() => setActiveNavTab('docs')}
            >
              Документация
            </button>
          </nav>
        </div>
        <div className="header-right">
          {sessionId && (
            <Notifications 
              sessionId={sessionId} 
              apiUrl={apiUrl}
              onInvitationAction={() => setActiveNavTab('shared')}
            />
          )}
          <div className="user-menu">
            <div className="user-avatar">
              {username.charAt(0).toUpperCase()}
            </div>
            <span className="user-name">{username}</span>
            <button className="logout-btn" onClick={onLogout} title="Выйти">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      {activeNavTab === 'home' && (
        <main className="welcome-main">
          <div className="welcome-hero">
            <h1>Добро пожаловать в MYCSC</h1>
            <p>
              MYCSC — это мощная система управления базами данных.
            </p>
            
            <div className="hero-links">
              <button className="hero-link" onClick={() => setActiveNavTab('docs')}>
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
                </svg>
                Документация
              </button>
            </div>
          </div>

          {/* Connections Section */}
          <section className="connections-section">
            <div className="section-header">
              <h2>
                <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
              </svg>
              Подключения MYCSC
              <button 
                className="add-connection-btn"
                onClick={() => setShowNewConnection(true)}
                title="Добавить подключение"
              >
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
              </button>

            </h2>
            <div className="search-box">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
              <input
                type="text"
                placeholder="Поиск подключений..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="connections-grid">
            {filteredConnections.map(conn => (
              <div
                key={conn.id}
                className="connection-card"
                onClick={() => onConnect(conn)}
                onContextMenu={(e) => handleContextMenu(e, conn)}
              >
                <div className="card-accent" style={{ backgroundColor: conn.color }}></div>
                <div className="card-icon">
                  <svg viewBox="0 0 24 24" width="48" height="48">
                    <path fill={conn.color} opacity="0.2" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                    <path fill={conn.color} d="M12 3C7.58 3 4 4.79 4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7c0-2.21-3.58-4-8-4zm0 2c3.87 0 6 1.5 6 2s-2.13 2-6 2-6-1.5-6-2 2.13-2 6-2zm6 12c0 .5-2.13 2-6 2s-6-1.5-6-2v-2.23c1.61.78 3.72 1.23 6 1.23s4.39-.45 6-1.23V17zm0-5c0 .5-2.13 2-6 2s-6-1.5-6-2V9.77c1.61.78 3.72 1.23 6 1.23s4.39-.45 6-1.23V12z"/>
                  </svg>
                </div>
                <div className="card-content">
                  <h3>{conn.name}</h3>
                  <div className="card-details">
                    <span className="detail">
                      <svg viewBox="0 0 24 24" width="14" height="14">
                        <path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                      </svg>
                      {conn.username}
                    </span>
                    <span className="detail">
                      <svg viewBox="0 0 24 24" width="14" height="14">
                        <path fill="currentColor" d="M21 11H6.83l3.58-3.59L9 6l-6 6 6 6 1.41-1.41L6.83 13H21v-2z"/>
                      </svg>
                      {conn.host}:{conn.port}
                    </span>
                  </div>
                </div>
                <div className="card-actions">
                  <button 
                    className="card-action-btn"
                    onClick={(e) => { e.stopPropagation(); openEditModal(conn); }}
                    title="Редактировать"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                    </svg>
                  </button>
                  <button 
                    className="card-action-btn danger"
                    onClick={(e) => { e.stopPropagation(); onDeleteConnection(conn.id); }}
                    title="Удалить"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}

            {/* Add New Connection Card */}
            <div 
              className="connection-card add-card"
              onClick={() => setShowNewConnection(true)}
            >
              <div className="add-icon">
                <svg viewBox="0 0 24 24" width="48" height="48">
                  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 2"/>
                  <path fill="currentColor" d="M13 7h-2v4H7v2h4v4h2v-4h4v-2h-4V7z"/>
                </svg>
              </div>
              <span>Добавить подключение</span>
            </div>
          </div>

          {connections.length === 0 && (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" width="64" height="64">
                <path fill="currentColor" opacity="0.3" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93z"/>
              </svg>
              <h3>Нет сохраненных подключений</h3>
              <p>Создайте своё первое подключение к базе данных</p>
              <button 
                className="btn-primary"
                onClick={() => setShowNewConnection(true)}
              >
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
                Создать подключение
              </button>
            </div>
          )}
        </section>

        {/* Recent Activity */}
        <section className="recent-section">
          <h3>Недавняя активность</h3>
          <div className="recent-list">
            {connections.slice(0, 3).map(conn => conn.lastUsed && (
              <div key={conn.id} className="recent-item" onClick={() => onConnect(conn)}>
                <div className="recent-icon" style={{ backgroundColor: conn.color }}>
                  <svg viewBox="0 0 24 24" width="16" height="16">
                    <path fill="white" d="M12 3C7.58 3 4 4.79 4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7c0-2.21-3.58-4-8-4z"/>
                  </svg>
                </div>
                <div className="recent-info">
                  <span className="recent-name">{conn.name}</span>
                  <span className="recent-time">{new Date(conn.lastUsed).toLocaleString()}</span>
                </div>
              </div>
            ))}
            {connections.filter(c => c.lastUsed).length === 0 && (
              <p className="no-recent">Нет недавней активности</p>
            )}
          </div>
        </section>
        </main>
      )}

      {/* Shared Databases Tab */}
      {activeNavTab === 'shared' && (
        <main className="welcome-main full-height">
          <SharedDatabases
            username={username}
            sessionId={sessionId}
            apiUrl={apiUrl}
            onSelectDatabase={(db) => {
              console.log('Selected shared database:', db);
              const sharedConnection: Connection = {
                id: `shared_${db.id}`,
                name: `[Shared] ${db.name}`,
                host: 'shared',
                port: 0,
                username: username,
                database: db.name,
                color: '#cba6f7',
                createdAt: db.createdAt,
                lastUsed: new Date().toISOString()
              };
              onConnect(sharedConnection);
            }}
          />
        </main>
      )}

      {/* Documentation Tab */}
      {activeNavTab === 'docs' && (
        <main className="welcome-main full-height">
          <Documentation isOpen={true} onClose={() => setActiveNavTab('home')} />
        </main>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div 
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <div className="context-menu-item" onClick={() => onConnect(contextMenu.connection)}>
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
            </svg>
            Подключиться
          </div>
          <div className="context-menu-item" onClick={() => openEditModal(contextMenu.connection)}>
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
            Редактировать
          </div>
          <div className="context-menu-item" onClick={() => navigator.clipboard.writeText(`${contextMenu.connection.host}:${contextMenu.connection.port}`)}>
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
            Копировать адрес
          </div>
          <div className="context-menu-divider"></div>
          <div className="context-menu-item danger" onClick={() => { onDeleteConnection(contextMenu.connection.id); setContextMenu(null); }}>
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
            Удалить
          </div>
        </div>
      )}

      {/* New/Edit Connection Modal */}
      {(showNewConnection || editingConnection) && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="connection-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon">
                <svg viewBox="0 0 24 24" width="32" height="32">
                  <path fill="var(--ctp-blue)" d="M12 3C7.58 3 4 4.79 4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7c0-2.21-3.58-4-8-4z"/>
                </svg>
              </div>
              <div className="modal-title">
                <h3>{editingConnection ? 'Редактировать подключение' : 'Новое подключение'}</h3>
                <p>{editingConnection ? 'Измените параметры подключения' : 'Настройте параметры нового подключения'}</p>
              </div>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Название подключения:</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Моя база данных"
                      required
                    />
                    <span className="form-hint">Укажите имя для идентификации подключения</span>
                  </div>
                </div>

                <div className="form-tabs">
                  <button 
                    type="button" 
                    className={`form-tab ${activeFormTab === 'params' ? 'active' : ''}`}
                    onClick={() => setActiveFormTab('params')}
                  >
                    Параметры
                  </button>
                  <button 
                    type="button" 
                    className={`form-tab ${activeFormTab === 'ssl' ? 'active' : ''}`}
                    onClick={() => setActiveFormTab('ssl')}
                  >
                    SSL
                  </button>
                  <button 
                    type="button" 
                    className={`form-tab ${activeFormTab === 'advanced' ? 'active' : ''}`}
                    onClick={() => setActiveFormTab('advanced')}
                  >
                    Дополнительно
                  </button>
                </div>

                {/* Parameters Tab */}
                {activeFormTab === 'params' && (
                  <>
                    <div className="form-row two-cols">
                      <div className="form-group">
                        <label>Хост:</label>
                        <input
                          type="text"
                          value={formData.host}
                          onChange={(e) => setFormData(prev => ({ ...prev, host: e.target.value }))}
                          placeholder="127.0.0.1"
                        />
                        <span className="form-hint">IP адрес или имя сервера</span>
                      </div>
                      <div className="form-group small">
                        <label>Порт:</label>
                        <input
                          type="number"
                          value={formData.port}
                          onChange={(e) => setFormData(prev => ({ ...prev, port: parseInt(e.target.value) || 3306 }))}
                        />
                      </div>
                    </div>

                    <div className="form-row two-cols">
                      <div className="form-group">
                        <label>Пользователь:</label>
                        <input
                          type="text"
                          value={formData.username}
                          onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                          placeholder="root"
                        />
                        <span className="form-hint">Имя пользователя для подключения</span>
                      </div>
                      <div className="form-group">
                        <label>Пароль:</label>
                        <input
                          type="password"
                          value={formData.password}
                          onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                          placeholder="••••••••"
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>База данных по умолчанию:</label>
                        <input
                          type="text"
                          value={formData.database}
                          onChange={(e) => setFormData(prev => ({ ...prev, database: e.target.value }))}
                          placeholder="Оставьте пустым для выбора позже"
                        />
                        <span className="form-hint">Схема для использования по умолчанию</span>
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Цвет:</label>
                        <div className="color-picker">
                          {CONNECTION_COLORS.map(color => (
                            <button
                              key={color}
                              type="button"
                              className={`color-option ${formData.color === color ? 'selected' : ''}`}
                              style={{ backgroundColor: color }}
                              onClick={() => setFormData(prev => ({ ...prev, color }))}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* SSL Tab */}
                {activeFormTab === 'ssl' && (
                  <>
                    <div className="form-row">
                      <div className="form-group checkbox-group">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={sslSettings.useSSL}
                            onChange={(e) => setSslSettings(prev => ({ ...prev, useSSL: e.target.checked }))}
                          />
                          <span className="checkmark"></span>
                          Использовать SSL/TLS шифрование
                        </label>
                        <span className="form-hint">Включите для безопасного соединения с сервером</span>
                      </div>
                    </div>

                    {sslSettings.useSSL && (
                      <>
                        <div className="form-row">
                          <div className="form-group">
                            <label>SSL CA сертификат:</label>
                            <div className="file-input-group">
                              <input
                                type="text"
                                value={sslSettings.sslCA}
                                onChange={(e) => setSslSettings(prev => ({ ...prev, sslCA: e.target.value }))}
                                placeholder="Путь к CA сертификату"
                              />
                              <button type="button" className="file-browse-btn">Обзор</button>
                            </div>
                            <span className="form-hint">Корневой сертификат удостоверяющего центра</span>
                          </div>
                        </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label>SSL сертификат клиента:</label>
                            <div className="file-input-group">
                              <input
                                type="text"
                                value={sslSettings.sslCert}
                                onChange={(e) => setSslSettings(prev => ({ ...prev, sslCert: e.target.value }))}
                                placeholder="Путь к сертификату клиента"
                              />
                              <button type="button" className="file-browse-btn">Обзор</button>
                            </div>
                            <span className="form-hint">Сертификат для аутентификации клиента</span>
                          </div>
                        </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label>SSL ключ клиента:</label>
                            <div className="file-input-group">
                              <input
                                type="text"
                                value={sslSettings.sslKey}
                                onChange={(e) => setSslSettings(prev => ({ ...prev, sslKey: e.target.value }))}
                                placeholder="Путь к ключу клиента"
                              />
                              <button type="button" className="file-browse-btn">Обзор</button>
                            </div>
                            <span className="form-hint">Приватный ключ клиента</span>
                          </div>
                        </div>

                        <div className="form-row">
                          <div className="form-group checkbox-group">
                            <label className="checkbox-label">
                              <input
                                type="checkbox"
                                checked={sslSettings.verifyServerCert}
                                onChange={(e) => setSslSettings(prev => ({ ...prev, verifyServerCert: e.target.checked }))}
                              />
                              <span className="checkmark"></span>
                              Проверять сертификат сервера
                            </label>
                            <span className="form-hint">Рекомендуется для безопасного соединения</span>
                          </div>
                        </div>
                      </>
                    )}

                    {!sslSettings.useSSL && (
                      <div className="ssl-disabled-notice">
                        <svg viewBox="0 0 24 24" width="48" height="48">
                          <path fill="var(--text-muted)" d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                        </svg>
                        <h4>SSL отключён</h4>
                        <p>Включите SSL для безопасного шифрованного соединения с сервером базы данных</p>
                      </div>
                    )}
                  </>
                )}

                {/* Advanced Tab */}
                {activeFormTab === 'advanced' && (
                  <>
                    <div className="form-row two-cols">
                      <div className="form-group">
                        <label>Таймаут подключения (сек):</label>
                        <input
                          type="number"
                          value={advancedSettings.connectionTimeout}
                          onChange={(e) => setAdvancedSettings(prev => ({ ...prev, connectionTimeout: parseInt(e.target.value) || 10 }))}
                          min="1"
                          max="300"
                        />
                        <span className="form-hint">Время ожидания подключения</span>
                      </div>
                      <div className="form-group">
                        <label>Таймаут чтения (сек):</label>
                        <input
                          type="number"
                          value={advancedSettings.readTimeout}
                          onChange={(e) => setAdvancedSettings(prev => ({ ...prev, readTimeout: parseInt(e.target.value) || 30 }))}
                          min="1"
                          max="3600"
                        />
                      </div>
                    </div>

                    <div className="form-row two-cols">
                      <div className="form-group">
                        <label>Таймаут записи (сек):</label>
                        <input
                          type="number"
                          value={advancedSettings.writeTimeout}
                          onChange={(e) => setAdvancedSettings(prev => ({ ...prev, writeTimeout: parseInt(e.target.value) || 30 }))}
                          min="1"
                          max="3600"
                        />
                        <span className="form-hint">Время ожидания записи</span>
                      </div>
                      <div className="form-group">
                        <label>Макс. размер пакета (МБ):</label>
                        <input
                          type="number"
                          value={advancedSettings.maxPacketSize}
                          onChange={(e) => setAdvancedSettings(prev => ({ ...prev, maxPacketSize: parseInt(e.target.value) || 64 }))}
                          min="1"
                          max="1024"
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group checkbox-group">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={advancedSettings.autoReconnect}
                            onChange={(e) => setAdvancedSettings(prev => ({ ...prev, autoReconnect: e.target.checked }))}
                          />
                          <span className="checkmark"></span>
                          Автоматическое переподключение
                        </label>
                        <span className="form-hint">Автоматически переподключаться при потере соединения</span>
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group checkbox-group">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={advancedSettings.compress}
                            onChange={(e) => setAdvancedSettings(prev => ({ ...prev, compress: e.target.checked }))}
                          />
                          <span className="checkmark"></span>
                          Сжатие данных
                        </label>
                        <span className="form-hint">Использовать сжатие для уменьшения трафика</span>
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group checkbox-group">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={advancedSettings.multipleStatements}
                            onChange={(e) => setAdvancedSettings(prev => ({ ...prev, multipleStatements: e.target.checked }))}
                          />
                          <span className="checkmark"></span>
                          Множественные запросы
                        </label>
                        <span className="form-hint">Разрешить выполнение нескольких SQL запросов за раз</span>
                      </div>
                    </div>
                  </>
                )}

                {/* Test Connection Result */}
                {testResult && (
                  <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                    <svg viewBox="0 0 24 24" width="20" height="20">
                      {testResult.success ? (
                        <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      ) : (
                        <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                      )}
                    </svg>
                    <span>{testResult.message}</span>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={closeModal}>
                  Отмена
                </button>
                <button 
                  type="button" 
                  className={`btn-secondary test-btn ${testingConnection ? 'testing' : ''}`}
                  onClick={testConnection}
                  disabled={testingConnection}
                >
                  {testingConnection ? (
                    <>
                      <span className="spinner"></span>
                      Проверка...
                    </>
                  ) : (
                    'Проверить соединение'
                  )}
                </button>
                <button type="submit" className="btn-primary">
                  {editingConnection ? 'Сохранить' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .welcome-screen {
          min-height: 100vh;
          background: linear-gradient(180deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
          display: flex;
          flex-direction: column;
        }

        /* Header */
        .welcome-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 24px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border);
        }

        .header-left .logo {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .header-nav {
          display: flex;
          gap: 8px;
        }

        .nav-link {
          padding: 8px 16px;
          color: var(--text-secondary);
          text-decoration: none;
          border-radius: 8px;
          transition: all 0.2s;
          background: transparent;
          border: none;
          font-size: 14px;
          cursor: pointer;
        }

        .nav-link:hover, .nav-link.active {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .header-right .user-menu {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .user-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--ctp-blue), var(--ctp-mauve));
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          color: var(--bg-primary);
        }

        .user-name {
          color: var(--text-primary);
          font-weight: 500;
        }

        .logout-btn {
          padding: 8px;
          background: transparent;
          border: none;
          border-radius: 8px;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s;
        }

        .logout-btn:hover {
          background: var(--ctp-surface1);
          color: var(--ctp-red);
        }

        /* Main */
        .welcome-main {
          flex: 1;
          padding: 40px 60px;
          max-width: 1400px;
          margin: 0 auto;
          width: 100%;
        }

        .welcome-main.full-height {
          padding: 0;
          max-width: none;
          overflow: hidden;
        }

        /* Hero */
        .welcome-hero {
          text-align: center;
          margin-bottom: 48px;
        }

        .welcome-hero h1 {
          font-size: 32px;
          font-weight: 300;
          color: var(--text-primary);
          margin-bottom: 16px;
        }

        .welcome-hero p {
          color: var(--text-secondary);
          font-size: 15px;
          max-width: 600px;
          margin: 0 auto 24px;
          line-height: 1.6;
        }

        .hero-links {
          display: flex;
          justify-content: center;
          gap: 32px;
        }

        .hero-link {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--accent);
          text-decoration: none;
          font-size: 14px;
          transition: color 0.2s;
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 0;
        }

        .hero-link:hover {
          color: var(--ctp-lavender);
        }

        /* Connections Section */
        .connections-section {
          margin-bottom: 48px;
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }

        .section-header h2 {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 18px;
          font-weight: 500;
          color: var(--text-primary);
        }

        .add-connection-btn, .manage-connections-btn {
          padding: 6px;
          background: transparent;
          border: none;
          border-radius: 6px;
          color: var(--accent);
          cursor: pointer;
          transition: all 0.2s;
        }

        .add-connection-btn:hover, .manage-connections-btn:hover {
          background: var(--bg-tertiary);
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: var(--bg-tertiary);
          border-radius: 8px;
          width: 280px;
        }

        .search-box svg {
          color: var(--text-muted);
        }

        .search-box input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: var(--text-primary);
          font-size: 14px;
        }

        .search-box input::placeholder {
          color: var(--text-muted);
        }

        /* Connections Grid */
        .connections-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 16px;
        }

        .connection-card {
          background: var(--bg-tertiary);
          border-radius: 12px;
          padding: 20px;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
          overflow: hidden;
        }

        .connection-card:hover {
          background: var(--ctp-surface1);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        }

        .card-accent {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
        }

        .card-icon {
          margin-bottom: 16px;
        }

        .card-content h3 {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 8px;
        }

        .card-details {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .card-details .detail {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: var(--text-secondary);
        }

        .card-actions {
          position: absolute;
          top: 12px;
          right: 12px;
          display: flex;
          gap: 4px;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .connection-card:hover .card-actions {
          opacity: 1;
        }

        .card-action-btn {
          padding: 6px;
          background: var(--ctp-surface1);
          border: none;
          border-radius: 6px;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s;
        }

        .card-action-btn:hover {
          background: var(--ctp-surface2);
          color: var(--text-primary);
        }

        .card-action-btn.danger:hover {
          background: var(--ctp-red);
          color: var(--bg-primary);
        }

        /* Add Card */
        .connection-card.add-card {
          border: 2px dashed var(--ctp-surface1);
          background: transparent;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          min-height: 180px;
        }

        .connection-card.add-card:hover {
          border-color: var(--accent);
          background: rgba(137, 180, 250, 0.05);
        }

        .add-icon {
          color: var(--text-muted);
        }

        .connection-card.add-card span {
          color: var(--text-muted);
          font-size: 14px;
        }

        .connection-card.add-card:hover .add-icon,
        .connection-card.add-card:hover span {
          color: var(--accent);
        }

        /* Empty State */
        .empty-state {
          text-align: center;
          padding: 60px 20px;
        }

        .empty-state svg {
          color: var(--ctp-surface1);
          margin-bottom: 24px;
        }

        .empty-state h3 {
          font-size: 18px;
          color: var(--text-primary);
          margin-bottom: 8px;
        }

        .empty-state p {
          color: var(--text-muted);
          margin-bottom: 24px;
        }

        .btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          background: linear-gradient(135deg, var(--ctp-blue), var(--ctp-mauve));
          border: none;
          border-radius: 8px;
          color: var(--bg-primary);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(137, 180, 250, 0.3);
        }

        /* Recent Section */
        .recent-section {
          background: var(--bg-tertiary);
          border-radius: 12px;
          padding: 20px;
        }

        .recent-section h3 {
          font-size: 14px;
          font-weight: 500;
          color: var(--text-secondary);
          margin-bottom: 16px;
        }

        .recent-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .recent-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .recent-item:hover {
          background: var(--ctp-surface1);
        }

        .recent-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .recent-info {
          flex: 1;
        }

        .recent-name {
          display: block;
          font-size: 14px;
          color: var(--text-primary);
          font-weight: 500;
        }

        .recent-time {
          font-size: 12px;
          color: var(--text-muted);
        }

        .no-recent {
          color: var(--text-muted);
          font-size: 14px;
          text-align: center;
          padding: 20px;
        }

        /* Context Menu */
        .context-menu {
          position: fixed;
          background: var(--bg-tertiary);
          border: 1px solid var(--ctp-surface1);
          border-radius: 8px;
          padding: 8px 0;
          min-width: 200px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          z-index: 1000;
        }

        .context-menu-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          color: var(--text-primary);
          cursor: pointer;
          font-size: 14px;
          transition: background 0.15s;
        }

        .context-menu-item:hover {
          background: var(--ctp-surface1);
        }

        .context-menu-item.danger {
          color: var(--ctp-red);
        }

        .context-menu-item.danger:hover {
          background: rgba(243, 139, 168, 0.15);
        }

        .context-menu-divider {
          height: 1px;
          background: var(--ctp-surface1);
          margin: 8px 0;
        }

        /* Modal */
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
          z-index: 1000;
        }

        .connection-modal {
          width: 90%;
          max-width: 550px;
          background: var(--bg-primary);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }

        .modal-header {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 24px;
          background: var(--bg-tertiary);
          border-bottom: 1px solid var(--ctp-surface1);
        }

        .modal-title h3 {
          font-size: 18px;
          color: var(--text-primary);
          margin-bottom: 4px;
        }

        .modal-title p {
          font-size: 13px;
          color: var(--text-muted);
        }

        .modal-close {
          margin-left: auto;
          padding: 8px;
          background: transparent;
          border: none;
          font-size: 24px;
          color: var(--text-muted);
          cursor: pointer;
        }

        .modal-close:hover {
          color: var(--text-primary);
        }

        .modal-body {
          padding: 24px;
        }

        .form-tabs {
          display: flex;
          gap: 4px;
          margin-bottom: 20px;
          padding: 4px;
          background: var(--bg-tertiary);
          border-radius: 8px;
        }

        .form-tab {
          flex: 1;
          padding: 8px 16px;
          background: transparent;
          border: none;
          border-radius: 6px;
          color: var(--text-muted);
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .form-tab.active {
          background: var(--ctp-surface1);
          color: var(--text-primary);
        }

        .form-row {
          margin-bottom: 20px;
        }

        .form-row.two-cols {
          display: grid;
          grid-template-columns: 1fr 120px;
          gap: 16px;
        }

        .form-group label {
          display: block;
          font-size: 13px;
          color: var(--text-secondary);
          margin-bottom: 8px;
        }

        .form-group input {
          width: 100%;
          padding: 12px;
          background: var(--bg-tertiary);
          border: 1px solid var(--ctp-surface1);
          border-radius: 8px;
          color: var(--text-primary);
          font-size: 14px;
          transition: border-color 0.2s;
        }

        .form-group input:focus {
          outline: none;
          border-color: var(--accent);
        }

        .form-group input::placeholder {
          color: var(--text-muted);
        }

        .form-hint {
          display: block;
          margin-top: 6px;
          font-size: 12px;
          color: var(--text-muted);
        }

        .color-picker {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .color-option {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 2px solid transparent;
          cursor: pointer;
          transition: all 0.2s;
        }

        .color-option:hover {
          transform: scale(1.1);
        }

        .color-option.selected {
          border-color: var(--text-primary);
          box-shadow: 0 0 0 2px var(--bg-primary);
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 24px;
          background: var(--bg-tertiary);
          border-top: 1px solid var(--ctp-surface1);
        }

        .btn-secondary {
          padding: 10px 20px;
          background: var(--ctp-surface1);
          border: none;
          border-radius: 8px;
          color: var(--text-primary);
          font-size: 14px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-secondary:hover {
          background: var(--ctp-surface2);
        }

        .modal-footer .btn-primary {
          padding: 10px 20px;
        }

        /* Checkbox styling */
        .checkbox-group {
          margin-bottom: 8px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          font-size: 14px;
          color: var(--text-primary);
        }

        .checkbox-label input[type="checkbox"] {
          width: 18px;
          height: 18px;
          accent-color: var(--accent);
          cursor: pointer;
        }

        /* File input group */
        .file-input-group {
          display: flex;
          gap: 8px;
        }

        .file-input-group input {
          flex: 1;
        }

        .file-browse-btn {
          padding: 12px 16px;
          background: var(--ctp-surface1);
          border: none;
          border-radius: 8px;
          color: var(--text-primary);
          cursor: pointer;
          transition: background 0.2s;
          white-space: nowrap;
        }

        .file-browse-btn:hover {
          background: var(--ctp-surface2);
        }

        /* SSL disabled notice */
        .ssl-disabled-notice {
          text-align: center;
          padding: 40px 20px;
          background: var(--bg-tertiary);
          border-radius: 12px;
          margin-top: 16px;
        }

        .ssl-disabled-notice h4 {
          color: var(--text-secondary);
          font-size: 16px;
          margin: 16px 0 8px;
        }

        .ssl-disabled-notice p {
          color: var(--text-muted);
          font-size: 13px;
        }

        /* Test result */
        .test-result {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 8px;
          margin-top: 16px;
          font-size: 14px;
        }

        .test-result.success {
          background: rgba(166, 227, 161, 0.15);
          color: var(--ctp-green);
        }

        .test-result.error {
          background: rgba(243, 139, 168, 0.15);
          color: var(--ctp-red);
        }

        /* Test button */
        .test-btn {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .test-btn.testing {
          opacity: 0.7;
          pointer-events: none;
        }

        .test-btn .spinner {
          width: 14px;
          height: 14px;
          border: 2px solid var(--text-muted);
          border-top-color: var(--text-primary);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Form tab hover */
        .form-tab:hover:not(.active) {
          background: rgba(69, 71, 90, 0.5);
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
};
