import React, { useState } from 'react';

export interface AppSettings {
  theme: 'dark' | 'light';
  fontSize: number;
  fontFamily: string;
  autoSave: boolean;
  autoSaveInterval: number;
  showLineNumbers: boolean;
  wordWrap: boolean;
  tabSize: number;
  autoComplete: boolean;
  confirmOnDelete: boolean;
  maxHistoryItems: number;
  language: 'ru' | 'en';
}

export const defaultSettings: AppSettings = {
  theme: 'dark',
  fontSize: 14,
  fontFamily: 'JetBrains Mono',
  autoSave: true,
  autoSaveInterval: 30,
  showLineNumbers: true,
  wordWrap: true,
  tabSize: 2,
  autoComplete: true,
  confirmOnDelete: true,
  maxHistoryItems: 100,
  language: 'ru'
};

interface SettingsModalProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onSave,
  onClose
}) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>({ ...settings });
  const [activeTab, setActiveTab] = useState<'editor' | 'general' | 'appearance'>('editor');

  const handleChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  const handleReset = () => {
    if (confirm('Сбросить все настройки по умолчанию?')) {
      setLocalSettings({ ...defaultSettings });
    }
  };

  const tabs = [
    { id: 'editor' as const, label: 'Редактор', icon: '📝' },
    { id: 'general' as const, label: 'Общие', icon: '⚙️' },
    { id: 'appearance' as const, label: 'Внешний вид', icon: '🎨' }
  ];

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Настройки</h2>
          <button className="close-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="settings-content">
          <div className="settings-tabs">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="settings-panel">
            {activeTab === 'editor' && (
              <div className="settings-section">
                <h3>Редактор кода</h3>
                
                <div className="setting-row">
                  <div className="setting-info">
                    <label>Размер шрифта</label>
                    <span className="setting-desc">Размер шрифта в редакторе SQL</span>
                  </div>
                  <div className="setting-control">
                    <input
                      type="number"
                      min="10"
                      max="24"
                      value={localSettings.fontSize}
                      onChange={e => handleChange('fontSize', parseInt(e.target.value))}
                    />
                    <span className="unit">px</span>
                  </div>
                </div>

                <div className="setting-row">
                  <div className="setting-info">
                    <label>Шрифт</label>
                    <span className="setting-desc">Моноширинный шрифт для кода</span>
                  </div>
                  <select
                    value={localSettings.fontFamily}
                    onChange={e => handleChange('fontFamily', e.target.value)}
                  >
                    <option value="JetBrains Mono">JetBrains Mono</option>
                    <option value="Fira Code">Fira Code</option>
                    <option value="Source Code Pro">Source Code Pro</option>
                    <option value="Consolas">Consolas</option>
                    <option value="Monaco">Monaco</option>
                  </select>
                </div>

                <div className="setting-row">
                  <div className="setting-info">
                    <label>Размер табуляции</label>
                    <span className="setting-desc">Количество пробелов для отступа</span>
                  </div>
                  <select
                    value={localSettings.tabSize}
                    onChange={e => handleChange('tabSize', parseInt(e.target.value))}
                  >
                    <option value="2">2 пробела</option>
                    <option value="4">4 пробела</option>
                  </select>
                </div>

                <div className="setting-row">
                  <div className="setting-info">
                    <label>Номера строк</label>
                    <span className="setting-desc">Показывать номера строк слева</span>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={localSettings.showLineNumbers}
                      onChange={e => handleChange('showLineNumbers', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="setting-row">
                  <div className="setting-info">
                    <label>Перенос строк</label>
                    <span className="setting-desc">Автоматический перенос длинных строк</span>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={localSettings.wordWrap}
                      onChange={e => handleChange('wordWrap', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="setting-row">
                  <div className="setting-info">
                    <label>Автодополнение</label>
                    <span className="setting-desc">Подсказки при вводе SQL</span>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={localSettings.autoComplete}
                      onChange={e => handleChange('autoComplete', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'general' && (
              <div className="settings-section">
                <h3>Общие настройки</h3>

                <div className="setting-row">
                  <div className="setting-info">
                    <label>Автосохранение</label>
                    <span className="setting-desc">Автоматически сохранять данные</span>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={localSettings.autoSave}
                      onChange={e => handleChange('autoSave', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                {localSettings.autoSave && (
                  <div className="setting-row">
                    <div className="setting-info">
                      <label>Интервал автосохранения</label>
                      <span className="setting-desc">Как часто сохранять данные</span>
                    </div>
                    <div className="setting-control">
                      <input
                        type="number"
                        min="10"
                        max="300"
                        value={localSettings.autoSaveInterval}
                        onChange={e => handleChange('autoSaveInterval', parseInt(e.target.value))}
                      />
                      <span className="unit">сек</span>
                    </div>
                  </div>
                )}

                <div className="setting-row">
                  <div className="setting-info">
                    <label>Подтверждение удаления</label>
                    <span className="setting-desc">Спрашивать перед удалением данных</span>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={localSettings.confirmOnDelete}
                      onChange={e => handleChange('confirmOnDelete', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="setting-row">
                  <div className="setting-info">
                    <label>Размер истории</label>
                    <span className="setting-desc">Максимум записей в истории запросов</span>
                  </div>
                  <div className="setting-control">
                    <input
                      type="number"
                      min="10"
                      max="1000"
                      step="10"
                      value={localSettings.maxHistoryItems}
                      onChange={e => handleChange('maxHistoryItems', parseInt(e.target.value))}
                    />
                  </div>
                </div>

                <div className="setting-row">
                  <div className="setting-info">
                    <label>Язык интерфейса</label>
                    <span className="setting-desc">Язык отображения</span>
                  </div>
                  <select
                    value={localSettings.language}
                    onChange={e => handleChange('language', e.target.value as 'ru' | 'en')}
                  >
                    <option value="ru">Русский</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="settings-section">
                <h3>Внешний вид</h3>

                <div className="setting-row">
                  <div className="setting-info">
                    <label>Тема оформления</label>
                    <span className="setting-desc">Цветовая схема интерфейса</span>
                  </div>
                  <div className="theme-selector">
                    <button
                      className={`theme-btn dark ${localSettings.theme === 'dark' ? 'active' : ''}`}
                      onClick={() => handleChange('theme', 'dark')}
                    >
                      <span className="theme-preview dark-preview"></span>
                      <span>Тёмная</span>
                    </button>
                    <button
                      className={`theme-btn light ${localSettings.theme === 'light' ? 'active' : ''}`}
                      onClick={() => handleChange('theme', 'light')}
                    >
                      <span className="theme-preview light-preview"></span>
                      <span>Светлая</span>
                    </button>
                  </div>
                </div>

                <div className="preview-section">
                  <h4>Предпросмотр редактора</h4>
                  <div 
                    className="editor-preview"
                    style={{ 
                      fontSize: localSettings.fontSize,
                      fontFamily: localSettings.fontFamily
                    }}
                  >
                    <div className="preview-line">
                      {localSettings.showLineNumbers && <span className="line-num">1</span>}
                      <span className="keyword">SELECT</span> * <span className="keyword">FROM</span> users
                    </div>
                    <div className="preview-line">
                      {localSettings.showLineNumbers && <span className="line-num">2</span>}
                      <span className="keyword">WHERE</span> age &gt; <span className="number">18</span>
                    </div>
                    <div className="preview-line">
                      {localSettings.showLineNumbers && <span className="line-num">3</span>}
                      <span className="keyword">ORDER BY</span> name;
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="settings-footer">
          <button className="reset-btn" onClick={handleReset}>
            Сбросить
          </button>
          <div className="footer-actions">
            <button className="cancel-btn" onClick={onClose}>
              Отмена
            </button>
            <button className="save-btn" onClick={handleSave}>
              Сохранить
            </button>
          </div>
        </div>

        <style>{`
          .settings-overlay {
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

          .settings-modal {
            width: 100%;
            max-width: 700px;
            max-height: 85vh;
            background: var(--bg-primary);
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          }

          .settings-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 20px 24px;
            border-bottom: 1px solid var(--border);
          }

          .settings-header h2 {
            margin: 0;
            font-size: 18px;
            color: var(--text-primary);
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

          .settings-content {
            display: flex;
            flex: 1;
            overflow: hidden;
          }

          .settings-tabs {
            width: 180px;
            padding: 16px;
            background: var(--bg-secondary);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .tab-btn {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px;
            background: none;
            border: none;
            border-radius: 8px;
            color: var(--text-secondary);
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
            text-align: left;
          }

          .tab-btn:hover {
            background: var(--bg-tertiary);
          }

          .tab-btn.active {
            background: var(--bg-tertiary);
            color: var(--text-primary);
          }

          .tab-icon {
            font-size: 18px;
          }

          .settings-panel {
            flex: 1;
            padding: 24px;
            overflow-y: auto;
          }

          .settings-section h3 {
            margin: 0 0 20px 0;
            font-size: 16px;
            color: var(--text-primary);
            padding-bottom: 12px;
            border-bottom: 1px solid var(--border);
          }

          .setting-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 0;
            border-bottom: 1px solid var(--border);
          }

          .setting-info {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .setting-info label {
            color: var(--text-primary);
            font-size: 14px;
            font-weight: 500;
          }

          .setting-desc {
            color: var(--text-muted);
            font-size: 12px;
          }

          .setting-control {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .setting-control input[type="number"] {
            width: 70px;
            padding: 8px 12px;
            background: var(--bg-tertiary);
            border: 1px solid var(--ctp-surface1);
            border-radius: 6px;
            color: var(--text-primary);
            font-size: 14px;
            text-align: center;
          }

          .unit {
            color: var(--text-muted);
            font-size: 13px;
          }

          select {
            padding: 8px 12px;
            background: var(--bg-tertiary);
            border: 1px solid var(--ctp-surface1);
            border-radius: 6px;
            color: var(--text-primary);
            font-size: 14px;
            cursor: pointer;
            min-width: 150px;
          }

          .toggle {
            position: relative;
            display: inline-block;
            width: 48px;
            height: 24px;
            cursor: pointer;
          }

          .toggle input {
            opacity: 0;
            width: 0;
            height: 0;
          }

          .toggle-slider {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: var(--ctp-surface1);
            border-radius: 24px;
            transition: 0.3s;
          }

          .toggle-slider:before {
            content: '';
            position: absolute;
            height: 18px;
            width: 18px;
            left: 3px;
            bottom: 3px;
            background: var(--text-primary);
            border-radius: 50%;
            transition: 0.3s;
          }

          .toggle input:checked + .toggle-slider {
            background: var(--accent);
          }

          .toggle input:checked + .toggle-slider:before {
            transform: translateX(24px);
          }

          .theme-selector {
            display: flex;
            gap: 12px;
          }

          .theme-btn {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            padding: 12px;
            background: var(--bg-tertiary);
            border: 2px solid transparent;
            border-radius: 8px;
            color: var(--text-secondary);
            cursor: pointer;
            transition: all 0.2s;
          }

          .theme-btn:hover {
            background: var(--ctp-surface1);
          }

          .theme-btn.active {
            border-color: var(--accent);
            color: var(--text-primary);
          }

          .theme-preview {
            width: 60px;
            height: 40px;
            border-radius: 4px;
          }

          .dark-preview {
            background: linear-gradient(135deg, var(--ctp-base), var(--ctp-surface0));
          }

          .light-preview {
            background: linear-gradient(135deg, #eff1f5, #ccd0da);
          }

          .preview-section {
            margin-top: 24px;
            padding-top: 16px;
            border-top: 1px solid var(--border);
          }

          .preview-section h4 {
            margin: 0 0 12px 0;
            font-size: 13px;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .editor-preview {
            background: var(--ctp-crust);
            border-radius: 8px;
            padding: 16px;
            border: 1px solid var(--border);
          }

          .preview-line {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 4px;
            color: var(--text-primary);
          }

          .line-num {
            color: var(--text-muted);
            min-width: 20px;
            text-align: right;
            user-select: none;
          }

          .keyword {
            color: var(--ctp-mauve);
          }

          .number {
            color: var(--ctp-peach);
          }

          .settings-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 24px;
            border-top: 1px solid var(--border);
            background: var(--bg-secondary);
          }

          .reset-btn {
            padding: 10px 16px;
            background: transparent;
            border: 1px solid var(--ctp-surface1);
            border-radius: 6px;
            color: var(--text-secondary);
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
          }

          .reset-btn:hover {
            background: var(--bg-tertiary);
          }

          .footer-actions {
            display: flex;
            gap: 12px;
          }

          .cancel-btn {
            padding: 10px 20px;
            background: var(--bg-tertiary);
            border: none;
            border-radius: 6px;
            color: var(--text-primary);
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
          }

          .cancel-btn:hover {
            background: var(--ctp-surface1);
          }

          .save-btn {
            padding: 10px 20px;
            background: var(--accent);
            border: none;
            border-radius: 6px;
            color: var(--bg-primary);
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          }

          .save-btn:hover {
            filter: brightness(0.9);
          }
        `}</style>
      </div>
    </div>
  );
};
