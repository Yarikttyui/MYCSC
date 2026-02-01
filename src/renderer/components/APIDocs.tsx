import React, { useState } from 'react';

interface APIDocsProps {
  onBack: () => void;
}

export const APIDocs: React.FC<APIDocsProps> = ({ onBack }) => {
  const [activeSection, setActiveSection] = useState('overview');

  const sections = [
    { id: 'overview', title: 'Обзор API' },
    { id: 'auth', title: 'Аутентификация' },
    { id: 'databases', title: 'Базы данных' },
    { id: 'tables', title: 'Таблицы' },
    { id: 'query', title: 'SQL запросы' },
    { id: 'export', title: 'Экспорт/Импорт' },
    { id: 'websocket', title: 'WebSocket' },
    { id: 'errors', title: 'Коды ошибок' },
  ];

  const content: Record<string, JSX.Element> = {
    'overview': (
      <div>
        <h2>Обзор MYCSC REST API</h2>
        <p style={{ color: '#a6adc8', marginBottom: '24px' }}>MYCSC предоставляет полнофункциональный REST API для работы с базами данных.</p>

        <h3>Базовый URL</h3>
        <div style={styles.codeBlock}>
          <pre>{`https://adskoekoleso.ru/api`}</pre>
        </div>

        <h3>Формат запросов</h3>
        <ul style={{ color: '#a6adc8', lineHeight: '1.8' }}>
          <li>Все запросы используют JSON формат</li>
          <li>Заголовок: <code style={styles.inlineCode}>Content-Type: application/json</code></li>
          <li>Авторизация: <code style={styles.inlineCode}>Authorization: Bearer {'<token>'}</code></li>
        </ul>

        <h3>Формат ответов</h3>
        <div style={styles.codeBlock}>
          <pre>{`{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "uuid",
    "timestamp": "2026-01-30T12:00:00Z",
    "duration": 15
  }
}`}</pre>
        </div>

        <h3>Доступные эндпоинты</h3>
        <table style={styles.table}>
          <thead>
            <tr><th>Метод</th><th>Эндпоинт</th><th>Описание</th></tr>
          </thead>
          <tbody>
            <tr><td style={styles.methodPost}>POST</td><td>/auth/login</td><td>Авторизация</td></tr>
            <tr><td style={styles.methodPost}>POST</td><td>/auth/register</td><td>Регистрация</td></tr>
            <tr><td style={styles.methodGet}>GET</td><td>/databases</td><td>Список баз данных</td></tr>
            <tr><td style={styles.methodPost}>POST</td><td>/databases</td><td>Создание БД</td></tr>
            <tr><td style={styles.methodGet}>GET</td><td>/tables</td><td>Список таблиц</td></tr>
            <tr><td style={styles.methodPost}>POST</td><td>/query</td><td>Выполнение SQL</td></tr>
            <tr><td style={styles.methodGet}>GET</td><td>/export/:table</td><td>Экспорт данных</td></tr>
          </tbody>
        </table>
      </div>
    ),

    'auth': (
      <div>
        <h2>Аутентификация</h2>
        <p style={{ color: '#a6adc8', marginBottom: '24px' }}>API использует JWT токены для аутентификации.</p>

        <h3>Регистрация</h3>
        <div style={styles.endpoint}>
          <span style={styles.methodPost}>POST</span>
          <code>/api/auth/register</code>
        </div>
        <div style={styles.codeBlock}>
          <pre>{`// Запрос
POST /api/auth/register
Content-Type: application/json

{
  "username": "myuser",
  "email": "user@example.com",
  "password": "securepassword123"
}
{
  "success": true,
  "user": {
    "id": "user_123",
    "username": "myuser",
    "role": "user"
  },
  "sessionId": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}`}</pre>
        </div>

        <h3>Вход</h3>
        <div style={styles.endpoint}>
          <span style={styles.methodPost}>POST</span>
          <code>/api/auth/login</code>
        </div>
        <div style={styles.codeBlock}>
          <pre>{`// Запрос
POST /api/auth/login
Content-Type: application/json

{
  "username": "myuser",
  "password": "securepassword123"
}
{
  "success": true,
  "sessionId": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_123",
    "username": "myuser",
    "role": "user"
  }
}`}</pre>
        </div>

        <h3>Использование токена</h3>
        <div style={styles.codeBlock}>
          <pre>{`// Добавьте заголовок Authorization ко всем запросам
GET /api/tables
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`}</pre>
        </div>

        <h3>Выход</h3>
        <div style={styles.endpoint}>
          <span style={styles.methodPost}>POST</span>
          <code>/api/auth/logout</code>
        </div>
        <div style={styles.codeBlock}>
          <pre>{`POST /api/auth/logout
Authorization: Bearer <token>
{
  "success": true
}`}</pre>
        </div>
      </div>
    ),

    'databases': (
      <div>
        <h2>Управление базами данных</h2>

        <h3>Список баз данных</h3>
        <div style={styles.endpoint}>
          <span style={styles.methodGet}>GET</span>
          <code>/api/databases</code>
        </div>
        <div style={styles.codeBlock}>
          <pre>{`// Ответ
{
  "success": true,
  "data": {
    "databases": ["default", "myapp", "test"]
  }
}`}</pre>
        </div>

        <h3>Создание базы данных</h3>
        <div style={styles.endpoint}>
          <span style={styles.methodPost}>POST</span>
          <code>/api/databases</code>
        </div>
        <div style={styles.codeBlock}>
          <pre>{`// Запрос
{
  "name": "new_database"
}
{
  "success": true,
  "data": {
    "database": "new_database"
  }
}`}</pre>
        </div>

        <h3>Выбор базы данных</h3>
        <div style={styles.endpoint}>
          <span style={styles.methodPost}>POST</span>
          <code>/api/databases/use</code>
        </div>
        <div style={styles.codeBlock}>
          <pre>{`// Запрос
{
  "database": "myapp"
}
{
  "success": true,
  "data": {
    "database": "myapp"
  }
}`}</pre>
        </div>

        <h3>Удаление базы данных</h3>
        <div style={styles.endpoint}>
          <span style={styles.methodDelete}>DELETE</span>
          <code>/api/databases/:name</code>
        </div>
        <div style={styles.codeBlock}>
          <pre>{`DELETE /api/databases/old_database
{
  "success": true
}`}</pre>
        </div>
      </div>
    ),

    'tables': (
      <div>
        <h2>Управление таблицами</h2>

        <h3>Список таблиц</h3>
        <div style={styles.endpoint}>
          <span style={styles.methodGet}>GET</span>
          <code>/api/tables</code>
        </div>
        <div style={styles.codeBlock}>
          <pre>{`// Ответ
{
  "success": true,
  "data": {
    "tables": ["users", "products", "orders"]
  }
}`}</pre>
        </div>

        <h3>Информация о таблице</h3>
        <div style={styles.endpoint}>
          <span style={styles.methodGet}>GET</span>
          <code>/api/tables/:name</code>
        </div>
        <div style={styles.codeBlock}>
          <pre>{`GET /api/tables/users
{
  "success": true,
  "data": {
    "table": {
      "name": "users",
      "columns": [
        { "name": "id", "type": "INT", "primaryKey": true, "autoIncrement": true },
        { "name": "username", "type": "VARCHAR(50)", "nullable": false },
        { "name": "email", "type": "VARCHAR(100)", "unique": true },
        { "name": "created_at", "type": "DATETIME", "default": "NOW()" }
      ],
      "rowCount": 150
    }
  }
}`}</pre>
        </div>

        <h3>Создание таблицы</h3>
        <div style={styles.endpoint}>
          <span style={styles.methodPost}>POST</span>
          <code>/api/tables</code>
        </div>
        <div style={styles.codeBlock}>
          <pre>{`// Запрос
{
  "name": "products",
  "columns": [
    { "name": "id", "type": "INT", "primaryKey": true, "autoIncrement": true },
    { "name": "name", "type": "VARCHAR(100)", "nullable": false },
    { "name": "price", "type": "DECIMAL(10,2)", "default": 0 }
  ]
}
{
  "success": true,
  "data": {
    "table": "products"
  }
}`}</pre>
        </div>

        <h3>Получение данных таблицы</h3>
        <div style={styles.endpoint}>
          <span style={styles.methodGet}>GET</span>
          <code>/api/tables/:name/rows</code>
        </div>
        <div style={styles.codeBlock}>
          <pre>{`GET /api/tables/users/rows?limit=10&offset=0&orderBy=created_at&order=desc
{
  "success": true,
  "data": {
    "rows": [
      { "id": 1, "username": "admin", "email": "admin@example.com" },
      { "id": 2, "username": "user1", "email": "user1@example.com" }
    ]
  },
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "total": 150,
      "totalPages": 15
    }
  }
}`}</pre>
        </div>
      </div>
    ),

    'query': (
      <div>
        <h2>Выполнение SQL запросов</h2>

        <h3>Выполнить SQL</h3>
        <div style={styles.endpoint}>
          <span style={styles.methodPost}>POST</span>
          <code>/api/query</code>
        </div>
        <div style={styles.codeBlock}>
          <pre>{`// Запрос SELECT
POST /api/query
{
  "sql": "SELECT * FROM users WHERE age > 18 ORDER BY name LIMIT 10"
}
{
  "success": true,
  "data": {
    "columns": ["id", "name", "email", "age"],
    "rows": [
      [1, "Alice", "alice@example.com", 25],
      [2, "Bob", "bob@example.com", 30]
    ],
    "rowCount": 2,
    "affectedRows": 0
  }
}`}</pre>
        </div>

        <h3>INSERT запрос</h3>
        <div style={styles.codeBlock}>
          <pre>{`POST /api/query
{
  "sql": "INSERT INTO users (name, email) VALUES ('John', 'john@example.com')"
}
{
  "success": true,
  "data": {
    "affectedRows": 1,
    "insertId": 123
  }
}`}</pre>
        </div>

        <h3>UPDATE запрос</h3>
        <div style={styles.codeBlock}>
          <pre>{`POST /api/query
{
  "sql": "UPDATE users SET status = 'active' WHERE id = 123"
}
{
  "success": true,
  "data": {
    "affectedRows": 1
  }
}`}</pre>
        </div>

        <h3>Множественные запросы</h3>
        <div style={styles.codeBlock}>
          <pre>{`POST /api/query/batch
{
  "queries": [
    "INSERT INTO logs (action) VALUES ('start')",
    "UPDATE counters SET value = value + 1",
    "INSERT INTO logs (action) VALUES ('end')"
  ]
}
{
  "success": true,
  "data": {
    "results": [
      { "affectedRows": 1 },
      { "affectedRows": 1 },
      { "affectedRows": 1 }
    ]
  }
}`}</pre>
        </div>
      </div>
    ),

    'export': (
      <div>
        <h2>Экспорт и Импорт данных</h2>

        <h3>Экспорт таблицы</h3>
        <div style={styles.endpoint}>
          <span style={styles.methodGet}>GET</span>
          <code>/api/export/:table</code>
        </div>
        <div style={styles.codeBlock}>
          <pre>{`// Экспорт в JSON
GET /api/export/users?format=json
GET /api/export/users?format=csv
GET /api/export/users?format=sql
?format=json|csv|sql    - формат экспорта
?where=age>18           - фильтрация
?columns=id,name,email  - выбор колонок`}</pre>
        </div>

        <h3>Импорт данных</h3>
        <div style={styles.endpoint}>
          <span style={styles.methodPost}>POST</span>
          <code>/api/import/:table</code>
        </div>
        <div style={styles.codeBlock}>
          <pre>{`// Импорт JSON
POST /api/import/users
Content-Type: application/json

{
  "data": [
    { "name": "User1", "email": "user1@example.com" },
    { "name": "User2", "email": "user2@example.com" }
  ],
  "mode": "insert"
}
{
  "success": true,
  "data": {
    "imported": 2,
    "errors": 0
  }
}`}</pre>
        </div>

        <h3>Резервное копирование</h3>
        <div style={styles.endpoint}>
          <span style={styles.methodGet}>GET</span>
          <code>/api/backup</code>
        </div>
        <div style={styles.codeBlock}>
          <pre>{`GET /api/backup?database=myapp
        </div>
      </div>
    ),

    'websocket': (
      <div>
        <h2>WebSocket API</h2>
        <p>Для real-time взаимодействия используйте WebSocket подключение.</p>

        <h3>Подключение</h3>
        <div style={styles.codeBlock}>
          <pre>{`// JavaScript
const socket = io('http://31.129.98.56');
const socket = io('http://31.129.98.56', {
  auth: {
    token: 'your-jwt-token'
  }
});

socket.on('connect', () => {
  console.log('Connected to MYCSC');
});`}</pre>
        </div>

        <h3>Выполнение запросов</h3>
        <div style={styles.codeBlock}>
          <pre>{`// Отправка SQL запроса
socket.emit('query', 'SELECT * FROM users', (result) => {
  console.log('Rows:', result.rows);
  console.log('Columns:', result.columns);
});
socket.emit('subscribe', 'users');
socket.on('table:users:change', (event) => {
  console.log('Table changed:', event.type, event.data);
});`}</pre>
        </div>

        <h3>События</h3>
        <table style={styles.table}>
          <thead>
            <tr><th>Событие</th><th>Описание</th></tr>
          </thead>
          <tbody>
            <tr><td><code>connect</code></td><td>Успешное подключение</td></tr>
            <tr><td><code>disconnect</code></td><td>Отключение</td></tr>
            <tr><td><code>error</code></td><td>Ошибка</td></tr>
            <tr><td><code>query:result</code></td><td>Результат запроса</td></tr>
            <tr><td><code>table:change</code></td><td>Изменение в таблице</td></tr>
          </tbody>
        </table>

        <h3>Python клиент</h3>
        <div style={styles.codeBlock}>
          <pre>{`import socketio

sio = socketio.Client()

@sio.on('connect')
def on_connect():
    print('Connected!')

@sio.on('query:result')
def on_result(data):
    print('Result:', data)

sio.connect('http://31.129.98.56')
sio.emit('query', 'SELECT * FROM users')`}</pre>
        </div>
      </div>
    ),

    'errors': (
      <div>
        <h2>Коды ошибок</h2>
        <p>API возвращает понятные коды ошибок для обработки исключительных ситуаций.</p>

        <h3>Формат ошибки</h3>
        <div style={styles.codeBlock}>
          <pre>{`{
  "success": false,
  "error": "Описание ошибки",
  "code": "ERROR_CODE",
  "details": { ... }
}`}</pre>
        </div>

        <h3>HTTP коды статуса</h3>
        <table style={styles.table}>
          <thead>
            <tr><th>Код</th><th>Статус</th><th>Описание</th></tr>
          </thead>
          <tbody>
            <tr><td>200</td><td>OK</td><td>Успешный запрос</td></tr>
            <tr><td>201</td><td>Created</td><td>Ресурс создан</td></tr>
            <tr><td>400</td><td>Bad Request</td><td>Некорректный запрос</td></tr>
            <tr><td>401</td><td>Unauthorized</td><td>Требуется авторизация</td></tr>
            <tr><td>403</td><td>Forbidden</td><td>Доступ запрещён</td></tr>
            <tr><td>404</td><td>Not Found</td><td>Ресурс не найден</td></tr>
            <tr><td>422</td><td>Unprocessable</td><td>Ошибка валидации</td></tr>
            <tr><td>500</td><td>Server Error</td><td>Внутренняя ошибка сервера</td></tr>
          </tbody>
        </table>

        <h3>Коды ошибок API</h3>
        <table style={styles.table}>
          <thead>
            <tr><th>Код</th><th>Описание</th></tr>
          </thead>
          <tbody>
            <tr><td><code>AUTH_REQUIRED</code></td><td>Требуется авторизация</td></tr>
            <tr><td><code>INVALID_TOKEN</code></td><td>Недействительный токен</td></tr>
            <tr><td><code>TOKEN_EXPIRED</code></td><td>Токен истёк</td></tr>
            <tr><td><code>USER_EXISTS</code></td><td>Пользователь уже существует</td></tr>
            <tr><td><code>INVALID_CREDENTIALS</code></td><td>Неверный логин или пароль</td></tr>
            <tr><td><code>TABLE_NOT_FOUND</code></td><td>Таблица не найдена</td></tr>
            <tr><td><code>DATABASE_NOT_FOUND</code></td><td>База данных не найдена</td></tr>
            <tr><td><code>SQL_SYNTAX_ERROR</code></td><td>Ошибка синтаксиса SQL</td></tr>
            <tr><td><code>CONSTRAINT_VIOLATION</code></td><td>Нарушение ограничения</td></tr>
            <tr><td><code>RATE_LIMIT_EXCEEDED</code></td><td>Превышен лимит запросов</td></tr>
          </tbody>
        </table>

        <h3>Пример обработки ошибок</h3>
        <div style={styles.codeBlock}>
          <pre>{`// JavaScript
try {
  const response = await fetch('/api/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({ sql: 'SELECT * FROM users' })
  });
  
  const data = await response.json();
  
  if (!data.success) {
    switch (data.code) {
      case 'AUTH_REQUIRED':
        break;
      case 'SQL_SYNTAX_ERROR':
        alert('Ошибка SQL: ' + data.error);
        break;
      default:
        console.error('Error:', data.error);
    }
  }
} catch (error) {
  console.error('Network error:', error);
}`}</pre>
        </div>
      </div>
    ),
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <button onClick={onBack} style={styles.backBtn}>
          ← Назад
        </button>
        <div style={styles.logo}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#89b4fa" strokeWidth="2">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
          <span style={styles.logoText}>API Documentation</span>
        </div>
        <div style={styles.baseUrl}>
          <code>Base URL: https://adskoekoleso.ru/api</code>
        </div>
      </header>

      <div style={styles.content}>
        {/* Sidebar */}
        <aside style={styles.sidebar}>
          <nav style={styles.sidebarNav}>
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                style={{
                  ...styles.sidebarItem,
                  ...(activeSection === section.id ? styles.sidebarItemActive : {})
                }}
              >
                {section.title}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main style={styles.main}>
          <article style={styles.article}>
            {content[activeSection]}
          </article>
        </main>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1e1e2e 0%, #181825 100%)',
    color: '#cdd6f4',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
    padding: '16px 32px',
    background: 'rgba(30, 30, 46, 0.9)',
    borderBottom: '1px solid rgba(205, 214, 244, 0.1)',
    position: 'sticky' as const,
    top: 0,
    zIndex: 100,
  },
  backBtn: {
    padding: '8px 16px',
    background: 'rgba(255, 255, 255, 0.1)',
    border: 'none',
    borderRadius: '8px',
    color: '#cdd6f4',
    cursor: 'pointer',
    fontSize: '14px',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoIcon: {
    fontSize: '24px',
  },
  logoText: {
    fontSize: '20px',
    fontWeight: 600,
  },
  baseUrl: {
    marginLeft: 'auto',
    padding: '8px 16px',
    background: 'rgba(137, 180, 250, 0.1)',
    borderRadius: '8px',
    fontSize: '13px',
  },
  content: {
    display: 'flex',
    minHeight: 'calc(100vh - 60px)',
  },
  sidebar: {
    width: '260px',
    background: 'rgba(17, 17, 27, 0.5)',
    borderRight: '1px solid rgba(205, 214, 244, 0.1)',
    padding: '24px 16px',
    position: 'sticky' as const,
    top: '60px',
    height: 'calc(100vh - 60px)',
    overflowY: 'auto' as const,
  },
  sidebarNav: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  sidebarItem: {
    padding: '12px 16px',
    background: 'transparent',
    border: 'none',
    borderRadius: '8px',
    color: '#a6adc8',
    cursor: 'pointer',
    fontSize: '14px',
    textAlign: 'left' as const,
    transition: 'all 0.2s',
  },
  sidebarItemActive: {
    background: 'rgba(137, 180, 250, 0.2)',
    color: '#89b4fa',
  },
  main: {
    flex: 1,
    padding: '32px 48px',
    overflowY: 'auto' as const,
    maxHeight: 'calc(100vh - 60px)',
  },
  article: {
    maxWidth: '900px',
    lineHeight: 1.7,
  },
  codeBlock: {
    background: '#11111b',
    borderRadius: '8px',
    padding: '16px',
    marginTop: '12px',
    marginBottom: '20px',
    overflow: 'auto',
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontSize: '13px',
  },
  endpoint: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  },
  methodGet: {
    padding: '4px 8px',
    background: 'rgba(166, 227, 161, 0.2)',
    color: '#a6e3a1',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 600,
  },
  methodPost: {
    padding: '4px 8px',
    background: 'rgba(137, 180, 250, 0.2)',
    color: '#89b4fa',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 600,
  },
  methodDelete: {
    padding: '4px 8px',
    background: 'rgba(243, 139, 168, 0.2)',
    color: '#f38ba8',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 600,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    marginTop: '12px',
    marginBottom: '20px',
    background: 'rgba(17, 17, 27, 0.5)',
    borderRadius: '8px',
    overflow: 'hidden',
  },
};

export default APIDocs;
