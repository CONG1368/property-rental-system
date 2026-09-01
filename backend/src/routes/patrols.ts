import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { Op } from 'sequelize';
import PatrolRecord from '../models/PatrolRecord.js';

function todayStr(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const router = Router();

// ====== 巡更统计 ======
router.get('/stats', async (_req: AuthRequest, res) => {
  try {
    const today = todayStr();
    const [total, todayCount, abnormal, todayAbnormal] = await Promise.all([
      PatrolRecord.count(),
      PatrolRecord.count({ where: { patrolDate: today } }),
      PatrolRecord.count({ where: { status: '异常' } }),
      PatrolRecord.count({ where: { patrolDate: today, status: '异常' } }),
    ]);
    res.json({ code: 200, data: { total, today: todayCount, abnormal, todayAbnormal } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 巡更记录列表 ======
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = '1', pageSize = '20', patrolDate, status, startDate, endDate } = req.query;
    const where: any = {};
    if (patrolDate) where.patrolDate = patrolDate as string;
    if (startDate && endDate) where.patrolDate = { [Op.between]: [startDate as string, endDate as string] };
    if (status) where.status = status;
    const { count, rows } = await PatrolRecord.findAndCountAll({
      where, limit: Number(pageSize), offset: (Number(page) - 1) * Number(pageSize),
      order: [['patrolDate', 'DESC'], ['patrolTime', 'DESC']],
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 新增巡更记录 ======
router.post('/', async (req: AuthRequest, res) => {
  try {
    const record = await PatrolRecord.create(req.body as any);
    res.json({ code: 200, data: record, message: '巡更记录已创建' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 更新巡更记录 ======
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const record = await PatrolRecord.findByPk(req.params.id);
    if (!record) return res.status(404).json({ code: 404, message: '巡更记录不存在' });
    await record.update(req.body);
    res.json({ code: 200, data: record, message: '巡更记录已更新' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 删除巡更记录 ======
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const record = await PatrolRecord.findByPk(req.params.id);
    if (!record) return res.status(404).json({ code: 404, message: '巡更记录不存在' });
    await record.destroy();
    res.json({ code: 200, message: '巡更记录已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
