import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { Op, fn, col } from 'sequelize';
import Decoration from '../models/Decoration.js';
import Property from '../models/Property.js';
import Tenant from '../models/Tenant.js';

const router = Router();

// ====== 统计 ======
router.get('/stats', async (_req: AuthRequest, res) => {
  try {
    const [total, byStatus] = await Promise.all([
      Decoration.count(),
      Decoration.findAll({ attributes: ['status', [fn('COUNT', col('id')), 'count']], group: ['status'], raw: true }),
    ]);
    res.json({ code: 200, data: { total, byStatus: byStatus.map((s: any) => ({ status: s.status, count: Number(s.count) })) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 列表 ======
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = '1', pageSize = '20', status } = req.query;
    const where: any = {};
    if (status) {
      const arr = String(status).split(',').filter(Boolean);
      where.status = arr.length > 1 ? { [Op.in]: arr } : arr[0];
    }
    const { count, rows } = await Decoration.findAndCountAll({
      where, limit: Number(pageSize), offset: (Number(page) - 1) * Number(pageSize),
      order: [['applyDate', 'DESC']],
      include: [
        { model: Property, as: 'property', attributes: ['id', 'name'] },
        { model: Tenant, as: 'tenant', attributes: ['id', 'name'] },
      ],
      raw: false,
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 创建 ======
router.post('/', async (req: AuthRequest, res) => {
  try {
    const d = await Decoration.create({ ...req.body, status: '待审批', createdBy: req.userId } as any);
    res.json({ code: 200, data: d, message: '装修申请已创建' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 更新 ======
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const d = await Decoration.findByPk(req.params.id);
    if (!d) return res.status(404).json({ code: 404, message: '装修申请不存在' });
    await d.update(req.body);
    res.json({ code: 200, data: d, message: '装修申请已更新' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 审批 ======
router.post('/:id/approve', async (req: AuthRequest, res) => {
  try {
    const d = await Decoration.findByPk(req.params.id);
    if (!d) return res.status(404).json({ code: 404, message: '装修申请不存在' });
    await d.update({ ...req.body, status: '已批准' } as any);
    res.json({ code: 200, data: d, message: '审批已通过' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/:id/reject', async (req: AuthRequest, res) => {
  try {
    const d = await Decoration.findByPk(req.params.id);
    if (!d) return res.status(404).json({ code: 404, message: '装修申请不存在' });
    await d.update({ ...req.body, status: '已驳回' } as any);
    res.json({ code: 200, data: d, message: '审批已驳回' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 开工 ======
router.post('/:id/start', async (req: AuthRequest, res) => {
  try {
    const d = await Decoration.findByPk(req.params.id);
    if (!d) return res.status(404).json({ code: 404, message: '装修申请不存在' });
    const today = new Date().toISOString().slice(0, 10);
    await d.update({ ...req.body, status: '施工中', startDate: req.body.startDate || (d as any).startDate || today } as any);
    res.json({ code: 200, data: d, message: '已开工' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 完工 ======
router.post('/:id/finish', async (req: AuthRequest, res) => {
  try {
    const d = await Decoration.findByPk(req.params.id);
    if (!d) return res.status(404).json({ code: 404, message: '装修申请不存在' });
    const today = new Date().toISOString().slice(0, 10);
    await d.update({ ...req.body, status: '已完工', endDate: req.body.endDate || (d as any).endDate || today } as any);
    res.json({ code: 200, data: d, message: '已完工' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 验收 ======
router.post('/:id/accept', async (req: AuthRequest, res) => {
  try {
    const d = await Decoration.findByPk(req.params.id);
    if (!d) return res.status(404).json({ code: 404, message: '装修申请不存在' });
    await d.update({ ...req.body, status: '已验收' } as any);
    res.json({ code: 200, data: d, message: '已验收' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 删除 ======
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const d = await Decoration.findByPk(req.params.id);
    if (!d) return res.status(404).json({ code: 404, message: '装修申请不存在' });
    await d.destroy();
    res.json({ code: 200, message: '装修申请已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
