import React, { useRef, useEffect, useState, useCallback } from 'react';
import { formatSQL } from '../utils/sqlFormatter';

interface QueryEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  isLoading: boolean;
  autoSave?: boolean;
  autoSaveInterval?: number;
  onAutoSave?: (sql: string) => void;
}

export default function QueryEditor({
  value,
  onChange,
  onExecute,
  isLoading,
  autoSave = true,
  autoSaveInterval = 30000,
  onAutoSave
}: QueryEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const lastSavedRef = useRef<string>(value);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!autoSave || !onAutoSave) return;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    if (value !== lastSavedRef.current && value.trim()) {
      setSaveStatus('idle');
      
      saveTimeoutRef.current = setTimeout(() => {
        setSaveStatus('saving');
        onAutoSave(value);
        lastSavedRef.current = value;
        
        setTimeout(() => {
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2000);
        }, 500);
      }, autoSaveInterval);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [value, autoSave, autoSaveInterval, onAutoSave]);
  const handleFormat = useCallback(() => {
    const formatted = formatSQL(value);
    onChange(formatted);
  }, [value, onChange]);
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onExecute();
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newValue = value.substring(0, start) + '  ' + value.substring(end);
        onChange(newValue);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        }, 0);
      }
    }
  };
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.max(200, textareaRef.current.scrollHeight) + 'px';
    }
  }, [value]);

  return (
    <div className="query-editor">
      <div className="editor-toolbar">
        <div className="toolbar-left">
          <span className="editor-title">SQL Редактор</span>
          {autoSave && saveStatus !== 'idle' && (
            <div className={`autosave-indicator ${saveStatus}`}>
              <span className="autosave-dot" />
              {saveStatus === 'saving' ? 'Сохранение...' : 'Сохранено'}
            </div>
          )}
        </div>
        <div className="toolbar-right">
          <button 
            className="format-btn"
            onClick={handleFormat}
            title="Форматировать SQL (Ctrl+Shift+F)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M4 6h16M4 12h10M4 18h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Формат
          </button>
          <button 
            className="btn btn-primary"
            onClick={onExecute}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner"></span>
                Выполняется...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 2L14 8L4 14V2Z" fill="currentColor"/>
                </svg>
                Выполнить
              </>
            )}
          </button>
        </div>
      </div>

      <div className="editor-container">
        <div className="line-numbers">
          {value.split('\n').map((_, i) => (
            <span key={i}>{i + 1}</span>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          className="editor-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Введите SQL запрос..."
          spellCheck={false}
        />
      </div>

      <div className="editor-statusbar">
        <span>Строк: {value.split('\n').length}</span>
        <span>Символов: {value.length}</span>
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 11 }}>
          Ctrl+Enter — выполнить
        </span>
      </div>
    </div>
  );
}
