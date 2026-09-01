import { Router } from 'express';
import AccountBook from '../models/AccountBook.js';
import { AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { requireConfirmPassword } from '../middleware/confirm-password.js';
import { auditLog } from '../middleware/audit-log.js';

const router = Router();

router.get('/', requirePermission('finance', 'read'), async (req: AuthRequest, res) => {
  try {
    const books = await AccountBook.findAll({ order: [['createdAt', 'DESC']] });
    res.json({ code: 200, data: { list: books } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

const BOOK_FIELDS = ['name', 'code', 'currency', 'description'];
const pick = (body: any) => { const o: any = {}; BOOK_FIELDS.forEach((k) => { if (body?.[k] !== undefined) o[k] = body[k]; }); return o; };
router.post('/', requirePermission('finance', 'create'), auditLog('账套', '新建'), async (req: AuthRequest, res) => {
  try {
    const book = await AccountBook.create({ ...pick(req.body), createdBy: req.userId ?? null } as any);
    res.json({ code: 200, data: book, message: '账套创建成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.get('/:id', requirePermission('finance', 'read'), async (req: AuthRequest, res) => {
  try {
    const book = await AccountBook.findByPk(req.params.id);
    if (!book) return res.status(404).json({ code: 404, message: '账套不存在' });
    res.json({ code: 200, data: book });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.put('/:id', requirePermission('finance', 'update'), requireConfirmPassword('修改账套'), auditLog('账套', '修改'), async (req: AuthRequest, res) => {
  try {
    const book = await AccountBook.findByPk(req.params.id);
    if (!book) return res.status(404).json({ code: 404, message: '账套不存在' });
    await book.update(pick(req.body));
    res.json({ code: 200, data: book, message: '账套更新成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
