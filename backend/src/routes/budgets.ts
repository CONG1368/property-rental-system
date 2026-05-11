import { Router } from 'express';
import Budget from '../models/Budget';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (req: AuthRequest, res) => {
  try {
    const { bookId, year } = req.query;
    const where: any = {};
    if (bookId) where.bookId = Number(bookId);
    if (year) where.year = Number(year);
    const budgets = await Budget.findAll({ where, order: [['year', 'DESC'], ['month', 'ASC']] });
    res.json({ code: 200, data: { list: budgets } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const budget = await Budget.create({ ...req.body, createdBy: req.userId });
    res.json({ code: 200, data: budget, message: '预算创建成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const budget = await Budget.findByPk(req.params.id);
    if (!budget) return res.status(404).json({ code: 404, message: '预算不存在' });
    await budget.update(req.body);
    res.json({ code: 200, data: budget, message: '预算更新成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.get('/execution', async (req: AuthRequest, res) => {
  try {
    const { bookId, year } = req.query;
    const where: any = {};
    if (bookId) where.bookId = Number(bookId);
    if (year) where.year = Number(year);
    const budgets = await Budget.findAll({ where });
    res.json({ code: 200, data: { list: budgets } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
