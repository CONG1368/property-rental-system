import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { Op } from 'sequelize';
import WorkOrder from '../models/WorkOrder.js';
import Property from '../models/Property.js';
import Tenant from '../models/Tenant.js';
import Facility from '../models/Facility.js';
import { getScopedPropertyIds, recordInScope } from '../services/data-scope.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

function generateTicketNo(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `WO${ymd}${rand}`;
}

// ====== 列表 ======
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = '1', pageSize = '20', status, type, priority, keyword, ticketNo } = req.query;
    const where: any = {};
    const woScope = await getScopedPropertyIds(req.userId);
    if (Array.isArray(woScope)) where.propertyId = { [Op.in]: woScope };
    if (status) where.status = status;
    if (type) where.type = type;
    if (priority) where.priority = priority;
    if (ticketNo) where.ticketNo = { [Op.like]: `%${ticketNo}%` };
    if (keyword) {
      where[Op.or] = [
        { title: { [Op.like]: `%${keyword}%` } },
        { reporter: { [Op.like]: `%${keyword}%` } },
        { phone: { [Op.like]: `%${keyword}%` } },
        { description: { [Op.like]: `%${keyword}%` } },
      ];
    }
    const { count, rows } = await WorkOrder.findAndCountAll({
      where,
      limit: Number(pageSize),
      offset: (Number(page) - 1) * Number(pageSize),
      order: [['createdAt', 'DESC']],
      include: [
        { model: Property, as: 'property', attributes: ['id', 'name'] },
        { model: Tenant, as: 'tenant', attributes: ['id', 'name'] },
      ],
      raw: false,
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 统计（固定路径，须在 /:id 之前） ======
router.get('/stats', async (_req: AuthRequest, res) => {
  try {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [total, pendingDispatch, processing, pendingAccept, finished, urgent, monthFinished] = await Promise.all([
      WorkOrder.count(),
      WorkOrder.count({ where: { status: '待派单' } }),
      WorkOrder.count({ where: { status: '处理中' } }),
      WorkOrder.count({ where: { status: '待验收' } }),
      WorkOrder.count({ where: { status: '已完工' } }),
      WorkOrder.count({ where: { priority: '紧急' } }),
      WorkOrder.count({ where: { status: '已完工', finishedAt: { [Op.like]: `${thisMonth}%` } as any } }),
    ]);
    res.json({ code: 200, data: { total, pendingDispatch, processing, pendingAccept, finished, urgent, monthFinished } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 详情 ======
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const wo = await WorkOrder.findByPk(req.params.id, {
      include: [
        { model: Property, as: 'property', attributes: ['id', 'name'] },
        { model: Tenant, as: 'tenant', attributes: ['id', 'name'] },
      ],
    });
    if (!wo) return res.status(404).json({ code: 404, message: '工单不存在' });
    if (!(await recordInScope(wo, req.userId, 'workorder'))) return res.status(403).json({ code: 403, message: '权限不足' });
    res.json({ code: 200, data: wo });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 创建 ======
router.post('/', requirePermission('workorder', 'create'), async (req: AuthRequest, res) => {
  try {
    const ticketNo = generateTicketNo();
    const wo = await WorkOrder.create({ ...req.body, ticketNo, createdBy: req.userId } as any);
    // 关联设备 → 设备设为维修中
    if ((wo as any).facilityId) { try { await Facility.update({ status: '维修中' } as any, { where: { id: (wo as any).facilityId } } as any); } catch { /* 忽略 */ } }
    res.json({ code: 200, data: wo, message: '工单已创建' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 派单 ======
router.put('/:id/assign', requirePermission('workorder', 'update'), async (req: AuthRequest, res) => {
  try {
    const wo = await WorkOrder.findByPk(req.params.id);
    if (!wo) return res.status(404).json({ code: 404, message: '工单不存在' });
    await wo.update({
      assigneeId: req.body.assigneeId ?? null,
      assigneeName: req.body.assigneeName ?? '',
      status: '已派单',
      assignedAt: new Date(),
    } as any);
    res.json({ code: 200, data: wo, message: '派单成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 状态推进（处理中 / 待验收 / 已完工） ======
router.put('/:id/advance', requirePermission('workorder', 'update'), async (req: AuthRequest, res) => {
  try {
    const wo = await WorkOrder.findByPk(req.params.id);
    if (!wo) return res.status(404).json({ code: 404, message: '工单不存在' });
    const { status, solution, cost } = req.body;
    const payload: any = { status };
    if (solution !== undefined) payload.solution = solution;
    if (cost !== undefined) payload.cost = cost;
    if (status === '已完工') payload.finishedAt = new Date();
    await wo.update(payload);
    // 关联设备完工 → 设备复原并更新维保日期
    if (status === '已完工' && (wo as any).facilityId) {
      try { await Facility.update({ status: '正常', lastMaintainDate: new Date().toISOString().slice(0, 10), nextMaintainDate: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10) } as any, { where: { id: (wo as any).facilityId } } as any); } catch { /* 忽略 */ }
    }
    res.json({ code: 200, data: wo, message: '工单状态已更新' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 评分 ======
router.put('/:id/rate', requirePermission('workorder', 'update'), async (req: AuthRequest, res) => {
  try {
    const wo = await WorkOrder.findByPk(req.params.id);
    if (!wo) return res.status(404).json({ code: 404, message: '工单不存在' });
    const payload: any = { rating: req.body.rating ?? 0 };
    if (req.body.solution !== undefined) payload.solution = req.body.solution;
    await wo.update(payload);
    res.json({ code: 200, data: wo, message: '评分已提交' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 更新 ======
router.put('/:id', requirePermission('workorder', 'update'), async (req: AuthRequest, res) => {
  try {
    const wo = await WorkOrder.findByPk(req.params.id);
    if (!wo) return res.status(404).json({ code: 404, message: '工单不存在' });
    await wo.update(req.body);
    res.json({ code: 200, data: wo, message: '工单已更新' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 删除 ======
router.delete('/:id', requirePermission('workorder', 'delete'), async (req: AuthRequest, res) => {
  try {
    const wo = await WorkOrder.findByPk(req.params.id);
    if (!wo) return res.status(404).json({ code: 404, message: '工单不存在' });
    await wo.destroy();
    res.json({ code: 200, message: '工单已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
