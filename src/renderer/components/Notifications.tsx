import React, { useState, useEffect, useRef } from 'react';
import './Notifications.css';

interface Notification {
  id: string;
  type: 'invitation' | 'role_change' | 'removed' | 'database_update' | 'system';
  title: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: string;
}

interface NotificationsProps {
  sessionId: string;
  apiUrl?: string;
  onInvitationAction?: () => void;
}

const Notifications: React.FC<NotificationsProps> = ({ 
  sessionId, 
  apiUrl = '',
  onInvitationAction 
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [processedInvitations, setProcessedInvitations] = useState<Map<string, 'accepted' | 'declined'>>(new Map());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fetchNotifications = async () => {
    if (!sessionId) return;
    try {
      const response = await fetch(`${apiUrl}/api/collab/notifications`, {
        headers: {
          'Authorization': `Bearer ${sessionId}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  useEffect(() => {
    if (!sessionId) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [sessionId]);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(`${apiUrl}/api/collab/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${sessionId}`
        }
      });
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch(`${apiUrl}/api/collab/notifications/read-all`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${sessionId}`
        }
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleAcceptInvitation = async (invitationId: string, notificationId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/collab/invitations/${invitationId}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionId}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setProcessedInvitations(prev => new Map(prev).set(invitationId, 'accepted'));
        setTimeout(() => {
          fetchNotifications();
          if (onInvitationAction) onInvitationAction();
        }, 1500);
      }
    } catch (error) {
      console.error('Failed to accept invitation:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeclineInvitation = async (invitationId: string, notificationId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/collab/invitations/${invitationId}/decline`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionId}`
        }
      });
      if (response.ok) {
        setProcessedInvitations(prev => new Map(prev).set(invitationId, 'declined'));
        setTimeout(() => {
          fetchNotifications();
        }, 1500);
      }
    } catch (error) {
      console.error('Failed to decline invitation:', error);
    } finally {
      setLoading(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'invitation': return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
      case 'role_change': return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
      case 'removed': return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>;
      case 'database_update': return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>;
      default: return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Только что';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`;
    return date.toLocaleDateString('ru-RU');
  };

  return (
    <div className="notifications-container" ref={dropdownRef}>
      <button 
        className={`notifications-bell ${unreadCount > 0 ? 'has-unread' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Уведомления"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unreadCount > 0 && (
          <span className="notifications-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notifications-dropdown">
          <div className="notifications-header">
            <h3>Уведомления</h3>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="mark-all-read">
                Прочитать все
              </button>
            )}
          </div>

          <div className="notifications-list">
            {notifications.length === 0 ? (
              <div className="notifications-empty">
                Нет уведомлений
              </div>
            ) : (
              notifications.map(notification => (
                <div 
                  key={notification.id}
                  className={`notification-item ${!notification.read ? 'unread' : ''}`}
                  onClick={() => !notification.read && markAsRead(notification.id)}
                >
                  <div className="notification-icon">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="notification-content">
                    <div className="notification-title">{notification.title}</div>
                    <div className="notification-message">{notification.message}</div>
                    <div className="notification-time">{formatTime(notification.createdAt)}</div>
                    
                    {notification.type === 'invitation' && notification.data?.invitationId && (
                      <div className="notification-actions">
                        {processedInvitations.get(notification.data.invitationId) === 'accepted' ? (
                          <span style={{ color: '#a6e3a1', fontSize: '0.85rem', fontWeight: 500 }}>
                            ✓ Приглашение принято
                          </span>
                        ) : processedInvitations.get(notification.data.invitationId) === 'declined' ? (
                          <span style={{ color: '#f38ba8', fontSize: '0.85rem', fontWeight: 500 }}>
                            ✗ Приглашение отклонено
                          </span>
                        ) : (
                          <>
                            <button 
                              className="btn-accept"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAcceptInvitation(notification.data.invitationId, notification.id);
                              }}
                              disabled={loading}
                            >
                              {loading ? '...' : 'Принять'}
                            </button>
                            <button 
                              className="btn-decline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeclineInvitation(notification.data.invitationId, notification.id);
                              }}
                              disabled={loading}
                            >
                              {loading ? '...' : 'Отклонить'}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications;
