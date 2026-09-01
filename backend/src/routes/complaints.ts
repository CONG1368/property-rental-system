import { Router } from 'express';
import Complaint from '../models/Complaint.js';
import Property from '../models/Property.js';
import Tenant from '../models/Tenant.js';
import { AuthRequest } from '../middleware/auth.js';
import { Op } from 'sequelize';

const router = Router();

router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20, status, type, keyword } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (keyword) where[Op.or] = [{ title: { [Op.like]: `%${keyword}%` } }, { reporter: { [Op.like]: `%${keyword}%` } }];
    const { count, rows } = await Complaint.findAndCountAll({
      where, limit: Number(pageSize), offset: (Number(page) - 1) * Number(pageSize),
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

router.get('/stats', async (_req: AuthRequest, res) => {
  try {
    const [total, pending, processing, resolved, closed] = await Promise.all([
      Complaint.count(),
      Complaint.count({ where: { status: '待受理' } }),
      Complaint.count({ where: { status: '处理中' } }),
      Complaint.count({ where: { status: '已解决' } }),
      Complaint.count({ where: { status: '已关闭' } }),
    ]);
    res.json({ code: 200, data: { total, pending, processing, resolved, closed } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const c = await Complaint.findByPk(req.params.id, {
      include: [{ model: Property, as: 'property', attributes: ['id', 'name'] }, { model: Tenant, as: 'tenant', attributes: ['id', 'name'] }],
    });
    if (!c) return res.status(404).json({ code: 404, message: '投诉单不存在' });
    res.json({ code: 200, data: c });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/', async (req: AuthRequest, res) => {
  try { const c = await Complaint.create(req.body as any); res.json({ code: 200, data: c, message: '投诉已提交' }); }
  catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// 处理/回复
router.put('/:id/respond', async (req: AuthRequest, res) => {
  try {
    const c = await Complaint.findByPk(req.params.id);
    if (!c) return res.status(404).json({ code: 404, message: '投诉单不存在' });
    await c.update({ status: '已回复', response: req.body.response || '', responseAt: new Date(), assignee: req.body.assignee || c.assignee } as any);
    res.json({ code: 200, data: c, message: '已回复' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.put('/:id/status', async (req: AuthRequest, res) => {
  try {
    const c = await Complaint.findByPk(req.params.id);
    if (!c) return res.status(404).json({ code: 404, message: '投诉单不存在' });
    await c.update({ status: req.body.status, satisfaction: req.body.satisfaction ?? c.satisfaction } as any);
    res.json({ code: 200, data: c, message: '状态已更新' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try { const c = await Complaint.findByPk(req.params.id); if (!c) return res.status(404).json({ code: 404, message: '投诉单不存在' }); await c.destroy(); res.json({ code: 200, message: '已删除' }); }
  catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
