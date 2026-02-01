import React, { useState, useEffect } from 'react';

interface LandingPageProps {
  onLogin: () => void;
  onRegister: () => void;
  onDocs?: () => void;
  onAPI?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLogin, onRegister, onDocs, onAPI }) => {
  const [activeFeature, setActiveFeature] = useState(0);
  const [statsVisible, setStatsVisible] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveFeature(prev => (prev + 1) % 4);
    }, 3000);
    
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setStatsVisible(true);
      }
    };
    window.addEventListener('scroll', handleScroll);
    
    return () => {
      clearInterval(timer);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const features = [
    {
      icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#89b4fa" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
      title: 'Высокая производительность',
      description: 'B-Tree индексы и оптимизатор запросов обеспечивают максимальную скорость обработки данных'
    },
    {
      icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#a6e3a1" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
      title: 'Защита данных',
      description: 'Система аутентификации, ролевая модель доступа и защита информации'
    },
    {
      icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#cba6f7" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
      title: 'Кроссплатформенность',
      description: 'Веб-интерфейс, настольное приложение и программный интерфейс API'
    },
    {
      icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f9e2af" strokeWidth="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>,
      title: 'Аналитика',
      description: 'ER-диаграммы, визуализация данных и экспорт в различные форматы'
    }
  ];

  const codeExample = `-- Создание таблицы
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE,
  created_at DATETIME DEFAULT NOW()
);

-- Вставка данных
INSERT INTO users (name, email) 
VALUES ('Алексей', 'alex@example.com');

-- Запрос с JOIN
SELECT u.name, o.total
FROM users u
JOIN orders o ON u.id = o.user_id
WHERE o.total > 1000
ORDER BY o.total DESC;`;

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logo}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="url(#logoGrad)" strokeWidth="2">
            <defs><linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#89b4fa"/><stop offset="100%" stopColor="#cba6f7"/></linearGradient></defs>
            <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
          </svg>
          <span style={styles.logoText}>MYCSC</span>
        </div>
        <nav style={styles.nav}>
          <a href="#features" style={styles.navLink}>Возможности</a>
          <button onClick={onDocs} style={styles.navLink}>Документация</button>
          <button onClick={onAPI} style={styles.navLink}>API</button>
          <a href="#download" style={styles.navLink}>Скачать</a>
          <button onClick={onLogin} style={styles.loginBtn}>Войти</button>
          <button onClick={onRegister} style={styles.registerBtn}>Регистрация</button>
        </nav>
      </header>

      {/* Hero Section */}
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <h1 style={styles.heroTitle}>
            <span style={styles.gradient}>MYCSC Database</span>
            <br />
            Современная СУБД нового поколения
          </h1>
          <p style={styles.heroSubtitle}>
            Мощная, быстрая и удобная система управления базами данных.
            Работайте с данными через веб-интерфейс или скачайте десктоп приложение.
          </p>
          <div style={styles.heroButtons}>
            <button onClick={onRegister} style={styles.primaryBtn}>
              Начать бесплатно
            </button>
            <a href="#download" style={styles.secondaryBtn}>
              Скачать EXE
            </a>
          </div>
          <div style={styles.heroStats}>
            <div style={styles.stat}>
              <span style={styles.statNumber}>10K+</span>
              <span style={styles.statLabel}>Запросов/сек</span>
            </div>
            <div style={styles.stat}>
              <span style={styles.statNumber}>100%</span>
              <span style={styles.statLabel}>SQL совместимость</span>
            </div>
            <div style={styles.stat}>
              <span style={styles.statNumber}>0ms</span>
              <span style={styles.statLabel}>Время отклика</span>
            </div>
          </div>
        </div>
        <div style={styles.heroVisual}>
          <div style={styles.codeBlock}>
            <div style={styles.codeHeader}>
              <span style={styles.codeDot} />
              <span style={{...styles.codeDot, background: '#f1fa8c'}} />
              <span style={{...styles.codeDot, background: '#50fa7b'}} />
              <span style={styles.codeTitle}>query.sql</span>
            </div>
            <pre style={styles.code}>{codeExample}</pre>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" style={styles.features}>
        <h2 style={styles.sectionTitle}>Почему MYCSC?</h2>
        <div style={styles.featureGrid}>
          {features.map((feature, index) => (
            <div 
              key={index} 
              style={{
                ...styles.featureCard,
                ...(activeFeature === index ? styles.featureCardActive : {})
              }}
              onMouseEnter={() => setActiveFeature(index)}
            >
              <span style={styles.featureIcon}>{feature.icon}</span>
              <h3 style={styles.featureTitle}>{feature.title}</h3>
              <p style={styles.featureDesc}>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Download Section */}
      <section id="download" style={styles.download}>
        <h2 style={styles.sectionTitle}>Скачать MYCSC</h2>
        <p style={styles.downloadSubtitle}>
          Выберите платформу для загрузки десктоп приложения
        </p>
        <div style={styles.downloadGrid}>
          <a href="/downloads/MYCSC%20Database%20Setup%201.3.5.exe" download="MYCSC Database Setup 1.3.5.exe" style={styles.downloadCard}>
            <div style={{width: 64, height: 64, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12}}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <ellipse cx="12" cy="5" rx="9" ry="3"/>
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
              </svg>
            </div>
            <span style={styles.downloadPlatform}>Windows</span>
            <span style={styles.downloadSize}>~75 MB • v1.3.5</span>
            <button style={styles.downloadBtn}>Скачать .exe</button>
          </a>
          <div style={{...styles.downloadCard, opacity: 0.5}}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6c7086" strokeWidth="1.5"><path d="M12 2a10 10 0 0 1 10 10c0 4.59-4.03 8.55-8 9.73V21h-4v-.27C6.03 19.55 2 15.59 2 11A10 10 0 0 1 12 2z"/><circle cx="8.5" cy="10" r="1.5" fill="#6c7086"/><circle cx="15.5" cy="10" r="1.5" fill="#6c7086"/><path d="M9 15c1.5 1 4.5 1 6 0"/></svg>
            <span style={styles.downloadPlatform}>macOS</span>
            <span style={styles.downloadSize}>Скоро</span>
            <button style={{...styles.downloadBtn, background: '#45475a'}} disabled>Недоступно</button>
          </div>
          <div style={{...styles.downloadCard, opacity: 0.5}}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6c7086" strokeWidth="1.5"><circle cx="12" cy="11" r="3"/><path d="M12 2C6.48 2 2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V22h4v-.2c4.56-.93 8-4.96 8-9.8 0-5.52-4.48-10-10-10z"/><path d="M7 14l-3 3m13-3l3 3M7 8l-3-3m13 3l3-3"/></svg>
            <span style={styles.downloadPlatform}>Linux</span>
            <span style={styles.downloadSize}>Скоро</span>
            <button style={{...styles.downloadBtn, background: '#45475a'}} disabled>Недоступно</button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={styles.cta}>
        <h2 style={styles.ctaTitle}>Готовы начать?</h2>
        <p style={styles.ctaSubtitle}>
          Создайте аккаунт и получите доступ к полному функционалу MYCSC Database
        </p>
        <div style={styles.ctaButtons}>
          <button onClick={onRegister} style={styles.primaryBtn}>
            Создать аккаунт
          </button>
          <button onClick={onLogin} style={styles.outlineBtn}>
            Уже есть аккаунт? Войти
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={styles.footer}>
        <div style={styles.footerContent}>
          <div style={styles.footerLogo}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#89b4fa" strokeWidth="2">
              <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
            </svg>
            <span style={styles.logoText}>MYCSC</span>
          </div>
          <p style={styles.footerText}>
            © 2026 MYCSC Database. Все права защищены.
          </p>
          <div style={styles.footerLinks}>
            <a href="#" onClick={(e) => { e.preventDefault(); onDocs && onDocs(); }} style={styles.footerLink}>Документация</a>
            <a href="#" onClick={(e) => { e.preventDefault(); onAPI && onAPI(); }} style={styles.footerLink}>API</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1e1e2e 0%, #181825 100%)',
    color: '#cdd6f4',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const,
    height: '100vh',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 60px',
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    background: 'rgba(30, 30, 46, 0.9)',
    backdropFilter: 'blur(10px)',
    zIndex: 1000,
    borderBottom: '1px solid rgba(205, 214, 244, 0.1)',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  logoIcon: {
    fontSize: '28px',
  },
  logoText: {
    fontSize: '24px',
    fontWeight: 700,
    background: 'linear-gradient(135deg, #89b4fa, #cba6f7)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: '30px',
  },
  navLink: {
    color: '#a6adc8',
    textDecoration: 'none',
    fontSize: '14px',
    transition: 'color 0.2s',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  loginBtn: {
    padding: '10px 20px',
    background: 'transparent',
    border: '1px solid #89b4fa',
    color: '#89b4fa',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s',
  },
  registerBtn: {
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #89b4fa, #cba6f7)',
    border: 'none',
    color: '#1e1e2e',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600,
    transition: 'transform 0.2s',
  },
  hero: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '60px',
    padding: '160px 60px 100px',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  heroContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: '48px',
    fontWeight: 800,
    lineHeight: 1.2,
    marginBottom: '24px',
  },
  gradient: {
    background: 'linear-gradient(135deg, #89b4fa, #cba6f7, #f5c2e7)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  heroSubtitle: {
    fontSize: '18px',
    color: '#a6adc8',
    lineHeight: 1.6,
    marginBottom: '32px',
  },
  heroButtons: {
    display: 'flex',
    gap: '16px',
    marginBottom: '48px',
  },
  primaryBtn: {
    padding: '16px 32px',
    background: 'linear-gradient(135deg, #89b4fa, #cba6f7)',
    border: 'none',
    color: '#1e1e2e',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 600,
    transition: 'transform 0.2s, box-shadow 0.2s',
    boxShadow: '0 4px 20px rgba(137, 180, 250, 0.3)',
  },
  secondaryBtn: {
    padding: '16px 32px',
    background: 'rgba(137, 180, 250, 0.1)',
    border: '1px solid #89b4fa',
    color: '#89b4fa',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 600,
    textDecoration: 'none',
    transition: 'all 0.2s',
  },
  heroStats: {
    display: 'flex',
    gap: '48px',
  },
  stat: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  statNumber: {
    fontSize: '32px',
    fontWeight: 700,
    color: '#89b4fa',
  },
  statLabel: {
    fontSize: '14px',
    color: '#6c7086',
  },
  heroVisual: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBlock: {
    background: '#181825',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
    border: '1px solid rgba(205, 214, 244, 0.1)',
    width: '100%',
  },
  codeHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    background: '#11111b',
    borderBottom: '1px solid rgba(205, 214, 244, 0.1)',
  },
  codeDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: '#ff5f56',
  },
  codeTitle: {
    marginLeft: 'auto',
    fontSize: '12px',
    color: '#6c7086',
  },
  code: {
    padding: '20px',
    margin: 0,
    fontSize: '13px',
    lineHeight: 1.6,
    color: '#cdd6f4',
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    overflow: 'auto',
    maxHeight: '400px',
  },
  features: {
    padding: '100px 60px',
    background: 'rgba(17, 17, 27, 0.5)',
  },
  sectionTitle: {
    fontSize: '36px',
    fontWeight: 700,
    textAlign: 'center' as const,
    marginBottom: '60px',
  },
  featureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  featureCard: {
    background: 'rgba(30, 30, 46, 0.5)',
    border: '1px solid rgba(205, 214, 244, 0.1)',
    borderRadius: '16px',
    padding: '32px',
    textAlign: 'center' as const,
    transition: 'all 0.3s',
    cursor: 'pointer',
  },
  featureCardActive: {
    background: 'rgba(137, 180, 250, 0.1)',
    border: '1px solid rgba(137, 180, 250, 0.3)',
    transform: 'translateY(-8px)',
    boxShadow: '0 20px 40px rgba(137, 180, 250, 0.1)',
  },
  featureIcon: {
    fontSize: '32px',
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  featureTitle: {
    fontSize: '18px',
    fontWeight: 600,
    marginBottom: '12px',
  },
  featureDesc: {
    fontSize: '14px',
    color: '#a6adc8',
    lineHeight: 1.6,
  },
  download: {
    padding: '100px 60px',
    background: 'rgba(17, 17, 27, 0.5)',
  },
  downloadSubtitle: {
    textAlign: 'center' as const,
    color: '#a6adc8',
    marginBottom: '48px',
  },
  downloadGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '24px',
    maxWidth: '900px',
    margin: '0 auto',
  },
  downloadCard: {
    background: 'rgba(30, 30, 46, 0.5)',
    border: '1px solid rgba(205, 214, 244, 0.1)',
    borderRadius: '16px',
    padding: '40px',
    textAlign: 'center' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '12px',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'all 0.3s',
  },
  downloadIcon: {
    fontSize: '48px',
  },
  downloadPlatform: {
    fontSize: '20px',
    fontWeight: 600,
  },
  downloadSize: {
    fontSize: '14px',
    color: '#6c7086',
  },
  downloadBtn: {
    marginTop: '12px',
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #89b4fa, #cba6f7)',
    border: 'none',
    color: '#1e1e2e',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600,
  },
  cta: {
    padding: '100px 60px',
    textAlign: 'center' as const,
  },
  ctaTitle: {
    fontSize: '36px',
    fontWeight: 700,
    marginBottom: '16px',
  },
  ctaSubtitle: {
    fontSize: '18px',
    color: '#a6adc8',
    marginBottom: '32px',
  },
  ctaButtons: {
    display: 'flex',
    justifyContent: 'center',
    gap: '16px',
  },
  outlineBtn: {
    padding: '16px 32px',
    background: 'transparent',
    border: '1px solid rgba(205, 214, 244, 0.3)',
    color: '#cdd6f4',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'all 0.2s',
  },
  footer: {
    padding: '40px 60px',
    borderTop: '1px solid rgba(205, 214, 244, 0.1)',
  },
  footerContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  footerLogo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  footerText: {
    color: '#6c7086',
    fontSize: '14px',
  },
  footerLinks: {
    display: 'flex',
    gap: '24px',
  },
  footerLink: {
    color: '#a6adc8',
    textDecoration: 'none',
    fontSize: '14px',
  },
};

export default LandingPage;
