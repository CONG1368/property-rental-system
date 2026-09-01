import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { auditLog } from '../middleware/audit-log.js';
import Property from '../models/Property.js';
import { Op } from 'sequelize';
import { allocateCost } from '../services/cost-allocator.js';

const router = Router();

// GET /api/cost-allocation/properties — 可分摊的房源列表（出租中）
router.get('/properties', requirePermission('finance', 'read'), async (req: AuthRequest, res) => {
  try {
    const rows = await Property.findAll({ where: { status: { [Op.in]: ['已出租', '退租中'] } }, attributes: ['id', 'name', 'area', 'status'] });
    res.json({ code: 200, data: { list: rows } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// POST /api/cost-allocation/allocate — 计算分摊
router.post('/allocate', requirePermission('finance', 'create'), auditLog('成本分摊', '执行分摊'), async (req: AuthRequest, res) => {
  try {
    const totalCost = Number(req.body.totalCost || 0);
    const rule = (req.body.rule || 'area') as 'area' | 'equal' | 'custom';
    const propertyIds = Array.isArray(req.body.propertyIds) ? req.body.propertyIds.map(Number) : undefined;
    if (!Number.isFinite(totalCost) || totalCost <= 0) return res.status(400).json({ code: 400, message: '分摊总额必须是大于 0 的有效数字' });
    if (!['area', 'equal', 'custom'].includes(rule)) return res.status(400).json({ code: 400, message: '无效的分摊规则' });
    const result = await allocateCost(totalCost, rule, propertyIds);
    res.json({ code: 200, data: { totalCost, rule, items: result }, message: '分摊计算完成' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
