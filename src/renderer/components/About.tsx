import React, { useState } from 'react';

interface AboutProps {
  isOpen?: boolean;
  onClose: () => void;
}

export const About: React.FC<AboutProps> = ({ isOpen = true, onClose }) => {
  const [activeTab, setActiveTab] = useState<'about' | 'changelog' | 'credits'>('about');

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-container" onClick={e => e.stopPropagation()}>
        {/* Header with Logo */}
        <div className="about-header">
          <div className="logo-section">
            <div className="app-logo">
              <svg viewBox="0 0 100 100" width="80" height="80">
                <defs>
                  <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#89b4fa"/>
                    <stop offset="50%" stopColor="#cba6f7"/>
                    <stop offset="100%" stopColor="#f5c2e7"/>
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                <circle cx="50" cy="50" r="45" fill="var(--bg-secondary)" stroke="url(#logoGradient)" strokeWidth="3"/>
                <g filter="url(#glow)">
                  <path d="M30 35 L50 25 L70 35 L70 55 L50 65 L30 55 Z" fill="none" stroke="var(--ctp-blue)" strokeWidth="2.5"/>
                  <path d="M30 45 L50 35 L70 45" fill="none" stroke="var(--ctp-mauve)" strokeWidth="2"/>
                  <path d="M30 55 L50 45 L70 55" fill="none" stroke="var(--ctp-pink)" strokeWidth="2"/>
                  <circle cx="50" cy="50" r="6" fill="var(--ctp-green)"/>
                  <circle cx="35" cy="42" r="3" fill="var(--ctp-blue)"/>
                  <circle cx="65" cy="42" r="3" fill="var(--ctp-blue)"/>
                  <circle cx="35" cy="58" r="3" fill="var(--ctp-mauve)"/>
                  <circle cx="65" cy="58" r="3" fill="var(--ctp-mauve)"/>
                </g>
              </svg>
            </div>
            <div className="app-info">
              <h1>MYCSC</h1>
              <p className="tagline">Modern Your Custom SQL Client</p>
              <div className="version-badge">
                <span className="version">v1.0.0</span>
                <span className="build">Build 2026.01</span>
              </div>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="24" height="24">
              <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2"/>
              <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="about-tabs">
          <button 
            className={`tab ${activeTab === 'about' ? 'active' : ''}`}
            onClick={() => setActiveTab('about')}
          >
            О программе
          </button>
          <button 
            className={`tab ${activeTab === 'changelog' ? 'active' : ''}`}
            onClick={() => setActiveTab('changelog')}
          >
            История версий
          </button>
          <button 
            className={`tab ${activeTab === 'credits' ? 'active' : ''}`}
            onClick={() => setActiveTab('credits')}
          >
            Благодарности
          </button>
        </div>

        {/* Content */}
        <div className="about-content">
          {activeTab === 'about' && (
            <div className="tab-content">
              <div className="description">
                <p>
                  <strong>MYCSC</strong> — это современная система управления базами данных с 
                  интуитивным графическим интерфейсом, вдохновлённым MySQL Workbench.
                </p>
                <p>
                  Приложение разработано для удобной работы с SQL базами данных, 
                  предоставляя мощные инструменты для разработчиков и администраторов.
                </p>
              </div>

              <div className="features-section">
                <h3>✨ Ключевые возможности</h3>
                <div className="features-grid">
                  <div className="feature">
                    <span className="feature-icon">📝</span>
                    <div>
                      <strong>SQL Редактор</strong>
                      <p>Подсветка синтаксиса, автодополнение, история запросов</p>
                    </div>
                  </div>
                  <div className="feature">
                    <span className="feature-icon">📐</span>
                    <div>
                      <strong>ER Диаграммы</strong>
                      <p>Визуальное проектирование структуры БД</p>
                    </div>
                  </div>
                  <div className="feature">
                    <span className="feature-icon">💾</span>
                    <div>
                      <strong>Экспорт/Импорт</strong>
                      <p>SQL, JSON, CSV, XML форматы</p>
                    </div>
                  </div>
                  <div className="feature">
                    <span className="feature-icon">🔍</span>
                    <div>
                      <strong>Глобальный поиск</strong>
                      <p>Поиск по всем таблицам с regex</p>
                    </div>
                  </div>
                  <div className="feature">
                    <span className="feature-icon">🎨</span>
                    <div>
                      <strong>Catppuccin тема</strong>
                      <p>Современный дизайн, приятный глазу</p>
                    </div>
                  </div>
                  <div className="feature">
                    <span className="feature-icon">⌨️</span>
                    <div>
                      <strong>Горячие клавиши</strong>
                      <p>Быстрая работа без мыши</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="tech-section">
                <h3>🛠 Технологии</h3>
                <div className="tech-stack">
                  <div className="tech-item">
                    <div className="tech-logo electron">E</div>
                    <span>Electron</span>
                  </div>
                  <div className="tech-item">
                    <div className="tech-logo react">⚛</div>
                    <span>React</span>
                  </div>
                  <div className="tech-item">
                    <div className="tech-logo typescript">TS</div>
                    <span>TypeScript</span>
                  </div>
                  <div className="tech-item">
                    <div className="tech-logo vite">⚡</div>
                    <span>Vite</span>
                  </div>
                </div>
              </div>

              <div className="links-section">
                <h3>🔗 Ссылки</h3>
                <div className="links">
                  <a href="#" className="link-btn">
                    <svg viewBox="0 0 24 24" width="20" height="20">
                      <path fill="currentColor" d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    GitHub
                  </a>
                  <a href="#" className="link-btn">
                    <svg viewBox="0 0 24 24" width="20" height="20">
                      <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                    </svg>
                    Сайт
                  </a>
                  <a href="#" className="link-btn">
                    <svg viewBox="0 0 24 24" width="20" height="20">
                      <path fill="currentColor" d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                    </svg>
                    Обратная связь
                  </a>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'changelog' && (
            <div className="tab-content changelog">
              <div className="version-entry latest">
                <div className="version-header">
                  <span className="version-tag">v1.0.0</span>
                  <span className="version-date">Январь 2026</span>
                  <span className="version-label new">Новая версия</span>
                </div>
                <div className="changes">
                  <div className="change-group">
                    <h4>✨ Новые возможности</h4>
                    <ul>
                      <li>SQL редактор с автодополнением и подсветкой синтаксиса</li>
                      <li>ER диаграммы для визуализации структуры БД</li>
                      <li>Глобальный поиск по всем таблицам</li>
                      <li>Экспорт/Импорт в форматах SQL, JSON, CSV, XML</li>
                      <li>История запросов с поиском и фильтрацией</li>
                      <li>Управление связями между таблицами</li>
                      <li>Статистика базы данных</li>
                      <li>Настраиваемый интерфейс</li>
                    </ul>
                  </div>
                  <div className="change-group">
                    <h4>🎨 Дизайн</h4>
                    <ul>
                      <li>Catppuccin Mocha цветовая тема</li>
                      <li>Адаптивный интерфейс в стиле MySQL Workbench</li>
                      <li>Иконки и анимации</li>
                    </ul>
                  </div>
                  <div className="change-group">
                    <h4>⌨️ Горячие клавиши</h4>
                    <ul>
                      <li>Ctrl+Enter — выполнить запрос</li>
                      <li>Ctrl+Space — автодополнение</li>
                      <li>Ctrl+Shift+F — глобальный поиск</li>
                      <li>F1 — справка по горячим клавишам</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="version-entry">
                <div className="version-header">
                  <span className="version-tag">v0.9.0</span>
                  <span className="version-date">Декабрь 2025</span>
                  <span className="version-label beta">Beta</span>
                </div>
                <div className="changes">
                  <div className="change-group">
                    <h4>🚀 Бета-релиз</h4>
                    <ul>
                      <li>Базовый SQL редактор</li>
                      <li>Управление таблицами</li>
                      <li>Просмотр результатов запросов</li>
                      <li>Локальное хранение данных</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="version-entry">
                <div className="version-header">
                  <span className="version-tag">v0.1.0</span>
                  <span className="version-date">Ноябрь 2025</span>
                  <span className="version-label alpha">Alpha</span>
                </div>
                <div className="changes">
                  <div className="change-group">
                    <h4>🌱 Начало разработки</h4>
                    <ul>
                      <li>Инициализация проекта</li>
                      <li>Настройка Electron + React + TypeScript</li>
                      <li>Базовая архитектура приложения</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'credits' && (
            <div className="tab-content credits">
              <div className="credits-section">
                <h3>👨‍💻 Разработка</h3>
                <div className="credit-card main-dev">
                  <div className="avatar">
                    <svg viewBox="0 0 24 24" width="48" height="48">
                      <circle cx="12" cy="8" r="4" fill="var(--ctp-blue)"/>
                      <path d="M12 14c-4 0-8 2-8 4v2h16v-2c0-2-4-4-8-4z" fill="var(--ctp-blue)"/>
                    </svg>
                  </div>
                  <div className="credit-info">
                    <strong>MYCSC Team</strong>
                    <p>Создатели и разработчики</p>
                  </div>
                </div>
              </div>

              <div className="credits-section">
                <h3>🎨 Дизайн и Вдохновение</h3>
                <div className="credit-items">
                  <div className="credit-item">
                    <span className="credit-icon">🎨</span>
                    <div>
                      <strong>Catppuccin</strong>
                      <p>Потрясающая цветовая палитра</p>
                    </div>
                  </div>
                  <div className="credit-item">
                    <span className="credit-icon">🐬</span>
                    <div>
                      <strong>MySQL Workbench</strong>
                      <p>Вдохновение для интерфейса</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="credits-section">
                <h3>📦 Open Source библиотеки</h3>
                <div className="libraries-grid">
                  <div className="library">
                    <strong>Electron</strong>
                    <span>MIT License</span>
                  </div>
                  <div className="library">
                    <strong>React</strong>
                    <span>MIT License</span>
                  </div>
                  <div className="library">
                    <strong>TypeScript</strong>
                    <span>Apache 2.0</span>
                  </div>
                  <div className="library">
                    <strong>Vite</strong>
                    <span>MIT License</span>
                  </div>
                </div>
              </div>

              <div className="credits-section">
                <h3>💖 Особая благодарность</h3>
                <p className="thanks-message">
                  Спасибо всем пользователям, которые тестируют приложение и 
                  помогают делать его лучше своими отзывами и предложениями!
                </p>
              </div>

              <div className="license-notice">
                <p>
                  © 2025-2026 MYCSC. Все права защищены.<br/>
                  Распространяется под лицензией MIT.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .about-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(8px);
        }

        .about-container {
          width: 700px;
          max-height: 85vh;
          background: linear-gradient(180deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 30px 100px rgba(0, 0, 0, 0.6), 0 0 40px rgba(137, 180, 250, 0.1);
          border: 1px solid var(--border);
        }

        /* Header */
        .about-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 32px 32px 24px;
          background: linear-gradient(135deg, color-mix(in srgb, var(--ctp-blue) 10%, transparent) 0%, color-mix(in srgb, var(--ctp-mauve) 10%, transparent) 100%);
          border-bottom: 1px solid var(--border);
        }

        .logo-section {
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .app-logo {
          filter: drop-shadow(0 4px 20px rgba(137, 180, 250, 0.3));
        }

        .app-info h1 {
          margin: 0;
          font-size: 32px;
          background: linear-gradient(135deg, var(--ctp-blue) 0%, var(--ctp-mauve) 50%, var(--ctp-pink) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          font-weight: 700;
          letter-spacing: 2px;
        }

        .tagline {
          margin: 4px 0 12px;
          color: var(--text-secondary);
          font-size: 14px;
        }

        .version-badge {
          display: flex;
          gap: 8px;
        }

        .version, .build {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
        }

        .version {
          background: var(--accent);
          color: var(--ctp-crust);
          font-weight: 600;
        }

        .build {
          background: var(--bg-tertiary);
          color: var(--text-secondary);
        }

        .close-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 8px;
          border-radius: 8px;
          transition: all 0.2s;
        }

        .close-btn:hover {
          background: var(--error);
          color: var(--ctp-crust);
        }

        /* Tabs */
        .about-tabs {
          display: flex;
          padding: 0 32px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border);
        }

        .about-tabs .tab {
          padding: 14px 24px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 14px;
          border-bottom: 2px solid transparent;
          transition: all 0.2s;
        }

        .about-tabs .tab:hover {
          color: var(--text-primary);
        }

        .about-tabs .tab.active {
          color: var(--accent);
          border-bottom-color: var(--accent);
        }

        /* Content */
        .about-content {
          padding: 28px 32px;
          max-height: 50vh;
          overflow-y: auto;
        }

        .tab-content h3 {
          color: var(--text-primary);
          font-size: 16px;
          margin: 24px 0 16px;
        }

        .tab-content h3:first-child {
          margin-top: 0;
        }

        .description p {
          color: var(--text-secondary);
          line-height: 1.7;
          margin: 0 0 12px;
        }

        .description strong {
          color: var(--accent);
        }

        /* Features Grid */
        .features-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .feature {
          display: flex;
          gap: 14px;
          padding: 16px;
          background: var(--bg-secondary);
          border-radius: 12px;
          border: 1px solid var(--border);
        }

        .feature-icon {
          font-size: 24px;
        }

        .feature strong {
          color: var(--text-primary);
          display: block;
          margin-bottom: 4px;
          font-size: 14px;
        }

        .feature p {
          color: var(--text-muted);
          font-size: 12px;
          margin: 0;
          line-height: 1.4;
        }

        /* Tech Stack */
        .tech-stack {
          display: flex;
          gap: 16px;
        }

        .tech-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 20px;
          background: var(--bg-secondary);
          border-radius: 10px;
          border: 1px solid var(--border);
        }

        .tech-logo {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 14px;
        }

        .tech-logo.electron { background: #47848f; color: white; }
        .tech-logo.react { background: #61dafb; color: #282c34; font-size: 20px; }
        .tech-logo.typescript { background: #3178c6; color: white; }
        .tech-logo.vite { background: #646cff; color: white; font-size: 18px; }

        .tech-item span {
          color: var(--text-primary);
          font-size: 14px;
        }

        /* Links */
        .links {
          display: flex;
          gap: 12px;
        }

        .link-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: var(--bg-tertiary);
          border-radius: 8px;
          color: var(--text-primary);
          text-decoration: none;
          font-size: 14px;
          transition: all 0.2s;
        }

        .link-btn:hover {
          background: var(--ctp-surface1);
          transform: translateY(-2px);
        }

        /* Changelog */
        .changelog .version-entry {
          margin-bottom: 24px;
          padding: 20px;
          background: var(--bg-secondary);
          border-radius: 12px;
          border: 1px solid var(--border);
        }

        .changelog .version-entry.latest {
          border-color: var(--accent);
          box-shadow: 0 0 20px rgba(137, 180, 250, 0.1);
        }

        .version-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .version-tag {
          background: var(--accent);
          color: var(--ctp-crust);
          padding: 4px 12px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 14px;
        }

        .version-date {
          color: var(--text-muted);
          font-size: 14px;
        }

        .version-label {
          padding: 2px 10px;
          border-radius: 4px;
          font-size: 11px;
          text-transform: uppercase;
          font-weight: 600;
        }

        .version-label.new {
          background: var(--success);
          color: var(--ctp-crust);
        }

        .version-label.beta {
          background: var(--warning);
          color: var(--ctp-crust);
        }

        .version-label.alpha {
          background: var(--ctp-peach);
          color: var(--ctp-crust);
        }

        .change-group h4 {
          color: var(--text-primary);
          font-size: 14px;
          margin: 0 0 8px;
        }

        .change-group ul {
          margin: 0 0 16px;
          padding-left: 20px;
          color: var(--text-secondary);
          font-size: 13px;
        }

        .change-group li {
          margin-bottom: 4px;
        }

        /* Credits */
        .credits-section {
          margin-bottom: 24px;
        }

        .credit-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px;
          background: linear-gradient(135deg, color-mix(in srgb, var(--ctp-blue) 10%, transparent) 0%, color-mix(in srgb, var(--ctp-mauve) 10%, transparent) 100%);
          border-radius: 12px;
          border: 1px solid var(--border);
        }

        .credit-card .avatar {
          width: 60px;
          height: 60px;
          background: var(--bg-tertiary);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .credit-info strong {
          color: var(--text-primary);
          font-size: 16px;
          display: block;
        }

        .credit-info p {
          color: var(--text-muted);
          font-size: 14px;
          margin: 4px 0 0;
        }

        .credit-items {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .credit-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: var(--bg-secondary);
          border-radius: 10px;
          border: 1px solid var(--border);
        }

        .credit-icon {
          font-size: 28px;
        }

        .credit-item strong {
          color: var(--text-primary);
          display: block;
        }

        .credit-item p {
          color: var(--text-muted);
          font-size: 13px;
          margin: 2px 0 0;
        }

        .libraries-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .library {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: var(--bg-secondary);
          border-radius: 8px;
          border: 1px solid var(--border);
        }

        .library strong {
          color: var(--text-primary);
          font-size: 14px;
        }

        .library span {
          color: var(--text-muted);
          font-size: 12px;
        }

        .thanks-message {
          color: var(--text-secondary);
          line-height: 1.7;
          padding: 16px;
          background: color-mix(in srgb, var(--ctp-green) 10%, transparent);
          border-radius: 10px;
          border: 1px solid color-mix(in srgb, var(--ctp-green) 30%, transparent);
        }

        .license-notice {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid var(--border);
          text-align: center;
        }

        .license-notice p {
          color: var(--text-muted);
          font-size: 12px;
          line-height: 1.6;
          margin: 0;
        }

        /* Scrollbar */
        .about-content::-webkit-scrollbar {
          width: 8px;
        }

        .about-content::-webkit-scrollbar-track {
          background: transparent;
        }

        .about-content::-webkit-scrollbar-thumb {
          background: var(--ctp-surface1);
          border-radius: 4px;
        }

        .about-content::-webkit-scrollbar-thumb:hover {
          background: var(--ctp-surface2);
        }
      `}</style>
    </div>
  );
};
