import React, { useState, useEffect } from 'react';

interface ResetPasswordProps {
  onSuccess: () => void;
  onBack: () => void;
}

export const ResetPassword: React.FC<ResetPasswordProps> = ({ onSuccess, onBack }) => {
  const [step, setStep] = useState<'request' | 'code' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlUserId = urlParams.get('userId');
    const urlCode = urlParams.get('code');

    if (urlUserId && urlCode) {
      setUserId(urlUserId);
      setCode(urlCode);
      setStep('reset');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!email.includes('@')) {
      setMessage({ type: 'error', text: 'Введите корректный email' });
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (data.success) {
        setUserId(data.userId);
        setMessage({ 
          type: 'success', 
          text: 'Код для сброса пароля отправлен на вашу почту' 
        });
        setTimeout(() => {
          setStep('code');
          setMessage(null);
        }, 1500);
      } else {
        setMessage({ type: 'error', text: data.error || 'Ошибка отправки' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Ошибка соединения с сервером' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (code.length !== 6) {
      setMessage({ type: 'error', text: 'Код должен состоять из 6 цифр' });
      return;
    }
    setStep('reset');
    setMessage(null);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Пароль должен быть не менее 6 символов' });
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Пароли не совпадают' });
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, code, newPassword })
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Пароль успешно изменён!' });
        setTimeout(() => onSuccess(), 2000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Неверный или истёкший код' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Ошибка соединения с сервером' });
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
          <span style={styles.icon}>
            {step === 'request' ? '🔐' : step === 'code' ? '📧' : '🔑'}
          </span>
        </div>

        <h1 style={styles.title}>
          {step === 'request' 
            ? 'Забыли пароль?' 
            : step === 'code' 
              ? 'Введите код' 
              : 'Новый пароль'
          }
        </h1>
        <p style={styles.subtitle}>
          {step === 'request' 
            ? 'Введите email для восстановления доступа' 
            : step === 'code'
              ? `Код отправлен на ${email}`
              : 'Придумайте новый надёжный пароль'
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

        {step === 'request' && (
          <form onSubmit={handleRequestReset} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@mail.com"
                style={styles.input}
                autoFocus
              />
            </div>

            <button
              type="submit"
              style={{ ...styles.submitBtn, opacity: loading ? 0.7 : 1 }}
              disabled={loading}
            >
              {loading ? 'Отправка...' : 'Отправить код'}
            </button>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={handleVerifyCode} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Код из письма</label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                style={{ ...styles.input, textAlign: 'center', letterSpacing: '8px', fontSize: '24px' }}
                maxLength={6}
                autoFocus
              />
            </div>

            <button
              type="submit"
              style={{ ...styles.submitBtn, opacity: code.length !== 6 ? 0.7 : 1 }}
              disabled={code.length !== 6}
            >
              Подтвердить код
            </button>

            <button
              type="button"
              onClick={() => { setStep('request'); setCode(''); setMessage(null); }}
              style={styles.linkBtn}
            >
              ← Отправить код повторно
            </button>
          </form>
        )}

        {step === 'reset' && (
          <form onSubmit={handleResetPassword} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Новый пароль</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Минимум 6 символов"
                style={styles.input}
                autoFocus
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Подтвердите пароль</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Повторите пароль"
                style={styles.input}
              />
            </div>

            <button
              type="submit"
              style={{ ...styles.submitBtn, opacity: loading ? 0.7 : 1 }}
              disabled={loading}
            >
              {loading ? 'Сохранение...' : 'Сохранить пароль'}
            </button>
          </form>
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
    background: 'radial-gradient(circle, rgba(203, 166, 247, 0.15) 0%, transparent 70%)',
    top: '-150px',
    right: '-100px',
  },
  bgCircle2: {
    position: 'absolute',
    width: '400px',
    height: '400px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(137, 180, 250, 0.1) 0%, transparent 70%)',
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
    padding: '14px 16px',
    background: 'rgba(17, 17, 27, 0.6)',
    border: '1px solid rgba(205, 214, 244, 0.1)',
    borderRadius: '10px',
    color: '#cdd6f4',
    fontSize: '15px',
    outline: 'none',
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
    marginTop: '8px',
  },
  helpSection: {
    marginTop: '24px',
    paddingTop: '20px',
    borderTop: '1px solid rgba(205, 214, 244, 0.1)',
  },
  helpText: {
    fontSize: '14px',
    color: '#6c7086',
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: '#89b4fa',
    fontSize: '14px',
    cursor: 'pointer',
    textDecoration: 'underline',
    marginLeft: '8px',
  },
};

export default ResetPassword;
