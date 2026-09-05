import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawnBackend } from './spawn-backend';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileP = promisify(execFile);

// ===== 全局 EPIPE 防护 =====
// 应用常随终端/父进程管道一起启动时，父进程退出/管道关闭会让 console 写入抛 EPIPE，
// 若未捕获会以 Uncaught Exception 直接崩掉整个 Electron 主进程（生产真实故障）。
// 这里在进程级吞掉 stdout/stderr 的 EPIPE，同时给未包装的 console.log 加保险。
for (const stream of [process.stdout, process.stderr]) {
  stream.on('error', (err: any) => {
    if (err && err.code === 'EPIPE') { /* 管道已关，静默忽略 */ }
    else { /* 其它写错误也一并吞掉，避免崩主进程 */ }
  });
}

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

	// 真实后端状态检测 — 通过 HTTP 健康检查确认后端是否就绪（含种子数据状态）
	ipcMain.handle('get-backend-status', async () => {
	  try {
	    const resp = await fetch('http://localhost:3001/api/health');
	    if (!resp.ok) { backendReady = false; return { ok: false, seedReady: false }; }
	    const body = await resp.json();
	    backendReady = true;
	    return { ok: true, seedReady: body?.data?.seedReady ?? false };
	  } catch {
	    backendReady = false;
	    return { ok: false, seedReady: false };
	  }
	});

ipcMain.handle('get-backend-url', () => 'http://localhost:3001');

// 文件保存对话框
ipcMain.handle('save-file-dialog', async (_event, options: any) => {
  const result = await dialog.showSaveDialog(mainWindow!, options);
  return result;
});

// 身份证读卡器（调用 DLL SDK）— 当前返回提示，实际 SDK 接入时替换此实现
ipcMain.handle('read-id-card', async (_event, provider: string, port: string) => {
  // TODO: 通过 node-ffi 或 child_process 调用品牌 DLL SDK
  // provider: '华视' | '新中新' | '普天' | '精伦' | '中控'
  // 当前返回错误提示，Mock 模式请通过后端 API /api/id-card-readers/:id/read 测试
  return { success: false, error: '请连接实体读卡器设备或使用后端 Mock 模式测试' };
});

// ===== 华视读卡器内核驱动：检测 + 一键安装（Win10 x64 用官方 WHQL 签名 64 位驱动） =====
// 驱动包随应用分发在 runtime/idcard-driver/（electron-builder extraResources）：
//   USBDrvCo.inf + USBDrv.sys(64位) + sdt_s_drv_x64.cat(WHQL签名) + samcoins.dll + USBDrv3.0-x64.msi(备用)
// 内核驱动不能“复制即用”，须经 pnputil 加入系统驱动仓库并由管理员(UAC)授权绑定设备。
function idcardDriverDir(): string {
  const execDir = path.dirname(process.execPath);
  const cands = [
    path.join(execDir, 'runtime', 'idcard-driver'),        // 打包：<resources>/runtime/idcard-driver
    path.join(process.cwd(), 'runtime', 'idcard-driver'),  // dev：仓库根
    path.join(process.cwd(), '..', 'runtime', 'idcard-driver'),
  ];
  for (const c of cands) { if (fs.existsSync(c)) return c; }
  return cands[0];
}

function psSingleQuote(p: string): string { return "'" + String(p).replace(/'/g, "''") + "'"; }

// 检测：①驱动包是否已进系统驱动仓库（pnputil /enum-drivers）②设备是否枚举到（VID_0400 SDT 设备）
async function probeIdcardDriver(): Promise<{ installed: boolean; devicePresent: boolean; detail: string }> {
  let pkg = false; let dev = false; let detail = '';
  try {
    const { stdout } = await execFileP('pnputil', ['/enum-drivers'], { windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
    pkg = /SDT|USBDrv|VID_0400/i.test(stdout || '');
    detail += '驱动包:' + (pkg ? '已安装' : '未安装');
  } catch { detail += '驱动包:枚举失败'; }
  try {
    const { stdout } = await execFileP('powershell', ['-NoProfile', '-Command',
      "Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue | Where-Object { $_.InstanceId -match 'VID_0400' -or $_.FriendlyName -match 'SDT' } | Select-Object -First 1 -ExpandProperty FriendlyName"],
      { windowsHide: true, maxBuffer: 1024 * 1024 });
    dev = /SDT|VID_0400/i.test(stdout || '');
    detail += (detail ? '；' : '') + '设备:' + (dev ? '已枚举' : '未枚举（未插设备或无驱动）');
  } catch { detail += (detail ? '；' : '') + '设备:枚举失败'; }
  return { installed: pkg && dev, devicePresent: dev, detail };
}

ipcMain.handle('get-id-card-driver-status', async () => {
  const dir = idcardDriverDir();
  const inf = path.join(dir, 'USBDrvCo.inf');
  const bundled = fs.existsSync(inf) && fs.existsSync(path.join(dir, 'USBDrv.sys')) && fs.existsSync(path.join(dir, 'sdt_s_drv_x64.cat'));
  try {
    const st = bundled ? await probeIdcardDriver() : { installed: false, devicePresent: false, detail: '未找到内置驱动包' };
    return { bundled, driverDir: dir, infPath: inf, ...st };
  } catch (e: any) {
    return { bundled, driverDir: dir, infPath: inf, installed: false, devicePresent: false, detail: String(e?.message || e) };
  }
});

ipcMain.handle('install-id-card-driver', async () => {
  const dir = idcardDriverDir();
  const inf = path.join(dir, 'USBDrvCo.inf');
  if (!fs.existsSync(inf)) return { ok: false, message: '未找到内置驱动包 USBDrvCo.inf（' + inf + '）' };
  // 组装 pnputil 参数（inf 路径可能含空格，需带引号）；提权运行触发 UAC 授权，取消会抛“操作被用户取消”
  const argStr = '/add-driver "' + inf + '" /install';
  const psCmd =
    '$argStr = ' + psSingleQuote(argStr) + '; ' +
    'Start-Sleep -Milliseconds 200; ' +
    "$p = Start-Process -FilePath 'pnputil.exe' -ArgumentList $argStr -Verb RunAs -Wait -PassThru; " +
    'Write-Output ("exitcode=" + $p.ExitCode)'
  try {
    const { stdout } = await execFileP('powershell', ['-NoProfile', '-Command', psCmd], { windowsHide: true, maxBuffer: 8 * 1024 * 1024, timeout: 120000 });
    const m = /exitcode=([0-9]+)/.exec(stdout || '');
    const code = m ? Number(m[1]) : null;
    // 安装后重新探测一次，返回是否已就绪
    let status = { installed: false, devicePresent: false, detail: '' };
    try { status = await probeIdcardDriver(); } catch { /* ignore */ }
    return { ok: code === 0, exitCode: code, message: stdout || '', ready: status.installed, detail: status.detail };
  } catch (e: any) {
    const msg = String(e?.message || e);
    // UAC 取消/拒绝：Start-Process 抛“The operation was canceled by the user”
    if (/canceled|取消|denied|拒绝/i.test(msg)) return { ok: false, message: '已取消安装（未通过管理员授权）。请在弹窗中点“是”完成驱动安装。' };
    return { ok: false, message: msg };
  }
});

// 文件打开对话框
ipcMain.handle('open-file-dialog', async (_event, options: any) => {
  const result = await dialog.showOpenDialog(mainWindow!, options);
  return result;
});

// 文字PDF导出（Electron printToPDF → 真正的文字PDF，非截图）
ipcMain.handle('export-pdf', async (_event, html: string, title: string) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'property-export-'));
  const tmpFile = path.join(tmpDir, `${title.replace(/[\\/:*?"<>|]/g, '_')}.html`);
  // 直接写入完整HTML文档（含合同模板的 <!DOCTYPE html><style>@page...），不额外包裹
  fs.writeFileSync(tmpFile, html, 'utf-8');

  const exportWin = new BrowserWindow({
    width: 860, height: 600, show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  try {
    await exportWin.loadFile(tmpFile);
    const data = await exportWin.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
    });

    const result = await dialog.showSaveDialog(mainWindow!, {
      title: '导出文字PDF',
      defaultPath: `${title}.pdf`,
      filters: [{ name: 'PDF文件', extensions: ['pdf'] }],
    });

    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, data);
    }

    exportWin.close();
    try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* ignore */ }
    return { success: true, filePath: result.canceled ? null : result.filePath };
  } catch (err: any) {
    exportWin.close();
    try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* ignore */ }
    return { success: false, error: err.message };
  }
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


// ===== 智能水电表：平台登录窗口 token 捕获 + 会话窗口内自动同步 =====
const METER_PLATFORM_URL = 'https://bzp.iyunmu.com/index';
const METER_API_BASE = 'https://bzp.iyunmu.com/prepaidBack';
const smartMeterState = {
  token: '', cookie: '', exp: 0, sysToken: '', window: null as BrowserWindow | null,
  timer: null as any, syncTimer: null as any, syncEveryMs: 10 * 60 * 1000,
};

function decodeJwtExp(t: string): number {
  try {
    const p = t.split('.')[1]; if (!p) return 0;
    let b = p.replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4) b += '=';
    const payload = JSON.parse(Buffer.from(b, 'base64').toString('utf8'));
    return Number(payload?.exp) || 0;
  } catch { return 0; }
}

async function syncSmartMeterOnce() {
  if (!smartMeterState.token) return { ok: false, error: 'no-token' };
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    // 同步接口挂在系统 authMiddleware 下，必须携带系统登录态（Access Token），否则后端返回 401「未登录或Token已过期」
    if (smartMeterState.sysToken) headers['Authorization'] = 'Bearer ' + smartMeterState.sysToken;
    const r = await fetch('http://localhost:3001/api/smart-meter/sync', {
      method: 'POST', headers,
      body: JSON.stringify({ token: smartMeterState.token, cookie: smartMeterState.cookie }),
    });
    const j = await r.json();
    if (r.status === 401 || j?.code === 401) { stopSmartMeterSync(); mainWindow?.webContents.send('smart-meter', { event: 'token-invalid', message: j?.message }); }
    else mainWindow?.webContents.send('smart-meter', { event: 'synced', data: j?.data, message: j?.message });
    return j;
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}

function startSmartMeterSyncWindow() {
  stopSmartMeterSync();
  if (smartMeterState.timer) return;
  smartMeterState.syncTimer = setInterval(() => { syncSmartMeterOnce(); }, smartMeterState.syncEveryMs);
  // 登录后立即同步一次
  syncSmartMeterOnce();
}

function stopSmartMeterSync() {
  if (smartMeterState.syncTimer) { clearInterval(smartMeterState.syncTimer); smartMeterState.syncTimer = null; }
}

ipcMain.handle('open-platform-login', async (_event, sysToken?: string) => {
  // 渲染进程把系统登录态（Access Token）传进来，同步 POST 需要它通过后端 authMiddleware
  if (sysToken) smartMeterState.sysToken = sysToken;
  if (smartMeterState.window && !smartMeterState.window.isDestroyed()) { smartMeterState.window.focus(); return { status: 'already-open' }; }
  // 平台登录窗口使用「内存会话」分区（无 persist: 前缀=不落盘）：平台登录页自带的
  // 「记住密码」/cookie/localStorage 只存在内存，关闭应用即清空，绝不写入磁盘。
  // token 由同一会话的 webRequest 捕获并保存在主进程内存（smartMeterState），
  // 后端同步直接用该 token 调平台，不依赖此会话，因此内存分区不影响同步。
  const win = new BrowserWindow({ width: 1180, height: 760, title: '智能水电表 - 平台登录', webPreferences: { nodeIntegration: false, contextIsolation: true, partition: 'smart-meter-platform' } });
  smartMeterState.window = win;
  // 观察发往平台 API 的请求，捕获 Authorization Bearer token
  win.webContents.session.webRequest.onBeforeSendHeaders({ urls: [METER_API_BASE + '/*'] }, (details, cb) => {
    const auth = details.requestHeaders['Authorization'] || details.requestHeaders['authorization'];
    const cookie = details.requestHeaders['Cookie'] || details.requestHeaders['cookie'] || '';
    // 同时捕获会话 cookie（sessionid/csrftoken）——平台认证依赖 cookie，缺它必然 400「系统更新,请清缓存」
    if (cookie && smartMeterState.cookie !== cookie) {
      smartMeterState.cookie = cookie;
    }
    if (auth && auth.startsWith('Bearer ')) {
      const t = auth.slice(7);
      if (t && smartMeterState.token !== t) {
        smartMeterState.token = t;
        smartMeterState.exp = decodeJwtExp(t);
        startSmartMeterSyncWindow();
        mainWindow?.webContents.send('smart-meter', { event: 'token-captured', exp: smartMeterState.exp, cookieCaptured: !!smartMeterState.cookie });
      }
    }
    cb({ requestHeaders: details.requestHeaders });
  });
  await win.loadURL(METER_PLATFORM_URL);
  win.on('closed', () => { smartMeterState.window = null; });
  return { status: 'open' };
});

ipcMain.handle('get-meter-token-status', async () => {
  const nowSec = Math.floor(Date.now() / 1000);
  return { captured: !!smartMeterState.token, cookieCaptured: !!smartMeterState.cookie, tokenExpSec: smartMeterState.exp, expired: !!(smartMeterState.exp && smartMeterState.exp <= nowSec) };
});

ipcMain.handle('stop-meter-sync', async () => { stopSmartMeterSync(); return { status: 'stopped' }; });

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