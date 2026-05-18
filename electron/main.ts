import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
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

// 后端状态（由 spawnBackend 和健康检查更新）
let backendReady = false;

// IPC 处理器
ipcMain.handle('get-app-version', () => app.getVersion());

// 真实后端状态检测 — 通过 HTTP 健康检查确认后端是否就绪
ipcMain.handle('get-backend-status', async () => {
  try {
    const resp = await fetch('http://localhost:3001/api/health');
    backendReady = resp.ok;
    return backendReady;
  } catch {
    backendReady = false;
    return false;
  }
});

ipcMain.handle('get-backend-url', () => 'http://localhost:3001');

// 文件保存对话框
ipcMain.handle('save-file-dialog', async (_event, options: any) => {
  const result = await dialog.showSaveDialog(mainWindow!, options);
  return result;
});

// 文件打开对话框
ipcMain.handle('open-file-dialog', async (_event, options: any) => {
  const result = await dialog.showOpenDialog(mainWindow!, options);
  return result;
});

// HTML 原生打印（临时文件渲染 → 弹出系统打印对话框）
ipcMain.handle('print-html', async (_event, html: string, title: string) => {
  return new Promise((resolve) => {
    // 写入临时 HTML 文件（避免 data: URL 的长度限制和编码问题）
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'property-print-'));
    const tmpFile = path.join(tmpDir, `${title.replace(/[\\/:*?"<>|]/g, '_')}.html`);
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  body { font-family: "Microsoft YaHei","SimHei","PingFang SC",sans-serif; color:#333; margin:0; padding:16px; }
  img { max-width:100%; }
</style></head><body>${html}</body></html>`;
    fs.writeFileSync(tmpFile, fullHtml, 'utf-8');

    const printWin = new BrowserWindow({
      width: 800, height: 600, show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    printWin.loadFile(tmpFile).then(() => {
      printWin.webContents.print({
        silent: false,
        printBackground: true,
      }, (success, failureReason) => {
        printWin.close();
        // 清理临时文件
        try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* 忽略清理错误 */ }
        resolve({ success, failureReason });
      });
    }).catch((err) => {
      printWin.close();
      try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* ignore */ }
      resolve({ success: false, failureReason: err.message });
    });
  });
});

app.whenReady().then(async () => {
  buildMenu();
  try {
    await spawnBackend();
  } catch (err: any) {
    console.error('Failed to start backend:', err);
    // 硬错误弹窗提示（文件缺失、进程崩溃），超时错误不弹窗（登录页会显示等待状态）
    if (err.message?.includes('not found') || err.message?.includes('exited with code')) {
      dialog.showErrorBox(
        '服务启动失败',
        `后端服务未能正常启动。\n\n${err.message}\n\n请尝试重新安装应用程序。`
      );
    }
  }
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
