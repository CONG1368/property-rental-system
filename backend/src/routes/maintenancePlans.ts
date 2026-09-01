import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { Op } from 'sequelize';
import MaintenancePlan from '../models/MaintenancePlan.js';
import Facility from '../models/Facility.js';
import FacilityMaintenance from '../models/FacilityMaintenance.js';

const router = Router();

// 在当前日期基础上推进 n 个月（返回 YYYY-MM-DD）
function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  const nd = new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
  const y = nd.getFullYear();
  const m = String(nd.getMonth() + 1).padStart(2, '0');
  const day = String(nd.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ====== 统计 ======
router.get('/stats', async (_req: AuthRequest, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const thirtyDaysLater = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const [total, enabled, stopped, dueSoon] = await Promise.all([
      MaintenancePlan.count(),
      MaintenancePlan.count({ where: { status: '启用' } }),
      MaintenancePlan.count({ where: { status: '停用' } }),
      MaintenancePlan.count({ where: { status: '启用', nextRunDate: { [Op.between]: [today, thirtyDaysLater] } as any } }),
    ]);
    res.json({ code: 200, data: { total, enabled, stopped, dueSoon } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 列表 ======
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = '1', pageSize = '20', facilityId, status } = req.query;
    const where: any = {};
    if (facilityId) where.facilityId = Number(facilityId);
    if (status) where.status = status;
    const { count, rows } = await MaintenancePlan.findAndCountAll({
      where,
      limit: Number(pageSize),
      offset: (Number(page) - 1) * Number(pageSize),
      order: [['nextRunDate', 'ASC']],
      include: [{ model: Facility, as: 'facility', attributes: ['id', 'name', 'code'] }],
      raw: false,
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 创建 ======
router.post('/', async (req: AuthRequest, res) => {
  try {
    const data: any = { ...req.body, createdBy: req.userId };
    // 未指定下次执行日期时，按周期从今天推算出首次执行日期
    if (!data.nextRunDate) {
      data.nextRunDate = addMonths(new Date().toISOString().slice(0, 10), Number(data.cycleMonths) || 1);
    }
    const plan = await MaintenancePlan.create(data as any);
    res.json({ code: 200, data: plan, message: '计划已创建' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 更新 ======
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const plan = await MaintenancePlan.findByPk(req.params.id);
    if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });
    await plan.update(req.body);
    res.json({ code: 200, data: plan, message: '计划已更新' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 删除 ======
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const plan = await MaintenancePlan.findByPk(req.params.id);
    if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });
    await plan.destroy();
    res.json({ code: 200, message: '计划已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 生成一次维保（在 facility_maintenances 建 type='保养' 记录，并推进计划周期） ======
router.post('/:id/generate', async (req: AuthRequest, res) => {
  try {
    const plan = await MaintenancePlan.findByPk(req.params.id);
    if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });
    if (!(plan as any).facilityId) return res.status(400).json({ code: 400, message: '该计划未关联设备，无法生成维保' });

    const facility = await Facility.findByPk((plan as any).facilityId);
    if (!facility) return res.status(404).json({ code: 404, message: '关联设备不存在' });

    const today = new Date().toISOString().slice(0, 10);
    const base = (plan as any).nextRunDate || today;
    const newNextRunDate = addMonths(base, Number((plan as any).cycleMonths) || 1);

    const maintenance = await FacilityMaintenance.create({
      facilityId: (plan as any).facilityId,
      type: '保养',
      date: today,
      performer: (plan as any).assignee || '',
      content: (plan as any).content || '',
      result: '正常',
      cost: 0,
      nextDate: newNextRunDate,
      notes: '',
    } as any);

    await facility.update({ lastMaintainDate: today, nextMaintainDate: newNextRunDate } as any);
    await plan.update({ nextRunDate: newNextRunDate } as any);

    res.json({ code: 200, data: maintenance, message: '维保已生成' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
