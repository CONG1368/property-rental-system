import { Router } from 'express';
import ChartOfAccount from '../models/ChartOfAccount';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (req: AuthRequest, res) => {
  try {
    const { bookId } = req.query;
    const where: any = {};
    if (bookId) where.bookId = Number(bookId);
    const accounts = await ChartOfAccount.findAll({ where, order: [['code', 'ASC']] });
    res.json({ code: 200, data: { list: accounts } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const account = await ChartOfAccount.create(req.body);
    res.json({ code: 200, data: account, message: '科目创建成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const account = await ChartOfAccount.findByPk(req.params.id);
    if (!account) return res.status(404).json({ code: 404, message: '科目不存在' });
    await account.update(req.body);
    res.json({ code: 200, data: account, message: '科目更新成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const account = await ChartOfAccount.findByPk(req.params.id);
    if (!account) return res.status(404).json({ code: 404, message: '科目不存在' });
    await account.destroy();
    res.json({ code: 200, message: '科目已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
