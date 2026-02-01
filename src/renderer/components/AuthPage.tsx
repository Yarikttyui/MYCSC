import React, { useState, useEffect } from 'react';
const isElectron = typeof window !== 'undefined' && 
  (window as any).electron !== undefined;

interface AuthPageProps {
  mode: 'login' | 'register';
  onModeChange: (mode: 'login' | 'register') => void;
  onSuccess: (user: { username: string; token: string }) => void;
  onBack: () => void;
  baseUrl?: string;
}

export const AuthPage: React.FC<AuthPageProps> = ({ mode, onModeChange, onSuccess, onBack, baseUrl = '' }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const apiRequest = async (url: string, options: { method?: string; body?: any; headers?: Record<string, string> } = {}) => {
    const electron = (window as any).electron;
    
    if (electron?.apiRequest) {
      const result = await electron.apiRequest({
        url,
        method: options.method || 'GET',
        headers: options.headers || { 'Content-Type': 'application/json' },
        body: options.body ? JSON.stringify(options.body) : undefined
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Ошибка сети');
      }
      return result.data;
    } else {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: options.headers || { 'Content-Type': 'application/json' },
        body: options.body ? JSON.stringify(options.body) : undefined
      });
      return response.json();
    }
  };
  const handleElectronOAuth = async (provider: 'google' | 'github') => {
    const apiBaseUrl = baseUrl || 'https://adskoekoleso.ru';
    setLoading(true);
    setError('');
    
    try {
      if ((window as any).electron?.oauth) {
        const result = await (window as any).electron.oauth(provider, apiBaseUrl);
        
        if (result.success && result.token) {
          const data = await apiRequest(`${apiBaseUrl}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${result.token}` }
          });
          
          if (data.success && data.user) {
            onSuccess({ username: data.user.username, token: result.token });
          } else {
            setError('Ошибка получения данных пользователя');
          }
        } else if (result.error) {
          if (result.error !== 'Окно авторизации закрыто') {
            setError(result.error);
          }
        }
      } else {
        window.location.href = `${apiBaseUrl}/api/auth/${provider}`;
      }
    } catch (err: any) {
      setError('Ошибка авторизации: ' + (err.message || 'Неизвестная ошибка'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (!isElectron) {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      if (token) {
        const apiBaseUrl = baseUrl || 'https://adskoekoleso.ru';
        fetch(`${apiBaseUrl}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.user) {
            window.history.replaceState({}, '', window.location.pathname);
            onSuccess({ username: data.user.username, token });
          }
        })
        .catch(console.error);
      }
    }
  }, [baseUrl, onSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const apiBaseUrl = baseUrl || 'https://adskoekoleso.ru';

    try {
      if (mode === 'register') {
        if (password !== confirmPassword) {
          throw new Error('Пароли не совпадают');
        }
        if (password.length < 6) {
          throw new Error('Пароль должен быть не менее 6 символов');
        }
        if (!email.includes('@')) {
          throw new Error('Некорректный email');
        }
        const data = await apiRequest(`${apiBaseUrl}/api/auth/register`, {
          method: 'POST',
          body: { username, email, password }
        });
        
        if (!data.success) {
          throw new Error(data.error || 'Ошибка регистрации');
        }
        setRegisteredEmail(email);
        setShowEmailVerification(true);
      } else {
        const data = await apiRequest(`${apiBaseUrl}/api/auth/login`, {
          method: 'POST',
          body: { username, password }
        });
        
        if (!data.success) {
          throw new Error(data.error || 'Неверный логин или пароль');
        }

        onSuccess({ username, token: data.sessionId });
      }
    } catch (err: any) {
      if (err.message === 'Failed to fetch') {
        setError('Нет подключения к серверу. Проверьте интернет-соединение.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };
  if (showEmailVerification) {
    return (
      <div style={styles.container}>
        <div style={styles.background}>
          <div style={styles.bgCircle1} />
          <div style={styles.bgCircle2} />
          <div style={styles.bgCircle3} />
        </div>

        <div style={styles.card}>
          <div style={styles.logoSection}>
            <div style={{
              width: 80,
              height: 80,
              background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
          </div>

          <h2 style={{...styles.title, color: '#22c55e'}}>
            Проверьте почту!
          </h2>
          <p style={{...styles.subtitle, marginBottom: 24}}>
            Мы отправили письмо с кодом подтверждения на
          </p>
          <p style={{
            color: '#89b4fa',
            fontSize: 18,
            fontWeight: 600,
            marginBottom: 32,
            padding: '12px 24px',
            background: 'rgba(137, 180, 250, 0.1)',
            borderRadius: 12,
            display: 'inline-block'
          }}>
            {registeredEmail}
          </p>
          
          <p style={{...styles.subtitle, fontSize: 14, marginBottom: 24}}>
            Откройте письмо и перейдите по ссылке для подтверждения аккаунта.
            После подтверждения вы сможете войти в систему.
          </p>

          <button
            onClick={() => {
              setShowEmailVerification(false);
              onModeChange('login');
            }}
            style={styles.submitBtn}
          >
            Перейти к входу
          </button>
          
          <p style={{...styles.switchText, marginTop: 16}}>
            Не получили письмо?{' '}
            <button
              onClick={async () => {
                const apiBaseUrl = baseUrl || 'https://adskoekoleso.ru';
                try {
                  await fetch(`${apiBaseUrl}/api/auth/resend-verification`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: registeredEmail })
                  });
                  alert('Письмо отправлено повторно!');
                } catch {
                  alert('Ошибка при отправке письма');
                }
              }}
              style={styles.switchBtn}
            >
              Отправить снова
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.background}>
        <div style={styles.bgCircle1} />
        <div style={styles.bgCircle2} />
        <div style={styles.bgCircle3} />
      </div>

      <button onClick={onBack} style={styles.backBtn}>
        ← Назад
      </button>

      <div style={styles.card}>
        <div style={styles.logoSection}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="url(#authLogoGrad)" strokeWidth="2">
            <defs><linearGradient id="authLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#89b4fa"/><stop offset="100%" stopColor="#cba6f7"/></linearGradient></defs>
            <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
          </svg>
          <h1 style={styles.logoText}>MYCSC</h1>
        </div>

        <h2 style={styles.title}>
          {mode === 'login' ? 'Вход в систему' : 'Регистрация'}
        </h2>
        <p style={styles.subtitle}>
          {mode === 'login' 
            ? 'Введите данные для входа в MYCSC Database'
            : 'Создайте аккаунт для доступа к MYCSC Database'
          }
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Имя пользователя</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Введите имя пользователя"
              style={styles.input}
              required
            />
          </div>

          {mode === 'register' && (
            <div style={styles.inputGroup}>
              <label style={styles.label}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@mail.com"
                style={styles.input}
                required
              />
            </div>
          )}

          <div style={styles.inputGroup}>
            <label style={styles.label}>Пароль</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={styles.input}
              required
            />
          </div>

          {mode === 'register' && (
            <div style={styles.inputGroup}>
              <label style={styles.label}>Подтвердите пароль</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                style={styles.input}
                required
              />
            </div>
          )}

          {error && (
            <div style={styles.error}>
              ⚠️ {error}
            </div>
          )}

          <button 
            type="submit" 
            style={{...styles.submitBtn, opacity: loading ? 0.7 : 1}}
            disabled={loading}
          >
            {loading 
              ? '⏳ Подождите...' 
              : mode === 'login' ? 'Войти' : 'Создать аккаунт'
            }
          </button>
        </form>

        <div style={styles.divider}>
          <span style={styles.dividerLine} />
          <span style={styles.dividerText}>или войдите через</span>
          <span style={styles.dividerLine} />
        </div>

        {/* OAuth Buttons - Google и GitHub */}
        <div style={styles.oauthContainer}>
          <button 
            onClick={(e) => {
              e.preventDefault();
              if (isElectron) {
                handleElectronOAuth('google');
              } else {
                window.location.href = `${baseUrl}/api/auth/google`;
              }
            }}
            style={{...styles.oauthBtn, ...styles.googleBtn}}
            type="button"
          >
            <svg viewBox="0 0 24 24" style={styles.oauthIcon}>
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google
          </button>
          <button 
            onClick={(e) => {
              e.preventDefault();
              if (isElectron) {
                handleElectronOAuth('github');
              } else {
                window.location.href = `${baseUrl}/api/auth/github`;
              }
            }}
            style={{...styles.oauthBtn, ...styles.githubBtn}}
            type="button"
          >
            <svg viewBox="0 0 24 24" style={styles.oauthIcon}>
              <path fill="currentColor" d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            GitHub
          </button>
        </div>

        <p style={styles.switchText}>
          {mode === 'login' ? (
            <>
              Нет аккаунта?{' '}
              <button 
                onClick={() => onModeChange('register')} 
                style={styles.switchBtn}
              >
                Зарегистрироваться
              </button>
            </>
          ) : (
            <>
              Уже есть аккаунт?{' '}
              <button 
                onClick={() => onModeChange('login')} 
                style={styles.switchBtn}
              >
                Войти
              </button>
            </>
          )}
        </p>

        {mode === 'login' && (
          <p style={{...styles.switchText, marginTop: '12px'}}>
            <button 
              onClick={() => window.location.href = '/reset-password'} 
              style={{...styles.switchBtn, color: '#a6adc8'}}
            >
              Забыли пароль?
            </button>
          </p>
        )}

      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #1e1e2e 0%, #181825 100%)',
    position: 'relative' as const,
    overflow: 'hidden',
  },
  background: {
    position: 'absolute' as const,
    inset: 0,
    overflow: 'hidden',
  },
  bgCircle1: {
    position: 'absolute' as const,
    width: '600px',
    height: '600px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(137, 180, 250, 0.15) 0%, transparent 70%)',
    top: '-200px',
    right: '-100px',
  },
  bgCircle2: {
    position: 'absolute' as const,
    width: '400px',
    height: '400px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(203, 166, 247, 0.15) 0%, transparent 70%)',
    bottom: '-100px',
    left: '-100px',
  },
  bgCircle3: {
    position: 'absolute' as const,
    width: '300px',
    height: '300px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(166, 227, 161, 0.1) 0%, transparent 70%)',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  },
  backBtn: {
    position: 'absolute' as const,
    top: '24px',
    left: '24px',
    padding: '10px 20px',
    background: 'rgba(255, 255, 255, 0.1)',
    border: 'none',
    borderRadius: '8px',
    color: '#cdd6f4',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s',
    zIndex: 10,
  },
  card: {
    background: 'rgba(30, 30, 46, 0.8)',
    backdropFilter: 'blur(20px)',
    borderRadius: '24px',
    padding: '48px',
    width: '100%',
    maxWidth: '420px',
    border: '1px solid rgba(205, 214, 244, 0.1)',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
    position: 'relative' as const,
    zIndex: 1,
  },
  logoSection: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '32px',
  },
  logoIcon: {
    fontSize: '36px',
  },
  logoText: {
    fontSize: '28px',
    fontWeight: 700,
    background: 'linear-gradient(135deg, #89b4fa, #cba6f7)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  title: {
    fontSize: '24px',
    fontWeight: 600,
    color: '#cdd6f4',
    textAlign: 'center' as const,
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#a6adc8',
    textAlign: 'center' as const,
    marginBottom: '32px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#cdd6f4',
  },
  input: {
    padding: '14px 16px',
    background: 'rgba(17, 17, 27, 0.6)',
    border: '1px solid rgba(205, 214, 244, 0.1)',
    borderRadius: '10px',
    color: '#cdd6f4',
    fontSize: '15px',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  error: {
    padding: '12px 16px',
    background: 'rgba(243, 139, 168, 0.1)',
    border: '1px solid rgba(243, 139, 168, 0.3)',
    borderRadius: '8px',
    color: '#f38ba8',
    fontSize: '14px',
  },
  submitBtn: {
    padding: '16px',
    background: 'linear-gradient(135deg, #89b4fa, #cba6f7)',
    border: 'none',
    borderRadius: '12px',
    color: '#1e1e2e',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    boxShadow: '0 4px 20px rgba(137, 180, 250, 0.3)',
    marginTop: '8px',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    margin: '24px 0',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    background: 'rgba(205, 214, 244, 0.1)',
  },
  dividerText: {
    fontSize: '12px',
    color: '#6c7086',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
  },
  switchText: {
    textAlign: 'center' as const,
    color: '#a6adc8',
    fontSize: '14px',
  },
  switchBtn: {
    background: 'none',
    border: 'none',
    color: '#89b4fa',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    textDecoration: 'underline',
  },
  oauthContainer: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px',
  },
  oauthBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '14px 20px',
    background: 'rgba(255, 255, 255, 0.95)',
    border: '1px solid rgba(205, 214, 244, 0.2)',
    borderRadius: '12px',
    color: '#1e1e2e',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
  },
  googleBtn: {
    background: 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)',
    color: '#333',
    border: '1px solid rgba(0, 0, 0, 0.1)',
  },
  githubBtn: {
    background: 'linear-gradient(135deg, #24292e 0%, #1b1f23 100%)',
    color: '#ffffff',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  oauthIcon: {
    width: '20px',
    height: '20px',
  },
  oauthTokenSection: {
    marginTop: '20px',
    padding: '16px',
    background: 'rgba(137, 180, 250, 0.1)',
    borderRadius: '12px',
    border: '1px solid rgba(137, 180, 250, 0.2)',
  },
  oauthTokenHint: {
    fontSize: '13px',
    color: '#a6adc8',
    marginBottom: '12px',
    lineHeight: 1.5,
  },
  oauthTokenInput: {
    display: 'flex',
    gap: '8px',
  },
};

export default AuthPage;
