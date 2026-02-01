import React, { useState } from 'react';
const USERS_STORAGE_KEY = 'mycsc_users';

interface StoredUser {
  username: string;
  passwordHash: string;
  createdAt: string;
}
const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36) + str.length.toString(36);
};

const getStoredUsers = (): StoredUser[] => {
  try {
    const data = localStorage.getItem(USERS_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveUsers = (users: StoredUser[]) => {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
};

interface AuthScreenProps {
  onLogin: (username: string) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      const users = getStoredUsers();

      if (isLogin) {
        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
        
        if (!user) {
          setError('Пользователь не найден');
          setLoading(false);
          return;
        }

        if (user.passwordHash !== simpleHash(password)) {
          setError('Неверный пароль');
          setLoading(false);
          return;
        }

        onLogin(user.username);
      } else {
        if (username.length < 3) {
          setError('Имя пользователя должно быть не менее 3 символов');
          setLoading(false);
          return;
        }

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
          setError('Имя пользователя может содержать только буквы, цифры и _');
          setLoading(false);
          return;
        }

        if (password !== confirmPassword) {
          setError('Пароли не совпадают');
          setLoading(false);
          return;
        }

        if (password.length < 6) {
          setError('Пароль должен быть не менее 6 символов');
          setLoading(false);
          return;
        }

        const existingUser = users.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (existingUser) {
          setError('Пользователь с таким именем уже существует');
          setLoading(false);
          return;
        }
        const newUser: StoredUser = {
          username: username,
          passwordHash: simpleHash(password),
          createdAt: new Date().toISOString()
        };

        users.push(newUser);
        saveUsers(users);
        onLogin(username);
      }
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка');
    }

    setLoading(false);
  };

  return (
    <div className="auth-screen">
      <div className="auth-container">
        <div className="auth-logo">
          <svg viewBox="0 0 100 100" className="logo-svg">
            <defs>
              <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#89b4fa" />
                <stop offset="100%" stopColor="#cba6f7" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="45" fill="none" stroke="url(#logoGradient)" strokeWidth="3"/>
            <path d="M30 35 L50 25 L70 35 L70 65 L50 75 L30 65 Z" fill="none" stroke="url(#logoGradient)" strokeWidth="2"/>
            <path d="M30 50 L50 40 L70 50" fill="none" stroke="url(#logoGradient)" strokeWidth="2"/>
            <circle cx="50" cy="50" r="8" fill="url(#logoGradient)" opacity="0.8"/>
          </svg>
          <h1 className="logo-text">MYCSC</h1>
          <p className="logo-subtitle">Система управления базами данных</p>
        </div>

        <div className="auth-tabs">
          <button 
            className={`auth-tab ${isLogin ? 'active' : ''}`}
            onClick={() => { setIsLogin(true); setError(''); }}
          >
            Вход
          </button>
          <button 
            className={`auth-tab ${!isLogin ? 'active' : ''}`}
            onClick={() => { setIsLogin(false); setError(''); }}
          >
            Регистрация
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">Имя пользователя</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Введите имя пользователя"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Пароль</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль"
              required
            />
          </div>

          {!isLogin && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Подтвердите пароль</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Повторите пароль"
                required
              />
            </div>
          )}

          {error && (
            <div className="auth-error">
              <svg viewBox="0 0 24 24" className="error-icon">
                <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              {error}
            </div>
          )}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? (
              <span className="loading-spinner"></span>
            ) : (
              isLogin ? 'Войти' : 'Зарегистрироваться'
            )}
          </button>
        </form>
      </div>

      <style>{`
        .auth-screen {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
          padding: 20px;
        }

        .auth-container {
          width: 100%;
          max-width: 400px;
          background: var(--bg-tertiary);
          border-radius: 16px;
          padding: 40px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }

        .auth-logo {
          text-align: center;
          margin-bottom: 32px;
        }

        .logo-svg {
          width: 80px;
          height: 80px;
          margin-bottom: 16px;
        }

        .logo-text {
          font-size: 28px;
          font-weight: 700;
          background: linear-gradient(135deg, var(--ctp-blue), var(--ctp-mauve));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin: 0;
        }

        .logo-subtitle {
          color: var(--text-muted);
          font-size: 14px;
          margin: 8px 0 0 0;
        }

        .auth-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
        }

        .auth-tab {
          flex: 1;
          padding: 12px;
          background: var(--ctp-surface1);
          border: none;
          border-radius: 8px;
          color: var(--text-secondary);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .auth-tab:hover {
          background: var(--ctp-surface2);
        }

        .auth-tab.active {
          background: linear-gradient(135deg, var(--ctp-blue), var(--ctp-mauve));
          color: var(--ctp-crust);
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group label {
          color: var(--text-primary);
          font-size: 14px;
          font-weight: 500;
        }

        .form-group input {
          padding: 14px 16px;
          background: var(--bg-primary);
          border: 2px solid var(--ctp-surface1);
          border-radius: 8px;
          color: var(--text-primary);
          font-size: 14px;
          transition: all 0.2s ease;
        }

        .form-group input:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(137, 180, 250, 0.2);
        }

        .form-group input::placeholder {
          color: var(--text-muted);
        }

        .auth-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          background: rgba(243, 139, 168, 0.1);
          border: 1px solid var(--error);
          border-radius: 8px;
          color: var(--error);
          font-size: 13px;
        }

        .error-icon {
          width: 20px;
          height: 20px;
          flex-shrink: 0;
        }

        .auth-submit {
          padding: 14px;
          background: linear-gradient(135deg, var(--ctp-blue), var(--ctp-mauve));
          border: none;
          border-radius: 8px;
          color: var(--ctp-crust);
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .auth-submit:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(137, 180, 250, 0.3);
        }

        .auth-submit:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .loading-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid transparent;
          border-top-color: var(--ctp-crust);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .auth-demo {
          margin-top: 24px;
          padding-top: 24px;
          border-top: 1px solid var(--ctp-surface1);
          text-align: center;
        }

        .auth-demo p {
          color: var(--text-muted);
          font-size: 13px;
          margin: 0 0 12px 0;
        }

        .demo-button {
          padding: 10px 20px;
          background: transparent;
          border: 1px solid var(--ctp-surface1);
          border-radius: 6px;
          color: var(--accent);
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .demo-button:hover {
          background: var(--ctp-surface1);
        }
      `}</style>
    </div>
  );
};
