import * as fs from 'fs';
import * as path from 'path';
export enum CollaboratorRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MODERATOR = 'mod',
  MEMBER = 'member'
}
export const RolePermissions: Record<CollaboratorRole, string[]> = {
  [CollaboratorRole.OWNER]: [
    'SELECT', 'INSERT', 'UPDATE', 'DELETE',
    'CREATE_TABLE', 'DROP_TABLE', 'ALTER_TABLE',
    'CREATE_DATABASE', 'DROP_DATABASE',
    'MANAGE_USERS', 'INVITE_USERS', 'REMOVE_USERS',
    'CHANGE_ROLES', 'DELETE_DATABASE'
  ],
  [CollaboratorRole.ADMIN]: [
    'SELECT', 'INSERT', 'UPDATE', 'DELETE',
    'CREATE_TABLE', 'DROP_TABLE', 'ALTER_TABLE',
    'MANAGE_USERS', 'INVITE_USERS', 'REMOVE_USERS'
  ],
  [CollaboratorRole.MODERATOR]: [
    'SELECT', 'INSERT', 'UPDATE', 'DELETE'
  ],
  [CollaboratorRole.MEMBER]: [
    'SELECT', 'INSERT'
  ]
};
export interface Collaborator {
  oderId: string;
  username: string;
  role: CollaboratorRole;
  addedAt: string;
  addedBy: string;
  lastAccess?: string;
}
export interface Invitation {
  id: string;
  databaseId: string;
  databaseName: string;
  fromUser: string;
  toUser: string;
  role: CollaboratorRole;
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  message?: string;
}
export interface SharedDatabase {
  id: string;
  name: string;
  owner: string;
  createdAt: string;
  collaborators: Collaborator[];
  maxCollaborators: number;
  isPublic: boolean;
}
export interface Notification {
  id: string;
  userId: string;
  type: 'invitation' | 'role_change' | 'removed' | 'database_update' | 'system';
  title: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: string;
}

export class CollaborationManager {
  private dataDir: string;
  private sharedDbsFile: string;
  private invitationsFile: string;
  private notificationsFile: string;
  
  private sharedDatabases: Map<string, SharedDatabase> = new Map();
  private invitations: Map<string, Invitation> = new Map();
  private notifications: Map<string, Notification[]> = new Map();

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.sharedDbsFile = path.join(dataDir, 'shared_databases.json');
    this.invitationsFile = path.join(dataDir, 'invitations.json');
    this.notificationsFile = path.join(dataDir, 'notifications.json');
    
    this.loadData();
  }
  private loadData(): void {
    try {
      if (fs.existsSync(this.sharedDbsFile)) {
        const data = JSON.parse(fs.readFileSync(this.sharedDbsFile, 'utf-8'));
        this.sharedDatabases = new Map(Object.entries(data));
      }
      
      if (fs.existsSync(this.invitationsFile)) {
        const data = JSON.parse(fs.readFileSync(this.invitationsFile, 'utf-8'));
        this.invitations = new Map(Object.entries(data));
      }
      
      if (fs.existsSync(this.notificationsFile)) {
        const data = JSON.parse(fs.readFileSync(this.notificationsFile, 'utf-8'));
        for (const [userId, notifs] of Object.entries(data)) {
          this.notifications.set(userId, notifs as Notification[]);
        }
      }
    } catch (error) {
      console.error('Error loading collaboration data:', error);
    }
  }
  private saveData(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      
      fs.writeFileSync(
        this.sharedDbsFile, 
        JSON.stringify(Object.fromEntries(this.sharedDatabases), null, 2)
      );
      
      fs.writeFileSync(
        this.invitationsFile,
        JSON.stringify(Object.fromEntries(this.invitations), null, 2)
      );
      
      const notifsObj: Record<string, Notification[]> = {};
      this.notifications.forEach((v, k) => notifsObj[k] = v);
      fs.writeFileSync(this.notificationsFile, JSON.stringify(notifsObj, null, 2));
    } catch (error) {
      console.error('Error saving collaboration data:', error);
    }
  }
  createSharedDatabase(name: string, owner: string): SharedDatabase {
    const id = `shared_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const db: SharedDatabase = {
      id,
      name,
      owner,
      createdAt: new Date().toISOString(),
      collaborators: [{
        oderId: owner,
        username: owner,
        role: CollaboratorRole.OWNER,
        addedAt: new Date().toISOString(),
        addedBy: owner
      }],
      maxCollaborators: 4,
      isPublic: false
    };
    
    this.sharedDatabases.set(id, db);
    this.saveData();
    
    return db;
  }
  getUserSharedDatabases(username: string): SharedDatabase[] {
    const result: SharedDatabase[] = [];
    
    this.sharedDatabases.forEach(db => {
      if (db.owner === username || db.collaborators.some(c => c.username === username)) {
        result.push(db);
      }
    });
    
    return result;
  }
  getSharedDatabase(id: string): SharedDatabase | undefined {
    return this.sharedDatabases.get(id);
  }
  inviteUser(
    databaseId: string, 
    fromUser: string, 
    toUser: string, 
    role: CollaboratorRole = CollaboratorRole.MEMBER,
    message?: string
  ): Invitation | { error: string } {
    const db = this.sharedDatabases.get(databaseId);
    
    if (!db) {
      return { error: 'База данных не найдена' };
    }
    const inviter = db.collaborators.find(c => c.username === fromUser);
    if (!inviter) {
      return { error: 'Вы не являетесь участником этой БД' };
    }
    
    const permissions = RolePermissions[inviter.role];
    if (!permissions.includes('INVITE_USERS')) {
      return { error: 'У вас нет прав для приглашения пользователей' };
    }
    if (db.collaborators.length >= db.maxCollaborators) {
      return { error: `Максимум ${db.maxCollaborators} участника в БД` };
    }
    if (db.collaborators.some(c => c.username === toUser)) {
      return { error: 'Пользователь уже является участником' };
    }
    const existingInvite = Array.from(this.invitations.values()).find(
      i => i.databaseId === databaseId && i.toUser === toUser && i.status === 'pending'
    );
    if (existingInvite) {
      return { error: 'Приглашение уже отправлено' };
    }
    
    const invitation: Invitation = {
      id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      databaseId,
      databaseName: db.name,
      fromUser,
      toUser,
      role,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 дней
      status: 'pending',
      message
    };
    
    this.invitations.set(invitation.id, invitation);
    this.addNotification(toUser, {
      id: `notif_${Date.now()}`,
      userId: toUser,
      type: 'invitation',
      title: 'Приглашение в базу данных',
      message: `${fromUser} приглашает вас в БД "${db.name}" как ${this.getRoleName(role)}`,
      data: { invitationId: invitation.id },
      read: false,
      createdAt: new Date().toISOString()
    });
    
    this.saveData();
    
    return invitation;
  }
  acceptInvitation(invitationId: string, username: string): { success: boolean; error?: string } {
    const invitation = this.invitations.get(invitationId);
    
    if (!invitation) {
      return { success: false, error: 'Приглашение не найдено' };
    }
    
    if (invitation.toUser !== username) {
      return { success: false, error: 'Это приглашение не для вас' };
    }
    
    if (invitation.status !== 'pending') {
      return { success: false, error: 'Приглашение уже обработано' };
    }
    
    if (new Date(invitation.expiresAt) < new Date()) {
      invitation.status = 'expired';
      this.saveData();
      return { success: false, error: 'Приглашение истекло' };
    }
    
    const db = this.sharedDatabases.get(invitation.databaseId);
    if (!db) {
      return { success: false, error: 'База данных не найдена' };
    }
    
    if (db.collaborators.length >= db.maxCollaborators) {
      return { success: false, error: 'В БД максимальное количество участников' };
    }
    db.collaborators.push({
      oderId: username,
      username,
      role: invitation.role,
      addedAt: new Date().toISOString(),
      addedBy: invitation.fromUser
    });
    
    invitation.status = 'accepted';
    this.addNotification(invitation.fromUser, {
      id: `notif_${Date.now()}`,
      userId: invitation.fromUser,
      type: 'system',
      title: 'Приглашение принято',
      message: `${username} присоединился к БД "${db.name}"`,
      data: { databaseId: db.id },
      read: false,
      createdAt: new Date().toISOString()
    });
    this.removeInvitationNotification(username, invitationId);
    
    this.saveData();
    
    return { success: true };
  }
  declineInvitation(invitationId: string, username: string): { success: boolean; error?: string } {
    const invitation = this.invitations.get(invitationId);
    
    if (!invitation) {
      return { success: false, error: 'Приглашение не найдено' };
    }
    
    if (invitation.toUser !== username) {
      return { success: false, error: 'Это приглашение не для вас' };
    }
    
    invitation.status = 'declined';
    this.removeInvitationNotification(username, invitationId);
    
    this.saveData();
    
    return { success: true };
  }
  getUserInvitations(username: string): Invitation[] {
    const result: Invitation[] = [];
    
    this.invitations.forEach(inv => {
      if (inv.toUser === username && inv.status === 'pending') {
        if (new Date(inv.expiresAt) < new Date()) {
          inv.status = 'expired';
        } else {
          result.push(inv);
        }
      }
    });
    
    this.saveData();
    return result;
  }
  removeCollaborator(
    databaseId: string, 
    removerUsername: string, 
    targetUsername: string
  ): { success: boolean; error?: string } {
    const db = this.sharedDatabases.get(databaseId);
    
    if (!db) {
      return { success: false, error: 'База данных не найдена' };
    }
    
    const remover = db.collaborators.find(c => c.username === removerUsername);
    if (!remover) {
      return { success: false, error: 'Вы не являетесь участником этой БД' };
    }
    const permissions = RolePermissions[remover.role];
    if (!permissions.includes('REMOVE_USERS') && removerUsername !== targetUsername) {
      return { success: false, error: 'У вас нет прав для удаления участников' };
    }
    if (db.owner === targetUsername && removerUsername !== targetUsername) {
      return { success: false, error: 'Нельзя удалить владельца БД' };
    }
    
    const targetIndex = db.collaborators.findIndex(c => c.username === targetUsername);
    if (targetIndex === -1) {
      return { success: false, error: 'Участник не найден' };
    }
    
    db.collaborators.splice(targetIndex, 1);
    if (removerUsername !== targetUsername) {
      this.addNotification(targetUsername, {
        id: `notif_${Date.now()}`,
        userId: targetUsername,
        type: 'removed',
        title: 'Вы были удалены',
        message: `${removerUsername} удалил вас из БД "${db.name}"`,
        data: { databaseId: db.id },
        read: false,
        createdAt: new Date().toISOString()
      });
    }
    
    this.saveData();
    
    return { success: true };
  }
  changeRole(
    databaseId: string,
    changerUsername: string,
    targetUsername: string,
    newRole: CollaboratorRole
  ): { success: boolean; error?: string } {
    const db = this.sharedDatabases.get(databaseId);
    
    if (!db) {
      return { success: false, error: 'База данных не найдена' };
    }
    
    const changer = db.collaborators.find(c => c.username === changerUsername);
    if (!changer) {
      return { success: false, error: 'Вы не являетесь участником этой БД' };
    }
    
    const permissions = RolePermissions[changer.role];
    if (!permissions.includes('CHANGE_ROLES')) {
      return { success: false, error: 'У вас нет прав для изменения ролей' };
    }
    if (db.owner === targetUsername) {
      return { success: false, error: 'Нельзя изменить роль владельца' };
    }
    
    const target = db.collaborators.find(c => c.username === targetUsername);
    if (!target) {
      return { success: false, error: 'Участник не найден' };
    }
    
    const oldRole = target.role;
    target.role = newRole;
    this.addNotification(targetUsername, {
      id: `notif_${Date.now()}`,
      userId: targetUsername,
      type: 'role_change',
      title: 'Ваша роль изменена',
      message: `Ваша роль в БД "${db.name}" изменена с ${this.getRoleName(oldRole)} на ${this.getRoleName(newRole)}`,
      data: { databaseId: db.id, oldRole, newRole },
      read: false,
      createdAt: new Date().toISOString()
    });
    
    this.saveData();
    
    return { success: true };
  }
  addNotification(userId: string, notification: Notification): void {
    if (!this.notifications.has(userId)) {
      this.notifications.set(userId, []);
    }
    this.notifications.get(userId)!.unshift(notification);
    const userNotifs = this.notifications.get(userId)!;
    if (userNotifs.length > 50) {
      userNotifs.splice(50);
    }
  }
  getNotifications(userId: string): Notification[] {
    return this.notifications.get(userId) || [];
  }
  getUnreadNotifications(userId: string): Notification[] {
    return (this.notifications.get(userId) || []).filter(n => !n.read);
  }
  markNotificationRead(userId: string, notificationId: string): void {
    const userNotifs = this.notifications.get(userId);
    if (userNotifs) {
      const notif = userNotifs.find(n => n.id === notificationId);
      if (notif) {
        notif.read = true;
        this.saveData();
      }
    }
  }
  removeNotification(userId: string, notificationId: string): void {
    const userNotifs = this.notifications.get(userId);
    if (userNotifs) {
      const index = userNotifs.findIndex(n => n.id === notificationId);
      if (index !== -1) {
        userNotifs.splice(index, 1);
        this.saveData();
      }
    }
  }
  removeInvitationNotification(userId: string, invitationId: string): void {
    const userNotifs = this.notifications.get(userId);
    if (userNotifs) {
      const index = userNotifs.findIndex(n => n.data?.invitationId === invitationId);
      if (index !== -1) {
        userNotifs.splice(index, 1);
        this.saveData();
      }
    }
  }
  markAllNotificationsRead(userId: string): void {
    const userNotifs = this.notifications.get(userId);
    if (userNotifs) {
      userNotifs.forEach(n => n.read = true);
      this.saveData();
    }
  }
  checkPermission(databaseId: string, username: string, permission: string): boolean {
    const db = this.sharedDatabases.get(databaseId);
    if (!db) return false;
    
    const collaborator = db.collaborators.find(c => c.username === username);
    if (!collaborator) return false;
    
    return RolePermissions[collaborator.role].includes(permission);
  }
  getUserRole(databaseId: string, username: string): CollaboratorRole | null {
    const db = this.sharedDatabases.get(databaseId);
    if (!db) return null;
    
    const collaborator = db.collaborators.find(c => c.username === username);
    return collaborator?.role || null;
  }
  private getRoleName(role: CollaboratorRole): string {
    switch (role) {
      case CollaboratorRole.OWNER: return 'Владелец';
      case CollaboratorRole.ADMIN: return 'Администратор';
      case CollaboratorRole.MODERATOR: return 'Модератор';
      case CollaboratorRole.MEMBER: return 'Участник';
      default: return role;
    }
  }
}

export default CollaborationManager;
