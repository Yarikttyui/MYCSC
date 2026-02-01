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

Главная страница
<img width="3439" height="1439" alt="image" src="https://github.com/user-attachments/assets/444aa09e-8069-4ef5-a308-ac53dbd825ca" />

Вход и Регистрация
<img width="511" height="787" alt="image" src="https://github.com/user-attachments/assets/f24e352c-a647-41bc-a8e5-d5c93280ea3d" />
<img width="505" height="930" alt="image" src="https://github.com/user-attachments/assets/baf5284c-0a07-4fa7-a862-20653634ea7e" />


