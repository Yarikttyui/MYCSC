import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SQLEditor } from './SQLEditor';
import useCollaboration, { RemoteUser, CodeSyncEvent } from '../hooks/useCollaboration';
import './CollaborativeEditor.css';

interface CollaborativeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  placeholder?: string;
  databaseId?: string;
  username: string;
  serverUrl?: string;
  isSharedDatabase?: boolean;
}

export const CollaborativeEditor: React.FC<CollaborativeEditorProps> = ({
  value,
  onChange,
  onExecute,
  placeholder = 'Введите SQL запрос...',
  databaseId,
  username,
  serverUrl = '',
  isSharedDatabase = false
}) => {
  const [isJoined, setIsJoined] = useState(false);
  const lastSyncRef = useRef<string>(value);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const ignoreNextChangeRef = useRef(false);
  const localVersionRef = useRef(0);
  const handleCodeChange = useCallback((change: { from: number; to: number; text: string; userId: string; username?: string }) => {
    if (ignoreNextChangeRef.current) {
      ignoreNextChangeRef.current = false;
      return;
    }
    const currentValue = lastSyncRef.current;
    const newValue = currentValue.substring(0, change.from) + change.text + currentValue.substring(change.to);
    lastSyncRef.current = newValue;
    onChange(newValue);
  }, [onChange]);
  const handleCodeSync = useCallback((event: CodeSyncEvent) => {
    if (event.version > localVersionRef.current) {
      localVersionRef.current = event.version;
      lastSyncRef.current = event.code;
      onChange(event.code);
    }
  }, [onChange]);

  const collaboration = useCollaboration(
    serverUrl,
    isSharedDatabase ? handleCodeChange : undefined,
    isSharedDatabase ? handleCodeSync : undefined
  );

  const {
    connected,
    users,
    typingUsers,
    joinDatabase,
    leaveDatabase,
    updateCursor,
    sendCodeChange,
    syncCode,
    setTyping
  } = collaboration;
  useEffect(() => {
    if (isSharedDatabase && databaseId && username && connected && !isJoined) {
      joinDatabase(databaseId, username);
      setIsJoined(true);
    }

    return () => {
      if (isJoined) {
        leaveDatabase();
        setIsJoined(false);
      }
    };
  }, [isSharedDatabase, databaseId, username, connected, isJoined, joinDatabase, leaveDatabase]);
  useEffect(() => {
    if (!isSharedDatabase || !isJoined) return;

    syncTimeoutRef.current = setInterval(() => {
      if (lastSyncRef.current !== value) {
        syncCode(value);
        lastSyncRef.current = value;
      }
    }, 1000);

    return () => {
      if (syncTimeoutRef.current) {
        clearInterval(syncTimeoutRef.current);
      }
    };
  }, [isSharedDatabase, isJoined, value, syncCode]);
  const handleLocalChange = useCallback((newValue: string) => {
    onChange(newValue);
    
    if (isSharedDatabase && isJoined) {
      setTyping(true);
      const oldValue = lastSyncRef.current;
      let start = 0;
      while (start < oldValue.length && start < newValue.length && oldValue[start] === newValue[start]) {
        start++;
      }
      
      let oldEnd = oldValue.length;
      let newEnd = newValue.length;
      while (oldEnd > start && newEnd > start && oldValue[oldEnd - 1] === newValue[newEnd - 1]) {
        oldEnd--;
        newEnd--;
      }
      
      const text = newValue.substring(start, newEnd);
      sendCodeChange(start, oldEnd, text, newValue);
      lastSyncRef.current = newValue;
      setTimeout(() => setTyping(false), 500);
    }
  }, [onChange, isSharedDatabase, isJoined, sendCodeChange, setTyping]);
  const handleCursorMove = useCallback((line: number, column: number) => {
    if (isSharedDatabase && isJoined) {
      updateCursor(line, column);
    }
  }, [isSharedDatabase, isJoined, updateCursor]);

  return (
    <div className="collaborative-editor">
      {/* Collaboration Status Bar */}
      {isSharedDatabase && (
        <div className="collab-status-bar">
          <div className="collab-status">
            <span className={`status-indicator ${connected ? 'connected' : 'disconnected'}`} />
            <span className="status-text">
              {connected ? 'Подключено' : 'Отключено'}
            </span>
          </div>
          
          {/* Active Users */}
          {users.length > 0 && (
            <div className="collab-users">
              {users.map(user => (
                <div 
                  key={user.id} 
                  className="collab-user"
                  style={{ borderColor: user.color }}
                  title={`${user.username}${user.isTyping ? ' (печатает...)' : ''}`}
                >
                  <span 
                    className="user-avatar" 
                    style={{ background: user.color }}
                  >
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                  {user.isTyping && (
                    <span className="typing-indicator">
                      <span className="dot"></span>
                      <span className="dot"></span>
                      <span className="dot"></span>
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {/* Typing Users */}
          {typingUsers.length > 0 && (
            <div className="typing-status">
              {typingUsers.map(u => u.username).join(', ')} 
              {typingUsers.length === 1 ? ' печатает...' : ' печатают...'}
            </div>
          )}
        </div>
      )}

      {/* Remote Cursors Overlay */}
      <div className="editor-with-cursors">
        <SQLEditor
          value={value}
          onChange={handleLocalChange}
          onExecute={onExecute}
          placeholder={placeholder}
        />
        
        {/* Remote user cursors */}
        {isSharedDatabase && users.map(user => user.cursor && (
          <div
            key={user.id}
            className="remote-cursor"
            style={{
              top: `calc(8px + ${user.cursor.line - 1} * 24px)`,
              left: `calc(62px + ${user.cursor.column} * 7.8px)`,
              borderColor: user.color
            }}
          >
            <div 
              className="cursor-label"
              style={{ background: user.color }}
            >
              {user.username}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CollaborativeEditor;
