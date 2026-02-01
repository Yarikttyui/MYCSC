import React, { useState, useEffect } from 'react';
import './CollaborationPanel.css';

interface Collaborator {
  oderId: string;
  username: string;
  role: 'owner' | 'admin' | 'mod' | 'member';
  addedAt: string;
  addedBy: string;
  lastAccess?: string;
}

interface SharedDatabase {
  id: string;
  name: string;
  owner: string;
  createdAt: string;
  collaborators: Collaborator[];
  maxCollaborators: number;
}

interface CollaborationPanelProps {
  database: SharedDatabase;
  currentUser: string;
  sessionId: string;
  apiUrl?: string;
  onUpdate?: () => void;
  onClose?: () => void;
}

const CollaborationPanel: React.FC<CollaborationPanelProps> = ({
  database,
  currentUser,
  sessionId,
  apiUrl = '',
  onUpdate,
  onClose
}) => {
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'mod' | 'admin'>('member');
  const [inviteMessage, setInviteMessage] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ username: string; id: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showInviteForm, setShowInviteForm] = useState(false);

  const currentUserRole = database.collaborators.find(c => c.username === currentUser)?.role;
  const canInvite = currentUserRole === 'owner' || currentUserRole === 'admin';
  const canManageUsers = currentUserRole === 'owner' || currentUserRole === 'admin';
  useEffect(() => {
    if (inviteUsername.length < 2) {
      setSearchResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(
          `${apiUrl}/api/users/search?q=${encodeURIComponent(inviteUsername)}`,
          {
            headers: { 'Authorization': `Bearer ${sessionId}` }
          }
        );
        const data = await response.json();
        if (data.success) {
          const filtered = data.users.filter(
            (u: any) => !database.collaborators.some(c => c.username === u.username)
          );
          setSearchResults(filtered);
        }
      } catch (err) {
        console.error('Search error:', err);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [inviteUsername, database.collaborators]);

  const handleInvite = async () => {
    if (!inviteUsername.trim()) {
      setError('Введите имя пользователя');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${apiUrl}/api/collab/databases/${database.id}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionId}`
        },
        body: JSON.stringify({
          username: inviteUsername,
          role: inviteRole,
          message: inviteMessage
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`Приглашение отправлено пользователю ${inviteUsername}`);
        setInviteUsername('');
        setInviteMessage('');
        setShowInviteForm(false);
        if (onUpdate) onUpdate();
      } else {
        setError(data.error || 'Ошибка при отправке приглашения');
      }
    } catch (err) {
      setError('Ошибка сети');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveUser = async (username: string) => {
    if (!confirm(`Удалить ${username} из базы данных?`)) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `${apiUrl}/api/collab/databases/${database.id}/collaborators/${username}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${sessionId}` }
        }
      );

      const data = await response.json();

      if (data.success) {
        setSuccess(`Пользователь ${username} удалён`);
        if (onUpdate) onUpdate();
      } else {
        setError(data.error || 'Ошибка при удалении');
      }
    } catch (err) {
      setError('Ошибка сети');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeRole = async (username: string, newRole: string) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `${apiUrl}/api/collab/databases/${database.id}/collaborators/${username}/role`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionId}`
          },
          body: JSON.stringify({ role: newRole })
        }
      );

      const data = await response.json();

      if (data.success) {
        setSuccess(`Роль пользователя ${username} изменена`);
        if (onUpdate) onUpdate();
      } else {
        setError(data.error || 'Ошибка при изменении роли');
      }
    } catch (err) {
      setError('Ошибка сети');
    } finally {
      setLoading(false);
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
      case 'owner': return <svg width="16" height="16" viewBox="0 0 24 24" fill="#eab308"><path d="M12 1l3.09 6.26L22 8.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 13.14 2 8.27l6.91-1.01L12 1z"/></svg>;
      case 'admin': return <svg width="16" height="16" viewBox="0 0 24 24" fill="#3b82f6"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
      case 'mod': return <svg width="16" height="16" viewBox="0 0 24 24" fill="#10b981"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
      case 'member': return <svg width="16" height="16" viewBox="0 0 24 24" fill="#6b7280"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
      default: return <svg width="16" height="16" viewBox="0 0 24 24" fill="#6b7280"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return '#eab308';
      case 'admin': return '#3b82f6';
      case 'mod': return '#10b981';
      case 'member': return '#6b7280';
      default: return '#6b7280';
    }
  };

  return (
    <div className="collab-panel">
      <div className="collab-header">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <h3>Участники — {database.name}</h3>
        <span className="collab-count">
          {database.collaborators.length}/{database.maxCollaborators}
        </span>
        {onClose && (
          <button className="collab-close" onClick={onClose}>✕</button>
        )}
      </div>

      {error && (
        <div className="collab-message error">
          {error}
        </div>
      )}

      {success && (
        <div className="collab-message success">
          {success}
        </div>
      )}

      <div className="collab-list">
        {database.collaborators.map(collab => (
          <div key={collab.username} className="collab-item">
            <div className="collab-avatar">
              {getRoleIcon(collab.role)}
            </div>
            <div className="collab-info">
              <div className="collab-name">
                {collab.username}
                {collab.username === currentUser && (
                  <span className="collab-you">(вы)</span>
                )}
              </div>
              <div 
                className="collab-role"
                style={{ color: getRoleColor(collab.role) }}
              >
                {getRoleName(collab.role)}
              </div>
            </div>
            <div className="collab-actions">
              {canManageUsers && collab.role !== 'owner' && collab.username !== currentUser && (
                <>
                  <select
                    value={collab.role}
                    onChange={(e) => handleChangeRole(collab.username, e.target.value)}
                    disabled={loading}
                    className="role-select"
                  >
                    <option value="member">Участник</option>
                    <option value="mod">Модератор</option>
                    <option value="admin">Администратор</option>
                  </select>
                  <button
                    className="btn-remove"
                    onClick={() => handleRemoveUser(collab.username)}
                    disabled={loading}
                    title="Удалить участника"
                  >
                    ✕
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {canInvite && database.collaborators.length < database.maxCollaborators && (
        <div className="collab-invite-section">
          {!showInviteForm ? (
            <button 
              className="btn-invite-toggle"
              onClick={() => setShowInviteForm(true)}
            >
              + Пригласить участника
            </button>
          ) : (
            <div className="invite-form">
              <div className="invite-form-header">
                <h4>Пригласить пользователя</h4>
                <button 
                  className="btn-close-form"
                  onClick={() => setShowInviteForm(false)}
                >
                  ✕
                </button>
              </div>

              <div className="invite-field">
                <label>Имя пользователя</label>
                <div className="invite-input-wrapper">
                  <input
                    type="text"
                    value={inviteUsername}
                    onChange={(e) => setInviteUsername(e.target.value)}
                    placeholder="Введите username..."
                    autoComplete="off"
                  />
                  {searchResults.length > 0 && (
                    <div className="search-results">
                      {searchResults.map(user => (
                        <div
                          key={user.id}
                          className="search-result-item"
                          onClick={() => {
                            setInviteUsername(user.username);
                            setSearchResults([]);
                          }}
                        >
                          {user.username}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="invite-field">
                <label>Роль</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                >
                  <option value="member">Участник — только чтение и INSERT</option>
                  <option value="mod">Модератор — полное редактирование данных</option>
                  <option value="admin">Администратор — управление участниками</option>
                </select>
              </div>

              <div className="invite-field">
                <label>Сообщение (опционально)</label>
                <textarea
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  placeholder="Добавьте сообщение к приглашению..."
                  rows={2}
                />
              </div>

              <button
                className="btn-send-invite"
                onClick={handleInvite}
                disabled={loading || !inviteUsername.trim()}
              >
                {loading ? 'Отправка...' : 'Отправить приглашение'}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="collab-footer">
        <div className="collab-permissions">
          <h4>Права ролей:</h4>
          <ul>
            <li><strong style={{color: '#eab308'}}>● Владелец:</strong> Полный контроль, удаление БД</li>
            <li><strong style={{color: '#3b82f6'}}>● Администратор:</strong> Управление данными и участниками</li>
            <li><strong style={{color: '#10b981'}}>● Модератор:</strong> SELECT, INSERT, UPDATE, DELETE</li>
            <li><strong style={{color: '#6b7280'}}>● Участник:</strong> SELECT, INSERT</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CollaborationPanel;
