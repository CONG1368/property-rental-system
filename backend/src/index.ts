import app from './app.js';
import { config } from './config/index.js';
import { sequelize, connectDatabase, initAdminUser } from './config/database.js';
import { connectRedis } from './config/redis.js';
import { setupWebSocket } from './websocket/index.js';
import './models/index.js';
import http from 'http';

async function start() {
  // 1. 连接数据库（SQLite 零配置，MySQL 自动建库重试）
  await connectDatabase();

  // 2. 同步表结构
  await sequelize.sync();  // 自动建表（如已存在则跳过）
  console.log('[DB] Tables synced');

  // 3. 初始化管理员 + 种子数据（科目表 + 3年演示经营数据）
  await initAdminUser();
  const { seedChartOfAccounts, seedAllDemoData } = await import('./services/seed-data.js');
  await seedChartOfAccounts();
  await seedAllDemoData();

  // 4. Redis（可选，不可用时自动退化）
  await connectRedis();

  // 5. 启动 HTTP + WebSocket
  const server = http.createServer(app);
  setupWebSocket(server);

  server.listen(config.port, () => {
    console.log('');
    console.log('  ========================================');
    console.log(`   Server running on http://localhost:${config.port}`);
    console.log(`   Database: ${config.db.dialect === 'sqlite' ? 'SQLite (file)' : 'MySQL'}`);
    console.log(`   Redis:    ${config.redis.enabled ? 'enabled' : 'disabled'}`);
    console.log('   Login:    admin / admin123');
    console.log('  ========================================');
    console.log('');
  });
}

start().catch((err) => {
  console.error('');
  console.error('========================================');
  console.error('  Server failed to start');
  console.error('========================================');
  const code = (err as any).code;
  if (code === 'ECONNREFUSED') {
    console.error('  MySQL is not running.');
    console.error('  Start: net start MySQL80');
    console.error('  Or set DB_DIALECT=sqlite in .env for local dev');
  } else {
    console.error('  ' + err.message);
  }
  console.error('========================================');
  process.exit(1);
});
