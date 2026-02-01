import { contextBridge, ipcRenderer, shell } from 'electron';
contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  platform: process.platform,
  openExternal: (url: string) => shell.openExternal(url),
  oauth: (provider: string, baseUrl: string) => ipcRenderer.invoke('auth:oauth', provider, baseUrl),
  apiRequest: (options: { url: string; method?: string; headers?: Record<string, string>; body?: string }) => 
    ipcRenderer.invoke('api:request', options)
});
contextBridge.exposeInMainWorld('novaDB', {
  query: (sql: string) => ipcRenderer.invoke('db:query', sql),
  queryMultiple: (sql: string) => ipcRenderer.invoke('db:queryMultiple', sql),
  getTables: () => ipcRenderer.invoke('db:getTables'),
  getTableSchema: (tableName: string) => ipcRenderer.invoke('db:getTableSchema', tableName),
  getCurrentDatabase: () => ipcRenderer.invoke('db:getCurrentDatabase'),
  getConfig: () => ipcRenderer.invoke('db:getConfig'),
  testConnection: (config: { host: string; port: number; timeout?: number }) => 
    ipcRenderer.invoke('db:testConnection', config),
  platform: process.platform,
  isElectron: true
});
