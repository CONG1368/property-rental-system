import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { spawnBackend } from './spawn-backend';
import { spawnMysql } from './spawn-mysql';
import { spawnRedis } from './spawn-redis';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1280,
    minHeight: 720,
    title: '物业租赁综合管理系统',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../frontend/dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    await spawnMysql();
    await spawnRedis();
    await spawnBackend();
  } catch (err) {
    console.error('Failed to start backend services:', err);
  }
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  // Backend and services are terminated via child_process kill on app quit
});
