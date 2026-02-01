import React, { useState, useEffect } from 'react';
import CollaborationPanel from './CollaborationPanel';
import './SharedDatabases.css';

interface Collaborator {
  oderId: string;
  username: string;
  role: 'owner' | 'admin' | 'mod' | 'member';
  addedAt: string;
  addedBy: string;
}

interface SharedDatabase {
  id: string;
  name: string;
  owner: string;
  createdAt: string;
  collaborators: Collaborator[];
  maxCollaborators: number;
}

interface SharedDatabasesProps {
  username: string;
  sessionId: string;
  apiUrl?: string;
  onSelectDatabase?: (db: SharedDatabase) => void;
}

const SharedDatabases: React.FC<SharedDatabasesProps> = ({
  username,
  sessionId,
  apiUrl = '',
  onSelectDatabase
}) => {
  const [databases, setDatabases] = useState<SharedDatabase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDbName, setNewDbName] = useState('');
  const [selectedDb, setSelectedDb] = useState<SharedDatabase | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchDatabases = async () => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${apiUrl}/api/collab/databases`, {
        headers: {
          'Authorization': `Bearer ${sessionId}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setDatabases(data.databases);
        setError('');
      } else {
        setError(data.error || 'Ошибка загрузки баз данных');
      }
    } catch (err) {
      setError('Ошибка сети');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionId) {
      fetchDatabases();
    }
  }, [sessionId]);

  const handleCreateDatabase = async () => {
    if (!newDbName.trim()) return;

    setCreating(true);
    try {
      const response = await fetch(`${apiUrl}/api/collab/databases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionId}`
        },
        body: JSON.stringify({ name: newDbName.trim() })
      });

      const data = await response.json();
      if (data.success) {
        setShowCreateModal(false);
        setNewDbName('');
        fetchDatabases();
      } else {
        setError(data.error || 'Ошибка создания базы данных');
      }
    } catch (err) {
      setError('Ошибка сети');
    } finally {
      setCreating(false);
    }
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case 'owner': return 'Владелец';
      case 'admin': return 'Администратор';
      case 'mod': return 'Модератор';
      case 'member': return 'Участник';
      default: return role;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return '●';
      case 'admin': return '○';
      case 'mod': return '◦';
      case 'member': return '•';
      default: return '•';
    }
  };

  const getUserRole = (db: SharedDatabase) => {
    const collab = db.collaborators.find(c => c.username === username);
    return collab?.role || 'member';
  };

  if (loading) {
    return (
      <div className="shared-dbs-loading">
        <div className="spinner"></div>
        <p>Загрузка баз данных...</p>
      </div>
    );
  }

  return (
    <div className="shared-databases">
      <div className="shared-dbs-header">
        <h2>Совместные базы данных</h2>
        <button 
          className="btn-create-db"
          onClick={() => setShowCreateModal(true)}
        >
          + Создать
        </button>
      </div>

      {error && (
        <div className="shared-dbs-error">
          {error}
        </div>
      )}

      {databases.length === 0 ? (
        <div className="shared-dbs-empty">
          <div className="empty-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#6c7086" strokeWidth="1.5">
              <ellipse cx="12" cy="5" rx="9" ry="3"/>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
            </svg>
          </div>
          <h3>Нет совместных баз данных</h3>
          <p>Создайте новую базу данных и пригласите до 4 участников для совместной работы.</p>
          <button 
            className="btn-create-first"
            onClick={() => setShowCreateModal(true)}
          >
            Создать первую БД
          </button>
        </div>
      ) : (
        <div className="shared-dbs-grid">
          {databases.map(db => (
            <div 
              key={db.id} 
              className="shared-db-card"
              onClick={() => onSelectDatabase && onSelectDatabase(db)}
            >
              <div className="db-card-header">
                <div className="db-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <ellipse cx="12" cy="5" rx="9" ry="3"/>
                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                  </svg>
                </div>
                <div className="db-info">
                  <h3>{db.name}</h3>
                  <span className="db-role">
                    {getRoleName(getUserRole(db))}
                  </span>
                </div>
              </div>
              
              <div className="db-collaborators">
                <div className="collaborators-avatars">
                  {db.collaborators.slice(0, 4).map((collab, index) => (
                    <div 
                      key={collab.username}
                      className="collaborator-avatar"
                      style={{ zIndex: 4 - index }}
                      title={`${collab.username} (${getRoleName(collab.role)})`}
                    >
                      {getRoleIcon(collab.role)}
                    </div>
                  ))}
                </div>
                <span className="collaborators-count">
                  {db.collaborators.length}/{db.maxCollaborators}
                </span>
              </div>

              <div className="db-card-actions">
                <button 
                  className="btn-manage"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDb(db);
                  }}
                  title="Управление участниками"
                >
                  Участники
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модалка создания БД */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Создать совместную БД</h3>
              <button 
                className="modal-close"
                onClick={() => setShowCreateModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <label>
                Название базы данных
                <input
                  type="text"
                  value={newDbName}
                  onChange={(e) => setNewDbName(e.target.value)}
                  placeholder="Например: Проект_2024"
                  autoFocus
                />
              </label>
              <p className="modal-hint">
                После создания вы сможете пригласить до 3 участников для совместной работы.
              </p>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-cancel"
                onClick={() => setShowCreateModal(false)}
              >
                Отмена
              </button>
              <button
                className="btn-create"
                onClick={handleCreateDatabase}
                disabled={creating || !newDbName.trim()}
              >
                {creating ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка управления участниками */}
      {selectedDb && (
        <div className="modal-overlay" onClick={() => setSelectedDb(null)}>
          <div className="modal-content wide" onClick={e => e.stopPropagation()}>
            <CollaborationPanel
              database={selectedDb}
              currentUser={username}
              sessionId={sessionId}
              apiUrl={apiUrl}
              onUpdate={fetchDatabases}
              onClose={() => setSelectedDb(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SharedDatabases;
