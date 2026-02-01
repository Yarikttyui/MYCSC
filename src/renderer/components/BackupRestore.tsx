import React, { useState, useEffect } from 'react';

interface BackupInfo {
  id: string;
  timestamp: string;
  size?: string;
  database?: string;
}

interface BackupRestoreProps {
  isOpen: boolean;
  onClose: () => void;
  currentDatabase: string;
  onRestore: (backupId: string) => void;
}

export const BackupRestore: React.FC<BackupRestoreProps> = ({
  isOpen,
  onClose,
  currentDatabase,
  onRestore
}) => {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadBackups();
    }
  }, [isOpen]);

  const loadBackups = async () => {
    setLoading(true);
    try {
      const backupsData = localStorage.getItem('mycsc_backups');
      if (backupsData) {
        const parsed = JSON.parse(backupsData);
        const backupList: BackupInfo[] = Object.entries(parsed).map(([id, data]: [string, any]) => ({
          id,
          timestamp: data.timestamp,
          size: formatSize(JSON.stringify(data.data).length),
          database: data.database || 'default'
        }));
        backupList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setBackups(backupList);
      } else {
        setBackups([]);
      }
    } catch (error) {
      console.error('Failed to load backups:', error);
      setBackups([]);
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  const formatDate = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleCreateBackup = async () => {
    setCreating(true);
    setMessage(null);

    try {
      const dbData = localStorage.getItem('mycsc_databases');
      if (!dbData) {
        setMessage({ type: 'error', text: 'Нет данных для резервного копирования' });
        return;
      }

      const backupId = `backup_${Date.now()}`;
      const backupsData = localStorage.getItem('mycsc_backups');
      const backups = backupsData ? JSON.parse(backupsData) : {};

      backups[backupId] = {
        data: JSON.parse(dbData),
        timestamp: new Date().toISOString(),
        database: currentDatabase
      };

      localStorage.setItem('mycsc_backups', JSON.stringify(backups));
      setMessage({ type: 'success', text: 'Резервная копия создана!' });
      loadBackups();
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Ошибка создания копии: ' + error.message });
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (backupId: string) => {
    if (!confirm('Восстановить эту резервную копию? Текущие данные будут заменены.')) {
      return;
    }

    setRestoring(backupId);
    setMessage(null);

    try {
      const backupsData = localStorage.getItem('mycsc_backups');
      if (!backupsData) {
        throw new Error('Резервные копии не найдены');
      }

      const backups = JSON.parse(backupsData);
      const backup = backups[backupId];

      if (!backup || !backup.data) {
        throw new Error('Данные резервной копии повреждены');
      }

      localStorage.setItem('mycsc_databases', JSON.stringify(backup.data));
      setMessage({ type: 'success', text: 'Данные успешно восстановлены!' });
      onRestore(backupId);
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Ошибка восстановления: ' + error.message });
    } finally {
      setRestoring(null);
    }
  };

  const handleDelete = async (backupId: string) => {
    if (!confirm('Удалить эту резервную копию?')) {
      return;
    }

    try {
      const backupsData = localStorage.getItem('mycsc_backups');
      if (backupsData) {
        const backups = JSON.parse(backupsData);
        delete backups[backupId];
        localStorage.setItem('mycsc_backups', JSON.stringify(backups));
        loadBackups();
        setMessage({ type: 'success', text: 'Резервная копия удалена' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Ошибка удаления: ' + error.message });
    }
  };

  const handleExport = (backupId: string) => {
    try {
      const backupsData = localStorage.getItem('mycsc_backups');
      if (!backupsData) return;

      const backups = JSON.parse(backupsData);
      const backup = backups[backupId];

      if (!backup) return;

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mycsc_backup_${new Date(backup.timestamp).toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage({ type: 'error', text: 'Ошибка экспорта' });
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const imported = JSON.parse(text);

        if (!imported.data || !imported.timestamp) {
          throw new Error('Неверный формат файла');
        }

        const backupId = `backup_imported_${Date.now()}`;
        const backupsData = localStorage.getItem('mycsc_backups');
        const backups = backupsData ? JSON.parse(backupsData) : {};

        backups[backupId] = imported;
        localStorage.setItem('mycsc_backups', JSON.stringify(backups));
        
        setMessage({ type: 'success', text: 'Резервная копия импортирована!' });
        loadBackups();
      } catch (error: any) {
        setMessage({ type: 'error', text: 'Ошибка импорта: ' + error.message });
      }
    };
    input.click();
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Резервные копии</h2>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>

        {message && (
          <div style={{
            ...styles.message,
            background: message.type === 'success' 
              ? 'rgba(166, 227, 161, 0.1)' 
              : 'rgba(243, 139, 168, 0.1)',
            borderColor: message.type === 'success' 
              ? 'rgba(166, 227, 161, 0.3)' 
              : 'rgba(243, 139, 168, 0.3)',
            color: message.type === 'success' ? '#a6e3a1' : '#f38ba8'
          }}>
            {message.type === 'success' ? '✓' : '⚠️'} {message.text}
          </div>
        )}

        <div style={styles.actions}>
          <button 
            onClick={handleCreateBackup} 
            style={styles.createBtn}
            disabled={creating}
          >
            {creating ? '⏳ Создание...' : '💾 Создать копию'}
          </button>
          <button onClick={handleImport} style={styles.importBtn}>
            📥 Импорт
          </button>
        </div>

        <div style={styles.content}>
          {loading ? (
            <div style={styles.loading}>Загрузка...</div>
          ) : backups.length === 0 ? (
            <div style={styles.empty}>
              <span style={styles.emptyIcon}>📦</span>
              <p>Нет резервных копий</p>
              <p style={styles.emptyHint}>Создайте первую резервную копию для сохранения данных</p>
            </div>
          ) : (
            <div style={styles.list}>
              {backups.map(backup => (
                <div key={backup.id} style={styles.backupItem}>
                  <div style={styles.backupInfo}>
                    <div style={styles.backupDate}>
                      📅 {formatDate(backup.timestamp)}
                    </div>
                    <div style={styles.backupMeta}>
                      {backup.size && <span>💾 {backup.size}</span>}
                      {backup.database && <span>{backup.database}</span>}
                    </div>
                  </div>
                  <div style={styles.backupActions}>
                    <button
                      onClick={() => handleRestore(backup.id)}
                      style={styles.restoreBtn}
                      disabled={restoring === backup.id}
                      title="Восстановить"
                    >
                      {restoring === backup.id ? '⏳' : '🔄'}
                    </button>
                    <button
                      onClick={() => handleExport(backup.id)}
                      style={styles.exportBtn}
                      title="Экспорт"
                    >
                      📤
                    </button>
                    <button
                      onClick={() => handleDelete(backup.id)}
                      style={styles.deleteBtn}
                      title="Удалить"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={styles.footer}>
          <p style={styles.footerText}>
            Резервные копии хранятся локально в браузере
          </p>
        </div>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#1e1e2e',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '560px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid rgba(205, 214, 244, 0.1)',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid rgba(205, 214, 244, 0.1)',
  },
  title: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#cdd6f4',
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#6c7086',
    fontSize: '28px',
    cursor: 'pointer',
    padding: '0 8px',
  },
  message: {
    margin: '16px 24px 0',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid',
    fontSize: '14px',
  },
  actions: {
    display: 'flex',
    gap: '12px',
    padding: '16px 24px',
  },
  createBtn: {
    flex: 1,
    padding: '12px 20px',
    background: 'linear-gradient(135deg, #a6e3a1, #94e2d5)',
    border: 'none',
    borderRadius: '10px',
    color: '#1e1e2e',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  importBtn: {
    padding: '12px 20px',
    background: 'rgba(137, 180, 250, 0.1)',
    border: '1px solid rgba(137, 180, 250, 0.3)',
    borderRadius: '10px',
    color: '#89b4fa',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '0 24px',
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: '#6c7086',
  },
  empty: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#6c7086',
  },
  emptyIcon: {
    fontSize: '48px',
    display: 'block',
    marginBottom: '16px',
  },
  emptyHint: {
    fontSize: '13px',
    marginTop: '8px',
    opacity: 0.7,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    paddingBottom: '16px',
  },
  backupItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px',
    background: 'rgba(17, 17, 27, 0.6)',
    borderRadius: '12px',
    border: '1px solid rgba(205, 214, 244, 0.05)',
  },
  backupInfo: {
    flex: 1,
  },
  backupDate: {
    fontSize: '15px',
    fontWeight: 500,
    color: '#cdd6f4',
    marginBottom: '4px',
  },
  backupMeta: {
    display: 'flex',
    gap: '16px',
    fontSize: '13px',
    color: '#6c7086',
  },
  backupActions: {
    display: 'flex',
    gap: '8px',
  },
  restoreBtn: {
    background: 'rgba(166, 227, 161, 0.1)',
    border: '1px solid rgba(166, 227, 161, 0.3)',
    borderRadius: '8px',
    padding: '8px 12px',
    cursor: 'pointer',
    fontSize: '16px',
  },
  exportBtn: {
    background: 'rgba(137, 180, 250, 0.1)',
    border: '1px solid rgba(137, 180, 250, 0.3)',
    borderRadius: '8px',
    padding: '8px 12px',
    cursor: 'pointer',
    fontSize: '16px',
  },
  deleteBtn: {
    background: 'rgba(243, 139, 168, 0.1)',
    border: '1px solid rgba(243, 139, 168, 0.3)',
    borderRadius: '8px',
    padding: '8px 12px',
    cursor: 'pointer',
    fontSize: '16px',
  },
  footer: {
    padding: '16px 24px',
    borderTop: '1px solid rgba(205, 214, 244, 0.1)',
  },
  footerText: {
    fontSize: '12px',
    color: '#6c7086',
    textAlign: 'center',
    margin: 0,
  },
};

export default BackupRestore;
