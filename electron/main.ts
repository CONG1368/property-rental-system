import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron';
import * as path from 'path';
import { spawnBackend } from './spawn-backend';

let mainWindow: BrowserWindow | null = null;

const isMac = process.platform === 'darwin';

// 中文菜单模板
function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    // macOS 应用菜单
    ...(isMac ? [{
      label: '物业租赁综合管理系统',
      submenu: [
        { label: '关于本系统', role: 'about' as const },
        { type: 'separator' as const },
        { label: '偏好设置...', accelerator: 'Cmd+,', click: () => mainWindow?.webContents.send('navigate', '/system/users') },
        { type: 'separator' as const },
        { label: '服务', role: 'services' as const },
        { type: 'separator' as const },
        { label: '隐藏', role: 'hide' as const },
        { label: '隐藏其他', role: 'hideOthers' as const },
        { label: '显示全部', role: 'unhide' as const },
        { type: 'separator' as const },
        { label: '退出', accelerator: 'Cmd+Q', role: 'quit' as const },
      ],
    }] : []),

    // 文件
    {
      label: '文件(&F)',
      submenu: [
        ...(isMac ? [
          { label: '关闭窗口', accelerator: 'Cmd+W', role: 'close' as const },
        ] : [
          { label: '设置', click: () => mainWindow?.webContents.send('navigate', '/system/users') },
          { type: 'separator' as const },
          { label: '退出(&X)', accelerator: 'Alt+F4', role: 'quit' as const },
        ]),
      ],
    },

    // 编辑
    {
      label: '编辑(&E)',
      submenu: [
        { label: '撤销(&U)', accelerator: 'Ctrl+Z', role: 'undo' as const },
        { label: '重做(&R)', accelerator: 'Ctrl+Shift+Z', role: 'redo' as const },
        { type: 'separator' as const },
        { label: '剪切(&T)', accelerator: 'Ctrl+X', role: 'cut' as const },
        { label: '复制(&C)', accelerator: 'Ctrl+C', role: 'copy' as const },
        { label: '粘贴(&P)', accelerator: 'Ctrl+V', role: 'paste' as const },
        { label: '全选(&A)', accelerator: 'Ctrl+A', role: 'selectAll' as const },
      ],
    },

    // 视图
    {
      label: '视图(&V)',
      submenu: [
        { label: '刷新(&R)', accelerator: 'Ctrl+R', role: 'reload' as const },
        { label: '强制刷新', accelerator: 'Ctrl+Shift+R', role: 'forceReload' as const },
        { type: 'separator' as const },
        { label: '放大(&I)', accelerator: 'Ctrl+=', role: 'zoomIn' as const },
        { label: '缩小(&O)', accelerator: 'Ctrl+-', role: 'zoomOut' as const },
        { label: '重置缩放', accelerator: 'Ctrl+0', role: 'resetZoom' as const },
        { type: 'separator' as const },
        { label: '全屏', accelerator: 'F11', role: 'togglefullscreen' as const },
        ...(!app.isPackaged ? [
          { type: 'separator' as const } as const,
          { label: '开发者工具(&D)', accelerator: 'Ctrl+Shift+I', role: 'toggleDevTools' as const },
        ] : []),
      ],
    },

    // 窗口
    {
      label: '窗口(&W)',
      submenu: [
        { label: '最小化(&M)', accelerator: 'Ctrl+M', role: 'minimize' as const },
        { label: '关闭(&C)', accelerator: 'Ctrl+W', role: 'close' as const },
      ],
    },

    // 帮助
    {
      label: '帮助(&H)',
      submenu: [
        {
          label: '关于(&A)',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: '关于 物业租赁综合管理系统',
              message: '物业租赁综合管理系统',
              detail: `版本: ${app.getVersion()}\n\n一站式物业租赁管理解决方案\n涵盖房源管理、租赁合同、账单催缴、财务管理等核心功能`,
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

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
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../frontend/dist/index.html'));
  }

  // 生产模式下禁止打开开发者工具（拦截 Ctrl+Shift+I 等所有入口）
  if (!isDev) {
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow?.webContents.closeDevTools();
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC 处理器
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('get-backend-status', () => true);

app.whenReady().then(async () => {
  buildMenu();
  try {
    await spawnBackend();
  } catch (err) {
    console.error('Failed to start backend:', err);
  }
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
