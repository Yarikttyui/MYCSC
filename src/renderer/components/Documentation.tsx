import React, { useState } from 'react';

interface DocSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

export const Documentation: React.FC<{ isOpen?: boolean; onClose: () => void }> = ({ isOpen = true, onClose }) => {
  const [activeSection, setActiveSection] = useState('getting-started');
  const [searchQuery, setSearchQuery] = useState('');

  const sections: DocSection[] = [
    {
      id: 'getting-started',
      title: 'Начало работы',
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path fill="currentColor" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
      ),
      content: (
        <div className="doc-content">
          <h2>Начало работы с MYCSC</h2>
          <p className="intro">
            Добро пожаловать в MYCSC — мощную систему управления базами данных с интуитивным интерфейсом,
            вдохновлённым MySQL Workbench.
          </p>

          <div className="step-card">
            <div className="step-number">1</div>
            <div className="step-content">
              <h4>Создание подключения</h4>
              <p>На экране приветствия нажмите <kbd>+ Новое подключение</kbd> и введите данные:</p>
              <ul>
                <li><strong>Имя:</strong> произвольное название для подключения</li>
                <li><strong>Хост:</strong> адрес сервера (localhost для локальной БД)</li>
                <li><strong>Порт:</strong> порт подключения (по умолчанию 3306)</li>
                <li><strong>Пользователь:</strong> имя пользователя БД</li>
              </ul>
            </div>
          </div>

          <div className="step-card">
            <div className="step-number">2</div>
            <div className="step-content">
              <h4>Выбор базы данных</h4>
              <p>После подключения выберите базу данных из выпадающего списка в верхней панели 
              или создайте новую командой:</p>
              <pre><code>CREATE DATABASE my_database;</code></pre>
            </div>
          </div>

          <div className="step-card">
            <div className="step-number">3</div>
            <div className="step-content">
              <h4>Работа с таблицами</h4>
              <p>Используйте боковую панель для просмотра таблиц или создайте новую:</p>
              <pre><code>{`CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE
);`}</code></pre>
            </div>
          </div>

          <div className="tip-box">
            <span className="tip-icon">ℹ</span>
            <div>
              <strong>Совет:</strong> Используйте <kbd>Ctrl+Enter</kbd> для быстрого выполнения запроса
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'sql-editor',
      title: 'SQL Редактор',
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path fill="currentColor" d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
        </svg>
      ),
      content: (
        <div className="doc-content">
          <h2>SQL Редактор</h2>
          <p className="intro">
            Мощный редактор SQL с автодополнением, подсветкой синтаксиса и историей запросов.
          </p>

          <h3>Автодополнение</h3>
          <p>Редактор предлагает интеллектуальные подсказки:</p>
          <div className="feature-grid">
            <div className="feature-item">
              <span className="feature-icon-text">SQL</span>
              <div>
                <strong>Ключевые слова SQL</strong>
                <p>SELECT, INSERT, UPDATE, DELETE и др.</p>
              </div>
            </div>
            <div className="feature-item">
              <span className="feature-icon-text">TBL</span>
              <div>
                <strong>Имена таблиц</strong>
                <p>Автоматически после FROM, JOIN, INTO</p>
              </div>
            </div>
            <div className="feature-item">
              <span className="feature-icon-text">COL</span>
              <div>
                <strong>Имена колонок</strong>
                <p>После указания таблицы</p>
              </div>
            </div>
            <div className="feature-item">
              <span className="feature-icon-text">TYP</span>
              <div>
                <strong>Типы данных</strong>
                <p>INT, VARCHAR, TEXT, DATE и др.</p>
              </div>
            </div>
          </div>

          <h3>Горячие клавиши редактора</h3>
          <table className="shortcut-table">
            <tbody>
              <tr><td><kbd>Ctrl</kbd>+<kbd>Space</kbd></td><td>Вызвать автодополнение</td></tr>
              <tr><td><kbd>Tab</kbd> / <kbd>Enter</kbd></td><td>Применить подсказку</td></tr>
              <tr><td><kbd>Esc</kbd></td><td>Закрыть подсказки</td></tr>
              <tr><td><kbd>Ctrl</kbd>+<kbd>Enter</kbd></td><td>Выполнить запрос</td></tr>
              <tr><td><kbd>Ctrl</kbd>+<kbd>/</kbd></td><td>Закомментировать строку</td></tr>
            </tbody>
          </table>

          <h3>Подсветка синтаксиса</h3>
          <div className="syntax-demo">
            <span className="kw">SELECT</span> <span className="col">name</span>, <span className="col">email</span><br/>
            <span className="kw">FROM</span> <span className="tbl">users</span><br/>
            <span className="kw">WHERE</span> <span className="col">age</span> &gt; <span className="num">18</span><br/>
            <span className="kw">ORDER BY</span> <span className="col">created_at</span> <span className="kw">DESC</span>;
          </div>
        </div>
      )
    },
    {
      id: 'tables',
      title: 'Управление таблицами',
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path fill="currentColor" d="M3 3h18v18H3V3zm2 4v12h14V7H5zm0 0h14v3H5V7z"/>
        </svg>
      ),
      content: (
        <div className="doc-content">
          <h2>Управление таблицами</h2>
          
          <h3>Боковая панель</h3>
          <p>Список всех таблиц базы данных с контекстным меню:</p>
          <ul className="context-menu-list">
            <li><strong>Выбрать все</strong> — SELECT * FROM table</li>
            <li><strong>Выбрать 1000 строк</strong> — SELECT с LIMIT</li>
            <li><strong>Структура</strong> — DESCRIBE table</li>
            <li><strong>Очистить</strong> — TRUNCATE TABLE</li>
            <li><strong>Удалить</strong> — DROP TABLE</li>
          </ul>

          <h3>Создание таблицы</h3>
          <pre><code>{`CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL,
  price DECIMAL(10, 2) DEFAULT 0.00,
  category_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);`}</code></pre>

          <h3>Изменение структуры</h3>
          <pre><code>{`-- Добавить колонку
ALTER TABLE products ADD description TEXT;

-- Изменить тип колонки
ALTER TABLE products MODIFY price DECIMAL(12, 2);

-- Удалить колонку
ALTER TABLE products DROP COLUMN description;

-- Переименовать таблицу
ALTER TABLE products RENAME TO items;`}</code></pre>

          <h3>Типы данных</h3>
          <div className="types-grid">
            <div className="type-category">
              <h4>Числовые</h4>
              <code>INTEGER</code> <code>BIGINT</code> <code>FLOAT</code> <code>DOUBLE</code> <code>DECIMAL</code>
            </div>
            <div className="type-category">
              <h4>Строковые</h4>
              <code>VARCHAR(n)</code> <code>CHAR(n)</code> <code>TEXT</code> <code>LONGTEXT</code>
            </div>
            <div className="type-category">
              <h4>Дата/Время</h4>
              <code>DATE</code> <code>TIME</code> <code>DATETIME</code> <code>TIMESTAMP</code>
            </div>
            <div className="type-category">
              <h4>Другие</h4>
              <code>BOOLEAN</code> <code>JSON</code> <code>BLOB</code> <code>UUID</code>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'queries',
      title: 'SQL Запросы',
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
        </svg>
      ),
      content: (
        <div className="doc-content">
          <h2>SQL Запросы</h2>

          <h3>SELECT — Выборка данных</h3>
          <pre><code>{`-- Все записи
SELECT * FROM users;

-- Конкретные колонки
SELECT name, email FROM users;

-- С условием
SELECT * FROM users WHERE age >= 18;

-- Сортировка
SELECT * FROM users ORDER BY name ASC;

-- Лимит
SELECT * FROM users LIMIT 10 OFFSET 20;

-- Группировка
SELECT country, COUNT(*) as total 
FROM users 
GROUP BY country 
HAVING total > 100;`}</code></pre>

          <h3>INSERT — Добавление данных</h3>
          <pre><code>{`-- Одна запись
INSERT INTO users (name, email) VALUES ('John', 'john@mail.com');

-- Несколько записей
INSERT INTO users (name, email) VALUES 
  ('Alice', 'alice@mail.com'),
  ('Bob', 'bob@mail.com');`}</code></pre>

          <h3>UPDATE — Обновление данных</h3>
          <pre><code>{`UPDATE users SET age = 25 WHERE id = 1;

UPDATE products 
SET price = price * 1.1 
WHERE category = 'electronics';`}</code></pre>

          <h3>DELETE — Удаление данных</h3>
          <pre><code>{`DELETE FROM users WHERE id = 1;

DELETE FROM logs WHERE created_at < '2024-01-01';`}</code></pre>

          <h3>JOIN — Объединение таблиц</h3>
          <pre><code>{`SELECT orders.id, users.name, products.title
FROM orders
INNER JOIN users ON orders.user_id = users.id
LEFT JOIN products ON orders.product_id = products.id
WHERE orders.status = 'completed';`}</code></pre>
        </div>
      )
    },
    {
      id: 'er-diagram',
      title: 'ER Диаграммы',
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20">
          <rect x="2" y="2" width="8" height="6" rx="1" fill="var(--ctp-blue)"/>
          <rect x="14" y="2" width="8" height="6" rx="1" fill="var(--ctp-peach)"/>
          <rect x="8" y="16" width="8" height="6" rx="1" fill="var(--ctp-green)"/>
          <path d="M6 8v4h6m6-4v8h-6" stroke="currentColor" strokeWidth="2" fill="none"/>
        </svg>
      ),
      content: (
        <div className="doc-content">
          <h2>ER Диаграммы</h2>
          <p className="intro">
            Визуальное представление структуры базы данных и связей между таблицами.
          </p>

          <h3>Возможности</h3>
          <div className="feature-grid">
            <div className="feature-item">
              <span className="feature-icon-text">CLR</span>
              <div>
                <strong>Цветовая маркировка</strong>
                <p>Каждая таблица имеет свой цвет для удобства</p>
              </div>
            </div>
            <div className="feature-item">
              <span className="feature-icon-text">REL</span>
              <div>
                <strong>Визуализация связей</strong>
                <p>1:1, 1:N, N:M отношения между таблицами</p>
              </div>
            </div>
            <div className="feature-item">
              <span className="feature-icon-text">DND</span>
              <div>
                <strong>Drag & Drop</strong>
                <p>Перетаскивание таблиц для организации</p>
              </div>
            </div>
            <div className="feature-item">
              <span className="feature-icon-text">ZOM</span>
              <div>
                <strong>Масштабирование</strong>
                <p>Колёсико мыши для zoom 25%-200%</p>
              </div>
            </div>
          </div>

          <h3>Навигация</h3>
          <table className="shortcut-table">
            <tbody>
              <tr><td>Колёсико мыши</td><td>Масштабирование</td></tr>
              <tr><td>Alt + перетаскивание</td><td>Панорамирование</td></tr>
              <tr><td>Клик по таблице</td><td>Выделение</td></tr>
              <tr><td>Перетаскивание</td><td>Перемещение таблицы</td></tr>
            </tbody>
          </table>

          <h3>Типы связей</h3>
          <div className="relation-types-doc">
            <div className="rel-type">
              <span className="rel-badge">1:1</span>
              <div>
                <strong>Один к одному</strong>
                <p>Пример: user → profile</p>
              </div>
            </div>
            <div className="rel-type">
              <span className="rel-badge">1:N</span>
              <div>
                <strong>Один ко многим</strong>
                <p>Пример: category → products</p>
              </div>
            </div>
            <div className="rel-type">
              <span className="rel-badge">N:M</span>
              <div>
                <strong>Многие ко многим</strong>
                <p>Пример: students ↔ courses</p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'export-import',
      title: 'Экспорт / Импорт',
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
        </svg>
      ),
      content: (
        <div className="doc-content">
          <h2>Экспорт и Импорт данных</h2>

          <h3>Поддерживаемые форматы</h3>
          <div className="format-cards">
            <div className="format-card">
              <div className="format-icon sql">SQL</div>
              <h4>SQL Dump</h4>
              <p>CREATE TABLE + INSERT команды для полного восстановления</p>
            </div>
            <div className="format-card">
              <div className="format-icon json">JSON</div>
              <h4>JSON</h4>
              <p>Структурированные данные для API и интеграций</p>
            </div>
            <div className="format-card">
              <div className="format-icon csv">CSV</div>
              <h4>CSV</h4>
              <p>Табличный формат для Excel и других программ</p>
            </div>
            <div className="format-card">
              <div className="format-icon xml">XML</div>
              <h4>XML</h4>
              <p>Универсальный формат обмена данными</p>
            </div>
          </div>

          <h3>Опции экспорта</h3>
          <ul>
            <li><strong>Структура (Schema)</strong> — включить CREATE TABLE</li>
            <li><strong>Данные (Data)</strong> — включить INSERT записи</li>
            <li><strong>Форматирование</strong> — отступы для читаемости</li>
            <li><strong>Выбор таблиц</strong> — экспорт отдельных таблиц</li>
          </ul>

          <h3>Импорт данных</h3>
          <ol>
            <li>Выберите формат файла</li>
            <li>Укажите целевую таблицу</li>
            <li>Загрузите файл или вставьте данные</li>
            <li>Нажмите "Импортировать"</li>
          </ol>

          <div className="warning-box">
            <span className="warning-icon">⚠</span>
            <div>
              <strong>Внимание:</strong> При импорте CSV первая строка должна содержать названия колонок
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'shortcuts',
      title: 'Горячие клавиши',
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20">
          <rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/>
          <line x1="6" y1="12" x2="18" y2="12" stroke="currentColor" strokeWidth="2"/>
        </svg>
      ),
      content: (
        <div className="doc-content">
          <h2>Горячие клавиши</h2>

          <h3>Основные</h3>
          <table className="shortcut-table full">
            <tbody>
              <tr><td><kbd>Ctrl</kbd>+<kbd>Enter</kbd></td><td>Выполнить SQL запрос</td></tr>
              <tr><td><kbd>Ctrl</kbd>+<kbd>S</kbd></td><td>Сохранить</td></tr>
              <tr><td><kbd>Ctrl</kbd>+<kbd>N</kbd></td><td>Новый запрос</td></tr>
              <tr><td><kbd>Ctrl</kbd>+<kbd>W</kbd></td><td>Закрыть вкладку</td></tr>
              <tr><td><kbd>F5</kbd></td><td>Обновить данные</td></tr>
            </tbody>
          </table>

          <h3>Редактор</h3>
          <table className="shortcut-table full">
            <tbody>
              <tr><td><kbd>Ctrl</kbd>+<kbd>Space</kbd></td><td>Автодополнение</td></tr>
              <tr><td><kbd>Ctrl</kbd>+<kbd>/</kbd></td><td>Комментировать строку</td></tr>
              <tr><td><kbd>Ctrl</kbd>+<kbd>D</kbd></td><td>Дублировать строку</td></tr>
              <tr><td><kbd>Ctrl</kbd>+<kbd>Z</kbd></td><td>Отменить</td></tr>
              <tr><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd></td><td>Повторить</td></tr>
              <tr><td><kbd>Tab</kbd></td><td>Отступ</td></tr>
              <tr><td><kbd>Shift</kbd>+<kbd>Tab</kbd></td><td>Убрать отступ</td></tr>
            </tbody>
          </table>

          <h3>Навигация</h3>
          <table className="shortcut-table full">
            <tbody>
              <tr><td><kbd>Ctrl</kbd>+<kbd>H</kbd></td><td>История запросов</td></tr>
              <tr><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd></td><td>Глобальный поиск</td></tr>
              <tr><td><kbd>Ctrl</kbd>+<kbd>,</kbd></td><td>Настройки</td></tr>
              <tr><td><kbd>F1</kbd></td><td>Справка по горячим клавишам</td></tr>
              <tr><td><kbd>Esc</kbd></td><td>Закрыть модальное окно</td></tr>
            </tbody>
          </table>
        </div>
      )
    },
    {
      id: 'search',
      title: 'Поиск данных',
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20">
          <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" strokeWidth="2"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2"/>
        </svg>
      ),
      content: (
        <div className="doc-content">
          <h2>Глобальный поиск</h2>
          <p className="intro">
            Поиск данных по всем таблицам базы данных одновременно.
          </p>

          <h3>Возможности поиска</h3>
          <ul>
            <li><strong>Текстовый поиск</strong> — по точному совпадению</li>
            <li><strong>Регулярные выражения</strong> — для сложных паттернов</li>
            <li><strong>Чувствительность к регистру</strong> — опционально</li>
            <li><strong>Фильтрация по таблицам</strong> — выбор конкретных таблиц</li>
          </ul>

          <h3>Примеры regex</h3>
          <pre><code>{`# Email адреса
[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}

# Телефоны
\\+?[0-9]{1,3}[\\s-]?\\(?[0-9]{3}\\)?[\\s-]?[0-9]{3}[\\s-]?[0-9]{2}[\\s-]?[0-9]{2}

# Числа
\\d+

# Слова на кириллице
[а-яА-ЯёЁ]+`}</code></pre>

          <h3>Результаты поиска</h3>
          <p>Результаты группируются по таблицам и показывают:</p>
          <ul>
            <li>Название таблицы и количество совпадений</li>
            <li>Строки с найденными значениями</li>
            <li>Подсветку найденного текста</li>
            <li>Возможность перехода к записи</li>
          </ul>
        </div>
      )
    }
  ];

  const filteredSections = sections.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="documentation-overlay" onClick={onClose}>
      <div className="documentation-container" onClick={e => e.stopPropagation()}>
        {/* Sidebar */}
        <div className="doc-sidebar">
          <div className="doc-sidebar-header">
            <h3>Документация</h3>
            <input
              type="text"
              placeholder="Поиск..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="doc-search"
            />
          </div>
          <nav className="doc-nav">
            {filteredSections.map(section => (
              <button
                key={section.id}
                className={`doc-nav-item ${activeSection === section.id ? 'active' : ''}`}
                onClick={() => setActiveSection(section.id)}
              >
                {section.icon}
                <span>{section.title}</span>
              </button>
            ))}
          </nav>
          <div className="doc-sidebar-footer">
            <span>MYCSC v1.0.0</span>
          </div>
        </div>

        {/* Main Content */}
        <div className="doc-main">
          <div className="doc-header">
            <h1>{sections.find(s => s.id === activeSection)?.title}</h1>
            <button className="doc-close-btn" onClick={onClose}>
              <svg viewBox="0 0 24 24" width="24" height="24">
                <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2"/>
                <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </button>
          </div>
          <div className="doc-body">
            {sections.find(s => s.id === activeSection)?.content}
          </div>
        </div>
      </div>

      <style>{`
        .documentation-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .documentation-container {
          width: 95vw;
          height: 90vh;
          max-width: 1400px;
          background: var(--bg-primary);
          border-radius: 16px;
          display: flex;
          overflow: hidden;
          box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5);
        }

        /* Sidebar */
        .doc-sidebar {
          width: 280px;
          background: var(--bg-secondary);
          display: flex;
          flex-direction: column;
          border-right: 1px solid var(--border);
        }

        .doc-sidebar-header {
          padding: 20px;
          border-bottom: 1px solid var(--border);
        }

        .doc-sidebar-header h3 {
          margin: 0 0 16px 0;
          color: var(--text-primary);
          font-size: 18px;
        }

        .doc-search {
          width: 100%;
          padding: 10px 14px;
          background: var(--bg-tertiary);
          border: 1px solid var(--ctp-surface1);
          border-radius: 8px;
          color: var(--text-primary);
          font-size: 14px;
        }

        .doc-search:focus {
          outline: none;
          border-color: var(--accent);
        }

        .doc-nav {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
        }

        .doc-nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 12px 16px;
          background: transparent;
          border: none;
          border-radius: 8px;
          color: var(--text-secondary);
          cursor: pointer;
          text-align: left;
          font-size: 14px;
          transition: all 0.2s;
        }

        .doc-nav-item:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .doc-nav-item.active {
          background: var(--accent);
          color: var(--ctp-crust);
        }

        .doc-nav-item svg {
          flex-shrink: 0;
        }

        .doc-sidebar-footer {
          padding: 16px 20px;
          border-top: 1px solid var(--border);
          color: var(--text-muted);
          font-size: 12px;
        }

        /* Main */
        .doc-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .doc-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 30px;
          border-bottom: 1px solid var(--border);
        }

        .doc-header h1 {
          margin: 0;
          font-size: 24px;
          color: var(--text-primary);
        }

        .doc-close-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 8px;
          border-radius: 8px;
        }

        .doc-close-btn:hover {
          background: var(--error);
          color: var(--ctp-crust);
        }

        .doc-body {
          flex: 1;
          overflow-y: auto;
          padding: 30px;
        }

        /* Content Styles */
        .doc-content h2 {
          margin: 0 0 16px 0;
          color: var(--text-primary);
          font-size: 28px;
        }

        .doc-content h3 {
          margin: 32px 0 16px 0;
          color: var(--accent);
          font-size: 18px;
        }

        .doc-content p {
          color: var(--text-secondary);
          line-height: 1.7;
          margin: 0 0 16px 0;
        }

        .doc-content .intro {
          font-size: 18px;
          color: var(--text-primary);
          margin-bottom: 32px;
        }

        .doc-content ul, .doc-content ol {
          color: var(--text-secondary);
          line-height: 1.8;
          padding-left: 24px;
        }

        .doc-content li {
          margin-bottom: 8px;
        }

        .doc-content code {
          background: var(--bg-tertiary);
          padding: 2px 8px;
          border-radius: 4px;
          color: var(--ctp-yellow);
          font-family: 'Consolas', monospace;
        }

        .doc-content pre {
          background: var(--ctp-crust);
          padding: 20px;
          border-radius: 12px;
          overflow-x: auto;
          margin: 16px 0;
          border: 1px solid var(--border);
        }

        .doc-content pre code {
          background: transparent;
          padding: 0;
          color: var(--text-primary);
          font-size: 14px;
          line-height: 1.6;
        }

        kbd {
          background: linear-gradient(180deg, var(--ctp-surface1) 0%, var(--bg-tertiary) 100%);
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 12px;
          color: var(--text-primary);
          border: 1px solid var(--ctp-surface2);
          box-shadow: 0 2px 0 var(--bg-secondary);
          font-family: inherit;
        }

        /* Step Cards */
        .step-card {
          display: flex;
          gap: 20px;
          background: var(--bg-secondary);
          padding: 24px;
          border-radius: 12px;
          margin-bottom: 16px;
          border: 1px solid var(--border);
        }

        .step-number {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, var(--ctp-blue) 0%, var(--ctp-lavender) 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          color: var(--ctp-crust);
          font-size: 18px;
          flex-shrink: 0;
        }

        .step-content h4 {
          margin: 0 0 12px 0;
          color: var(--text-primary);
          font-size: 16px;
        }

        .step-content p {
          margin: 0 0 12px 0;
        }

        .step-content ul {
          margin: 0;
          padding-left: 20px;
        }

        /* Tip Box */
        .tip-box {
          display: flex;
          gap: 16px;
          background: rgba(166, 227, 161, 0.1);
          border: 1px solid var(--success);
          padding: 16px 20px;
          border-radius: 12px;
          margin-top: 24px;
        }

        .tip-box strong {
          color: var(--success);
        }

        /* Warning Box */
        .warning-box {
          display: flex;
          gap: 16px;
          background: rgba(249, 226, 175, 0.1);
          border: 1px solid var(--warning);
          padding: 16px 20px;
          border-radius: 12px;
          margin-top: 24px;
        }

        .warning-box strong {
          color: var(--warning);
        }

        /* Feature Grid */
        .feature-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin: 20px 0;
        }

        .feature-item {
          display: flex;
          gap: 16px;
          background: var(--bg-secondary);
          padding: 20px;
          border-radius: 12px;
          border: 1px solid var(--border);
        }

        .feature-icon {
          font-size: 28px;
        }

        .feature-icon-text {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, var(--ctp-blue), var(--ctp-lavender));
          color: var(--ctp-crust);
          font-size: 11px;
          font-weight: 700;
          border-radius: 8px;
          flex-shrink: 0;
        }

        .tip-icon, .warning-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: var(--bg-tertiary);
          border-radius: 50%;
          font-size: 16px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .tip-icon {
          color: var(--success);
          background: rgba(166, 227, 161, 0.2);
        }

        .warning-icon {
          color: var(--warning);
          background: rgba(249, 226, 175, 0.2);
        }

        .feature-item strong {
          color: var(--text-primary);
          display: block;
          margin-bottom: 4px;
        }

        .feature-item p {
          margin: 0;
          font-size: 13px;
        }

        /* Shortcut Table */
        .shortcut-table {
          width: 100%;
          border-collapse: collapse;
          margin: 16px 0;
        }

        .shortcut-table td {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
        }

        .shortcut-table td:first-child {
          width: 200px;
        }

        .shortcut-table.full td:first-child {
          width: 250px;
        }

        /* Syntax Demo */
        .syntax-demo {
          background: var(--ctp-crust);
          padding: 20px;
          border-radius: 12px;
          font-family: 'Consolas', monospace;
          font-size: 14px;
          line-height: 1.8;
          border: 1px solid var(--border);
        }

        .syntax-demo .kw { color: var(--ctp-mauve); }
        .syntax-demo .col { color: var(--ctp-blue); }
        .syntax-demo .tbl { color: var(--ctp-green); }
        .syntax-demo .num { color: var(--ctp-peach); }
        .syntax-demo .str { color: var(--ctp-green); }

        /* Types Grid */
        .types-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin: 20px 0;
        }

        .type-category {
          background: var(--bg-secondary);
          padding: 20px;
          border-radius: 12px;
          border: 1px solid var(--border);
        }

        .type-category h4 {
          margin: 0 0 12px 0;
          color: var(--accent);
          font-size: 14px;
        }

        .type-category code {
          margin: 4px;
          display: inline-block;
        }

        /* Format Cards */
        .format-cards {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin: 20px 0;
        }

        .format-card {
          background: var(--bg-secondary);
          padding: 24px;
          border-radius: 12px;
          text-align: center;
          border: 1px solid var(--border);
        }

        .format-icon {
          width: 60px;
          height: 60px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
          font-weight: bold;
          font-size: 14px;
        }

        .format-icon.sql { background: var(--ctp-blue); color: var(--ctp-crust); }
        .format-icon.json { background: var(--ctp-green); color: var(--ctp-crust); }
        .format-icon.csv { background: var(--ctp-peach); color: var(--ctp-crust); }
        .format-icon.xml { background: var(--ctp-mauve); color: var(--ctp-crust); }

        .format-card h4 {
          margin: 0 0 8px 0;
          color: var(--text-primary);
        }

        .format-card p {
          font-size: 13px;
          margin: 0;
        }

        /* Relation Types Doc */
        .relation-types-doc {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin: 20px 0;
        }

        .rel-type {
          display: flex;
          align-items: center;
          gap: 16px;
          background: var(--bg-secondary);
          padding: 16px 20px;
          border-radius: 12px;
          border: 1px solid var(--border);
        }

        .rel-badge {
          background: var(--accent);
          color: var(--ctp-crust);
          padding: 8px 16px;
          border-radius: 6px;
          font-family: monospace;
          font-weight: bold;
        }

        .rel-type strong {
          color: var(--text-primary);
          display: block;
        }

        .rel-type p {
          margin: 0;
          font-size: 13px;
        }

        /* Scrollbar */
        .doc-body::-webkit-scrollbar,
        .doc-nav::-webkit-scrollbar {
          width: 8px;
        }

        .doc-body::-webkit-scrollbar-track,
        .doc-nav::-webkit-scrollbar-track {
          background: transparent;
        }

        .doc-body::-webkit-scrollbar-thumb,
        .doc-nav::-webkit-scrollbar-thumb {
          background: var(--ctp-surface1);
          border-radius: 4px;
        }

        .doc-body::-webkit-scrollbar-thumb:hover,
        .doc-nav::-webkit-scrollbar-thumb:hover {
          background: var(--ctp-surface2);
        }
      `}</style>
    </div>
  );
};
