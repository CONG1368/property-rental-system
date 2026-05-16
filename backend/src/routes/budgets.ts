import { Router } from 'express';
import Budget from '../models/Budget.js';
import AccountBook from '../models/AccountBook.js';
import ChartOfAccount from '../models/ChartOfAccount.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20, bookId, year } = req.query;
    const where: any = {};
    if (bookId) where.bookId = Number(bookId);
    if (year) where.year = Number(year);
    const { count, rows } = await Budget.findAndCountAll({
      where,
      include: [
        { model: AccountBook, as: 'book', attributes: ['id', 'name'] },
        { model: ChartOfAccount, as: 'account', attributes: ['id', 'code', 'name'] },
      ],
      limit: Number(pageSize),
      offset: (Number(page) - 1) * Number(pageSize),
      order: [['year', 'DESC'], ['month', 'ASC']],
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const budget = await Budget.create({ ...req.body, createdBy: req.userId });
    res.json({ code: 200, data: budget, message: '预算创建成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.get('/execution', async (req: AuthRequest, res) => {
  try {
    const { bookId, year } = req.query;
    const where: any = {};
    if (bookId) where.bookId = Number(bookId);
    if (year) where.year = Number(year);
    const budgets = await Budget.findAll({
      where,
      include: [
        { model: AccountBook, as: 'book', attributes: ['id', 'name'] },
        { model: ChartOfAccount, as: 'account', attributes: ['id', 'code', 'name'] },
      ],
    });
    res.json({ code: 200, data: { list: budgets } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const budget = await Budget.findByPk(req.params.id, {
      include: [
        { model: AccountBook, as: 'book', attributes: ['id', 'name'] },
        { model: ChartOfAccount, as: 'account', attributes: ['id', 'code', 'name'] },
      ],
    });
    if (!budget) return res.status(404).json({ code: 404, message: '预算不存在' });
    res.json({ code: 200, data: budget });
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

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const budget = await Budget.findByPk(req.params.id);
    if (!budget) return res.status(404).json({ code: 404, message: '预算不存在' });
    await budget.destroy();
    res.json({ code: 200, message: '预算已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
