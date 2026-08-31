import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { Op } from 'sequelize';
import CommonRevenue from '../models/CommonRevenue.js';
import Property from '../models/Property.js';

const router = Router();

// GET / — 列表（类型/状态/关键字过滤 + 分页，按收益日期倒序）
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = '1', pageSize = '20', type, status, keyword } = req.query;
    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (keyword) {
      where[Op.or] = [
        { item: { [Op.like]: `%${keyword}%` } },
        { payer: { [Op.like]: `%${keyword}%` } },
      ];
    }
    const { count, rows } = await CommonRevenue.findAndCountAll({
      where,
      limit: Number(pageSize),
      offset: (Number(page) - 1) * Number(pageSize),
      order: [['revenueDate', 'DESC']],
      include: [{ model: Property, as: 'property', attributes: ['id', 'name'] }],
      raw: false,
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// GET /stats — 统计（总收益/应收/已入账）
router.get('/stats', async (_req: AuthRequest, res) => {
  try {
    const [totalAmount, receivableAmount, receivedAmount] = await Promise.all([
      CommonRevenue.sum('amount'),
      CommonRevenue.sum('amount', { where: { status: '应收' } }),
      CommonRevenue.sum('amount', { where: { status: '已入账' } }),
    ]);
    res.json({ code: 200, data: {
      totalAmount: Number(totalAmount || 0),
      receivableAmount: Number(receivableAmount || 0),
      receivedAmount: Number(receivedAmount || 0),
    } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// POST / — 创建
router.post('/', async (req: AuthRequest, res) => {
  try {
    const rec = await CommonRevenue.create(req.body as any);
    res.json({ code: 200, data: rec, message: '收益记录已创建' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// PUT /:id/confirm — 入账（固定子路径，须在 /:id 之前）
router.put('/:id/confirm', async (req: AuthRequest, res) => {
  try {
    const rec = await CommonRevenue.findByPk(req.params.id);
    if (!rec) return res.status(404).json({ code: 404, message: '收益记录不存在' });
    await rec.update({ status: '已入账', accountId: req.body.accountId ?? null } as any);
    res.json({ code: 200, data: rec, message: '已入账' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// PUT /:id — 更新
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const rec = await CommonRevenue.findByPk(req.params.id);
    if (!rec) return res.status(404).json({ code: 404, message: '收益记录不存在' });
    await rec.update(req.body);
    res.json({ code: 200, data: rec, message: '收益记录已更新' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// DELETE /:id
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const rec = await CommonRevenue.findByPk(req.params.id);
    if (!rec) return res.status(404).json({ code: 404, message: '收益记录不存在' });
    await rec.destroy();
    res.json({ code: 200, message: '收益记录已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
