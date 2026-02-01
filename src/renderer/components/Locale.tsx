import React, { createContext, useContext, useState, useCallback } from 'react';

export type Language = 'ru' | 'en';
export interface Translations {
  'common.save': string;
  'common.cancel': string;
  'common.close': string;
  'common.delete': string;
  'common.edit': string;
  'common.create': string;
  'common.search': string;
  'common.loading': string;
  'common.success': string;
  'common.error': string;
  'common.warning': string;
  'common.info': string;
  'common.yes': string;
  'common.no': string;
  'common.confirm': string;
  'common.copy': string;
  'common.copied': string;
  'common.export': string;
  'common.import': string;
  'common.refresh': string;
  'common.apply': string;
  'common.reset': string;
  'app.title': string;
  'app.disconnect': string;
  'app.settings': string;
  'app.about': string;
  'app.help': string;
  'auth.login': string;
  'auth.logout': string;
  'auth.username': string;
  'auth.password': string;
  'auth.welcome': string;
  'db.databases': string;
  'db.tables': string;
  'db.views': string;
  'db.procedures': string;
  'db.functions': string;
  'db.indexes': string;
  'db.noTables': string;
  'db.createTable': string;
  'db.dropTable': string;
  'db.truncateTable': string;
  'db.refreshTables': string;
  'editor.title': string;
  'editor.execute': string;
  'editor.executing': string;
  'editor.format': string;
  'editor.clear': string;
  'editor.history': string;
  'editor.newTab': string;
  'editor.placeholder': string;
  'editor.lines': string;
  'editor.characters': string;
  'results.title': string;
  'results.rows': string;
  'results.rowsAffected': string;
  'results.executionTime': string;
  'results.noResults': string;
  'results.executeHint': string;
  'results.copyAs': string;
  'results.copyJSON': string;
  'results.copyCSV': string;
  'results.copySQL': string;
  'results.copyMarkdown': string;
  'results.chart': string;
  'results.table': string;
  'toast.querySuccess': string;
  'toast.queryError': string;
  'toast.savedQuery': string;
  'toast.copiedClipboard': string;
  'toast.connectionLost': string;
  'toast.exportSuccess': string;
  'toast.importSuccess': string;
  'settings.title': string;
  'settings.theme': string;
  'settings.themeDark': string;
  'settings.themeLight': string;
  'settings.language': string;
  'settings.fontSize': string;
  'settings.fontFamily': string;
  'settings.autoSave': string;
  'settings.autoSaveInterval': string;
  'settings.showLineNumbers': string;
  'settings.wordWrap': string;
  'settings.tabSize': string;
  'settings.autoComplete': string;
  'settings.confirmDelete': string;
  'settings.maxHistory': string;
  'admin.title': string;
  'admin.serverStatus': string;
  'admin.connections': string;
  'admin.users': string;
  'admin.variables': string;
  'admin.logs': string;
  'admin.performance': string;
  'stats.title': string;
  'stats.queriesExecuted': string;
  'stats.tablesCount': string;
  'stats.totalRows': string;
  'stats.sessionTime': string;
  'chart.bar': string;
  'chart.line': string;
  'chart.pie': string;
  'chart.area': string;
  'chart.noNumericData': string;
}

const translations: Record<Language, Translations> = {
  ru: {
    'common.save': 'Сохранить',
    'common.cancel': 'Отмена',
    'common.close': 'Закрыть',
    'common.delete': 'Удалить',
    'common.edit': 'Редактировать',
    'common.create': 'Создать',
    'common.search': 'Поиск',
    'common.loading': 'Загрузка...',
    'common.success': 'Успешно',
    'common.error': 'Ошибка',
    'common.warning': 'Предупреждение',
    'common.info': 'Информация',
    'common.yes': 'Да',
    'common.no': 'Нет',
    'common.confirm': 'Подтвердить',
    'common.copy': 'Копировать',
    'common.copied': 'Скопировано',
    'common.export': 'Экспорт',
    'common.import': 'Импорт',
    'common.refresh': 'Обновить',
    'common.apply': 'Применить',
    'common.reset': 'Сбросить',
    'app.title': 'MYCSC',
    'app.disconnect': 'Отключиться',
    'app.settings': 'Настройки',
    'app.about': 'О программе',
    'app.help': 'Помощь',
    'auth.login': 'Войти',
    'auth.logout': 'Выйти',
    'auth.username': 'Имя пользователя',
    'auth.password': 'Пароль',
    'auth.welcome': 'Добро пожаловать',
    'db.databases': 'Базы данных',
    'db.tables': 'Таблицы',
    'db.views': 'Представления',
    'db.procedures': 'Процедуры',
    'db.functions': 'Функции',
    'db.indexes': 'Индексы',
    'db.noTables': 'Нет таблиц',
    'db.createTable': 'Создать таблицу',
    'db.dropTable': 'Удалить таблицу',
    'db.truncateTable': 'Очистить таблицу',
    'db.refreshTables': 'Обновить таблицы',
    'editor.title': 'SQL Редактор',
    'editor.execute': 'Выполнить',
    'editor.executing': 'Выполняется...',
    'editor.format': 'Форматировать',
    'editor.clear': 'Очистить',
    'editor.history': 'История',
    'editor.newTab': 'Новая вкладка',
    'editor.placeholder': 'Введите SQL запрос...',
    'editor.lines': 'Строк',
    'editor.characters': 'Символов',
    'results.title': 'Результаты',
    'results.rows': 'строк',
    'results.rowsAffected': 'затронуто строк',
    'results.executionTime': 'Время выполнения',
    'results.noResults': 'Результаты запроса появятся здесь',
    'results.executeHint': 'Нажмите Ctrl+Enter для выполнения',
    'results.copyAs': 'Копировать как',
    'results.copyJSON': 'JSON',
    'results.copyCSV': 'CSV',
    'results.copySQL': 'SQL INSERT',
    'results.copyMarkdown': 'Markdown',
    'results.chart': 'График',
    'results.table': 'Таблица',
    'toast.querySuccess': 'Запрос выполнен успешно',
    'toast.queryError': 'Ошибка выполнения запроса',
    'toast.savedQuery': 'Запрос сохранён',
    'toast.copiedClipboard': 'Скопировано в буфер обмена',
    'toast.connectionLost': 'Соединение потеряно',
    'toast.exportSuccess': 'Экспорт завершён',
    'toast.importSuccess': 'Импорт завершён',
    'settings.title': 'Настройки',
    'settings.theme': 'Тема',
    'settings.themeDark': 'Тёмная',
    'settings.themeLight': 'Светлая',
    'settings.language': 'Язык',
    'settings.fontSize': 'Размер шрифта',
    'settings.fontFamily': 'Шрифт',
    'settings.autoSave': 'Автосохранение',
    'settings.autoSaveInterval': 'Интервал автосохранения',
    'settings.showLineNumbers': 'Номера строк',
    'settings.wordWrap': 'Перенос строк',
    'settings.tabSize': 'Размер табуляции',
    'settings.autoComplete': 'Автодополнение',
    'settings.confirmDelete': 'Подтверждение удаления',
    'settings.maxHistory': 'Макс. записей в истории',
    'admin.title': 'Администрирование',
    'admin.serverStatus': 'Статус сервера',
    'admin.connections': 'Подключения',
    'admin.users': 'Пользователи',
    'admin.variables': 'Переменные',
    'admin.logs': 'Логи',
    'admin.performance': 'Производительность',
    'stats.title': 'Статистика',
    'stats.queriesExecuted': 'Выполнено запросов',
    'stats.tablesCount': 'Количество таблиц',
    'stats.totalRows': 'Всего записей',
    'stats.sessionTime': 'Время сессии',
    'chart.bar': 'Столбчатая',
    'chart.line': 'Линейная',
    'chart.pie': 'Круговая',
    'chart.area': 'Площадная',
    'chart.noNumericData': 'Нет числовых данных для визуализации',
  },
  en: {
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.close': 'Close',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.create': 'Create',
    'common.search': 'Search',
    'common.loading': 'Loading...',
    'common.success': 'Success',
    'common.error': 'Error',
    'common.warning': 'Warning',
    'common.info': 'Info',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.confirm': 'Confirm',
    'common.copy': 'Copy',
    'common.copied': 'Copied',
    'common.export': 'Export',
    'common.import': 'Import',
    'common.refresh': 'Refresh',
    'common.apply': 'Apply',
    'common.reset': 'Reset',
    'app.title': 'MYCSC',
    'app.disconnect': 'Disconnect',
    'app.settings': 'Settings',
    'app.about': 'About',
    'app.help': 'Help',
    'auth.login': 'Login',
    'auth.logout': 'Logout',
    'auth.username': 'Username',
    'auth.password': 'Password',
    'auth.welcome': 'Welcome',
    'db.databases': 'Databases',
    'db.tables': 'Tables',
    'db.views': 'Views',
    'db.procedures': 'Procedures',
    'db.functions': 'Functions',
    'db.indexes': 'Indexes',
    'db.noTables': 'No tables',
    'db.createTable': 'Create table',
    'db.dropTable': 'Drop table',
    'db.truncateTable': 'Truncate table',
    'db.refreshTables': 'Refresh tables',
    'editor.title': 'SQL Editor',
    'editor.execute': 'Execute',
    'editor.executing': 'Executing...',
    'editor.format': 'Format',
    'editor.clear': 'Clear',
    'editor.history': 'History',
    'editor.newTab': 'New tab',
    'editor.placeholder': 'Enter SQL query...',
    'editor.lines': 'Lines',
    'editor.characters': 'Characters',
    'results.title': 'Results',
    'results.rows': 'rows',
    'results.rowsAffected': 'rows affected',
    'results.executionTime': 'Execution time',
    'results.noResults': 'Query results will appear here',
    'results.executeHint': 'Press Ctrl+Enter to execute',
    'results.copyAs': 'Copy as',
    'results.copyJSON': 'JSON',
    'results.copyCSV': 'CSV',
    'results.copySQL': 'SQL INSERT',
    'results.copyMarkdown': 'Markdown',
    'results.chart': 'Chart',
    'results.table': 'Table',
    'toast.querySuccess': 'Query executed successfully',
    'toast.queryError': 'Query execution error',
    'toast.savedQuery': 'Query saved',
    'toast.copiedClipboard': 'Copied to clipboard',
    'toast.connectionLost': 'Connection lost',
    'toast.exportSuccess': 'Export completed',
    'toast.importSuccess': 'Import completed',
    'settings.title': 'Settings',
    'settings.theme': 'Theme',
    'settings.themeDark': 'Dark',
    'settings.themeLight': 'Light',
    'settings.language': 'Language',
    'settings.fontSize': 'Font size',
    'settings.fontFamily': 'Font family',
    'settings.autoSave': 'Auto save',
    'settings.autoSaveInterval': 'Auto save interval',
    'settings.showLineNumbers': 'Line numbers',
    'settings.wordWrap': 'Word wrap',
    'settings.tabSize': 'Tab size',
    'settings.autoComplete': 'Auto complete',
    'settings.confirmDelete': 'Confirm delete',
    'settings.maxHistory': 'Max history items',
    'admin.title': 'Administration',
    'admin.serverStatus': 'Server status',
    'admin.connections': 'Connections',
    'admin.users': 'Users',
    'admin.variables': 'Variables',
    'admin.logs': 'Logs',
    'admin.performance': 'Performance',
    'stats.title': 'Statistics',
    'stats.queriesExecuted': 'Queries executed',
    'stats.tablesCount': 'Tables count',
    'stats.totalRows': 'Total rows',
    'stats.sessionTime': 'Session time',
    'chart.bar': 'Bar',
    'chart.line': 'Line',
    'chart.pie': 'Pie',
    'chart.area': 'Area',
    'chart.noNumericData': 'No numeric data for visualization',
  }
};

interface LocaleContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof Translations) => string;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('mycsc_language');
    return (saved as Language) || 'ru';
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('mycsc_language', lang);
  }, []);

  const t = useCallback((key: keyof Translations): string => {
    return translations[language][key] || key;
  }, [language]);

  return (
    <LocaleContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LocaleContext.Provider>
  );
}
