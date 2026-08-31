import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { Op, fn, col } from 'sequelize';
import PropertyTask from '../models/PropertyTask.js';

const router = Router();

// ====== 统计（类型/状态/质检结果） ======
router.get('/stats', async (_req: AuthRequest, res) => {
  try {
    const [total, byStatus, byType, byResult] = await Promise.all([
      PropertyTask.count(),
      PropertyTask.findAll({ attributes: ['status', [fn('COUNT', col('id')), 'count']], group: ['status'], raw: true }),
      PropertyTask.findAll({ attributes: ['type', [fn('COUNT', col('id')), 'count']], group: ['type'], raw: true }),
      PropertyTask.findAll({ attributes: ['result', [fn('COUNT', col('id')), 'count']], group: ['result'], raw: true }),
    ]);
    res.json({
      code: 200,
      data: {
        total,
        byStatus: byStatus.map((s: any) => ({ status: s.status, count: Number(s.count) })),
        byType: byType.map((s: any) => ({ type: s.type, count: Number(s.count) })),
        byResult: byResult.map((s: any) => ({ result: s.result, count: Number(s.count) })),
      },
    });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 列表 ======
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = '1', pageSize = '20', type, status, assignee, keyword } = req.query;
    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (assignee) where.assignee = assignee;
    if (keyword) {
      const kw = '%' + String(keyword) + '%';
      where[Op.or] = [
        { area: { [Op.like]: kw } },
        { assignee: { [Op.like]: kw } },
        { inspector: { [Op.like]: kw } },
        { remark: { [Op.like]: kw } },
      ];
    }
    const { count, rows } = await PropertyTask.findAndCountAll({
      where,
      limit: Number(pageSize),
      offset: (Number(page) - 1) * Number(pageSize),
      order: [['scheduleDate', 'DESC'], ['id', 'DESC']],
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 创建 ======
router.post('/', async (req: AuthRequest, res) => {
  try {
    const task = await PropertyTask.create({ ...req.body, createdBy: req.userId ?? null } as any);
    res.json({ code: 200, data: task, message: '任务已创建' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 更新 ======
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const task = await PropertyTask.findByPk(req.params.id);
    if (!task) return res.status(404).json({ code: 404, message: '任务不存在' });
    await task.update(req.body as any);
    res.json({ code: 200, data: task, message: '任务已更新' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 质检完成 ======
router.post('/:id/complete', async (req: AuthRequest, res) => {
  try {
    const task = await PropertyTask.findByPk(req.params.id);
    if (!task) return res.status(404).json({ code: 404, message: '任务不存在' });
    const { result, qualityScore, inspector } = req.body;
    await task.update({
      result: result ?? '合格',
      qualityScore: qualityScore ?? 0,
      inspector: inspector ?? '',
      status: '已完成',
    } as any);
    res.json({ code: 200, data: task, message: '质检已完成' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 删除 ======
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const task = await PropertyTask.findByPk(req.params.id);
    if (!task) return res.status(404).json({ code: 404, message: '任务不存在' });
    await task.destroy();
    res.json({ code: 200, message: '任务已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
