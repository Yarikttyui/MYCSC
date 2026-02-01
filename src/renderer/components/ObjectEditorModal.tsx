import React, { useState, useEffect, useRef } from 'react';

type ObjectType = 'view' | 'procedure' | 'function';

interface ObjectEditorModalProps {
  isOpen: boolean;
  type: ObjectType;
  onClose: () => void;
  onSave: (name: string, definition: string, params?: string[], returnType?: string) => void;
  existingObject?: {
    name: string;
    definition: string;
    parameters?: string[];
    returnType?: string;
  } | null;
}

export const ObjectEditorModal: React.FC<ObjectEditorModalProps> = ({
  isOpen,
  type,
  onClose,
  onSave,
  existingObject
}) => {
  const [name, setName] = useState('');
  const [definition, setDefinition] = useState('');
  const [parameters, setParameters] = useState('');
  const [returnType, setReturnType] = useState('INT');
  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (existingObject) {
        setName(existingObject.name);
        setDefinition(existingObject.definition);
        setParameters(existingObject.parameters?.join(', ') || '');
        setReturnType(existingObject.returnType || 'INT');
      } else {
        const defaultName = `new_${type}`;
        setName(defaultName);
        
        if (type === 'view') {
          setDefinition('SELECT * FROM ');
        } else if (type === 'procedure') {
          setDefinition('-- Тело процедуры\nSELECT 1;');
          setParameters('');
        } else if (type === 'function') {
          setDefinition('-- Тело функции\nRETURN 0;');
          setParameters('');
          setReturnType('INT');
        }
      }
      
      setTimeout(() => editorRef.current?.focus(), 100);
    }
  }, [isOpen, type, existingObject]);

  if (!isOpen) return null;

  const getTitle = () => {
    const prefix = existingObject ? 'Редактировать' : 'Создать';
    switch (type) {
      case 'view': return `${prefix} View`;
      case 'procedure': return `${prefix} Stored Procedure`;
      case 'function': return `${prefix} Function`;
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'view':
        return (
          <svg viewBox="0 0 24 24" width="32" height="32">
            <path fill="var(--ctp-blue)" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
          </svg>
        );
      case 'procedure':
        return (
          <svg viewBox="0 0 24 24" width="32" height="32">
            <path fill="var(--ctp-green)" d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0L19.2 12l-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
          </svg>
        );
      case 'function':
        return (
          <svg viewBox="0 0 24 24" width="32" height="32">
            <text x="4" y="18" fontSize="18" fontWeight="bold" fill="var(--ctp-mauve)">ƒ</text>
          </svg>
        );
    }
  };

  const getHint = () => {
    switch (type) {
      case 'view':
        return 'Имя View извлекается автоматически из DDL. DDL парсится автоматически при вводе.';
      case 'procedure':
        return 'Введите имя процедуры, параметры и тело процедуры.';
      case 'function':
        return 'Введите имя функции, параметры, тип возврата и тело функции.';
    }
  };

  const getPreviewSQL = () => {
    switch (type) {
      case 'view':
        return `CREATE VIEW \`${name}\` AS\n${definition}`;
      case 'procedure':
        return `CREATE PROCEDURE \`${name}\`(${parameters})\nBEGIN\n${definition}\nEND`;
      case 'function':
        return `CREATE FUNCTION \`${name}\`(${parameters}) RETURNS ${returnType}\nDETERMINISTIC\nBEGIN\n${definition}\nEND`;
    }
  };

  const handleSave = () => {
    if (!name.trim()) return;
    
    const params = parameters ? parameters.split(',').map(p => p.trim()).filter(p => p) : [];
    onSave(name.trim(), definition, params, returnType);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="object-editor-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="header-icon">{getIcon()}</div>
          <div className="header-info">
            <h2>{getTitle()}</h2>
            <p className="header-hint">{getHint()}</p>
          </div>
          <button className="close-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="modal-body">
          {/* Name field */}
          <div className="form-row">
            <label>Name:</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={`new_${type}`}
              className="name-input"
            />
          </div>

          {/* Parameters for procedure/function */}
          {(type === 'procedure' || type === 'function') && (
            <div className="form-row">
              <label>Parameters:</label>
              <input
                type="text"
                value={parameters}
                onChange={e => setParameters(e.target.value)}
                placeholder="IN param1 INT, IN param2 VARCHAR(255)"
                className="params-input"
              />
            </div>
          )}

          {/* Return type for function */}
          {type === 'function' && (
            <div className="form-row">
              <label>Returns:</label>
              <select 
                value={returnType} 
                onChange={e => setReturnType(e.target.value)}
                className="return-select"
              >
                <optgroup label="Numeric">
                  <option value="INT">INT</option>
                  <option value="BIGINT">BIGINT</option>
                  <option value="DECIMAL">DECIMAL</option>
                  <option value="FLOAT">FLOAT</option>
                  <option value="DOUBLE">DOUBLE</option>
                </optgroup>
                <optgroup label="String">
                  <option value="VARCHAR(255)">VARCHAR(255)</option>
                  <option value="TEXT">TEXT</option>
                  <option value="CHAR(1)">CHAR(1)</option>
                </optgroup>
                <optgroup label="Date/Time">
                  <option value="DATE">DATE</option>
                  <option value="DATETIME">DATETIME</option>
                  <option value="TIMESTAMP">TIMESTAMP</option>
                </optgroup>
                <optgroup label="Other">
                  <option value="BOOLEAN">BOOLEAN</option>
                  <option value="JSON">JSON</option>
                </optgroup>
              </select>
            </div>
          )}

          {/* DDL Editor */}
          <div className="form-row editor-row">
            <label>{type === 'view' ? 'DDL:' : 'Body:'}</label>
            <div className="ddl-toolbar">
              <button title="Открыть"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H5V8h14v10z"/></svg></button>
              <button title="Сохранить"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm2 16H5V5h11.17L19 7.83V19zm-7-7c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zM6 6h9v4H6z"/></svg></button>
              <span className="toolbar-divider"></span>
              <button title="Отменить"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg></button>
              <button title="Повторить"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/></svg></button>
              <span className="toolbar-divider"></span>
              <button title="Поиск"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg></button>
              <button title="Красивый вывод"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M3 21h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18V7H3v2zm0-6v2h18V3H3z"/></svg></button>
            </div>
            <div className="editor-wrapper">
              <div className="line-numbers">
                {definition.split('\n').map((_, i) => (
                  <div key={i} className="line-num">{i + 1}</div>
                ))}
              </div>
              <textarea
                ref={editorRef}
                value={definition}
                onChange={e => setDefinition(e.target.value)}
                placeholder={type === 'view' ? 'SELECT * FROM table_name' : '-- Введите код здесь'}
                className="ddl-editor"
                spellCheck={false}
              />
            </div>
          </div>

          {/* Preview */}
          <div className="preview-section">
            <label>Предпросмотр SQL:</label>
            <pre className="sql-preview">{getPreviewSQL()}</pre>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <div className="footer-tab">{type === 'view' ? 'View' : type === 'procedure' ? 'Procedure' : 'Function'}</div>
          <div className="footer-actions">
            <button className="btn-secondary" onClick={onClose}>Отмена</button>
            <button className="btn-primary" onClick={handleSave} disabled={!name.trim()}>
              Применить
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .modal-overlay {
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
          backdrop-filter: blur(4px);
        }

        .object-editor-modal {
          width: 90%;
          max-width: 900px;
          max-height: 90vh;
          background: var(--bg-primary);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          border: 1px solid var(--border);
        }

        .modal-header {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px 24px;
          border-bottom: 1px solid var(--border);
          background: var(--bg-secondary);
          border-radius: 12px 12px 0 0;
        }

        .header-icon {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: color-mix(in srgb, var(--ctp-blue) 10%, transparent);
          border-radius: 8px;
        }

        .header-info {
          flex: 1;
        }

        .header-info h2 {
          margin: 0;
          font-size: 18px;
          color: var(--text-primary);
          font-weight: 600;
        }

        .header-hint {
          margin: 4px 0 0;
          font-size: 12px;
          color: var(--text-muted);
        }

        .close-btn {
          padding: 8px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.2s;
        }

        .close-btn:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .modal-body {
          flex: 1;
          padding: 20px 24px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .form-row {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-row label {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .name-input,
        .params-input {
          padding: 10px 14px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 6px;
          color: var(--text-primary);
          font-size: 14px;
          font-family: 'Consolas', 'Monaco', monospace;
          transition: border-color 0.2s;
        }

        .name-input:focus,
        .params-input:focus {
          outline: none;
          border-color: var(--accent);
        }

        .return-select {
          padding: 10px 14px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 6px;
          color: var(--text-primary);
          font-size: 14px;
          cursor: pointer;
        }

        .return-select:focus {
          outline: none;
          border-color: var(--accent);
        }

        .editor-row {
          flex: 1;
          min-height: 200px;
        }

        .ddl-toolbar {
          display: flex;
          gap: 4px;
          padding: 6px 8px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-bottom: none;
          border-radius: 6px 6px 0 0;
        }

        .ddl-toolbar button {
          padding: 6px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .ddl-toolbar button:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .toolbar-divider {
          width: 1px;
          background: var(--border);
          margin: 0 4px;
        }

        .editor-wrapper {
          display: flex;
          flex: 1;
          min-height: 180px;
          border: 1px solid var(--border);
          border-radius: 0 0 6px 6px;
          overflow: hidden;
        }

        .line-numbers {
          width: 40px;
          background: var(--bg-secondary);
          border-right: 1px solid var(--border);
          padding: 8px 0;
          text-align: right;
          user-select: none;
        }

        .line-num {
          height: 20px;
          line-height: 20px;
          padding-right: 8px;
          font-size: 12px;
          color: var(--text-muted);
          font-family: 'Consolas', 'Monaco', monospace;
        }

        .ddl-editor {
          flex: 1;
          padding: 8px 12px;
          background: var(--bg-primary);
          border: none;
          color: var(--text-primary);
          font-family: 'Consolas', 'Monaco', monospace;
          font-size: 13px;
          line-height: 20px;
          resize: none;
          outline: none;
        }

        .ddl-editor::placeholder {
          color: var(--text-muted);
        }

        .preview-section {
          padding-top: 12px;
          border-top: 1px solid var(--border);
        }

        .preview-section label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }

        .sql-preview {
          padding: 12px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 6px;
          color: var(--accent);
          font-family: 'Consolas', 'Monaco', monospace;
          font-size: 12px;
          line-height: 1.5;
          white-space: pre-wrap;
          margin: 0;
          max-height: 100px;
          overflow-y: auto;
        }

        .modal-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 24px;
          background: var(--bg-secondary);
          border-top: 1px solid var(--border);
          border-radius: 0 0 12px 12px;
        }

        .footer-tab {
          padding: 6px 16px;
          background: var(--bg-tertiary);
          border-radius: 4px;
          font-size: 12px;
          color: var(--accent);
          font-weight: 500;
        }

        .footer-actions {
          display: flex;
          gap: 12px;
        }

        .btn-secondary {
          padding: 8px 20px;
          background: var(--bg-tertiary);
          border: none;
          border-radius: 6px;
          color: var(--text-primary);
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-secondary:hover {
          background: var(--ctp-surface1);
        }

        .btn-primary {
          padding: 8px 20px;
          background: var(--accent);
          border: none;
          border-radius: 6px;
          color: var(--ctp-crust);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary:hover:not(:disabled) {
          background: var(--accent-hover);
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};
