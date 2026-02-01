import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export interface RemoteUser {
  id: string;
  username: string;
  color: string;
  cursor?: { line: number; column: number };
  selection?: { start: { line: number; column: number }; end: { line: number; column: number } };
  isTyping?: boolean;
}

export interface QueryResultEvent {
  id: string;
  username: string;
  sql: string;
  result: any;
  timestamp: number;
}

export interface CodeSyncEvent {
  id?: string;
  username?: string;
  code: string;
  version: number;
  timestamp?: number;
}

export interface CollaborationState {
  connected: boolean;
  users: RemoteUser[];
  typingUsers: RemoteUser[];
  currentVersion: number;
  joinDatabase: (databaseId: string, username: string) => void;
  leaveDatabase: () => void;
  updateCursor: (line: number, column: number) => void;
  updateSelection: (start: { line: number; column: number }, end: { line: number; column: number }) => void;
  sendCodeChange: (from: number, to: number, text: string, fullCode?: string) => void;
  syncCode: (code: string) => void;
  setTyping: (isTyping: boolean) => void;
  requestState: () => void;
}

export function useCollaboration(
  serverUrl: string = '',
  onCodeChange?: (change: { from: number; to: number; text: string; userId: string; username?: string }) => void,
  onCodeSync?: (event: CodeSyncEvent) => void,
  onQueryResult?: (event: QueryResultEvent) => void
): CollaborationState {
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState<RemoteUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<RemoteUser[]>([]);
  const [currentVersion, setCurrentVersion] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const throttleRef = useRef<{ cursor: number; typing: number }>({ cursor: 0, typing: 0 });
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingCodeRef = useRef<string>('');
  const isTypingRef = useRef(false);

  useEffect(() => {
    const socket = io(serverUrl || window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Collaboration connected:', socket.id);
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Collaboration disconnected');
      setConnected(false);
      setUsers([]);
      setTypingUsers([]);
    });

    socket.on('reconnect', () => {
      console.log('Collaboration reconnected');
      socket.emit('requestState');
    });
    socket.on('activeUsers', (usersList: RemoteUser[]) => {
      setUsers(usersList.filter(u => u.id !== socket.id));
    });
    socket.on('userJoined', (user: RemoteUser) => {
      setUsers(prev => {
        if (prev.some(u => u.id === user.id)) return prev;
        return [...prev, user];
      });
    });
    socket.on('userLeft', (data: { id: string }) => {
      setUsers(prev => prev.filter(u => u.id !== data.id));
      setTypingUsers(prev => prev.filter(u => u.id !== data.id));
    });
    socket.on('cursorUpdate', (data: RemoteUser) => {
      setUsers(prev => prev.map(u => 
        u.id === data.id ? { ...u, cursor: data.cursor } : u
      ));
    });
    socket.on('selectionUpdate', (data: RemoteUser & { selection: any }) => {
      setUsers(prev => prev.map(u => 
        u.id === data.id ? { ...u, selection: data.selection } : u
      ));
    });
    socket.on('userTyping', (data: { id: string; username: string; color: string; isTyping: boolean }) => {
      setUsers(prev => prev.map(u => 
        u.id === data.id ? { ...u, isTyping: data.isTyping } : u
      ));
      
      if (data.isTyping) {
        setTypingUsers(prev => {
          if (prev.some(u => u.id === data.id)) return prev;
          return [...prev, { id: data.id, username: data.username, color: data.color }];
        });
      } else {
        setTypingUsers(prev => prev.filter(u => u.id !== data.id));
      }
    });
    socket.on('codeChange', (data: { id: string; username: string; change: { from: number; to: number; text: string } }) => {
      if (onCodeChange) {
        onCodeChange({ ...data.change, userId: data.id, username: data.username });
      }
    });
    socket.on('syncCode', (data: CodeSyncEvent) => {
      setCurrentVersion(data.version);
      if (onCodeSync) {
        onCodeSync(data);
      }
    });
    socket.on('codeSync', (data: CodeSyncEvent) => {
      setCurrentVersion(data.version);
      if (onCodeSync) {
        onCodeSync(data);
      }
    });
    socket.on('queryResult', (data: QueryResultEvent) => {
      if (onQueryResult) {
        onQueryResult(data);
      }
    });
    socket.on('queryResults', (data: { id: string; username: string; sql: string; results: any[]; timestamp: number }) => {
      if (onQueryResult && data.results && data.results.length > 0) {
        onQueryResult({
          id: data.id,
          username: data.username,
          sql: data.sql,
          result: data.results[data.results.length - 1],
          timestamp: data.timestamp
        });
      }
    });

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
      socket.disconnect();
    };
  }, [serverUrl, onCodeChange, onCodeSync, onQueryResult]);

  const joinDatabase = useCallback((databaseId: string, username: string) => {
    if (socketRef.current) {
      socketRef.current.emit('joinDatabase', { databaseId, username });
    }
  }, []);

  const leaveDatabase = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('leaveDatabase');
      setUsers([]);
      setTypingUsers([]);
    }
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
  }, []);

  const updateCursor = useCallback((line: number, column: number) => {
    const now = Date.now();
    if (now - throttleRef.current.cursor < 30) return;
    throttleRef.current.cursor = now;

    if (socketRef.current) {
      socketRef.current.emit('cursorMove', { line, column });
    }
  }, []);

  const updateSelection = useCallback((
    start: { line: number; column: number }, 
    end: { line: number; column: number }
  ) => {
    if (socketRef.current) {
      socketRef.current.emit('selectionChange', { start, end });
    }
  }, []);

  const sendCodeChange = useCallback((from: number, to: number, text: string, fullCode?: string) => {
    if (socketRef.current) {
      socketRef.current.emit('codeChange', { from, to, text, fullCode });
    }
  }, []);

  const syncCode = useCallback((code: string) => {
    pendingCodeRef.current = code;
    if (socketRef.current) {
      socketRef.current.emit('syncCode', { code });
    }
  }, []);

  const setTyping = useCallback((isTyping: boolean) => {
    const now = Date.now();
    if (isTyping && now - throttleRef.current.typing < 200) return;
    throttleRef.current.typing = now;
    if (isTypingRef.current !== isTyping) {
      isTypingRef.current = isTyping;
      if (socketRef.current) {
        socketRef.current.emit('typing', isTyping);
      }
    }
  }, []);

  const requestState = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('requestState');
    }
  }, []);

  return {
    connected,
    users,
    typingUsers,
    currentVersion,
    joinDatabase,
    leaveDatabase,
    updateCursor,
    updateSelection,
    sendCodeChange,
    syncCode,
    setTyping,
    requestState
  };
}

export default useCollaboration;
