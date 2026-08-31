import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { Op } from 'sequelize';
import Vendor from '../models/Vendor.js';

const router = Router();

// ====== 统计（固定路径，必须放在 /:id 之前） ======
router.get('/stats', async (_req: AuthRequest, res) => {
  try {
    const [total, cooperating, paused, terminated] = await Promise.all([
      Vendor.count(),
      Vendor.count({ where: { status: '合作中' } }),
      Vendor.count({ where: { status: '已暂停' } }),
      Vendor.count({ where: { status: '已终止' } }),
    ]);
    res.json({ code: 200, data: { total, cooperating, paused, terminated } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 列表 ======
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = '1', pageSize = '20', keyword, category, status } = req.query;
    const where: any = {};
    if (keyword) {
      const kw = '%' + keyword + '%';
      where[Op.or] = [
        { name: { [Op.like]: kw } },
        { contact: { [Op.like]: kw } },
        { phone: { [Op.like]: kw } },
        { contractNo: { [Op.like]: kw } },
      ];
    }
    if (category) where.category = category;
    if (status) where.status = status;
    const { count, rows } = await Vendor.findAndCountAll({
      where, limit: Number(pageSize), offset: (Number(page) - 1) * Number(pageSize),
      order: [['createdAt', 'DESC']],
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 详情 ======
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const v = await Vendor.findByPk(req.params.id);
    if (!v) return res.status(404).json({ code: 404, message: '供应商不存在' });
    res.json({ code: 200, data: v });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 创建 ======
router.post('/', async (req: AuthRequest, res) => {
  try {
    const v = await Vendor.create(req.body as any);
    res.json({ code: 200, data: v, message: '供应商已创建' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 更新 ======
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const v = await Vendor.findByPk(req.params.id);
    if (!v) return res.status(404).json({ code: 404, message: '供应商不存在' });
    await v.update(req.body);
    res.json({ code: 200, data: v, message: '供应商已更新' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 删除 ======
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const v = await Vendor.findByPk(req.params.id);
    if (!v) return res.status(404).json({ code: 404, message: '供应商不存在' });
    await v.destroy();
    res.json({ code: 200, message: '供应商已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
