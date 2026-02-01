import React from 'react';
import { RemoteUser } from '../hooks/useCollaboration';

interface RemoteCursorsProps {
  users: RemoteUser[];
  lineHeight?: number;
  charWidth?: number;
  scrollTop?: number;
  scrollLeft?: number;
}

export const RemoteCursors: React.FC<RemoteCursorsProps> = ({
  users,
  lineHeight = 20,
  charWidth = 8,
  scrollTop = 0,
  scrollLeft = 0
}) => {
  if (users.length === 0) return null;

  return (
    <div className="remote-cursors-container" style={{ 
      position: 'absolute', 
      inset: 0, 
      pointerEvents: 'none',
      overflow: 'hidden',
      zIndex: 10
    }}>
      {users.map(user => {
        if (!user.cursor) return null;

        const top = (user.cursor.line - 1) * lineHeight - scrollTop;
        const left = user.cursor.column * charWidth - scrollLeft;
        if (top < -lineHeight || left < -charWidth) return null;

        return (
          <div key={user.id} className="remote-cursor" style={{ position: 'absolute' }}>
            {/* Cursor line */}
            <div
              style={{
                position: 'absolute',
                top,
                left,
                width: 2,
                height: lineHeight,
                background: user.color,
                borderRadius: 1,
                animation: 'cursor-blink 1s ease-in-out infinite'
              }}
            />
            
            {/* Username label */}
            <div
              style={{
                position: 'absolute',
                top: top - 18,
                left: left,
                background: user.color,
                color: '#1e1e2e',
                padding: '2px 6px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 500,
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}
            >
              {user.username}
            </div>

            {/* Selection highlight */}
            {user.selection && (
              <div
                style={{
                  position: 'absolute',
                  top: (user.selection.start.line - 1) * lineHeight - scrollTop,
                  left: user.selection.start.column * charWidth - scrollLeft,
                  width: Math.abs(user.selection.end.column - user.selection.start.column) * charWidth,
                  height: lineHeight * (user.selection.end.line - user.selection.start.line + 1),
                  background: user.color,
                  opacity: 0.2,
                  borderRadius: 2
                }}
              />
            )}
          </div>
        );
      })}

      <style>{`
        @keyframes cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};
export const ActiveUsersIndicator: React.FC<{ users: RemoteUser[]; connected: boolean }> = ({ 
  users, 
  connected 
}) => {
  if (!connected && users.length === 0) return null;

  return (
    <div className="active-users-indicator" style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '4px 8px',
      background: 'rgba(17, 17, 27, 0.8)',
      borderRadius: 6,
      fontSize: 12
    }}>
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: connected ? '#a6e3a1' : '#f38ba8',
        boxShadow: connected ? '0 0 6px #a6e3a1' : '0 0 6px #f38ba8'
      }} />
      
      {users.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {users.slice(0, 3).map(user => (
            <div
              key={user.id}
              title={user.username}
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: user.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#1e1e2e',
                fontSize: 11,
                fontWeight: 600,
                border: '2px solid var(--bg-secondary)'
              }}
            >
              {user.username.charAt(0).toUpperCase()}
            </div>
          ))}
          {users.length > 3 && (
            <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>
              +{users.length - 3}
            </span>
          )}
        </div>
      )}
      
      {users.length === 0 && connected && (
        <span style={{ color: 'var(--text-muted)' }}>Вы одни</span>
      )}
    </div>
  );
};

export default RemoteCursors;
