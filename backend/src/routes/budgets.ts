import { Router } from 'express';
import Budget from '../models/Budget.js';
import AccountBook from '../models/AccountBook.js';
import ChartOfAccount from '../models/ChartOfAccount.js';
import { AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { auditLog } from '../middleware/audit-log.js';
import { submitApproval } from '../services/approval-bridge.js';

const router = Router();

router.get('/', requirePermission('finance', 'read'), async (req: AuthRequest, res) => {
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

router.post('/', requirePermission('finance', 'create'), auditLog('预算', '新建'), async (req: AuthRequest, res) => {
  try {
    const budget = await Budget.create({ ...req.body, createdBy: req.userId });
    // 桥接通用审批引擎(bizType=预算)
    try { await submitApproval({ bizType: '预算', bizId: (budget as any).id, bizNo: `预算-${(budget as any).id}`, title: `预算审批：${(budget as any).id}`, applicantName: (req as any).username || '', amount: Number((budget as any).budgetAmount || 0) }, req.userId); } catch { /* 忽略 */ }
    res.json({ code: 200, data: budget, message: '预算创建成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.get('/execution', requirePermission('finance', 'read'), async (req: AuthRequest, res) => {
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

router.get('/:id', requirePermission('finance', 'read'), async (req: AuthRequest, res) => {
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

// 可更新字段白名单：budgetAmount/notes 仅编制中/待审核可改；status 由审批引擎联动，禁止直接写入
const BUDGET_UPDATABLE = ['budgetAmount', 'notes'];
router.put('/:id', requirePermission('finance', 'update'), auditLog('预算', '修改'), async (req: AuthRequest, res) => {
  try {
    const budget = await Budget.findByPk(req.params.id);
    if (!budget) return res.status(404).json({ code: 404, message: '预算不存在' });
    const status = budget.get('status') as string;
    // 已批准预算禁止直接改金额；编制中/待审核可更新
    if (status === '已批准' && (req.body.budgetAmount !== undefined)) {
      return res.status(400).json({ code: 400, message: '已批准预算不能直接修改金额，请走预算调整审批' });
    }
    const upd: any = {};
    BUDGET_UPDATABLE.forEach((k) => { if (req.body[k] !== undefined) upd[k] = req.body[k]; });
    await budget.update(upd);
    res.json({ code: 200, data: budget, message: '预算更新成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.delete('/:id', requirePermission('finance', 'delete'), auditLog('预算', '删除'), async (req: AuthRequest, res) => {
  try {
    const budget = await Budget.findByPk(req.params.id);
    if (!budget) return res.status(404).json({ code: 404, message: '预算不存在' });
    await budget.destroy();
    res.json({ code: 200, message: '预算已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
