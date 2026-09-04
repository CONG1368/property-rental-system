import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getBackendStatus: () => ipcRenderer.invoke('get-backend-status'),
  getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),
  openFileDialog: (options: any) => ipcRenderer.invoke('open-file-dialog', options),
  saveFileDialog: (options: any) => ipcRenderer.invoke('save-file-dialog', options),
  printHTML: (html: string, title: string) => ipcRenderer.invoke('print-html', html, title),
  exportPDF: (html: string, title: string) => ipcRenderer.invoke('export-pdf', html, title),
  saveFile: (options: any) => ipcRenderer.invoke('save-file-dialog', options),
  readIdCard: (provider: string, port: string) => ipcRenderer.invoke('read-id-card', provider, port),
  openPlatformLogin: () => ipcRenderer.invoke('open-platform-login'),
  getMeterTokenStatus: () => ipcRenderer.invoke('get-meter-token-status'),
  stopMeterSync: () => ipcRenderer.invoke('stop-meter-sync'),
  onSmartMeterEvent: (callback: (payload: any) => void) => { ipcRenderer.on('smart-meter', (_event, p: any) => callback(p)); },
  onMenuNavigate: (callback: (path: string) => void) => {
    ipcRenderer.on('navigate', (_event, path: string) => callback(path));
  },
});
