import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import SystemConfig from '../models/SystemConfig.js';
import { requireAdmin } from '../middleware/requireRole.js';
import { requireConfirmPassword } from '../middleware/confirm-password.js';
import { auditLog } from '../middleware/audit-log.js';

const router = Router();

// GET /api/system-configs/keys?keys=... — 批量查询配置值（只读，供所有登录用户打印/展示使用）
router.get('/keys', async (req: AuthRequest, res) => {
  try {
    const keysStr = req.query.keys as string;
    if (!keysStr) return res.json({ code: 200, data: [] });
    const keys = keysStr.split(',').map(k => k.trim()).filter(Boolean);
    const rows = await SystemConfig.findAll({ where: { configKey: keys }, raw: true });
    res.json({ code: 200, data: rows });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// GET /api/system-configs — 全量配置元数据（管理员，用于系统参数中心）
router.get('/', requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const rows = await SystemConfig.findAll({ order: [['configGroup', 'ASC'], ['configKey', 'ASC']], raw: true });
    res.json({ code: 200, data: { list: rows } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// PUT /api/system-configs/:key — 保存单个配置（管理员；涉及公司抬头/签章等敏感项，需二次确认）
router.put('/:key', auditLog('系统配置', '保存配置'), requireAdmin, requireConfirmPassword('修改系统配置'), async (req: AuthRequest, res) => {
  try {
    const { configValue, description, configGroup, valueType, isSensitive } = req.body;
    if (configValue === undefined) return res.status(400).json({ code: 400, message: 'configValue 不能为空' });
    const [row] = await SystemConfig.upsert({
      configKey: req.params.key,
      configValue: configValue ?? '',
      description: description || '',
      configGroup: configGroup || '其他',
      valueType: valueType || 'string',
      isSensitive: isSensitive === undefined ? false : !!isSensitive,
    } as any);
    res.json({ code: 200, data: row, message: '配置已保存' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// POST /api/system-configs/batch — 批量保存（管理员；二次确认）
router.post('/batch', auditLog('系统配置', '批量保存配置'), requireAdmin, requireConfirmPassword('修改系统配置'), async (req: AuthRequest, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ code: 400, message: 'items 必须为数组' });
    for (const it of items) {
      if (!it?.configKey) continue;
      await SystemConfig.upsert({
        configKey: it.configKey,
        configValue: it.configValue ?? '',
        description: it.description || '',
      } as any);
    }
    res.json({ code: 200, message: '已批量保存 ' + items.length + ' 项配置' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// POST /api/system-configs — 新增配置项（管理员；二次确认）
router.post('/', auditLog('系统配置', '新增配置'), requireAdmin, requireConfirmPassword('新增系统配置'), async (req: AuthRequest, res) => {
  try {
    const { configKey, configValue, description, configGroup, valueType, isSensitive } = req.body;
    if (!configKey) return res.status(400).json({ code: 400, message: 'configKey 不能为空' });
    const exists = await SystemConfig.findOne({ where: { configKey } });
    if (exists) return res.status(400).json({ code: 400, message: '配置项已存在' });
    const row = await SystemConfig.create({
      configKey, configValue: configValue ?? '', description: description || '',
      configGroup: configGroup || '其他', valueType: valueType || 'string',
      isSensitive: !!isSensitive, builtIn: false,
    } as any);
    res.json({ code: 200, data: row, message: '配置项已新增' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// DELETE /api/system-configs/:key — 删除配置项（管理员；二次确认；内置项禁止删除）
router.delete('/:key', auditLog('系统配置', '删除配置'), requireAdmin, requireConfirmPassword('删除系统配置'), async (req: AuthRequest, res) => {
  try {
    const row = await SystemConfig.findOne({ where: { configKey: req.params.key } });
    if (!row) return res.status(404).json({ code: 404, message: '配置项不存在' });
    if ((row as any).builtIn) return res.status(400).json({ code: 400, message: '内置配置项不可删除' });
    await row.destroy();
    res.json({ code: 200, message: '配置项已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
