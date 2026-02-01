import { app, BrowserWindow, ipcMain, Menu, session } from 'electron';
import * as path from 'path';
import * as net from 'net';
import * as https from 'https';
import * as http from 'http';
import { MYCSC } from '../core';

let mainWindow: BrowserWindow | null = null;
let oauthWindow: BrowserWindow | null = null;
let db: MYCSC;
function getIconPath(): string {
  const isDev = !app.isPackaged;
  if (isDev) {
    return path.join(__dirname, '../../build/icon.png');
  } else {
    return path.join(process.resourcesPath, 'build/icon.png');
  }
}

async function createWindow(): Promise<void> {
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    icon: getIconPath(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1e1e2e',
    autoHideMenuBar: true,
    frame: true
  });
  const isDev = !app.isPackaged;
  
  if (isDev) {
    const ports = [3000, 3001, 5173];
    let loaded = false;
    for (const port of ports) {
      try {
        await mainWindow.loadURL(`http://localhost:${port}`);
        loaded = true;
        break;
      } catch {
        continue;
      }
    }
    if (!loaded) {
      mainWindow.loadURL('http://localhost:3000');
    }
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = path.join(__dirname, '../../renderer/index.html');
    console.log('[MYCSC] Loading index.html from:', indexPath);
    const fs = require('fs');
    if (!fs.existsSync(indexPath)) {
      console.error('[MYCSC] index.html not found at:', indexPath);
      const altPaths = [
        path.join(__dirname, '../renderer/index.html'),
        path.join(process.resourcesPath, 'renderer/index.html'),
        path.join(app.getAppPath(), 'dist/renderer/index.html')
      ];
      for (const altPath of altPaths) {
        console.log('[MYCSC] Trying:', altPath);
        if (fs.existsSync(altPath)) {
          mainWindow.loadFile(altPath);
          return;
        }
      }
    }
    
    mainWindow.loadFile(indexPath).catch(err => {
      console.error('[MYCSC] Failed to load index.html:', err);
      mainWindow?.loadURL(`data:text/html,<html><body style="background:#1e1e2e;color:#cdd6f4;font-family:sans-serif;padding:40px;"><h1>MYCSC Database</h1><p>Ошибка загрузки приложения</p><pre>${err.message}</pre><p>Path: ${indexPath}</p></body></html>`);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}
function initDatabase(): void {
  db = new MYCSC({
    dataDir: path.join(app.getPath('userData'), 'databases'),
    logLevel: 'info'
  });
}
function setupIPC(): void {
  ipcMain.handle('db:query', async (_, sql: string) => {
    try {
      const result = await db.query(sql);
      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        executionTime: 0
      };
    }
  });
  ipcMain.handle('db:queryMultiple', async (_, sql: string) => {
    try {
      const results = await db.queryMultiple(sql);
      return results;
    } catch (error: any) {
      return [{
        success: false,
        error: error.message,
        executionTime: 0
      }];
    }
  });
  ipcMain.handle('db:getTables', async () => {
    return db.getTables();
  });
  ipcMain.handle('db:getTableSchema', async (_, tableName: string) => {
    return db.getTableSchema(tableName);
  });
  ipcMain.handle('db:getCurrentDatabase', async () => {
    return db.getCurrentDatabase();
  });
  ipcMain.handle('db:getConfig', async () => {
    return db.getConfig();
  });
  ipcMain.handle('api:request', async (_, options: { 
    url: string; 
    method?: string; 
    headers?: Record<string, string>; 
    body?: string 
  }) => {
    return new Promise((resolve) => {
      try {
        const url = new URL(options.url);
        const isHttps = url.protocol === 'https:';
        const httpModule = isHttps ? https : http;
        
        const requestOptions = {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname + url.search,
          method: options.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...options.headers
          }
        };

        const req = httpModule.request(requestOptions, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              resolve({ success: true, data: JSON.parse(data), status: res.statusCode });
            } catch {
              resolve({ success: true, data: data, status: res.statusCode });
            }
          });
        });

        req.on('error', (err) => {
          console.error('[API Request Error]', err.message);
          resolve({ success: false, error: err.message });
        });

        req.setTimeout(10000, () => {
          req.destroy();
          resolve({ success: false, error: 'Request timeout' });
        });

        if (options.body) {
          req.write(options.body);
        }
        req.end();
      } catch (err: any) {
        resolve({ success: false, error: err.message });
      }
    });
  });
  ipcMain.handle('db:testConnection', async (_, config: { host: string; port: number; timeout?: number }) => {
    return new Promise((resolve) => {
      const timeout = config.timeout || 5000;
      const socket = new net.Socket();
      let resolved = false;

      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
        }
      };

      socket.setTimeout(timeout);

      socket.on('connect', () => {
        cleanup();
        resolve({
          success: true,
          message: `Соединение с ${config.host}:${config.port} успешно установлено!`,
          latency: Date.now()
        });
      });

      socket.on('timeout', () => {
        cleanup();
        resolve({
          success: false,
          message: `Превышено время ожидания подключения к ${config.host}:${config.port}`
        });
      });

      socket.on('error', (err: NodeJS.ErrnoException) => {
        cleanup();
        let message = `Не удалось подключиться к ${config.host}:${config.port}`;
        
        if (err.code === 'ECONNREFUSED') {
          message = `Соединение отклонено. Убедитесь, что сервер MySQL запущен на ${config.host}:${config.port}`;
        } else if (err.code === 'ENOTFOUND') {
          message = `Хост ${config.host} не найден. Проверьте правильность адреса`;
        } else if (err.code === 'ETIMEDOUT') {
          message = `Превышено время ожидания при подключении к ${config.host}:${config.port}`;
        } else if (err.code === 'ENETUNREACH') {
          message = `Сеть недоступна. Проверьте подключение к интернету`;
        } else if (err.message) {
          message += `: ${err.message}`;
        }

        resolve({
          success: false,
          message,
          error: err.code
        });
      });

      try {
        socket.connect(config.port, config.host);
      } catch (err: any) {
        cleanup();
        resolve({
          success: false,
          message: `Ошибка при создании подключения: ${err.message}`
        });
      }
    });
  });
  ipcMain.handle('auth:oauth', async (_, provider: string, baseUrl: string) => {
    return new Promise((resolve, reject) => {
      if (oauthWindow) {
        oauthWindow.close();
        oauthWindow = null;
      }

      const authUrl = `${baseUrl}/api/auth/${provider}`;
      
      oauthWindow = new BrowserWindow({
        width: 600,
        height: 700,
        parent: mainWindow || undefined,
        modal: true,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        },
        autoHideMenuBar: true,
        title: `Вход через ${provider === 'google' ? 'Google' : 'GitHub'}`
      });

      oauthWindow.once('ready-to-show', () => {
        oauthWindow?.show();
      });
      oauthWindow.webContents.on('will-redirect', (event, url) => {
        handleOAuthCallback(url, resolve, reject);
      });

      oauthWindow.webContents.on('will-navigate', (event, url) => {
        handleOAuthCallback(url, resolve, reject);
      });
      oauthWindow.webContents.on('did-navigate', (event, url) => {
        handleOAuthCallback(url, resolve, reject);
      });

      oauthWindow.on('closed', () => {
        oauthWindow = null;
        resolve({ success: false, error: 'Окно авторизации закрыто' });
      });

      oauthWindow.loadURL(authUrl).catch(err => {
        console.error('OAuth window load error:', err);
        resolve({ success: false, error: 'Не удалось загрузить страницу авторизации' });
      });
    });
  });

  function handleOAuthCallback(url: string, resolve: Function, reject: Function) {
    try {
      const urlObj = new URL(url);
      const token = urlObj.searchParams.get('token');
      const error = urlObj.searchParams.get('error');

      if (error) {
        if (oauthWindow) {
          oauthWindow.close();
          oauthWindow = null;
        }
        resolve({ success: false, error: error });
        return;
      }

      if (token) {
        if (oauthWindow) {
          oauthWindow.close();
          oauthWindow = null;
        }
        resolve({ success: true, token: token });
        return;
      }
    } catch (e) {
    }
  }
}
app.whenReady().then(() => {
  initDatabase();
  setupIPC();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
