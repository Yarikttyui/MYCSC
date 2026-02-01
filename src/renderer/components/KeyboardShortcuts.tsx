import React from 'react';

export interface Shortcut {
  keys: string[];
  description: string;
  category: 'editor' | 'navigation' | 'general';
}

export const shortcuts: Shortcut[] = [
  { keys: ['F5'], description: 'Выполнить запрос', category: 'editor' },
  { keys: ['Ctrl', 'Enter'], description: 'Выполнить текущий запрос', category: 'editor' },
  { keys: ['Ctrl', 'Shift', 'Enter'], description: 'Выполнить выделенный текст', category: 'editor' },
  { keys: ['Ctrl', 'S'], description: 'Сохранить скрипт', category: 'editor' },
  { keys: ['Ctrl', 'Z'], description: 'Отменить', category: 'editor' },
  { keys: ['Ctrl', 'Y'], description: 'Повторить', category: 'editor' },
  { keys: ['Ctrl', 'Shift', 'Z'], description: 'Повторить', category: 'editor' },
  { keys: ['Ctrl', 'F'], description: 'Поиск в редакторе', category: 'editor' },
  { keys: ['Ctrl', 'H'], description: 'Найти и заменить', category: 'editor' },
  { keys: ['Ctrl', 'D'], description: 'Дублировать строку', category: 'editor' },
  { keys: ['Ctrl', '/'], description: 'Закомментировать строку', category: 'editor' },
  { keys: ['Ctrl', 'Shift', 'F'], description: 'Глобальный поиск', category: 'editor' },
  { keys: ['Ctrl', 'A'], description: 'Выделить всё', category: 'editor' },
  { keys: ['Ctrl', 'L'], description: 'Выделить строку', category: 'editor' },
  { keys: ['Alt', '↑'], description: 'Переместить строку вверх', category: 'editor' },
  { keys: ['Alt', '↓'], description: 'Переместить строку вниз', category: 'editor' },
  { keys: ['Ctrl', 'T'], description: 'Новая вкладка', category: 'navigation' },
  { keys: ['Ctrl', 'W'], description: 'Закрыть вкладку', category: 'navigation' },
  { keys: ['Ctrl', 'Tab'], description: 'Следующая вкладка', category: 'navigation' },
  { keys: ['Ctrl', 'Shift', 'Tab'], description: 'Предыдущая вкладка', category: 'navigation' },
  { keys: ['Ctrl', 'B'], description: 'Показать/скрыть боковую панель', category: 'navigation' },
  { keys: ['Ctrl', '1-9'], description: 'Перейти на вкладку N', category: 'navigation' },
  { keys: ['Ctrl', 'G'], description: 'Перейти к строке', category: 'navigation' },
  { keys: ['Ctrl', 'P'], description: 'Быстрый переход', category: 'navigation' },
  { keys: ['Ctrl', ','], description: 'Открыть настройки', category: 'general' },
  { keys: ['Ctrl', 'Shift', 'H'], description: 'История запросов', category: 'general' },
  { keys: ['Ctrl', 'Shift', 'E'], description: 'Экспорт данных', category: 'general' },
  { keys: ['Ctrl', 'Shift', 'I'], description: 'Импорт данных', category: 'general' },
  { keys: ['Ctrl', 'Shift', 'B'], description: 'Резервные копии', category: 'general' },
  { keys: ['Ctrl', 'Shift', 'R'], description: 'Связи таблиц', category: 'general' },
  { keys: ['Ctrl', 'Shift', 'D'], description: 'ER диаграмма', category: 'general' },
  { keys: ['Ctrl', 'Shift', 'S'], description: 'Статистика', category: 'general' },
  { keys: ['F1'], description: 'Справка', category: 'general' },
  { keys: ['F11'], description: 'Полноэкранный режим', category: 'general' },
  { keys: ['Escape'], description: 'Закрыть диалог / Отмена', category: 'general' },
];

interface KeyboardShortcutsProps {
  onClose: () => void;
}

export const KeyboardShortcuts: React.FC<KeyboardShortcutsProps> = ({ onClose }) => {
  const categories = {
    editor: { title: 'Редактор', icon: '📝' },
    navigation: { title: 'Навигация', icon: '🧭' },
    general: { title: 'Общие', icon: '⚙️' }
  };

  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, Shortcut[]>);

  return (
    <div className="shortcuts-overlay" onClick={onClose}>
      <div className="shortcuts-modal" onClick={e => e.stopPropagation()}>
        <div className="shortcuts-header">
          <div className="header-title">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <line x1="6" y1="8" x2="6" y2="8"/>
              <line x1="10" y1="8" x2="10" y2="8"/>
              <line x1="14" y1="8" x2="14" y2="8"/>
              <line x1="18" y1="8" x2="18" y2="8"/>
              <line x1="6" y1="12" x2="18" y2="12"/>
              <line x1="8" y1="16" x2="16" y2="16"/>
            </svg>
            <h2>Горячие клавиши</h2>
          </div>
          <button className="close-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="shortcuts-content">
          {Object.entries(categories).map(([key, category]) => (
            <div key={key} className="shortcut-category">
              <h3>
                <span className="category-icon">{category.icon}</span>
                {category.title}
              </h3>
              <div className="shortcut-list">
                {groupedShortcuts[key]?.map((shortcut, index) => (
                  <div key={index} className="shortcut-item">
                    <span className="shortcut-description">{shortcut.description}</span>
                    <div className="shortcut-keys">
                      {shortcut.keys.map((key, i) => (
                        <React.Fragment key={i}>
                          <kbd>{key}</kbd>
                          {i < shortcut.keys.length - 1 && <span className="key-separator">+</span>}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="shortcuts-footer">
          <p>💡 Совет: Нажмите <kbd>F1</kbd> в любой момент для вызова справки</p>
        </div>

        <style>{`
          .shortcuts-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 20px;
          }

          .shortcuts-modal {
            width: 100%;
            max-width: 800px;
            max-height: 85vh;
            background: var(--bg-primary);
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          }

          .shortcuts-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 20px 24px;
            border-bottom: 1px solid var(--border);
          }

          .header-title {
            display: flex;
            align-items: center;
            gap: 12px;
            color: var(--text-primary);
          }

          .header-title svg {
            color: var(--accent);
          }

          .header-title h2 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
          }

          .close-btn {
            background: none;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
            padding: 8px;
            border-radius: 6px;
            transition: all 0.2s;
          }

          .close-btn:hover {
            background: var(--bg-tertiary);
            color: var(--text-primary);
          }

          .shortcuts-content {
            flex: 1;
            overflow-y: auto;
            padding: 24px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 24px;
          }

          .shortcut-category h3 {
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 0 0 16px 0;
            font-size: 14px;
            font-weight: 600;
            color: var(--text-primary);
            padding-bottom: 8px;
            border-bottom: 1px solid var(--border);
          }

          .category-icon {
            font-size: 16px;
          }

          .shortcut-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .shortcut-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 12px;
            background: var(--bg-tertiary);
            border-radius: 6px;
            transition: all 0.2s;
          }

          .shortcut-item:hover {
            background: var(--ctp-surface1);
          }

          .shortcut-description {
            color: var(--text-secondary);
            font-size: 13px;
          }

          .shortcut-keys {
            display: flex;
            align-items: center;
            gap: 4px;
          }

          kbd {
            display: inline-block;
            padding: 4px 8px;
            background: var(--bg-secondary);
            border: 1px solid var(--ctp-surface1);
            border-radius: 4px;
            color: var(--text-primary);
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px;
            font-weight: 500;
            box-shadow: 0 2px 0 var(--ctp-crust);
          }

          .key-separator {
            color: var(--text-muted);
            font-size: 12px;
            margin: 0 2px;
          }

          .shortcuts-footer {
            padding: 16px 24px;
            border-top: 1px solid var(--border);
            background: var(--bg-secondary);
            text-align: center;
          }

          .shortcuts-footer p {
            margin: 0;
            color: var(--text-muted);
            font-size: 13px;
          }

          .shortcuts-footer kbd {
            margin: 0 4px;
          }
        `}</style>
      </div>
    </div>
  );
};
export const useKeyboardShortcuts = (handlers: Record<string, () => void>) => {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = [];
      if (e.ctrlKey) key.push('Ctrl');
      if (e.shiftKey) key.push('Shift');
      if (e.altKey) key.push('Alt');
      if (e.key === 'Enter') key.push('Enter');
      else if (e.key === 'Escape') key.push('Escape');
      else if (e.key === 'Tab') key.push('Tab');
      else if (e.key === 'F1') key.push('F1');
      else if (e.key === 'F5') key.push('F5');
      else if (e.key.length === 1) key.push(e.key.toUpperCase());
      
      const shortcutKey = key.join('+');
      
      if (handlers[shortcutKey]) {
        e.preventDefault();
        handlers[shortcutKey]();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
};
