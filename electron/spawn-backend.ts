import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import { app } from 'electron';

let backendProcess: ChildProcess | null = null;

/** HTTP 健康检查轮询 — 确认后端端口已真正监听 */
function waitForHealth(maxAttempts = 30, intervalMs = 500): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      const req = http.get('http://localhost:3001/api/health', (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else if (attempts < maxAttempts) {
          setTimeout(check, intervalMs);
        } else {
          reject(new Error('Health check failed after max attempts'));
        }
      });
      req.on('error', () => {
        if (attempts < maxAttempts) {
          setTimeout(check, intervalMs);
        } else {
          reject(new Error('Backend not reachable after max attempts'));
        }
      });
      req.setTimeout(1000, () => {
        req.destroy();
        if (attempts < maxAttempts) {
          setTimeout(check, intervalMs);
        } else {
          reject(new Error('Health check timeout'));
        }
      });
    };
    check();
  });
}

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
    let stderrBuffer = '';

    // 并行双通道检测 — stdout 管道可能被 C 运行时缓冲，故同时启动健康检查轮询
    let healthCheckStarted = false;
    const startHealthPolling = () => {
      if (healthCheckStarted) return;
      healthCheckStarted = true;
      console.log('[Backend] Starting parallel health check polling...');
      waitForHealth().then(() => {
        if (!resolved) { resolved = true; resolve(); }
      }).catch((err) => {
        console.log('[Backend] Health check polling failed:', err.message);
      });
    };

    backendProcess.stdout?.on('data', (data: Buffer) => {
      const msg = data.toString().trim();
      console.log('[Backend]', msg);
      // 检测到关键启动信息后立即启动健康检查轮询
      if (!healthCheckStarted && (msg.includes('Server running') || msg.includes('[DB] Admin user ready') || msg.includes('Tables synced'))) {
        startHealthPolling();
      }
    });

    // 兜底：5 秒后若无 stdout 事件（缓冲导致），直接启动健康检查轮询
    const healthPollFallback = setTimeout(() => {
      if (!healthCheckStarted) {
        console.log('[Backend] No stdout detected in 5s — starting health check fallback');
        startHealthPolling();
      }
    }, 5000);

    backendProcess.stderr?.on('data', (data: Buffer) => {
      const msg = data.toString().trim();
      stderrBuffer += msg + '\n';
      console.error('[Backend Error]', msg);
    });

    backendProcess.on('error', (err) => {
      if (!resolved) { clearTimeout(healthPollFallback); resolved = true; reject(err); }
    });

    backendProcess.on('close', (code) => {
      if (!resolved) {
        clearTimeout(healthPollFallback);
        resolved = true;
        // 尝试读取后端启动日志文件
        let logContent = '';
        try {
          const logDir = path.join(userDataDir, 'logs');
          if (fs.existsSync(logDir)) {
            const files = fs.readdirSync(logDir)
              .filter(f => f.startsWith('startup-') && f.endsWith('.log'))
              .sort()
              .reverse();
            if (files.length > 0) {
              const logPath = path.join(logDir, files[0]);
              logContent = fs.readFileSync(logPath, 'utf-8').slice(-3000);
            }
          }
        } catch {}

        // 如果日志中没有错误信息，附加 stderr 最后部分
        const diagnostics = logContent || (stderrBuffer ? stderrBuffer.slice(-2000) : '');
        const baseMsg = `Backend exited with code ${code}`;
        reject(new Error(diagnostics ? `${baseMsg}\n\n诊断日志:\n${diagnostics}` : baseMsg));
      }
    });

    // 安全超时 — 30 秒后强制 resolve（首次安装需建库/迁移/同步30张表/种子数据）
    setTimeout(() => {
      if (!resolved) {
        console.log('[Backend] Safety timeout reached, backend may still be initializing');
        clearTimeout(healthPollFallback);
        resolved = true;
        resolve();
      }
    }, 30000);
  });
}

export function stopBackend() {
  if (backendProcess) {
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
}
