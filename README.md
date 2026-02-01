# MYCSC Database

Конструктор баз данных на TypeScript. Поддерживает полный SQL синтаксис, B-Tree индексы, транзакции, внешние ключи, подзапросы и JOIN операции. Работает как десктоп-приложение (Electron) и веб-версия.

---

## Стек технологий

| Слой | Технологии |
|------|------------|
| Язык | TypeScript |
| Ядро БД | SQL парсер, B-Tree индексы |
| Десктоп | Electron |
| Frontend | React, Vite |
| Backend | Node.js, Express |
| Realtime | Socket.IO, WebSocket |
| Авторизация | JWT, OAuth 2.0 (Google, GitHub) |

---

## Возможности

- Полноценный SQL: SELECT, INSERT, UPDATE, DELETE, JOIN, подзапросы
- DDL: CREATE/DROP TABLE/DATABASE/INDEX
- Ограничения: PRIMARY KEY, FOREIGN KEY, UNIQUE, NOT NULL
- Типы данных: INTEGER, VARCHAR, TEXT, BOOLEAN, DATE, TIMESTAMP, JSON, UUID
- B-Tree индексы для ускорения запросов
- OAuth авторизация и email верификация
- Совместная работа в реальном времени
- Экспорт/импорт данных (JSON, CSV, SQL)

---

## Структура проекта

```
src/
├── core/       Ядро БД (lexer, parser, executor, storage, btree)
├── client/     Клиентская библиотека для подключения
├── server/     REST API + WebSocket сервер
├── main/       Electron main process
└── renderer/   React UI компоненты
```

---

## Запуск

```bash
npm install
npm run dev      # Electron
npm run web      # Web (localhost:3001)
npm run build    # Сборка
```