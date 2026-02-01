import React, { useState, useEffect, useCallback } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { WelcomeScreen, Connection } from './components/WelcomeScreen';
import { MainWorkspace } from './components/MainWorkspace';
import { LandingPage } from './components/LandingPage';
import { AuthPage } from './components/AuthPage';
import { APIDocs } from './components/APIDocs';
import { Documentation } from './components/Documentation';
import { VerifyEmail } from './components/VerifyEmail';
import { ResetPassword } from './components/ResetPassword';
import { dbAPI } from './api';
import { ToastProvider } from './components/Toast';
import { LocaleProvider } from './components/Locale';
const isElectron = typeof window !== 'undefined' && 
  (window as any).electron !== undefined;
const ONLINE_SERVER = 'https://adskoekoleso.ru';
type AppView = 'landing' | 'auth' | 'app' | 'docs' | 'api' | 'verify' | 'reset-password' | 'mode-select';
type AuthMode = 'login' | 'register';
interface UserProfile {
  id: string;
  username: string;
  email?: string;
  createdAt: string;
  settings: {
    theme: 'dark' | 'light';
    fontSize: number;
    autoSave: boolean;
  };
  connections: Connection[];
  recentQueries: string[];
}
const getUserStorageKey = (username: string) => `mycsc_user_${username}`;
const getConnectionsKey = (username: string) => `mycsc_connections_${username}`;
const getDatabasesKey = (username: string) => `mycsc_databases_${username}`;
const OFFLINE_USER = 'local_user';

export default function App() {
  const [view, setView] = useState<AppView>(isElectron ? 'mode-select' : 'landing');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [isOffline, setIsOffline] = useState(false);
  const [apiUrl, setApiUrl] = useState<string>(isElectron ? ONLINE_SERVER : '');
  const [activeConnection, setActiveConnection] = useState<Connection | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [oauthErrorMessage, setOauthErrorMessage] = useState<string>('');
  const handleModeSelect = (mode: 'online' | 'offline') => {
    if (mode === 'offline') {
      loadUserProfile(OFFLINE_USER);
      setIsOffline(true);
      setIsAuthenticated(true);
      setApiUrl('');
      setView('app');
    } else {
      setIsOffline(false);
      setApiUrl(ONLINE_SERVER);
      setView('auth');
    }
    localStorage.setItem('mycsc_mode', mode);
  };
  useEffect(() => {
    if (isElectron) {
      const savedMode = localStorage.getItem('mycsc_mode');
      const savedSession = localStorage.getItem('mycsc_current_session');
      
      if (savedMode === 'offline') {
        loadUserProfile(OFFLINE_USER);
        setIsOffline(true);
        setIsAuthenticated(true);
        setView('app');
        return;
      }
      
      if (savedMode === 'online' && savedSession) {
        try {
          const session = JSON.parse(savedSession);
          if (session.token) {
            setSessionId(session.token);
            setApiUrl(ONLINE_SERVER);
            fetch(`${ONLINE_SERVER}/api/auth/me`, {
              headers: { 'Authorization': `Bearer ${session.token}` }
            })
            .then(res => res.json())
            .then(data => {
              if (data.success && data.user) {
                loadUserProfile(data.user.username);
                setIsOffline(false);
                setView('app');
              } else {
                localStorage.removeItem('mycsc_current_session');
                setView('mode-select');
              }
            })
            .catch(() => {
              setView('mode-select');
            });
            return;
          }
        } catch {
          localStorage.removeItem('mycsc_current_session');
        }
      }
      setView('mode-select');
      return;
    }
    const pathname = window.location.pathname;
    if (pathname === '/verify' || pathname.includes('verify')) {
      setView('verify');
      return;
    }
    if (pathname === '/reset-password' || pathname.includes('reset-password')) {
      setView('reset-password');
      return;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const oauthToken = urlParams.get('token');
    const oauthProvider = urlParams.get('provider');
    const oauthError = urlParams.get('error');
    
    if (oauthError) {
      console.error('OAuth error:', oauthError);
      const errorMessages: Record<string, string> = {
        'invalid_state': 'Сессия истекла. Попробуйте войти снова.',
        'no_code': 'Авторизация не завершена. Попробуйте снова.',
        'oauth_failed': 'Не удалось получить данные от провайдера.',
        'oauth_error': 'Ошибка авторизации. Попробуйте позже.'
      };
      setOauthErrorMessage(errorMessages[oauthError] || 'Ошибка авторизации');
      window.history.replaceState({}, '', window.location.pathname);
      setView('auth');
      return;
    }
    
    if (oauthToken && oauthProvider) {
      fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${oauthToken}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user) {
          window.history.replaceState({}, '', window.location.pathname);
          setSessionId(oauthToken);
          localStorage.setItem('mycsc_current_session', JSON.stringify({
            username: data.user.username,
            token: oauthToken,
            provider: oauthProvider
          }));
          
          loadUserProfile(data.user.username);
          setView('app');
        }
      })
      .catch(err => {
        console.error('OAuth session check failed:', err);
        window.history.replaceState({}, '', window.location.pathname);
      });
      return;
    }
    const savedSession = localStorage.getItem('mycsc_current_session');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        if (session.token) {
          setSessionId(session.token);
        }
        loadUserProfile(session.username);
        const savedConnection = localStorage.getItem('mycsc_active_connection');
        if (savedConnection) {
          try {
            const connection = JSON.parse(savedConnection);
            setActiveConnection(connection);
          } catch {
            localStorage.removeItem('mycsc_active_connection');
          }
        }
        
        setView('app');
      } catch {
        localStorage.removeItem('mycsc_current_session');
      }
    }
  }, []);
  const loadUserProfile = (username: string) => {
    const userKey = getUserStorageKey(username);
    const savedProfile = localStorage.getItem(userKey);
    
    let profile: UserProfile;
    
    if (savedProfile) {
      profile = JSON.parse(savedProfile);
    } else {
      profile = {
        id: Date.now().toString(),
        username,
        createdAt: new Date().toISOString(),
        settings: {
          theme: 'dark',
          fontSize: 14,
          autoSave: true
        },
        connections: [],
        recentQueries: []
      };
      localStorage.setItem(userKey, JSON.stringify(profile));
    }
    const connectionsKey = getConnectionsKey(username);
    const savedConnections = localStorage.getItem(connectionsKey);
    const userConnections = savedConnections ? JSON.parse(savedConnections) : [];
    const dbKey = getDatabasesKey(username);
    const savedDbs = localStorage.getItem(dbKey);
    if (savedDbs) {
      localStorage.setItem('mycsc_databases', savedDbs);
    } else {
      localStorage.removeItem('mycsc_databases');
    }

    setCurrentUser(profile);
    setConnections(userConnections);
    setIsAuthenticated(true);
    const existingSession = localStorage.getItem('mycsc_current_session');
    if (existingSession) {
      try {
        const parsed = JSON.parse(existingSession);
        localStorage.setItem('mycsc_current_session', JSON.stringify({ 
          username,
          token: parsed.token || undefined
        }));
      } catch {
        localStorage.setItem('mycsc_current_session', JSON.stringify({ username }));
      }
    } else {
      localStorage.setItem('mycsc_current_session', JSON.stringify({ username }));
    }
  };
  const saveUserData = useCallback(() => {
    if (!currentUser) return;
    
    const userKey = getUserStorageKey(currentUser.username);
    localStorage.setItem(userKey, JSON.stringify(currentUser));
    
    const connectionsKey = getConnectionsKey(currentUser.username);
    localStorage.setItem(connectionsKey, JSON.stringify(connections));
    const dbKey = getDatabasesKey(currentUser.username);
    const currentDbs = localStorage.getItem('mycsc_databases');
    if (currentDbs) {
      localStorage.setItem(dbKey, currentDbs);
    }
  }, [currentUser, connections]);
  useEffect(() => {
    if (isAuthenticated) {
      saveUserData();
    }
  }, [connections, isAuthenticated, saveUserData]);
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentUser) {
        const userKey = getUserStorageKey(currentUser.username);
        localStorage.setItem(userKey, JSON.stringify(currentUser));
        
        const connectionsKey = getConnectionsKey(currentUser.username);
        localStorage.setItem(connectionsKey, JSON.stringify(connections));
        
        const dbKey = getDatabasesKey(currentUser.username);
        const currentDbs = localStorage.getItem('mycsc_databases');
        if (currentDbs) {
          localStorage.setItem(dbKey, currentDbs);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentUser, connections]);
  const handleLogin = (username: string) => {
    loadUserProfile(username);
    setView('app');
  };

  const handleLogout = () => {
    saveUserData();
    setCurrentUser(null);
    setIsAuthenticated(false);
    setActiveConnection(null);
    setConnections([]);
    setSessionId('');
    setIsOffline(false);
    localStorage.removeItem('mycsc_current_session');
    localStorage.removeItem('mycsc_active_connection');
    localStorage.removeItem('mycsc_mode');
    localStorage.removeItem('mycsc_databases');
    setView(isElectron ? 'mode-select' : 'landing');
  };
  const handleAuthSuccess = (user: { username: string; token: string }) => {
    localStorage.setItem('mycsc_current_session', JSON.stringify({ 
      username: user.username, 
      token: user.token 
    }));
    setSessionId(user.token);
    loadUserProfile(user.username);
    setView('app');
  };
  const handleConnect = (connection: Connection) => {
    const updatedConnections = connections.map(c => 
      c.id === connection.id 
        ? { ...c, lastUsed: new Date().toISOString() }
        : c
    );
    setConnections(updatedConnections);
    setActiveConnection(connection);
    localStorage.setItem('mycsc_active_connection', JSON.stringify(connection));
  };

  const handleDisconnect = () => {
    saveUserData();
    setActiveConnection(null);
    localStorage.removeItem('mycsc_active_connection');
  };

  const handleCreateConnection = (data: Omit<Connection, 'id' | 'createdAt'>) => {
    const newConnection: Connection = {
      ...data,
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    };
    setConnections(prev => [...prev, newConnection]);
  };

  const handleEditConnection = (connection: Connection) => {
    setConnections(prev => prev.map(c => c.id === connection.id ? connection : c));
  };

  const handleDeleteConnection = (id: string) => {
    if (confirm('Удалить это подключение?')) {
      setConnections(prev => prev.filter(c => c.id !== id));
    }
  };
  if (view === 'mode-select' && isElectron) {
    return (
      <LocaleProvider>
        <ToastProvider>
          <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Segoe UI', system-ui, sans-serif"
          }}>
            <div style={{
              background: 'rgba(30, 30, 46, 0.9)',
              borderRadius: 24,
              padding: 48,
              maxWidth: 500,
              width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.1)',
              textAlign: 'center'
            }}>
              <div style={{
                width: 80,
                height: 80,
                margin: '0 auto 24px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                  <ellipse cx="12" cy="5" rx="9" ry="3"/>
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                </svg>
              </div>
              <h1 style={{ color: '#cdd6f4', fontSize: 28, marginBottom: 12 }}>MYCSC Database</h1>
              <p style={{ color: '#a6adc8', fontSize: 16, marginBottom: 32 }}>
                Выберите режим работы
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <button
                  onClick={() => handleModeSelect('online')}
                  style={{
                    padding: '20px 32px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 16,
                    fontSize: 18,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="2" y1="12" x2="22" y2="12"/>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                  Онлайн режим
                </button>
                <p style={{ color: '#6c7086', fontSize: 13, margin: '-8px 0 8px' }}>
                  Синхронизация с сервером, совместная работа
                </p>
                
                <button
                  onClick={() => handleModeSelect('offline')}
                  style={{
                    padding: '20px 32px',
                    background: 'rgba(69, 71, 90, 0.5)',
                    color: '#cdd6f4',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 16,
                    fontSize: 18,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/>
                    <line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                  Локальный режим
                </button>
                <p style={{ color: '#6c7086', fontSize: 13, margin: '-8px 0 0' }}>
                  Работа без интернета, данные на компьютере
                </p>
              </div>
            </div>
          </div>
        </ToastProvider>
      </LocaleProvider>
    );
  }
  if (view === 'landing' && !isElectron) {
    return (
      <LocaleProvider>
        <ToastProvider>
          <LandingPage 
            onLogin={() => { setAuthMode('login'); setView('auth'); }}
            onRegister={() => { setAuthMode('register'); setView('auth'); }}
            onDocs={() => setView('docs')}
            onAPI={() => setView('api')}
          />
        </ToastProvider>
      </LocaleProvider>
    );
  }
  if (view === 'verify') {
    return (
      <LocaleProvider>
        <ToastProvider>
          <VerifyEmail 
            onSuccess={() => {
              window.history.replaceState({}, '', '/');
              setView(isAuthenticated ? 'app' : 'landing');
            }}
            onBack={() => {
              window.history.replaceState({}, '', '/');
              setView(isAuthenticated ? 'app' : 'landing');
            }}
          />
        </ToastProvider>
      </LocaleProvider>
    );
  }
  if (view === 'reset-password') {
    return (
      <LocaleProvider>
        <ToastProvider>
          <ResetPassword 
            onSuccess={() => {
              window.history.replaceState({}, '', '/');
              setView('auth');
              setAuthMode('login');
            }}
            onBack={() => {
              window.history.replaceState({}, '', '/');
              setView('auth');
            }}
          />
        </ToastProvider>
      </LocaleProvider>
    );
  }
  if (view === 'docs' && !isElectron) {
    return (
      <LocaleProvider>
        <ToastProvider>
          <Documentation 
            isOpen={true}
            onClose={() => setView('landing')}
          />
        </ToastProvider>
      </LocaleProvider>
    );
  }
  if (view === 'api' && !isElectron) {
    return (
      <LocaleProvider>
        <ToastProvider>
          <APIDocs onBack={() => setView('landing')} />
        </ToastProvider>
      </LocaleProvider>
    );
  }
  if (view === 'auth') {
    return (
      <LocaleProvider>
        <ToastProvider>
          <AuthPage
            mode={authMode}
            onModeChange={setAuthMode}
            onSuccess={handleAuthSuccess}
            onBack={() => setView(isElectron ? 'mode-select' : 'landing')}
            baseUrl={apiUrl}
          />
        </ToastProvider>
      </LocaleProvider>
    );
  }
  if (activeConnection) {
    return (
      <LocaleProvider>
        <ToastProvider>
          <MainWorkspace
            connection={activeConnection}
            onDisconnect={handleDisconnect}
            dbAPI={dbAPI}
            sessionId={sessionId}
            apiUrl={apiUrl}
            username={currentUser?.username || ''}
          />
        </ToastProvider>
      </LocaleProvider>
    );
  }
  return (
    <LocaleProvider>
      <ToastProvider>
        <WelcomeScreen
          username={currentUser?.username || ''}
          connections={connections}
          onConnect={handleConnect}
          onCreateConnection={handleCreateConnection}
          onEditConnection={handleEditConnection}
          onDeleteConnection={handleDeleteConnection}
          onLogout={handleLogout}
          sessionId={sessionId}
          apiUrl={apiUrl}
        />
      </ToastProvider>
    </LocaleProvider>
  );
}
