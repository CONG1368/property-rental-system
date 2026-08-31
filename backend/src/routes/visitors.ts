import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { Op } from 'sequelize';
import Visitor from '../models/Visitor.js';

function todayStr(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const router = Router();

// ====== 访客统计 ======
router.get('/stats', async (_req: AuthRequest, res) => {
  try {
    const today = todayStr();
    const [total, inVisit, todayCount] = await Promise.all([
      Visitor.count(),
      Visitor.count({ where: { status: '在访' } }),
      Visitor.count({ where: { visitTime: today } }),
    ]);
    res.json({ code: 200, data: { total, inVisit, today: todayCount } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 访客列表 ======
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = '1', pageSize = '20', status, name } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (name) where.name = { [Op.like]: '%' + name + '%' };
    const { count, rows } = await Visitor.findAndCountAll({
      where, limit: Number(pageSize), offset: (Number(page) - 1) * Number(pageSize),
      order: [['visitTime', 'DESC'], ['createdAt', 'DESC']],
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 新增访客 ======
router.post('/', async (req: AuthRequest, res) => {
  try {
    const visitor = await Visitor.create(req.body as any);
    res.json({ code: 200, data: visitor, message: '访客登记成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 访客离开登记 ======
router.put('/:id/leave', async (req: AuthRequest, res) => {
  try {
    const visitor = await Visitor.findByPk(req.params.id);
    if (!visitor) return res.status(404).json({ code: 404, message: '访客记录不存在' });
    await visitor.update({ status: '已离开', leaveTime: todayStr() } as any);
    res.json({ code: 200, data: visitor, message: '访客已登记离开' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 更新访客 ======
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const visitor = await Visitor.findByPk(req.params.id);
    if (!visitor) return res.status(404).json({ code: 404, message: '访客记录不存在' });
    await visitor.update(req.body);
    res.json({ code: 200, data: visitor, message: '访客已更新' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 删除访客 ======
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const visitor = await Visitor.findByPk(req.params.id);
    if (!visitor) return res.status(404).json({ code: 404, message: '访客记录不存在' });
    await visitor.destroy();
    res.json({ code: 200, message: '访客记录已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
