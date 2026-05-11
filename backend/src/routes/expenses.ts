import { Router } from 'express';
import Expense from '../models/Expense';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20, bookId, category, status } = req.query;
    const where: any = {};
    if (bookId) where.bookId = Number(bookId);
    if (category) where.category = category;
    if (status) where.status = status;
    const { count, rows } = await Expense.findAndCountAll({
      where, limit: Number(pageSize), offset: (Number(page) - 1) * Number(pageSize),
      order: [['createdAt', 'DESC']],
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const expense = await Expense.create({ ...req.body, createdBy: req.userId });
    res.json({ code: 200, data: expense, message: '费用记录创建成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.put('/:id/approve', async (req: AuthRequest, res) => {
  try {
    const expense = await Expense.findByPk(req.params.id);
    if (!expense) return res.status(404).json({ code: 404, message: '费用记录不存在' });
    await expense.update({ status: '已批准' });
    res.json({ code: 200, data: expense, message: '费用已批准' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const expense = await Expense.findByPk(req.params.id);
    if (!expense) return res.status(404).json({ code: 404, message: '费用记录不存在' });
    await expense.destroy();
    res.json({ code: 200, message: '费用记录已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
