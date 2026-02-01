import React, { useState, useEffect } from 'react';

interface VerifyEmailProps {
  onSuccess: () => void;
  onBack: () => void;
}

export const VerifyEmail: React.FC<VerifyEmailProps> = ({ onSuccess, onBack }) => {
  const [code, setCode] = useState('');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [autoVerifying, setAutoVerifying] = useState(false);
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlUserId = urlParams.get('userId');
    const urlCode = urlParams.get('code');

    if (urlUserId && urlCode) {
      setUserId(urlUserId);
      setCode(urlCode);
      setAutoVerifying(true);
      verifyWithParams(urlUserId, urlCode);
    }
  }, []);

  const verifyWithParams = async (verifyUserId: string, verifyCode: string) => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: verifyUserId, code: verifyCode })
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Email успешно подтверждён!' });
        window.history.replaceState({}, '', window.location.pathname);
        setTimeout(() => onSuccess(), 2000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Неверный или истёкший код' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Ошибка соединения с сервером' });
    } finally {
      setLoading(false);
      setAutoVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!code.trim()) {
      setMessage({ type: 'error', text: 'Введите код подтверждения' });
      return;
    }
    const session = localStorage.getItem('mycsc_current_session');
    let currentUserId = userId;
    
    if (!currentUserId && session) {
      try {
        const parsed = JSON.parse(session);
        currentUserId = parsed.userId || '';
      } catch {}
    }

    if (!currentUserId) {
      setMessage({ type: 'error', text: 'Сессия не найдена. Войдите снова.' });
      return;
    }

    await verifyWithParams(currentUserId, code.trim());
  };

  const handleResend = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const session = localStorage.getItem('mycsc_current_session');
      if (!session) {
        setMessage({ type: 'error', text: 'Сессия не найдена' });
        return;
      }

      const parsed = JSON.parse(session);
      
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: parsed.userId })
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Код отправлен на вашу почту' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Не удалось отправить код' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Ошибка соединения' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.background}>
        <div style={styles.bgCircle1} />
        <div style={styles.bgCircle2} />
      </div>

      <button onClick={onBack} style={styles.backBtn}>
        ← Назад
      </button>

      <div style={styles.card}>
        <div style={styles.iconWrapper}>
          <span style={styles.icon}>✉️</span>
        </div>

        <h1 style={styles.title}>Подтверждение Email</h1>
        <p style={styles.subtitle}>
          {autoVerifying 
            ? 'Проверяем код...' 
            : 'Введите код, отправленный на вашу почту'
          }
        </p>

        {message && (
          <div style={{
            ...styles.message,
            background: message.type === 'success' 
              ? 'rgba(166, 227, 161, 0.1)' 
              : 'rgba(243, 139, 168, 0.1)',
            borderColor: message.type === 'success' 
              ? 'rgba(166, 227, 161, 0.3)' 
              : 'rgba(243, 139, 168, 0.3)',
            color: message.type === 'success' ? '#a6e3a1' : '#f38ba8'
          }}>
            {message.type === 'success' ? '✓' : '⚠️'} {message.text}
          </div>
        )}

        {!autoVerifying && (
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Код подтверждения</label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="XXXXXX"
                style={styles.input}
                maxLength={6}
                autoFocus
              />
            </div>

            <button
              type="submit"
              style={{ ...styles.submitBtn, opacity: loading ? 0.7 : 1 }}
              disabled={loading}
            >
              {loading ? 'Проверка...' : 'Подтвердить'}
            </button>
          </form>
        )}

        <div style={styles.resendSection}>
          <p style={styles.resendText}>Не получили код?</p>
          <button
            onClick={handleResend}
            style={styles.resendBtn}
            disabled={loading}
          >
            Отправить повторно
          </button>
        </div>
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
    position: 'relative',
    overflow: 'hidden',
  },
  background: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
  },
  bgCircle1: {
    position: 'absolute',
    width: '500px',
    height: '500px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(137, 180, 250, 0.15) 0%, transparent 70%)',
    top: '-150px',
    right: '-100px',
  },
  bgCircle2: {
    position: 'absolute',
    width: '400px',
    height: '400px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(166, 227, 161, 0.1) 0%, transparent 70%)',
    bottom: '-100px',
    left: '-100px',
  },
  backBtn: {
    position: 'absolute',
    top: '24px',
    left: '24px',
    padding: '10px 20px',
    background: 'rgba(255, 255, 255, 0.1)',
    border: 'none',
    borderRadius: '8px',
    color: '#cdd6f4',
    cursor: 'pointer',
    fontSize: '14px',
    zIndex: 10,
  },
  card: {
    background: 'rgba(30, 30, 46, 0.9)',
    backdropFilter: 'blur(20px)',
    borderRadius: '24px',
    padding: '48px',
    width: '100%',
    maxWidth: '420px',
    border: '1px solid rgba(205, 214, 244, 0.1)',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
    textAlign: 'center',
    zIndex: 1,
  },
  iconWrapper: {
    marginBottom: '24px',
  },
  icon: {
    fontSize: '64px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#cdd6f4',
    marginBottom: '12px',
  },
  subtitle: {
    fontSize: '15px',
    color: '#a6adc8',
    marginBottom: '32px',
  },
  message: {
    padding: '14px 18px',
    borderRadius: '10px',
    border: '1px solid',
    marginBottom: '24px',
    fontSize: '14px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#cdd6f4',
    textAlign: 'left',
  },
  input: {
    padding: '16px 20px',
    background: 'rgba(17, 17, 27, 0.6)',
    border: '1px solid rgba(205, 214, 244, 0.1)',
    borderRadius: '12px',
    color: '#cdd6f4',
    fontSize: '24px',
    fontWeight: 600,
    textAlign: 'center',
    letterSpacing: '8px',
    outline: 'none',
  },
  submitBtn: {
    padding: '16px',
    background: 'linear-gradient(135deg, #a6e3a1, #94e2d5)',
    border: 'none',
    borderRadius: '12px',
    color: '#1e1e2e',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '8px',
  },
  resendSection: {
    marginTop: '32px',
    paddingTop: '24px',
    borderTop: '1px solid rgba(205, 214, 244, 0.1)',
  },
  resendText: {
    fontSize: '14px',
    color: '#6c7086',
    marginBottom: '12px',
  },
  resendBtn: {
    background: 'none',
    border: '1px solid rgba(137, 180, 250, 0.3)',
    borderRadius: '8px',
    padding: '10px 24px',
    color: '#89b4fa',
    fontSize: '14px',
    cursor: 'pointer',
  },
};

export default VerifyEmail;
