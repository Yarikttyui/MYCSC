import express from 'express';
import { createServer } from 'http';
import * as net from 'net';
import { Server as SocketIO } from 'socket.io';
import * as path from 'path';
import * as fs from 'fs';
import { MYCSC, AuthManager } from '../core';
import CollaborationManager, { CollaboratorRole } from '../core/collaboration';
import { 
  generateOAuthState, 
  getGoogleAuthUrl,
  getGithubAuthUrl, 
  processOAuthCallback 
} from './oauth-service';
import { 
  sendVerificationEmail, 
  sendWelcomeEmail, 
  sendPasswordResetEmail,
  verifyEmailConnection 
} from './email-service';
const oauthStates = new Map<string, { provider: string; createdAt: number; isDesktop?: boolean }>();

interface RateLimitEntry {
  count: number;
  firstRequest: number;
  blockedUntil?: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 минута
const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_BLOCK_DURATION = 5 * 60 * 1000;

function getRateLimitKey(req: express.Request, endpoint: string): string {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `${ip}:${endpoint}`;
}

function checkRateLimit(req: express.Request, endpoint: string): { allowed: boolean; retryAfter?: number } {
  const key = getRateLimitKey(req, endpoint);
  const now = Date.now();
  
  let entry = rateLimitStore.get(key);
  if (entry?.blockedUntil && now < entry.blockedUntil) {
    return { allowed: false, retryAfter: Math.ceil((entry.blockedUntil - now) / 1000) };
  }
  if (!entry || now - entry.firstRequest > RATE_LIMIT_WINDOW) {
    entry = { count: 0, firstRequest: now };
  }
  
  entry.count++;
  
  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    entry.blockedUntil = now + RATE_LIMIT_BLOCK_DURATION;
    rateLimitStore.set(key, entry);
    return { allowed: false, retryAfter: RATE_LIMIT_BLOCK_DURATION / 1000 };
  }
  
  rateLimitStore.set(key, entry);
  return { allowed: true };
}
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.firstRequest > RATE_LIMIT_WINDOW * 2 && (!entry.blockedUntil || now > entry.blockedUntil)) {
      rateLimitStore.delete(key);
    }
  }
}, 10 * 60 * 1000);
const rateLimitMiddleware = (endpoint: string) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const result = checkRateLimit(req, endpoint);
  if (!result.allowed) {
    res.setHeader('Retry-After', result.retryAfter || 300);
    return res.status(429).json({ 
      success: false, 
      error: 'Слишком много запросов. Попробуйте позже.',
      retryAfter: result.retryAfter 
    });
  }
  next();
};

function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/['"`;\\]/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '')
    .trim();
}

function validateUsername(username: string): { valid: boolean; error?: string } {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Имя пользователя обязательно' };
  }
  if (username.length < 3 || username.length > 30) {
    return { valid: false, error: 'Имя пользователя должно быть от 3 до 30 символов' };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { valid: false, error: 'Имя пользователя может содержать только буквы, цифры, _ и -' };
  }
  return { valid: true };
}

function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Пароль обязателен' };
  }
  if (password.length < 6) {
    return { valid: false, error: 'Пароль должен быть минимум 6 символов' };
  }
  if (password.length > 100) {
    return { valid: false, error: 'Пароль слишком длинный' };
  }
  return { valid: true };
}

function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email обязателен' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Некорректный формат email' };
  }
  return { valid: true };
}

const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 часа
const SESSION_CLEANUP_INTERVAL = 60 * 60 * 1000;
setInterval(() => {
  try {
    const cleaned = auth.cleanupExpiredSessions(SESSION_TTL);
    if (cleaned > 0) {
      console.log(`[Session] Cleaned up ${cleaned} expired sessions`);
    }
  } catch (error) {
    console.error('[Session] Cleanup error:', error);
  }
}, SESSION_CLEANUP_INTERVAL);

const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = parseInt(process.env.PORT || '3001', 10);
const TCP_PORT = parseInt(process.env.TCP_PORT || '3002', 10);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

console.log(`[MYCSC] Starting in ${NODE_ENV} mode...`);
console.log(`[MYCSC] Data directory: ${DATA_DIR}`);

const app = express();
const httpServer = createServer(app);
const io = new SocketIO(httpServer, {
  cors: {
    origin: NODE_ENV === 'production' ? false : '*',
    methods: ['GET', 'POST']
  }
});
const db = new MYCSC({
  dataDir: DATA_DIR,
  logLevel: LOG_LEVEL as any
});

const auth = new AuthManager(path.join(DATA_DIR, 'auth'));
const collab = new CollaborationManager(path.join(DATA_DIR, 'collab'));

if (NODE_ENV === 'production') {
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
const staticPath = NODE_ENV === 'production' 
  ? path.join(__dirname, '../../renderer')
  : path.join(__dirname, '../renderer');
const downloadsPath = NODE_ENV === 'production'
  ? path.join(__dirname, '../../../public/downloads')
  : path.join(__dirname, '../../public/downloads');
const publicPath = NODE_ENV === 'production'
  ? path.join(__dirname, '../../../public')
  : path.join(__dirname, '../../public');

console.log(`[MYCSC] Static files path: ${staticPath}`);
console.log(`[MYCSC] Downloads path: ${downloadsPath}`);
console.log(`[MYCSC] Public path: ${publicPath}`);
app.use(express.static(staticPath));
app.use('/downloads', express.static(downloadsPath));
app.use(express.static(publicPath));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (LOG_LEVEL === 'debug' || (LOG_LEVEL === 'info' && duration > 1000)) {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0',
    environment: NODE_ENV
  });
});
app.post('/api/auth/login', rateLimitMiddleware('login'), async (req, res) => {
  try {
    const { username, password } = req.body;
    const usernameCheck = validateUsername(username);
    if (!usernameCheck.valid) {
      return res.json({ success: false, error: usernameCheck.error });
    }
    
    if (!password) {
      return res.json({ success: false, error: 'Пароль обязателен' });
    }
    
    const session = await auth.login(sanitizeInput(username), password);
    res.json({ success: true, sessionId: session.token, user: session.user });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/auth/register', rateLimitMiddleware('register'), async (req, res) => {
  try {
    const { username, password, email, role = 'user' } = req.body;
    const usernameCheck = validateUsername(username);
    if (!usernameCheck.valid) {
      return res.json({ success: false, error: usernameCheck.error });
    }
    
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return res.json({ success: false, error: passwordCheck.error });
    }
    
    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      return res.json({ success: false, error: emailCheck.error });
    }
    const user = await auth.createUser(sanitizeInput(username), password, role);
    auth.updateUserEmail(user.id, sanitizeInput(email));
    const verificationCode = auth.createVerificationCode(user.id);
    const baseUrl = process.env.BASE_URL || 'https://adskoekoleso.ru';
    const verificationUrl = `${baseUrl}/verify?userId=${user.id}&code=${verificationCode}`;
    try {
      await sendVerificationEmail(sanitizeInput(email), sanitizeInput(username), verificationCode, verificationUrl);
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
    }
    const session = await auth.login(sanitizeInput(username), password);
    res.json({ 
      success: true, 
      user, 
      sessionId: session.token,
      message: 'На вашу почту отправлено письмо для подтверждения'
    });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});
app.post('/api/auth/verify-email', async (req, res) => {
  try {
    const { userId, code } = req.body;
    const verified = auth.verifyEmail(userId, code);
    
    if (verified) {
      const user = auth.getUser(userId);
      if (user?.email) {
        await sendWelcomeEmail(user.email, user.username);
      }
      res.json({ success: true, message: 'Email подтверждён!' });
    } else {
      res.json({ success: false, error: 'Неверный или истёкший код' });
    }
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});
app.post('/api/auth/forgot-password', rateLimitMiddleware('forgot-password'), async (req, res) => {
  try {
    const { email } = req.body;
    
    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      return res.json({ success: false, error: emailCheck.error });
    }
    
    const result = auth.createPasswordResetCode(sanitizeInput(email));
    
    if (result) {
      const user = auth.getUser(result.userId);
      const baseUrl = process.env.BASE_URL || 'https://adskoekoleso.ru';
      const resetUrl = `${baseUrl}/reset-password?userId=${result.userId}&code=${result.code}`;
      
      const emailSent = await sendPasswordResetEmail(sanitizeInput(email), user?.username || '', result.code, resetUrl);
      
      if (emailSent) {
        res.json({ success: true, userId: result.userId, message: 'Код отправлен на email' });
      } else {
        res.json({ success: false, error: 'Ошибка отправки email. Попробуйте позже.' });
      }
    } else {
      res.json({ success: false, error: 'Пользователь с таким email не найден' });
    }
  } catch (error: any) {
    console.error('Forgot password error:', error);
    res.json({ success: false, error: 'Ошибка сервера. Попробуйте позже.' });
  }
});
app.post('/api/auth/reset-password', rateLimitMiddleware('reset-password'), async (req, res) => {
  try {
    const { userId, code, newPassword } = req.body;
    
    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.valid) {
      return res.json({ success: false, error: passwordCheck.error });
    }
    
    const success = auth.resetPasswordWithCode(sanitizeInput(userId), sanitizeInput(code), newPassword);
    
    if (success) {
      res.json({ success: true, message: 'Пароль успешно изменён' });
    } else {
      res.json({ success: false, error: 'Неверный или истёкший код' });
    }
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/api/auth/google', (req, res) => {
  const isDesktop = req.query.desktop === 'true';
  const state = isDesktop ? 'desktop_' + generateOAuthState() : generateOAuthState();
  oauthStates.set(state, { provider: 'google', createdAt: Date.now(), isDesktop });
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  oauthStates.forEach((value, key) => {
    if (value.createdAt < tenMinutesAgo) oauthStates.delete(key);
  });
  
  const authUrl = getGoogleAuthUrl(state);
  res.redirect(authUrl);
});
app.get('/api/auth/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!state || !oauthStates.has(state as string)) {
      return res.redirect('/?error=invalid_state');
    }
    oauthStates.delete(state as string);
    
    if (!code) {
      return res.redirect('/?error=no_code');
    }
    
    const userData = await processOAuthCallback('google', code as string);
    
    if (!userData) {
      return res.redirect('/?error=oauth_failed');
    }
    
    const session = auth.loginWithOAuth(
      'google',
      userData.providerId,
      userData.email,
      userData.username,
      userData.name,
      userData.avatar
    );
    const isDesktop = req.query.desktop === 'true' || (state as string).startsWith('desktop_');
    
    if (isDesktop) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>MYCSC - Авторизация успешна</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Segoe UI', sans-serif; 
              background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #cdd6f4;
            }
            .container {
              background: #1e1e2e;
              border-radius: 20px;
              padding: 40px;
              max-width: 500px;
              text-align: center;
              box-shadow: 0 20px 60px rgba(0,0,0,0.4);
              border: 1px solid #313244;
            }
            .success-icon {
              width: 80px;
              height: 80px;
              background: linear-gradient(135deg, #22c55e, #16a34a);
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 20px;
              font-size: 40px;
            }
            h1 { color: #22c55e; margin-bottom: 10px; }
            p { color: #a6adc8; margin-bottom: 20px; }
            .token-box {
              background: #11111b;
              border: 2px solid #89b4fa;
              border-radius: 12px;
              padding: 15px;
              margin: 20px 0;
              word-break: break-all;
              font-family: monospace;
              font-size: 12px;
              color: #89b4fa;
              user-select: all;
            }
            .copy-btn {
              background: linear-gradient(135deg, #89b4fa, #cba6f7);
              color: #11111b;
              border: none;
              padding: 15px 40px;
              border-radius: 12px;
              font-size: 16px;
              font-weight: 600;
              cursor: pointer;
              transition: transform 0.2s;
            }
            .copy-btn:hover { transform: scale(1.05); }
            .hint { font-size: 14px; color: #6c7086; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">?</div>
            <h1>Авторизация успешна!</h1>
            <p>Скопируйте токен и вставьте его в десктоп приложение MYCSC</p>
            <div class="token-box" id="token">${session.token}</div>
            <button class="copy-btn" onclick="copyToken()">?? Скопировать токен</button>
            <p class="hint">После копирования вернитесь в приложение MYCSC</p>
          </div>
          <script>
            function copyToken() {
              navigator.clipboard.writeText('${session.token}');
              document.querySelector('.copy-btn').textContent = '? Скопировано!';
              setTimeout(() => {
                document.querySelector('.copy-btn').textContent = '?? Скопировать токен';
              }, 2000);
            }
          </script>
        </body>
        </html>
      `);
    } else {
      res.redirect(`/?token=${session.token}&provider=google`);
    }
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    res.redirect('/?error=oauth_error');
  }
});
app.get('/api/auth/github', (req, res) => {
  const isDesktop = req.query.desktop === 'true';
  const state = isDesktop ? 'desktop_' + generateOAuthState() : generateOAuthState();
  oauthStates.set(state, { provider: 'github', createdAt: Date.now(), isDesktop });
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  oauthStates.forEach((value, key) => {
    if (value.createdAt < tenMinutesAgo) oauthStates.delete(key);
  });
  
  const authUrl = getGithubAuthUrl(state);
  res.redirect(authUrl);
});
app.get('/api/auth/github/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!state || !oauthStates.has(state as string)) {
      return res.redirect('/?error=invalid_state');
    }
    oauthStates.delete(state as string);
    
    if (!code) {
      return res.redirect('/?error=no_code');
    }
    
    const userData = await processOAuthCallback('github', code as string);
    
    if (!userData) {
      return res.redirect('/?error=oauth_failed');
    }
    
    const session = auth.loginWithOAuth(
      'github',
      userData.providerId,
      userData.email,
      userData.username,
      userData.name,
      userData.avatar
    );
    const isDesktop = req.query.desktop === 'true' || (state as string).startsWith('desktop_');
    
    if (isDesktop) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>MYCSC - Авторизация успешна</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Segoe UI', sans-serif; 
              background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #cdd6f4;
            }
            .container {
              background: #1e1e2e;
              border-radius: 20px;
              padding: 40px;
              max-width: 500px;
              text-align: center;
              box-shadow: 0 20px 60px rgba(0,0,0,0.4);
              border: 1px solid #313244;
            }
            .success-icon {
              width: 80px;
              height: 80px;
              background: linear-gradient(135deg, #22c55e, #16a34a);
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 20px;
              font-size: 40px;
            }
            h1 { color: #22c55e; margin-bottom: 10px; }
            p { color: #a6adc8; margin-bottom: 20px; }
            .token-box {
              background: #11111b;
              border: 2px solid #89b4fa;
              border-radius: 12px;
              padding: 15px;
              margin: 20px 0;
              word-break: break-all;
              font-family: monospace;
              font-size: 12px;
              color: #89b4fa;
              user-select: all;
            }
            .copy-btn {
              background: linear-gradient(135deg, #89b4fa, #cba6f7);
              color: #11111b;
              border: none;
              padding: 15px 40px;
              border-radius: 12px;
              font-size: 16px;
              font-weight: 600;
              cursor: pointer;
              transition: transform 0.2s;
            }
            .copy-btn:hover { transform: scale(1.05); }
            .hint { font-size: 14px; color: #6c7086; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">?</div>
            <h1>Авторизация успешна!</h1>
            <p>Скопируйте токен и вставьте его в десктоп приложение MYCSC</p>
            <div class="token-box" id="token">${session.token}</div>
            <button class="copy-btn" onclick="copyToken()">?? Скопировать токен</button>
            <p class="hint">После копирования вернитесь в приложение MYCSC</p>
          </div>
          <script>
            function copyToken() {
              navigator.clipboard.writeText('${session.token}');
              document.querySelector('.copy-btn').textContent = '? Скопировано!';
              setTimeout(() => {
                document.querySelector('.copy-btn').textContent = '?? Скопировать токен';
              }, 2000);
            }
          </script>
        </body>
        </html>
      `);
    } else {
      res.redirect(`/?token=${session.token}&provider=github`);
    }
  } catch (error) {
    console.error('GitHub OAuth callback error:', error);
    res.redirect('/?error=oauth_error');
  }
});
app.get('/api/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    
    const token = authHeader.substring(7);
    const session = auth.getSession(token);
    
    if (!session) {
      return res.status(401).json({ success: false, error: 'Invalid session' });
    }
    
    res.json({ success: true, user: session.user });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const { sessionId } = req.body;
    auth.logout(sessionId);
    res.json({ success: true });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});
app.post('/api/query', async (req, res) => {
  try {
    const { sql } = req.body;
    const result = await db.query(sql);
    res.json(result);
  } catch (error: any) {
    res.json({
      success: false,
      error: error.message,
      executionTime: 0
    });
  }
});
app.post('/api/query/multiple', async (req, res) => {
  try {
    const { sql } = req.body;
    const results = await db.queryMultiple(sql);
    res.json(results);
  } catch (error: any) {
    res.json([{
      success: false,
      error: error.message,
      executionTime: 0
    }]);
  }
});
app.get('/api/tables', (req, res) => {
  res.json(db.getTables());
});
app.get('/api/tables/:name/schema', (req, res) => {
  const schema = db.getTableSchema(req.params.name);
  if (schema) {
    res.json(schema);
  } else {
    res.status(404).json({ error: 'Table not found' });
  }
});
app.get('/api/database/current', (req, res) => {
  res.json({ database: db.getCurrentDatabase() });
});
app.get('/api/databases', (req, res) => {
  try {
    const databases = db.getDatabases();
    res.json({ success: true, databases });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});
app.post('/api/databases', async (req, res) => {
  try {
    const { name, charset = 'utf8mb4', collation = 'utf8mb4_unicode_ci' } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Database name is required' });
    }
    const result = await db.query(`CREATE DATABASE IF NOT EXISTS ${name} CHARACTER SET ${charset} COLLATE ${collation}`);
    res.json(result);
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});
app.post('/api/databases/use', async (req, res) => {
  try {
    const { database } = req.body;
    if (!database) {
      return res.status(400).json({ success: false, error: 'Database name is required' });
    }
    const result = await db.query(`USE ${database}`);
    res.json({ success: true, database, message: `Now using database: ${database}` });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});
app.get('/api/tables/:name/data', async (req, res) => {
  try {
    const { name } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const offset = (page - 1) * limit;
    const orderBy = req.query.orderBy as string || '';
    const order = (req.query.order as string || 'ASC').toUpperCase();
    
    let sql = `SELECT * FROM ${name}`;
    if (orderBy) {
      sql += ` ORDER BY ${orderBy} ${order}`;
    }
    sql += ` LIMIT ${limit} OFFSET ${offset}`;
    
    const result = await db.query(sql);
    const countResult = await db.query(`SELECT COUNT(*) as total FROM ${name}`);
    const total = countResult.rows?.[0]?.total || 0;
    
    res.json({
      success: true,
      data: result.rows || [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});
app.post('/api/tables/:name/data', async (req, res) => {
  try {
    const { name } = req.params;
    const { data } = req.body;
    
    if (!data || (Array.isArray(data) && data.length === 0)) {
      return res.status(400).json({ success: false, error: 'Data is required' });
    }
    
    const rows = Array.isArray(data) ? data : [data];
    const results = [];
    
    for (const row of rows) {
      const columns = Object.keys(row).join(', ');
      const values = Object.values(row).map(v => 
        typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v === null ? 'NULL' : v
      ).join(', ');
      
      const sql = `INSERT INTO ${name} (${columns}) VALUES (${values})`;
      const result = await db.query(sql);
      results.push(result);
    }
    
    res.json({
      success: true,
      inserted: rows.length,
      results
    });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});
app.put('/api/tables/:name/data', async (req, res) => {
  try {
    const { name } = req.params;
    const { data, where } = req.body;
    
    if (!data || !where) {
      return res.status(400).json({ success: false, error: 'Data and where clause are required' });
    }
    
    const setClause = Object.entries(data).map(([k, v]) => 
      `${k} = ${typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v === null ? 'NULL' : v}`
    ).join(', ');
    
    const whereClause = Object.entries(where).map(([k, v]) => 
      `${k} = ${typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v}`
    ).join(' AND ');
    
    const sql = `UPDATE ${name} SET ${setClause} WHERE ${whereClause}`;
    const result = await db.query(sql);
    res.json(result);
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});
app.delete('/api/tables/:name/data', async (req, res) => {
  try {
    const { name } = req.params;
    const { where } = req.body;
    
    if (!where) {
      return res.status(400).json({ success: false, error: 'Where clause is required for safety' });
    }
    
    const whereClause = Object.entries(where).map(([k, v]) => 
      `${k} = ${typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v}`
    ).join(' AND ');
    
    const sql = `DELETE FROM ${name} WHERE ${whereClause}`;
    const result = await db.query(sql);
    res.json(result);
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});
app.get('/api', (req, res) => {
  res.json({
    name: 'MYCSC Database API',
    version: '1.0.0',
    description: 'REST API for MYCSC Database',
    endpoints: {
      auth: {
        'POST /api/auth/login': 'Login with username and password',
        'POST /api/auth/register': 'Register new user',
        'POST /api/auth/logout': 'Logout'
      },
      databases: {
        'GET /api/databases': 'List all databases',
        'POST /api/databases': 'Create new database',
        'POST /api/databases/use': 'Switch database'
      },
      tables: {
        'GET /api/tables': 'List all tables',
        'GET /api/tables/:name/schema': 'Get table schema',
        'GET /api/tables/:name/data': 'Get table data with pagination',
        'POST /api/tables/:name/data': 'Insert data',
        'PUT /api/tables/:name/data': 'Update data',
        'DELETE /api/tables/:name/data': 'Delete data'
      },
      query: {
        'POST /api/query': 'Execute SQL query',
        'POST /api/query/multiple': 'Execute multiple queries'
      }
    },
    examples: {
      query: {
        url: 'POST /api/query',
        body: { sql: 'SELECT * FROM users LIMIT 10' }
      },
      insert: {
        url: 'POST /api/tables/users/data',
        body: { data: { name: 'John', email: 'john@example.com' } }
      }
    }
  });
});
app.get('/api/config', (req, res) => {
  res.json(db.getConfig());
});

const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Требуется авторизация' });
  }
  
  const sessionId = authHeader.substring(7);
  const session = auth.getSession(sessionId);
  
  if (!session) {
    return res.status(401).json({ success: false, error: 'Недействительная сессия' });
  }
  
  (req as any).user = session.user;
  (req as any).sessionId = sessionId;
  next();
};
app.get('/api/collab/databases', requireAuth as any, (req, res) => {
  try {
    const user = (req as any).user;
    const databases = collab.getUserSharedDatabases(user.username);
    res.json({ success: true, databases });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});
app.post('/api/collab/databases', requireAuth as any, (req, res) => {
  try {
    const user = (req as any).user;
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Имя базы данных обязательно' });
    }
    
    const database = collab.createSharedDatabase(name, user.username);
    res.json({ success: true, database });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});
app.get('/api/collab/databases/:id', requireAuth as any, (req, res) => {
  try {
    const database = collab.getSharedDatabase(req.params.id);
    if (!database) {
      return res.status(404).json({ success: false, error: 'База данных не найдена' });
    }
    res.json({ success: true, database });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});
app.post('/api/collab/databases/:id/invite', requireAuth as any, (req, res) => {
  try {
    const user = (req as any).user;
    const { username, role = 'member', message } = req.body;
    
    if (!username) {
      return res.status(400).json({ success: false, error: 'Username обязателен' });
    }
    const targetUser = auth.getUserByUsername(username);
    if (!targetUser) {
      return res.json({ success: false, error: 'Пользователь не найден' });
    }
    
    const result = collab.inviteUser(
      req.params.id,
      user.username,
      username,
      role as CollaboratorRole,
      message
    );
    
    if ('error' in result) {
      return res.json({ success: false, error: result.error });
    }
    io.emit('notification', {
      userId: username,
      type: 'invitation',
      data: result
    });
    
    res.json({ success: true, invitation: result });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});
app.get('/api/collab/invitations', requireAuth as any, (req, res) => {
  try {
    const user = (req as any).user;
    const invitations = collab.getUserInvitations(user.username);
    res.json({ success: true, invitations });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});
app.post('/api/collab/invitations/:id/accept', requireAuth as any, (req, res) => {
  try {
    const user = (req as any).user;
    const result = collab.acceptInvitation(req.params.id, user.username);
    
    if (!result.success) {
      return res.json(result);
    }
    
    res.json({ success: true });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});
app.post('/api/collab/invitations/:id/decline', requireAuth as any, (req, res) => {
  try {
    const user = (req as any).user;
    const result = collab.declineInvitation(req.params.id, user.username);
    res.json(result);
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});
app.delete('/api/collab/databases/:id/collaborators/:username', requireAuth as any, (req, res) => {
  try {
    const user = (req as any).user;
    const result = collab.removeCollaborator(req.params.id, user.username, req.params.username);
    res.json(result);
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});
app.put('/api/collab/databases/:id/collaborators/:username/role', requireAuth as any, (req, res) => {
  try {
    const user = (req as any).user;
    const { role } = req.body;
    
    if (!role) {
      return res.status(400).json({ success: false, error: 'Роль обязательна' });
    }
    
    const result = collab.changeRole(req.params.id, user.username, req.params.username, role);
    res.json(result);
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});
app.get('/api/collab/notifications', requireAuth as any, (req, res) => {
  try {
    const user = (req as any).user;
    const notifications = collab.getNotifications(user.username);
    const unread = collab.getUnreadNotifications(user.username).length;
    res.json({ success: true, notifications, unreadCount: unread });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});
app.put('/api/collab/notifications/:id/read', requireAuth as any, (req, res) => {
  try {
    const user = (req as any).user;
    collab.markNotificationRead(user.username, req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});
app.put('/api/collab/notifications/read-all', requireAuth as any, (req, res) => {
  try {
    const user = (req as any).user;
    collab.markAllNotificationsRead(user.username);
    res.json({ success: true });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});
app.get('/api/users/search', requireAuth as any, (req, res) => {
  try {
    const query = (req.query.q as string || '').toLowerCase();
    if (!query || query.length < 2) {
      return res.json({ success: true, users: [] });
    }
    const users = auth.searchUsers(query);
    res.json({ success: true, users });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  const indexPath = path.join(staticPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Application not built. Run npm run build first.');
  }
});
interface ActiveUser {
  username: string;
  cursor?: { line: number; column: number };
  color: string;
  isTyping?: boolean;
  lastActivity?: number;
}
interface RoomState {
  code: string;
  lastUpdate: number;
  version: number;
}

const activeUsers = new Map<string, Map<string, ActiveUser>>();
const roomStates = new Map<string, RoomState>();
const typingTimeouts = new Map<string, NodeJS.Timeout>();

const userColors = [
  '#f38ba8', '#fab387', '#f9e2af', '#a6e3a1', '#94e2d5', 
  '#89dceb', '#89b4fa', '#cba6f7', '#f5c2e7', '#eba0ac'
];

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  let currentRoom: string | null = null;
  let username: string = 'Anonymous';
  socket.on('joinDatabase', (data: { databaseId: string; username: string }) => {
    currentRoom = `db_${data.databaseId}`;
    username = data.username || 'Anonymous';
    
    socket.join(currentRoom);
    
    if (!activeUsers.has(currentRoom)) {
      activeUsers.set(currentRoom, new Map());
    }
    
    const usersInRoom = activeUsers.get(currentRoom)!;
    const colorIndex = usersInRoom.size % userColors.length;
    const userInfo: ActiveUser = { 
      username, 
      color: userColors[colorIndex],
      isTyping: false,
      lastActivity: Date.now()
    };
    usersInRoom.set(socket.id, userInfo);
    socket.to(currentRoom).emit('userJoined', { 
      id: socket.id, 
      username, 
      color: userColors[colorIndex] 
    });
    const users = Array.from(usersInRoom.entries()).map(([id, u]) => ({ id, ...u }));
    socket.emit('activeUsers', users);
    const roomState = roomStates.get(currentRoom);
    if (roomState) {
      socket.emit('syncCode', { 
        code: roomState.code, 
        version: roomState.version 
      });
    }
    
    console.log(`${username} joined room ${currentRoom}`);
  });
  socket.on('leaveDatabase', () => {
    if (currentRoom) {
      socket.leave(currentRoom);
      const typingKey = `${currentRoom}_${socket.id}`;
      if (typingTimeouts.has(typingKey)) {
        clearTimeout(typingTimeouts.get(typingKey)!);
        typingTimeouts.delete(typingKey);
      }
      
      const usersInRoom = activeUsers.get(currentRoom);
      if (usersInRoom) {
        usersInRoom.delete(socket.id);
        socket.to(currentRoom).emit('userLeft', { id: socket.id, username });
        
        if (usersInRoom.size === 0) {
          activeUsers.delete(currentRoom);
          setTimeout(() => {
            const stillEmpty = !activeUsers.has(currentRoom!) || activeUsers.get(currentRoom!)!.size === 0;
            if (stillEmpty && currentRoom) {
              roomStates.delete(currentRoom);
            }
          }, 60 * 60 * 1000);
        }
      }
      
      console.log(`${username} left room ${currentRoom}`);
      currentRoom = null;
    }
  });
  socket.on('cursorMove', (cursor: { line: number; column: number }) => {
    if (currentRoom) {
      const usersInRoom = activeUsers.get(currentRoom);
      if (usersInRoom && usersInRoom.has(socket.id)) {
        const user = usersInRoom.get(socket.id)!;
        user.cursor = cursor;
        user.lastActivity = Date.now();
        
        socket.to(currentRoom).emit('cursorUpdate', {
          id: socket.id,
          username,
          color: user.color,
          cursor
        });
      }
    }
  });
  socket.on('selectionChange', (selection: { start: { line: number; column: number }; end: { line: number; column: number } }) => {
    if (currentRoom) {
      const usersInRoom = activeUsers.get(currentRoom);
      if (usersInRoom && usersInRoom.has(socket.id)) {
        const user = usersInRoom.get(socket.id)!;
        
        socket.to(currentRoom).emit('selectionUpdate', {
          id: socket.id,
          username,
          color: user.color,
          selection
        });
      }
    }
  });
  socket.on('typing', (isTyping: boolean) => {
    if (currentRoom) {
      const usersInRoom = activeUsers.get(currentRoom);
      if (usersInRoom && usersInRoom.has(socket.id)) {
        const user = usersInRoom.get(socket.id)!;
        user.isTyping = isTyping;
        user.lastActivity = Date.now();
        
        socket.to(currentRoom).emit('userTyping', {
          id: socket.id,
          username,
          color: user.color,
          isTyping
        });
        const typingKey = `${currentRoom}_${socket.id}`;
        if (typingTimeouts.has(typingKey)) {
          clearTimeout(typingTimeouts.get(typingKey)!);
        }
        if (isTyping) {
          const timeout = setTimeout(() => {
            if (usersInRoom.has(socket.id)) {
              const u = usersInRoom.get(socket.id)!;
              u.isTyping = false;
              socket.to(currentRoom!).emit('userTyping', {
                id: socket.id,
                username,
                color: u.color,
                isTyping: false
              });
            }
            typingTimeouts.delete(typingKey);
          }, 3000);
          typingTimeouts.set(typingKey, timeout);
        }
      }
    }
  });
  socket.on('syncCode', (data: { code: string; cursorPosition?: number }) => {
    if (currentRoom) {
      const currentState = roomStates.get(currentRoom);
      const newVersion = (currentState?.version || 0) + 1;
      
      roomStates.set(currentRoom, {
        code: data.code,
        lastUpdate: Date.now(),
        version: newVersion
      });
      socket.to(currentRoom).emit('codeSync', {
        id: socket.id,
        username,
        code: data.code,
        version: newVersion,
        timestamp: Date.now()
      });
    }
  });
  socket.on('codeChange', (change: { from: number; to: number; text: string; fullCode?: string }) => {
    if (currentRoom) {
      if (change.fullCode !== undefined) {
        const currentState = roomStates.get(currentRoom);
        const newVersion = (currentState?.version || 0) + 1;
        roomStates.set(currentRoom, {
          code: change.fullCode,
          lastUpdate: Date.now(),
          version: newVersion
        });
      }
      
      socket.to(currentRoom).emit('codeChange', {
        id: socket.id,
        username,
        change
      });
    }
  });
  socket.on('requestState', () => {
    if (currentRoom) {
      const roomState = roomStates.get(currentRoom);
      if (roomState) {
        socket.emit('syncCode', {
          code: roomState.code,
          version: roomState.version
        });
      }
    }
  });
  socket.on('query', async (sql: string, callback) => {
    try {
      const result = await db.query(sql);
      callback(result);
      if (currentRoom && result.success) {
        socket.to(currentRoom).emit('queryResult', {
          id: socket.id,
          username,
          sql,
          result,
          timestamp: Date.now()
        });
      }
    } catch (error: any) {
      callback({
        success: false,
        error: error.message,
        executionTime: 0
      });
    }
  });
  socket.on('queryMultiple', async (sql: string, callback) => {
    try {
      const results = await db.queryMultiple(sql);
      callback(results);
      if (currentRoom) {
        socket.to(currentRoom).emit('queryResults', {
          id: socket.id,
          username,
          sql,
          results,
          timestamp: Date.now()
        });
      }
    } catch (error: any) {
      callback([{
        success: false,
        error: error.message,
        executionTime: 0
      }]);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    if (currentRoom) {
      const usersInRoom = activeUsers.get(currentRoom);
      if (usersInRoom) {
        usersInRoom.delete(socket.id);
        socket.to(currentRoom).emit('userLeft', { id: socket.id, username });
        
        if (usersInRoom.size === 0) {
          activeUsers.delete(currentRoom);
        }
      }
    }
  });
});
const HOST = process.env.HOST || '0.0.0.0';
const tcpServer = net.createServer((socket) => {
  console.log('TCP client connected:', socket.remoteAddress);
  
  let sessionId: string | null = null;
  let currentDatabase: string | null = null;
  sendTcpResponse(socket, { success: true, message: 'MYCSC Server v1.0.0' });
  
  let buffer = Buffer.alloc(0);
  
  socket.on('data', async (data) => {
    buffer = Buffer.concat([buffer, data]);
    while (buffer.length >= 4) {
      const messageLength = buffer.readUInt32BE(0);
      
      if (buffer.length < 4 + messageLength) {
        break;
      }
      
      const messageData = buffer.slice(4, 4 + messageLength).toString('utf-8');
      buffer = buffer.slice(4 + messageLength);
      
      try {
        const request = JSON.parse(messageData);
        const response = await handleTcpRequest(request, sessionId, currentDatabase);
        if (response.sessionId) sessionId = response.sessionId;
        if (response.database) currentDatabase = response.database;
        
        sendTcpResponse(socket, response);
      } catch (error: any) {
        sendTcpResponse(socket, { success: false, error: error.message });
      }
    }
  });
  
  socket.on('close', () => {
    console.log('TCP client disconnected');
    if (sessionId) {
      auth.logout(sessionId);
    }
  });
  
  socket.on('error', (err) => {
    console.error('TCP socket error:', err);
  });
});

function sendTcpResponse(socket: net.Socket, data: any): void {
  const message = JSON.stringify(data);
  const buffer = Buffer.alloc(4 + Buffer.byteLength(message, 'utf-8'));
  buffer.writeUInt32BE(Buffer.byteLength(message, 'utf-8'), 0);
  buffer.write(message, 4, 'utf-8');
  socket.write(buffer);
}

async function handleTcpRequest(
  request: any, 
  sessionId: string | null, 
  currentDatabase: string | null
): Promise<any> {
  const { type, action } = request;
  
  switch (type) {
    case 'auth':
      if (action === 'login') {
        try {
          const session = await auth.login(request.username, request.password);
          return { success: true, sessionId: session.token, session_id: session.token };
        } catch (e: any) {
          return { success: false, error: e.message };
        }
      } else if (action === 'register') {
        try {
          await auth.createUser(request.username, request.password, request.role || 'user');
          return { success: true };
        } catch (e: any) {
          return { success: false, error: e.message };
        }
      }
      break;
      
    case 'logout':
      if (sessionId) {
        auth.logout(sessionId);
      }
      return { success: true };
      
    case 'query':
      try {
        const query = request.query?.trim();
        if (query?.toUpperCase().startsWith('USE ')) {
          const dbName = query.slice(4).trim().replace(/;$/, '');
          return { success: true, message: `Database changed to ${dbName}`, database: dbName };
        }
        
        const result = await db.query(request.query);
        return { 
          success: result.success, 
          rows: result.rows || [],
          columns: result.columns || [],
          affected_rows: result.affectedRows || 0,
          last_insert_id: result.insertId,
          message: result.success ? 'OK' : result.error,
          error: result.error
        };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
      
    default:
      return { success: false, error: `Unknown request type: ${type}` };
  }
  
  return { success: false, error: 'Invalid request' };
}

tcpServer.listen(TCP_PORT, HOST, () => {
  console.log(`[MYCSC] TCP Server listening on ${HOST}:${TCP_PORT}`);
});

httpServer.listen(PORT, HOST, () => {
  if (NODE_ENV === 'production') {
    console.log(`
г==========================================================¬
¦   MYCSC Database Server - Production Mode                ¦
¦==========================================================¦
¦   ?? HTTP: http://${HOST}:${PORT}                        
¦   ?? TCP:  ${HOST}:${TCP_PORT}                           
¦   ?? Data: ${DATA_DIR}
¦   ?? DB:   ${db.getCurrentDatabase()}                    
L==========================================================-
    `);
  } else {
    console.log(`
г==========================================================¬
¦                                                          ¦
¦   ---¬   ---¬--¬   --¬ ------¬-------¬ ------¬          ¦
¦   ----¬ ----¦L--¬ --г---г====---г====---г====-          ¦
¦   --г----г--¦ L----г- --¦     -------¬--¦               ¦
¦   --¦L--г---¦  L--г-  --¦     L====--¦--¦               ¦
¦   --¦ L=- --¦   --¦   L------¬-------¦L------¬          ¦
¦   L=-     L=-   L=-    L=====-L======- L=====-          ¦
¦                                                          ¦
¦   Database Constructor - Development Server              ¦
¦                                                          ¦
¦==========================================================¦
¦                                                          ¦
¦   ?? HTTP Server: http://localhost:${PORT}               
¦   ?? TCP Server:  localhost:${TCP_PORT} (Python clients) 
¦   ?? Data directory: ${DATA_DIR}
¦   ?? Database: ${db.getCurrentDatabase()}                
¦                                                          ¦
L==========================================================-
    `);
  }
});

export { app, httpServer };
