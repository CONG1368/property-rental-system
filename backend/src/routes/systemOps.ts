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

// GET /system-ops/cron — cron 任务执行状态（静态描述 + 手动触发入口提示）
router.get('/cron', requireAdmin, async (_req: AuthRequest, res) => {
  const tasks = [
    { name: '账单生成', schedule: '每日 02:00', desc: '生成月租账单' },
    { name: '催缴升级', schedule: '每日 08:00', desc: '检查逾期生成催缴任务' },
    { name: '合同到期检查', schedule: '每日 07:00', desc: '标记到期提醒' },
    { name: '固定资产折旧', schedule: '每月 1 日 02:00', desc: '月度折旧计算' },
    { name: '物业自动化', schedule: '每日 09:00', desc: 'SLA升级/设备到期/合同到期' },
    { name: '月度经营简报', schedule: '每月 1 日 09:30', desc: '生成月度简报 PDF' },
    { name: '门锁密码清理', schedule: '每日 08:30', desc: '清理过期临时密码' },
  ];
  res.json({ code: 200, data: { list: tasks, started: typeof scheduler?.start === 'function' } });
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
