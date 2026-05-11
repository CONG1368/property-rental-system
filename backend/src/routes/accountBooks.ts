import { Router } from 'express';
import AccountBook from '../models/AccountBook';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (req: AuthRequest, res) => {
  try {
    const books = await AccountBook.findAll({ order: [['createdAt', 'DESC']] });
    res.json({ code: 200, data: { list: books } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const book = await AccountBook.create(req.body);
    res.json({ code: 200, data: book, message: '账套创建成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const book = await AccountBook.findByPk(req.params.id);
    if (!book) return res.status(404).json({ code: 404, message: '账套不存在' });
    res.json({ code: 200, data: book });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const book = await AccountBook.findByPk(req.params.id);
    if (!book) return res.status(404).json({ code: 404, message: '账套不存在' });
    await book.update(req.body);
    res.json({ code: 200, data: book, message: '账套更新成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
