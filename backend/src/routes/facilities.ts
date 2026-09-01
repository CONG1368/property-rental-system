import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { Op, fn, col } from 'sequelize';
import Facility from '../models/Facility.js';
import FacilityMaintenance from '../models/FacilityMaintenance.js';
import Property from '../models/Property.js';

const router = Router();

// ====== 统计 ======
router.get('/stats', async (_req: AuthRequest, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const thirtyDaysLater = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const [total, byStatus, expiringSoon] = await Promise.all([
      Facility.count(),
      Facility.findAll({ attributes: ['status', [fn('COUNT', col('id')), 'count']], group: ['status'], raw: true }),
      Facility.count({ where: { nextMaintainDate: { [Op.between]: [today, thirtyDaysLater] } as any } }),
    ]);
    const statusMap: Record<string, number> = {};
    byStatus.forEach((s: any) => { statusMap[s.status] = Number(s.count); });
    res.json({ code: 200, data: {
      total,
      normal: statusMap['正常'] || 0,
      maintaining: statusMap['保养中'] || 0,
      repairing: statusMap['维修中'] || 0,
      stopped: statusMap['停用'] || 0,
      fault: statusMap['故障'] || 0,
      expiringSoon,
    } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 列表 ======
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = '1', pageSize = '20', status, category, keyword } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (category) where.category = category;
    if (keyword) where[Op.or] = [{ name: { [Op.like]: '%' + keyword + '%' } }, { code: { [Op.like]: '%' + keyword + '%' } }];
    const { count, rows } = await Facility.findAndCountAll({
      where, limit: Number(pageSize), offset: (Number(page) - 1) * Number(pageSize),
      order: [['createdAt', 'DESC']],
      include: [{ model: Property, as: 'property', attributes: ['id', 'name'] }],
      raw: false,
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 详情（含维护记录） ======
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const facility = await Facility.findByPk(req.params.id, {
      include: [
        { model: Property, as: 'property', attributes: ['id', 'name'] },
        { model: FacilityMaintenance, as: 'maintenances' },
      ],
    });
    if (!facility) return res.status(404).json({ code: 404, message: '设备不存在' });
    res.json({ code: 200, data: facility });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 创建 ======
router.post('/', async (req: AuthRequest, res) => {
  try {
    const facility = await Facility.create(req.body as any);
    res.json({ code: 200, data: facility, message: '设备已创建' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 更新 ======
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const facility = await Facility.findByPk(req.params.id);
    if (!facility) return res.status(404).json({ code: 404, message: '设备不存在' });
    await facility.update(req.body);
    res.json({ code: 200, data: facility, message: '设备已更新' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 删除 ======
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const facility = await Facility.findByPk(req.params.id);
    if (!facility) return res.status(404).json({ code: 404, message: '设备不存在' });
    await facility.destroy();
    res.json({ code: 200, message: '设备已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 维护登记（创建维护记录并回写设备维保信息） ======
router.post('/:id/maintain', async (req: AuthRequest, res) => {
  try {
    const facility = await Facility.findByPk(req.params.id);
    if (!facility) return res.status(404).json({ code: 404, message: '设备不存在' });
    const { type, date, performer, content, result, cost, nextDate, notes } = req.body;
    const maintainDate = date || new Date().toISOString().slice(0, 10);
    const maintenance = await FacilityMaintenance.create({
      facilityId: (facility as any).id,
      type: type || '巡检',
      date: maintainDate,
      performer: performer || '',
      content: content || '',
      result: result || '正常',
      cost: cost ?? 0,
      nextDate: nextDate || null,
      notes: notes || '',
    } as any);
    const newStatus = (result !== '正常' && type === '维修') ? '维修中' : '正常';
    await facility.update({
      lastMaintainDate: maintainDate,
      nextMaintainDate: nextDate || (facility as any).nextMaintainDate,
      status: newStatus,
    } as any);
    res.json({ code: 200, data: maintenance, message: '维护记录已登记' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
