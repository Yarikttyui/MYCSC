import React, { useState } from 'react';

type ExportFormat = 'sql' | 'json' | 'csv' | 'xml' | 'excel';

interface ExportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tables: string[];
  currentTable: string | null;
  onExport: (options: ExportOptions) => Promise<string>;
  onImport: (format: ExportFormat, data: string, tableName: string) => Promise<void>;
}

interface ExportOptions {
  format: ExportFormat;
  tables: string[];
  includeSchema: boolean;
  includeData: boolean;
  prettyPrint: boolean;
}

export const ExportImportModal: React.FC<ExportImportModalProps> = ({
  isOpen,
  onClose,
  tables,
  currentTable,
  onExport,
  onImport
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('sql');
  const [selectedTables, setSelectedTables] = useState<string[]>(currentTable ? [currentTable] : []);
  const [includeSchema, setIncludeSchema] = useState(true);
  const [includeData, setIncludeData] = useState(true);
  const [prettyPrint, setPrettyPrint] = useState(true);
  const [exportResult, setExportResult] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);

  const [importFormat, setImportFormat] = useState<ExportFormat>('csv');
  const [importTable, setImportTable] = useState(currentTable || '');
  const [importData, setImportData] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSelectAll = () => {
    if (selectedTables.length === tables.length) {
      setSelectedTables([]);
    } else {
      setSelectedTables([...tables]);
    }
  };

  const handleToggleTable = (table: string) => {
    if (selectedTables.includes(table)) {
      setSelectedTables(selectedTables.filter(t => t !== table));
    } else {
      setSelectedTables([...selectedTables, table]);
    }
  };

  const handleExport = async () => {
    if (selectedTables.length === 0) return;
    
    setIsExporting(true);
    try {
      const result = await onExport({
        format: exportFormat,
        tables: selectedTables,
        includeSchema,
        includeData,
        prettyPrint
      });
      setExportResult(result);
    } catch (error: any) {
      setExportResult(`-- Error: ${error.message}`);
    }
    setIsExporting(false);
  };

  const handleDownload = () => {
    const extensions: Record<ExportFormat, string> = {
      sql: '.sql',
      json: '.json',
      csv: '.csv',
      xml: '.xml',
      excel: '.xls'
    };

    const blob = new Blob([exportResult], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mycsc_export_${Date.now()}${extensions[exportFormat]}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(exportResult);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setImportData(event.target?.result as string || '');
      };
      reader.readAsText(file);
    }
  };

  const handleImport = async () => {
    if (!importData.trim() || !importTable) return;
    
    setIsImporting(true);
    setImportResult(null);
    
    try {
      await onImport(importFormat, importData, importTable);
      setImportResult({ success: true, message: 'Данные успешно импортированы!' });
      setImportData('');
      setImportFile(null);
    } catch (error: any) {
      setImportResult({ success: false, message: error.message });
    }
    
    setIsImporting(false);
  };

  if (!isOpen) return null;

  return (
    <div className="export-import-modal-overlay" onClick={onClose}>
      <div className="export-import-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Экспорт / Импорт данных</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-tabs">
          <button 
            className={`tab ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => setActiveTab('export')}
          >
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
            </svg>
            Экспорт
          </button>
          <button 
            className={`tab ${activeTab === 'import' ? 'active' : ''}`}
            onClick={() => setActiveTab('import')}
          >
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M5 20h14v-2H5v2zm7-18l-7 7h4v6h6v-6h4l-7-7z"/>
            </svg>
            Импорт
          </button>
        </div>

        <div className="modal-body">
          {activeTab === 'export' ? (
            <div className="export-content">
              <div className="export-options">
                <div className="option-group">
                  <h4>Формат</h4>
                  <div className="format-buttons">
                    {(['sql', 'json', 'csv', 'xml', 'excel'] as ExportFormat[]).map(format => (
                      <button
                        key={format}
                        className={`format-btn ${exportFormat === format ? 'active' : ''}`}
                        onClick={() => setExportFormat(format)}
                      >
                        {format === 'excel' ? 'Excel' : format.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="option-group">
                  <h4>Таблицы</h4>
                  <div className="tables-select">
                    <label className="select-all">
                      <input
                        type="checkbox"
                        checked={selectedTables.length === tables.length}
                        onChange={handleSelectAll}
                      />
                      Выбрать все
                    </label>
                    <div className="tables-list">
                      {tables.map(table => (
                        <label key={table} className="table-checkbox">
                          <input
                            type="checkbox"
                            checked={selectedTables.includes(table)}
                            onChange={() => handleToggleTable(table)}
                          />
                          {table}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="option-group">
                  <h4>Опции</h4>
                  <div className="options-list">
                    <label className="option-checkbox">
                      <input
                        type="checkbox"
                        checked={includeSchema}
                        onChange={(e) => setIncludeSchema(e.target.checked)}
                      />
                      Включить структуру таблиц
                    </label>
                    <label className="option-checkbox">
                      <input
                        type="checkbox"
                        checked={includeData}
                        onChange={(e) => setIncludeData(e.target.checked)}
                      />
                      Включить данные
                    </label>
                    {(exportFormat === 'json' || exportFormat === 'xml') && (
                      <label className="option-checkbox">
                        <input
                          type="checkbox"
                          checked={prettyPrint}
                          onChange={(e) => setPrettyPrint(e.target.checked)}
                        />
                        Форматировать вывод
                      </label>
                    )}
                  </div>
                </div>

                <button 
                  className="export-btn"
                  onClick={handleExport}
                  disabled={isExporting || selectedTables.length === 0}
                >
                  {isExporting ? 'Экспорт...' : 'Экспортировать'}
                </button>
              </div>

              <div className="export-result">
                <div className="result-header">
                  <h4>Результат</h4>
                  {exportResult && (
                    <div className="result-actions">
                      <button onClick={handleCopyToClipboard} title="Копировать">
                        <svg viewBox="0 0 24 24" width="16" height="16">
                          <path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                        </svg>
                      </button>
                      <button onClick={handleDownload} title="Скачать">
                        <svg viewBox="0 0 24 24" width="16" height="16">
                          <path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
                <pre className="result-content">
                  {exportResult || 'Выберите таблицы и нажмите "Экспортировать"'}
                </pre>
              </div>
            </div>
          ) : (
            <div className="import-content">
              <div className="import-options">
                <div className="option-group">
                  <h4>Формат файла</h4>
                  <div className="format-buttons">
                    {(['csv', 'json'] as ExportFormat[]).map(format => (
                      <button
                        key={format}
                        className={`format-btn ${importFormat === format ? 'active' : ''}`}
                        onClick={() => setImportFormat(format)}
                      >
                        {format.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="option-group">
                  <h4>Целевая таблица</h4>
                  <select
                    value={importTable}
                    onChange={(e) => setImportTable(e.target.value)}
                  >
                    <option value="">Выберите таблицу</option>
                    {tables.map(table => (
                      <option key={table} value={table}>{table}</option>
                    ))}
                  </select>
                </div>

                <div className="option-group">
                  <h4>Файл или данные</h4>
                  <div className="file-input-wrapper">
                    <input
                      type="file"
                      accept={importFormat === 'csv' ? '.csv' : '.json'}
                      onChange={handleFileSelect}
                    />
                    <span>{importFile ? importFile.name : 'Выберите файл...'}</span>
                  </div>
                  <p className="hint">или вставьте данные ниже</p>
                  <textarea
                    value={importData}
                    onChange={(e) => setImportData(e.target.value)}
                    placeholder={importFormat === 'csv' 
                      ? 'name,email,age\nJohn,john@example.com,25\nJane,jane@example.com,30'
                      : '[{"name": "John", "email": "john@example.com"}]'
                    }
                  />
                </div>

                {importResult && (
                  <div className={`import-result ${importResult.success ? 'success' : 'error'}`}>
                    {importResult.success ? (
                      <svg viewBox="0 0 24 24" width="20" height="20">
                        <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="20" height="20">
                        <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                      </svg>
                    )}
                    {importResult.message}
                  </div>
                )}

                <button 
                  className="import-btn"
                  onClick={handleImport}
                  disabled={isImporting || !importData.trim() || !importTable}
                >
                  {isImporting ? 'Импорт...' : 'Импортировать данные'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .export-import-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .export-import-modal {
          width: 90%;
          max-width: 1000px;
          max-height: 85vh;
          background: var(--bg-primary);
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid var(--border);
        }

        .modal-header h3 {
          margin: 0;
          color: var(--text-primary);
          font-size: 18px;
        }

        .close-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 28px;
          cursor: pointer;
          line-height: 1;
        }

        .modal-tabs {
          display: flex;
          padding: 0 24px;
          border-bottom: 1px solid var(--border);
        }

        .tab {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 16px 24px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--text-muted);
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .tab:hover {
          color: var(--text-primary);
        }

        .tab.active {
          color: var(--accent);
          border-bottom-color: var(--accent);
        }

        .modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        .export-content {
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: 24px;
          height: 100%;
        }

        .import-content {
          max-width: 500px;
        }

        .option-group {
          margin-bottom: 20px;
        }

        .option-group h4 {
          margin: 0 0 12px 0;
          color: var(--text-primary);
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .format-buttons {
          display: flex;
          gap: 8px;
        }

        .format-btn {
          flex: 1;
          padding: 10px;
          background: var(--bg-tertiary);
          border: 1px solid var(--ctp-surface1);
          border-radius: 6px;
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .format-btn:hover {
          background: var(--ctp-surface1);
        }

        .format-btn.active {
          background: var(--accent);
          border-color: var(--accent);
          color: var(--bg-primary);
        }

        .tables-select {
          background: var(--bg-tertiary);
          border-radius: 8px;
          padding: 12px;
        }

        .select-all {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          margin-bottom: 8px;
          border-bottom: 1px solid var(--ctp-surface1);
          color: var(--text-primary);
          font-size: 13px;
          cursor: pointer;
        }

        .tables-list {
          max-height: 150px;
          overflow-y: auto;
        }

        .table-checkbox {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 8px;
          color: var(--text-secondary);
          font-size: 13px;
          cursor: pointer;
        }

        .table-checkbox:hover {
          background: var(--ctp-surface1);
          border-radius: 4px;
        }

        .options-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .option-checkbox {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text-secondary);
          font-size: 13px;
          cursor: pointer;
        }

        .export-btn,
        .import-btn {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, var(--ctp-blue), var(--ctp-mauve));
          border: none;
          border-radius: 8px;
          color: var(--bg-primary);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .export-btn:hover:not(:disabled),
        .import-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(137, 180, 250, 0.3);
        }

        .export-btn:disabled,
        .import-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .export-result {
          display: flex;
          flex-direction: column;
          background: var(--bg-tertiary);
          border-radius: 12px;
          overflow: hidden;
        }

        .result-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid var(--ctp-surface1);
        }

        .result-header h4 {
          margin: 0;
          color: var(--text-primary);
          font-size: 13px;
        }

        .result-actions {
          display: flex;
          gap: 8px;
        }

        .result-actions button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: var(--ctp-surface1);
          border: none;
          border-radius: 4px;
          color: var(--text-primary);
          cursor: pointer;
        }

        .result-actions button:hover {
          background: var(--ctp-surface2);
        }

        .result-content {
          flex: 1;
          margin: 0;
          padding: 16px;
          background: var(--bg-primary);
          color: var(--text-secondary);
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          line-height: 1.6;
          overflow: auto;
          white-space: pre-wrap;
          word-break: break-all;
          max-height: 400px;
        }

        /* Import specific styles */
        .import-options select {
          width: 100%;
          padding: 10px 12px;
          background: var(--bg-tertiary);
          border: 1px solid var(--ctp-surface1);
          border-radius: 6px;
          color: var(--text-primary);
          font-size: 13px;
        }

        .file-input-wrapper {
          position: relative;
          padding: 20px;
          background: var(--bg-tertiary);
          border: 2px dashed var(--ctp-surface1);
          border-radius: 8px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .file-input-wrapper:hover {
          border-color: var(--accent);
        }

        .file-input-wrapper input {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          opacity: 0;
          cursor: pointer;
        }

        .file-input-wrapper span {
          color: var(--text-secondary);
          font-size: 13px;
        }

        .hint {
          text-align: center;
          color: var(--text-muted);
          font-size: 12px;
          margin: 12px 0;
        }

        .import-options textarea {
          width: 100%;
          height: 150px;
          padding: 12px;
          background: var(--bg-tertiary);
          border: 1px solid var(--ctp-surface1);
          border-radius: 8px;
          color: var(--text-primary);
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          resize: vertical;
        }

        .import-options textarea:focus {
          outline: none;
          border-color: var(--accent);
        }

        .import-result {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          border-radius: 8px;
          font-size: 13px;
          margin-bottom: 16px;
        }

        .import-result.success {
          background: color-mix(in srgb, var(--ctp-green) 10%, transparent);
          color: var(--ctp-green);
        }

        .import-result.error {
          background: color-mix(in srgb, var(--ctp-red) 10%, transparent);
          color: var(--ctp-red);
        }
      `}</style>
    </div>
  );
};
