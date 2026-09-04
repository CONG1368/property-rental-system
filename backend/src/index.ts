import app from './app.js';
import { config } from './config/index.js';
import { sequelize, connectDatabase, initAdminUser } from './config/database.js';
import { connectRedis } from './config/redis.js';
import { setupWebSocket } from './websocket/index.js';
import './models/index.js';
import http from 'http';
import fs from 'fs';
import path from 'path';

export let seedDataReady = false;

// ====== 文件日志系统 ======
// 启动时创建日志文件，Tea（分流）模式——同时输出到控制台和日志文件
let logStream: fs.WriteStream | null = null;
let logFilePath: string | null = null;
const originalConsole = { log: console.log, error: console.error, warn: console.warn };

function setupStartupLogging(): void {
  const logDir = path.resolve(
    path.dirname(config.db.storage || path.join(process.cwd(), 'data/database.sqlite')),
    '..',
    'logs'
  );
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // 清理旧启动日志（保留最近 10 个）
  try {
    const oldFiles = fs.readdirSync(logDir)
      .filter(f => f.startsWith('startup-') && f.endsWith('.log'))
      .sort()
      .reverse();
    for (let i = 10; i < oldFiles.length; i++) {
      fs.unlinkSync(path.join(logDir, oldFiles[i]));
    }
  } catch {}

  // 创建新日志文件
  const now = new Date();
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  logFilePath = path.join(logDir, `startup-${ts}.log`);
  logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

  // 写入文件头
  logStream.write(`=== 物业租赁综合管理系统 启动日志 ===\n`);
  logStream.write(`时间: ${now.toISOString()}\n`);
  logStream.write(`Node.js: ${process.version}\n`);
  logStream.write(`平台: ${process.platform} / ${process.arch}\n`);
  logStream.write(`工作目录: ${process.cwd()}\n`);
  logStream.write(`DB 路径: ${config.db.storage || 'N/A'}\n`);
  logStream.write(`Redis: ${config.redis.enabled ? 'enabled' : 'disabled'}\n`);
  logStream.write(`========================================\n\n`);

  // 重定向 console 到文件 + 控制台
  function teeLog(level: string, args: any[]) {
    const line = `[${level}] ${new Date().toISOString()} ${args.map(a => typeof a === 'string' ? a : JSON.stringify(a, null, 2)).join(' ')}\n`;
    try { logStream?.write(line); } catch {}
  }

  console.log = (...args: any[]) => { teeLog('LOG', args); originalConsole.log(...args); };
  console.error = (...args: any[]) => { teeLog('ERR', args); originalConsole.error(...args); };
  console.warn = (...args: any[]) => { teeLog('WRN', args); originalConsole.warn(...args); };
}

function flushAndCloseLog(): void {
  try {
    if (logStream) {
      logStream.write('\n=== 日志结束 ===\n');
      logStream.end();
    }
  } catch {}
}

// ====== 全局错误捕获 ======
function setupGlobalErrorHandlers(): void {
  process.on('uncaughtException', (err) => {
    originalConsole.error('[FATAL] 未捕获异常:', err.message);
    originalConsole.error(err.stack || '');
    try {
      if (logStream) {
        logStream.write(`\n[FATAL] 未捕获异常: ${err.message}\n${err.stack || ''}\n`);
        logStream.end();
      }
    } catch {}
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    originalConsole.error('[FATAL] 未处理的Promise拒绝:', reason);
    try {
      if (logStream) {
        logStream.write(`\n[FATAL] 未处理的Promise拒绝: ${reason}\n`);
      }
    } catch {}
    process.exit(1);
  });
}

async function start() {
  // Phase 0：启动日志
  setupStartupLogging();
  setupGlobalErrorHandlers();
  console.log('[Boot] 后端启动中…');

  // Phase 1：数据库连接 + Schema 迁移 + 建表 + 管理员
  await connectDatabase();

  // 先迁移已有表补充缺失列，再 sync 创建新表
  const { runAllMigrations } = await import('./config/migration.js');
  await runAllMigrations();

  await sequelize.sync();
  console.log('[DB] Tables synced');

  await initAdminUser();
  console.log('[DB] Admin user ready');

  // Phase 2：启动 HTTP 服务，让登录 API 立即可用
  const server = http.createServer(app);
  setupWebSocket(server);

  await new Promise<void>((resolve, reject) => {
    server.once('error', (err: NodeJS.ErrnoException) => {
      reject(err);
    });
    server.listen(config.port, () => {
      console.log('');
      console.log('  ========================================');
      console.log(`   Server running on http://localhost:${config.port}`);
      console.log(`   Database: ${config.db.dialect === 'sqlite' ? 'SQLite (file)' : 'MySQL'}`);
      console.log('   Login:    admin / admin123');
      console.log('  ========================================');
      console.log('');
      resolve();
    });
  });

  // Phase 3：后台初始化种子数据（幂等，已有数据自动跳过）
  console.log('[Seed] Starting background data initialization...');
  try {
    // 演示数据一次性初始化标记（system_configs.demo_seeded）：
    // 已初始化（含老库迁移补标）则不重种，避免「删掉的演示数据重启后复活」。
    const { getDemoSeedState, ensureSeedConfig, isDemoEnabled } = await import('./services/seed-status.js');
    await ensureSeedConfig();
    const { ensureIdCardConfig } = await import('./services/id-card-service.js');
    await ensureIdCardConfig();
    const { ensureMeterPlatformConfig } = await import('./services/meter-platform.js');
    await ensureMeterPlatformConfig();
    const demoState = await getDemoSeedState();
    const demoEnabled = await isDemoEnabled();
    const { seedChartOfAccounts, seedAllDemoData, seedDoorLocks, seedContractTemplates, seedIdCardReaders, seedFireSafety } = await import('./services/seed-data.js');
    // 功能性基线（始终幂等执行，缺了会补——系统正常运行必需）：科目 / 合同模板 / 字典 / 审批流
    await seedChartOfAccounts();
    await seedContractTemplates();
    if (demoEnabled) {
      // 演示内容（经营演示数据 / 门锁 / 消防 / 读卡器）——受 demo_enabled 与一次性标记管控
      if (demoState === 'run') {
        await seedAllDemoData();
      } else {
        console.log('[Seed] Demo seed skipped (state=' + demoState + ') — 演示数据已初始化，不再重建');
      }
      await seedDoorLocks();
      await seedIdCardReaders();
      await seedFireSafety();
    } else {
      console.log('[Seed] Demo content disabled (demo_enabled=0) — 跳过：经营演示数据 / 门锁 / 消防 / 读卡器');
    }
    // 业务枚举数据字典统一（幂等）
    const { seedBusinessDicts, seedDefaultFlows } = await import('./services/dict-seed.js');
    const dictCount = await seedBusinessDicts();
    const flowCount = await seedDefaultFlows();
    if (dictCount > 0) console.log('[Seed] Business dicts seeded:', dictCount);
    console.log('[Seed] All seed data ready');
  } catch (err: any) {
    console.error('[Seed] Data initialization error:', err.message);
    console.error('[Seed] Server is running — seed data will be retried on next restart');
  } finally {
    seedDataReady = true;
  }

  // Phase 3.5：定时任务调度器
  // 必须在种子数据之后启动——账单生成等任务依赖基础数据；
  // 默认开启，设 CRON_ENABLED=false 可关闭（运行中也可在「系统运维」页切换）
  const cronEnabled = String(process.env.CRON_ENABLED ?? 'true').toLowerCase() !== 'false';
  if (cronEnabled) {
    try {
      const { scheduler } = await import('./jobs/scheduler.js');
      scheduler.start();
    } catch (err: any) {
      console.error('[Cron] 调度器启动失败（不影响主服务）:', err.message);
    }
  } else {
    console.log('[Cron] 已按 CRON_ENABLED=false 跳过调度器启动');
  }

  // Phase 4：Redis（可选，失败自动退化）
  await connectRedis();
  console.log(`   Redis:    ${config.redis.enabled ? 'enabled' : 'disabled'}`);
}

start().catch((err) => {
  const code = (err as any).code;
  const dbPath = config.db.storage || 'N/A';

  console.error('');
  console.error('========================================');
  console.error('  服务启动失败');
  console.error('========================================');

  if (code === 'ECONNREFUSED') {
    console.error('  MySQL 未运行。');
    console.error('  启动: net start MySQL80');
    console.error('  或设置 DB_DIALECT=sqlite 使用 SQLite');
  } else if (code === 'EADDRINUSE') {
    console.error('  端口 ' + config.port + ' 已被占用。');
    console.error('  请关闭占用此端口的程序后重试。');
  } else {
    console.error('  错误: ' + (err as any).message);
    console.error('  Stack: ' + ((err as any).stack || 'N/A'));
  }

  // 诊断信息
  console.error('  --- 诊断信息 ---');
  console.error('  Node.js 版本: ' + process.version);
  console.error('  平台/架构: ' + process.platform + ' / ' + process.arch);
  console.error('  工作目录: ' + process.cwd());
  console.error('  DB 路径: ' + dbPath);
  try {
    if (dbPath && dbPath !== 'N/A' && fs.existsSync(dbPath)) {
      const stat = fs.statSync(dbPath);
      console.error('  DB 文件: 存在 (' + (stat.size / 1024).toFixed(1) + ' KB)');
    } else {
      console.error('  DB 文件: 不存在');
    }
  } catch {}

  console.error('========================================');

  flushAndCloseLog();
  process.exit(1);
});
