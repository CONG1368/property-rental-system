import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireRole.js';
import { requireConfirmPassword } from '../middleware/confirm-password.js';
import { auditLog } from '../middleware/audit-log.js';
import { sequelize } from '../config/database.js';
import SystemConfig from '../models/SystemConfig.js';
import User from '../models/User.js';
import { scheduler } from '../jobs/scheduler.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = Router();

const APP_NAME = '物业租赁综合管理系统';

// 从根 package.json 读取版本（定位到项目根，而非 process.cwd() 可能指向 backend/）
function readVersion(): string {
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    // backend/src/routes -> 上三级到项目根
    const root = path.resolve(__dirname, '../../..');
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
    return pkg.version || '未知';
  } catch { return '未知'; }
}

// GET /system-ops/info — 系统信息
router.get('/info', requireAdmin, async (_req: AuthRequest, res) => {
  try {
    let dbDialect = 'memory';
    let dbStorage = '';
    try {
      await sequelize.authenticate();
      dbDialect = sequelize.getDialect();
      if (dbDialect === 'sqlite') {
        const cfg: any = (sequelize as any).options.storage || '';
        // 仅暴露文件名，避免泄露服务器绝对路径
        dbStorage = cfg ? cfg.replace(/\\/g, '/').split('/').pop() : '';
      }
    } catch (e: any) { dbDialect = 'error: ' + (e?.message || ''); }
    const userCount = await User.count();
    const data = {
      appName: APP_NAME,
      version: readVersion(),
      nodeVersion: process.version,
      platform: process.platform + ' ' + process.arch,
      uptimeSeconds: Math.floor(process.uptime()),
      dbDialect,
      dbStorage,
      userCount,
      redisEnabled: !!process.env.REDIS_ENABLED && process.env.REDIS_ENABLED !== 'false',
      memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
      startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
    };
    res.json({ code: 200, data });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// GET /system-ops/cron — cron 任务真实状态（任务清单 + 最近一次执行结果）
// 注意：started 取自调度器实际状态，不是"函数存在与否"——后者永远为 true，会谎报在跑
router.get('/cron', requireAdmin, async (_req: AuthRequest, res) => {
  res.json({
    code: 200,
    data: {
      list: scheduler.list(),
      started: scheduler.isStarted(),
      envEnabled: String(process.env.CRON_ENABLED ?? 'true').toLowerCase() !== 'false',
    },
  });
});

// POST /system-ops/cron/run/:key — 手动触发单个定时任务（与定时执行共用同一份逻辑）
router.post('/cron/run/:key', auditLog('系统运维', '手动触发定时任务'), requireAdmin, async (req: AuthRequest, res) => {
  try {
    const key = String(req.params.key || '');
    if (!scheduler.list().some((t) => t.key === key)) {
      return res.status(404).json({ code: 404, message: '未知的定时任务: ' + key });
    }
    const record = await scheduler.runTask(key, 'manual');
    if (!record.ok) return res.status(500).json({ code: 500, message: '任务执行失败: ' + record.detail, data: record });
    res.json({ code: 200, data: record, message: '执行完成：' + record.detail });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// POST /system-ops/cron/toggle — 运行时启停调度器（二次确认）
router.post('/cron/toggle', auditLog('系统运维', '切换定时任务调度器'), requireAdmin, requireConfirmPassword('切换定时任务调度器'), async (req: AuthRequest, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') return res.status(400).json({ code: 400, message: 'enabled 必须为布尔值' });
    if (enabled) scheduler.start(); else scheduler.stop();
    res.json({ code: 200, data: { started: scheduler.isStarted() }, message: enabled ? '调度器已启动' : '调度器已停止' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// GET /system-ops/audit-toggle — 审计开关
router.get('/audit-toggle', requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const row = await SystemConfig.findOne({ where: { configKey: 'audit_enabled' } });
    res.json({ code: 200, data: { enabled: row ? row.configValue !== 'false' : true } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// POST /system-ops/audit-toggle — 切换审计开关（二次确认）
router.post('/audit-toggle', auditLog('系统运维', '切换审计开关'), requireAdmin, requireConfirmPassword('切换审计开关'), async (req: AuthRequest, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') return res.status(400).json({ code: 400, message: 'enabled 必须为布尔值' });
    await SystemConfig.upsert({ configKey: 'audit_enabled', configValue: String(enabled), description: '是否记录操作审计日志' } as any);
    res.json({ code: 200, data: { enabled }, message: enabled ? '审计日志已开启' : '审计日志已关闭' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// GET /system-ops/backup — 数据库备份下载（仅 SQLite；需二次确认）
router.get('/backup', requireAdmin, requireConfirmPassword('下载数据库备份'), async (_req: AuthRequest, res) => {
  try {
    const dialect = sequelize.getDialect();
    if (dialect !== 'sqlite') return res.status(400).json({ code: 400, message: '仅支持 SQLite 数据库备份下载' });
    const storage: any = (sequelize as any).options.storage || 'data/database.sqlite';
    if (!fs.existsSync(storage)) return res.status(404).json({ code: 404, message: '数据库文件不存在: ' + storage });
    const stat = fs.statSync(storage);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename=database_backup_' + new Date().toISOString().slice(0, 10) + '.sqlite');
    res.setHeader('Content-Length', stat.size);
    fs.createReadStream(storage).pipe(res);
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
