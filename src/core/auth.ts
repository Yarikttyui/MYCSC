import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { User, Session } from './types';

export class AuthManager {
  private users: Map<string, User> = new Map();
  private sessions: Map<string, Session> = new Map();
  private authDir: string;
  private sessionDuration: number = 24 * 60 * 60 * 1000; // 24 часа

  constructor(dataDir: string) {
    this.authDir = path.join(dataDir, '.auth');
    this.ensureAuthDir();
    this.loadUsers();
    this.cleanExpiredSessions();
  }

  private ensureAuthDir(): void {
    if (!fs.existsSync(this.authDir)) {
      fs.mkdirSync(this.authDir, { recursive: true });
    }
  }

  private loadUsers(): void {
    const usersFile = path.join(this.authDir, 'users.json');
    if (fs.existsSync(usersFile)) {
      const data = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
      for (const user of data) {
        this.users.set(user.id, {
          ...user,
          createdAt: new Date(user.createdAt),
          lastLogin: user.lastLogin ? new Date(user.lastLogin) : undefined
        });
      }
    } else {
      this.createUser('admin', 'admin@localhost', 'admin123', 'admin');
    }
  }

  private saveUsers(): void {
    const usersFile = path.join(this.authDir, 'users.json');
    const data = Array.from(this.users.values());
    fs.writeFileSync(usersFile, JSON.stringify(data, null, 2));
  }
  private hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }
  private verifyPassword(password: string, storedHash: string): boolean {
    const [salt, hash] = storedHash.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
  }
  createUser(
    username: string, 
    passwordOrEmail: string, 
    roleOrPassword?: string | 'admin' | 'user' | 'readonly', 
    role?: 'admin' | 'user' | 'readonly'
  ): User {
    let email: string;
    let password: string;
    let userRole: 'admin' | 'user' | 'readonly';
    
    if (role !== undefined) {
      email = passwordOrEmail;
      password = roleOrPassword as string;
      userRole = role;
    } else if (roleOrPassword === 'admin' || roleOrPassword === 'user' || roleOrPassword === 'readonly') {
      email = `${username}@localhost`;
      password = passwordOrEmail;
      userRole = roleOrPassword;
    } else if (roleOrPassword) {
      email = passwordOrEmail;
      password = roleOrPassword;
      userRole = 'user';
    } else {
      email = `${username}@localhost`;
      password = passwordOrEmail;
      userRole = 'user';
    }
    for (const user of this.users.values()) {
      if (user.username === username) {
        throw new Error('Username already exists');
      }
      if (user.email === email && email !== `${username}@localhost`) {
        throw new Error('Email already exists');
      }
    }

    const user: User = {
      id: uuidv4(),
      username,
      email,
      passwordHash: this.hashPassword(password),
      role: userRole,
      createdAt: new Date(),
      databases: userRole === 'admin' ? ['*'] : []
    };

    this.users.set(user.id, user);
    this.saveUsers();

    return { ...user, passwordHash: '[hidden]' };
  }
  login(username: string, password: string): { user: User; token: string } {
    let foundUser: User | undefined;

    for (const user of this.users.values()) {
      if (user.username === username || user.email === username) {
        foundUser = user;
        break;
      }
    }

    if (!foundUser) {
      throw new Error('Invalid credentials');
    }

    if (!this.verifyPassword(password, foundUser.passwordHash)) {
      throw new Error('Invalid credentials');
    }
    foundUser.lastLogin = new Date();
    this.saveUsers();
    const session: Session = {
      id: uuidv4(),
      userId: foundUser.id,
      token: crypto.randomBytes(32).toString('hex'),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.sessionDuration)
    };

    this.sessions.set(session.token, session);
    this.saveSession(session);

    return {
      user: { ...foundUser, passwordHash: '[hidden]' },
      token: session.token
    };
  }
  logout(token: string): void {
    const session = this.sessions.get(token);
    if (session) {
      this.sessions.delete(token);
      this.deleteSession(session.id);
    }
  }
  validateToken(token: string): User | null {
    const session = this.sessions.get(token);
    
    if (!session) {
      const loadedSession = this.loadSession(token);
      if (loadedSession) {
        this.sessions.set(token, loadedSession);
        return this.validateToken(token);
      }
      return null;
    }

    if (new Date() > session.expiresAt) {
      this.sessions.delete(token);
      this.deleteSession(session.id);
      return null;
    }

    const user = this.users.get(session.userId);
    return user ? { ...user, passwordHash: '[hidden]' } : null;
  }
  updateUser(userId: string, updates: Partial<Pick<User, 'email' | 'role' | 'databases'>>): User {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (updates.email) user.email = updates.email;
    if (updates.role) user.role = updates.role;
    if (updates.databases) user.databases = updates.databases;

    this.saveUsers();
    return { ...user, passwordHash: '[hidden]' };
  }
  changePassword(userId: string, oldPassword: string, newPassword: string): void {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!this.verifyPassword(oldPassword, user.passwordHash)) {
      throw new Error('Invalid old password');
    }

    user.passwordHash = this.hashPassword(newPassword);
    this.saveUsers();
  }
  resetPassword(userId: string, newPassword: string): void {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.passwordHash = this.hashPassword(newPassword);
    this.saveUsers();
  }
  deleteUser(userId: string): void {
    if (!this.users.has(userId)) {
      throw new Error('User not found');
    }
    for (const [token, session] of this.sessions) {
      if (session.userId === userId) {
        this.sessions.delete(token);
        this.deleteSession(session.id);
      }
    }

    this.users.delete(userId);
    this.saveUsers();
  }
  listUsers(): User[] {
    return Array.from(this.users.values()).map(u => ({
      ...u,
      passwordHash: '[hidden]'
    }));
  }
  getUser(userId: string): User | undefined {
    const user = this.users.get(userId);
    return user ? { ...user, passwordHash: '[hidden]' } : undefined;
  }
  getUserByUsername(username: string): User | undefined {
    for (const user of this.users.values()) {
      if (user.username === username) {
        return { ...user, passwordHash: '[hidden]' };
      }
    }
    return undefined;
  }
  getSession(token: string): { user: User; session: Session } | null {
    let session = this.sessions.get(token);
    
    if (!session) {
      session = this.loadSession(token) || undefined;
      if (session) {
        this.sessions.set(token, session);
      }
    }
    
    if (!session || new Date() > session.expiresAt) {
      return null;
    }
    
    const user = this.users.get(session.userId);
    if (!user) return null;
    
    return {
      user: { ...user, passwordHash: '[hidden]' },
      session
    };
  }
  searchUsers(query: string, limit: number = 10): Array<{ username: string; id: string }> {
    const results: Array<{ username: string; id: string }> = [];
    const lowerQuery = query.toLowerCase();
    
    for (const user of this.users.values()) {
      if (user.username.toLowerCase().includes(lowerQuery)) {
        results.push({ username: user.username, id: user.id });
        if (results.length >= limit) break;
      }
    }
    
    return results;
  }
  canAccessDatabase(userId: string, database: string): boolean {
    const user = this.users.get(userId);
    if (!user) return false;

    if (user.role === 'admin' || user.databases.includes('*')) {
      return true;
    }

    return user.databases.includes(database);
  }
  canWrite(userId: string): boolean {
    const user = this.users.get(userId);
    if (!user) return false;
    return user.role === 'admin' || user.role === 'user';
  }
  grantDatabaseAccess(userId: string, database: string): void {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.databases.includes(database)) {
      user.databases.push(database);
      this.saveUsers();
    }
  }
  revokeDatabaseAccess(userId: string, database: string): void {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const index = user.databases.indexOf(database);
    if (index > -1) {
      user.databases.splice(index, 1);
      this.saveUsers();
    }
  }
  private saveSession(session: Session): void {
    const sessionFile = path.join(this.authDir, 'sessions', `${session.id}.json`);
    const sessionsDir = path.dirname(sessionFile);
    
    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
    }
    
    fs.writeFileSync(sessionFile, JSON.stringify(session));
  }
  private loadSession(token: string): Session | null {
    const sessionsDir = path.join(this.authDir, 'sessions');
    if (!fs.existsSync(sessionsDir)) return null;

    const files = fs.readdirSync(sessionsDir);
    for (const file of files) {
      const sessionPath = path.join(sessionsDir, file);
      const session: Session = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
      
      if (session.token === token) {
        session.createdAt = new Date(session.createdAt);
        session.expiresAt = new Date(session.expiresAt);
        return session;
      }
    }
    
    return null;
  }
  private deleteSession(sessionId: string): void {
    const sessionFile = path.join(this.authDir, 'sessions', `${sessionId}.json`);
    if (fs.existsSync(sessionFile)) {
      fs.unlinkSync(sessionFile);
    }
  }
  private cleanExpiredSessions(): void {
    const sessionsDir = path.join(this.authDir, 'sessions');
    if (!fs.existsSync(sessionsDir)) return;

    const files = fs.readdirSync(sessionsDir);
    const now = new Date();

    for (const file of files) {
      const sessionPath = path.join(sessionsDir, file);
      try {
        const session: Session = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
        if (new Date(session.expiresAt) < now) {
          fs.unlinkSync(sessionPath);
        }
      } catch {
        fs.unlinkSync(sessionPath);
      }
    }
  }
  cleanupExpiredSessions(ttl: number): number {
    const sessionsDir = path.join(this.authDir, 'sessions');
    if (!fs.existsSync(sessionsDir)) return 0;

    const files = fs.readdirSync(sessionsDir);
    const now = Date.now();
    let cleaned = 0;

    for (const file of files) {
      const sessionPath = path.join(sessionsDir, file);
      try {
        const session: Session = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
        const sessionAge = now - new Date(session.createdAt).getTime();
        if (sessionAge > ttl || new Date(session.expiresAt) < new Date()) {
          fs.unlinkSync(sessionPath);
          this.sessions.delete(session.token);
          cleaned++;
        }
      } catch {
        try { fs.unlinkSync(sessionPath); cleaned++; } catch {}
      }
    }

    console.log(`[Auth] Cleaned up ${cleaned} expired sessions`);
    return cleaned;
  }
  updateUserEmail(userId: string, email: string): User {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }
    for (const u of this.users.values()) {
      if (u.id !== userId && u.email === email) {
        throw new Error('Email already exists');
      }
    }

    user.email = email;
    this.saveUsers();
    return { ...user, passwordHash: '[hidden]' };
  }

  createOrGetOAuthUser(
    provider: 'google' | 'github',
    providerId: string,
    email: string,
    username: string,
    name?: string,
    avatar?: string
  ): User {
    for (const user of this.users.values()) {
      if (user.oauthProvider === provider && user.oauthProviderId === providerId) {
        user.lastLogin = new Date();
        if (avatar) user.avatar = avatar;
        this.saveUsers();
        return { ...user, passwordHash: '[hidden]' };
      }
    }
    for (const user of this.users.values()) {
      if (user.email === email) {
        user.oauthProvider = provider;
        user.oauthProviderId = providerId;
        user.emailVerified = true;
        user.lastLogin = new Date();
        if (avatar) user.avatar = avatar;
        this.saveUsers();
        return { ...user, passwordHash: '[hidden]' };
      }
    }
    let finalUsername = username;
    let counter = 1;
    while (Array.from(this.users.values()).some(u => u.username === finalUsername)) {
      finalUsername = `${username}${counter}`;
      counter++;
    }

    const user: User = {
      id: uuidv4(),
      username: finalUsername,
      email,
      passwordHash: '',
      role: 'user',
      createdAt: new Date(),
      lastLogin: new Date(),
      databases: [],
      oauthProvider: provider,
      oauthProviderId: providerId,
      avatar,
      emailVerified: true
    };

    this.users.set(user.id, user);
    this.saveUsers();

    return { ...user, passwordHash: '[hidden]' };
  }
  loginWithOAuth(
    provider: 'google' | 'github',
    providerId: string,
    email: string,
    username: string,
    name?: string,
    avatar?: string
  ): { user: User; token: string } {
    const user = this.createOrGetOAuthUser(provider, providerId, email, username, name, avatar);
    const session: Session = {
      id: uuidv4(),
      userId: user.id,
      token: crypto.randomBytes(32).toString('hex'),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.sessionDuration)
    };

    this.sessions.set(session.token, session);
    this.saveSession(session);

    return { user, token: session.token };
  }

  createVerificationCode(userId: string): string {
    const user = this.users.get(userId);
    if (!user) throw new Error('User not found');

    const code = Math.random().toString().slice(2, 8); // 6 цифр
    user.verificationCode = code;
    user.verificationCodeExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 часа
    this.saveUsers();

    return code;
  }
  verifyEmail(userId: string, code: string): boolean {
    const user = this.users.get(userId);
    if (!user) return false;

    if (user.verificationCode !== code) return false;
    if (user.verificationCodeExpires && new Date() > user.verificationCodeExpires) {
      return false;
    }

    user.emailVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    this.saveUsers();

    return true;
  }
  isEmailVerified(userId: string): boolean {
    const user = this.users.get(userId);
    return user?.emailVerified === true;
  }
  getUserByEmail(email: string): User | undefined {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return { ...user, passwordHash: '[hidden]' };
      }
    }
    return undefined;
  }
  createPasswordResetCode(email: string): { userId: string; code: string } | null {
    const user = this.getUserByEmail(email);
    if (!user) return null;

    const fullUser = this.users.get(user.id);
    if (!fullUser) return null;

    const code = Math.random().toString().slice(2, 8);
    fullUser.verificationCode = code;
    fullUser.verificationCodeExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 час
    this.saveUsers();

    return { userId: user.id, code };
  }
  resetPasswordWithCode(userId: string, code: string, newPassword: string): boolean {
    const user = this.users.get(userId);
    if (!user) return false;

    if (user.verificationCode !== code) return false;
    if (user.verificationCodeExpires && new Date() > user.verificationCodeExpires) {
      return false;
    }

    user.passwordHash = this.hashPassword(newPassword);
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    this.saveUsers();

    return true;
  }
}
