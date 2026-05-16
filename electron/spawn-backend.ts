import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

let backendProcess: ChildProcess | null = null;

export function spawnBackend(): Promise<void> {
  return new Promise((resolve, reject) => {
    const isPackaged = app.isPackaged;

    // --- 目录判定 ---
    const backendDir = isPackaged
      ? path.join(process.resourcesPath, 'backend')
      : path.join(__dirname, '../../backend');

    const backendEntry = path.join(backendDir, 'dist/index.js');

    // --- 便携 Node.js 路径 ---
    const nodeExe = isPackaged
      ? path.join(process.resourcesPath, 'runtime/node/node.exe')
      : 'node';

    if (!fs.existsSync(backendEntry)) {
      reject(new Error(`Backend entry not found: ${backendEntry}`));
      return;
    }

    if (isPackaged && !fs.existsSync(nodeExe)) {
      reject(new Error(`Node executable not found: ${nodeExe}`));
      return;
    }

    // --- 用户数据目录（生产模式使用 %APPDATA%） ---
    const userDataDir = isPackaged
      ? app.getPath('userData')
      : backendDir;

    const dataDir = path.join(userDataDir, 'data');
    const uploadsDir = path.join(userDataDir, 'uploads');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    // --- 启动后端 ---
    console.log(`[Backend] Starting: ${nodeExe} ${backendEntry}`);
    console.log(`[Backend] Data dir: ${dataDir}`);

    backendProcess = spawn(nodeExe, [backendEntry], {
      cwd: backendDir,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: '3001',
        DB_DIALECT: 'sqlite',
        DB_STORAGE: path.join(dataDir, 'database.sqlite'),
        REDIS_ENABLED: 'false',
        UPLOAD_DIR: uploadsDir,
        JWT_SECRET: process.env.JWT_SECRET || 'property-rental-jwt-secret-key-2026',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let resolved = false;

    backendProcess.stdout?.on('data', (data: Buffer) => {
      const msg = data.toString().trim();
      console.log('[Backend]', msg);
      if (!resolved && msg.includes('Server running')) {
        resolved = true;
        resolve();
      }
    });

    backendProcess.stderr?.on('data', (data: Buffer) => {
      console.error('[Backend Error]', data.toString().trim());
    });

    backendProcess.on('error', (err) => {
      if (!resolved) { resolved = true; reject(err); }
    });

    backendProcess.on('close', (code) => {
      if (!resolved) { resolved = true; reject(new Error(`Backend exited with code ${code}`)); }
    });

    setTimeout(() => {
      if (!resolved) { resolved = true; resolve(); }
    }, 8000);
  });
}

export function stopBackend() {
  if (backendProcess) {
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
}
